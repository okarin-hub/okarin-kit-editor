import { finalizeMask, ConvertedZone, newCanvas, PNG_PSD_MARK } from '@/utils/psdImport';
import { analyzeColors, ColorAnalysis } from '@/utils/colorClusters';
import { PES_2021_PARTS } from '@/constants/pes2021Parts';

/**
 * PNG -> template conversion (runs in the browser). A flat PNG has no layers, so there are two ways
 * to get zones out of one:
 *  1. several PNG files, one per layer (each file becomes a zone);
 *  2. one PNG whose regions have different colours (a colour map, or a finished design): the colours
 *     are grouped into clusters and every cluster (optionally every connected piece) becomes a zone.
 */

const SIZE = 1024;

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Tidak bisa membuka ${file.name}`));
    };
    img.src = url;
  });
}

/** How a non-square image goes into the square 1024 texture. */
export type ImageFit = 'stretch' | 'fit' | 'crop';

/**
 * Draws an image into 1024x1024 and returns its pixels: stretched, fitted whole (the rest stays transparent)
 * or cropped (fills the square, the middle is kept).
 */
export function imageToData(
  img: HTMLImageElement,
  fit: ImageFit = 'stretch',
  size = SIZE
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; data: ImageData } {
  const SIZE = size;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (fit === 'stretch' || iw === ih) {
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
  } else {
    const k = (fit === 'fit' ? Math.min : Math.max)(SIZE / iw, SIZE / ih);
    const w = iw * k, h = ih * k;
    ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
  }
  return { canvas, ctx, data: ctx.getImageData(0, 0, SIZE, SIZE) };
}

export async function loadPngFile(file: File, fit: ImageFit = 'stretch') {
  const img = await fileToImage(file);
  return { img, width: img.naturalWidth, height: img.naturalHeight, ...imageToData(img, fit) };
}

// ---------------------------------------------------------------------------------------------
// Mode 1: one PNG per layer
// ---------------------------------------------------------------------------------------------

/**
 * Makes the alpha channel of a flat image usable as a mask: images that already have transparency
 * keep it; opaque images use the difference to the background colour (taken from the corners).
 */
function ensureAlpha(data: ImageData): void {
  const d = data.data;
  let hasAlpha = false;
  for (let i = 3; i < d.length; i += 4 * 17) {
    if (d[i] < 250) {
      hasAlpha = true;
      break;
    }
  }
  if (hasAlpha) return;

  const corner = (x: number, y: number) => {
    const i = (y * SIZE + x) * 4;
    return [d[i], d[i + 1], d[i + 2]];
  };
  const cs = [corner(0, 0), corner(SIZE - 1, 0), corner(0, SIZE - 1), corner(SIZE - 1, SIZE - 1)];
  // the most common corner colour is the background
  let bg = cs[0];
  let best = 0;
  cs.forEach((c) => {
    const n = cs.filter((o) => Math.abs(o[0] - c[0]) + Math.abs(o[1] - c[1]) + Math.abs(o[2] - c[2]) < 24).length;
    if (n > best) {
      best = n;
      bg = c;
    }
  });
  for (let i = 0; i < d.length; i += 4) {
    const diff = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]);
    d[i + 3] = diff < 36 ? 0 : 255;
  }
}

export interface PngLayerInput {
  name: string;
  file: File;
}

export async function convertPngFile(
  input: PngLayerInput,
  index: number,
  mode: 'auto' | 'tint' | 'keep',
  fit: ImageFit = 'stretch'
): Promise<ConvertedZone | null> {
  const { canvas, ctx, data } = await loadPngFile(input.file, fit);
  ensureAlpha(data);
  return finalizeMask(canvas, ctx, data, { name: input.name, mode }, index);
}

// ---------------------------------------------------------------------------------------------
// Mode 2: split one PNG by colour
// ---------------------------------------------------------------------------------------------

// The clustering itself lives in colorClusters.ts (pure, no DOM); re-exported for the importer UI
export { analyzeColors } from '@/utils/colorClusters';
export type { ColorCluster, ColorAnalysis } from '@/utils/colorClusters';

/** Pixel masks (1 = in the piece) for the connected components of a cluster. */
export function splitComponents(labels: Uint16Array, cluster: number, minArea: number): Uint8Array[] {
  const visited = new Uint8Array(SIZE * SIZE);
  const out: Uint8Array[] = [];
  const stack: number[] = [];
  for (let start = 0; start < SIZE * SIZE; start++) {
    if (visited[start] || labels[start] !== cluster) continue;
    const mask = new Uint8Array(SIZE * SIZE);
    let area = 0;
    stack.push(start);
    visited[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      mask[p] = 1;
      area++;
      const x = p % SIZE;
      const y = (p / SIZE) | 0;
      if (x > 0 && !visited[p - 1] && labels[p - 1] === cluster) { visited[p - 1] = 1; stack.push(p - 1); }
      if (x < SIZE - 1 && !visited[p + 1] && labels[p + 1] === cluster) { visited[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && !visited[p - SIZE] && labels[p - SIZE] === cluster) { visited[p - SIZE] = 1; stack.push(p - SIZE); }
      if (y < SIZE - 1 && !visited[p + SIZE] && labels[p + SIZE] === cluster) { visited[p + SIZE] = 1; stack.push(p + SIZE); }
    }
    if (area >= minArea) out.push(mask);
  }
  return out;
}

/** Closes tiny holes / gaps (anti-aliasing lines between regions) by growing the mask 1px. */
function dilate(mask: Uint8Array): Uint8Array {
  const out = new Uint8Array(mask);
  for (let y = 1; y < SIZE - 1; y++) {
    for (let x = 1; x < SIZE - 1; x++) {
      const p = y * SIZE + x;
      if (mask[p]) continue;
      if (mask[p - 1] || mask[p + 1] || mask[p - SIZE] || mask[p + SIZE]) out[p] = 1;
    }
  }
  return out;
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');
export const clusterHex = (c: [number, number, number]) => `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`;

/** Builds the zone for one piece mask (pixel mask -> 1024x1024 canvas -> finalizeMask). */
export function convertPieceMask(
  mask: Uint8Array,
  color: [number, number, number],
  name: string,
  index: number,
  grow = true
): ConvertedZone | null {
  const m = grow ? dilate(mask) : mask;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.createImageData(SIZE, SIZE);
  for (let p = 0, i = 0; p < SIZE * SIZE; p++, i += 4) {
    if (m[p]) {
      img.data[i] = color[0];
      img.data[i + 1] = color[1];
      img.data[i + 2] = color[2];
      img.data[i + 3] = 255;
    }
  }
  // A colour zone often spans several parts (white = sponsor on the chest + cuffs + socks). A part joins with
  // a few dozen pixels, otherwise a small logo loses to the big areas of the same colour and vanishes.
  return finalizeMask(canvas, ctx, img, { name, mode: 'tint', defaultColor: clusterHex(color), minPartShare: 0.004, minPartPixels: 60 }, index);
}

/** Size of the PSD written by Import PNG: twice the zone size, so edges stay smooth once read back. */
export const PSD_SIZE = 2048;

/** A cluster's colour in every picture of the set, one after the other (r, g, b, r, g, b, ...). */
export type ColourVector = number[];

/**
 * For every pixel (PSD_SIZE square): its nearest colour a, the next nearest b and how far it lies from a
 * towards b (0..255). Edge pixels of a smooth (anti-aliased) picture lie between two colours. With several
 * colourways of one template, a pixel is compared in all of them at once (its colour vector).
 * In gradient mode only the used colours (rank >= 0) count and the share follows the picture exactly, so a smooth
 * gradient between two chosen colours stays a gradient.
 */
function blendMap(srcs: ImageData[], palette: ColourVector[], rank: Int16Array, gradient: boolean) {
  const n = srcs[0].width * srcs[0].height;
  const a = new Uint16Array(n), b = new Uint16Array(n), t = new Uint8Array(n);
  const ds = srcs.map((s) => s.data);
  const D = palette[0]?.length ?? 3;
  const use = palette.map((_, k) => !gradient || rank[k] >= 0);
  const px = new Float64Array(D);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    if (ds.some((d) => d[i + 3] < 128)) { a[p] = b[p] = 65535; continue; }
    for (let s = 0; s < ds.length; s++) { px[s * 3] = ds[s][i]; px[s * 3 + 1] = ds[s][i + 1]; px[s * 3 + 2] = ds[s][i + 2]; }
    let best = 1e12, second = 1e12, ia = 0, ib = 0;
    for (let k = 0; k < palette.length; k++) {
      if (!use[k]) continue;
      const c = palette[k];
      let e = 0;
      for (let j = 0; j < D; j++) e += (px[j] - c[j]) ** 2;
      if (e < best) { second = best; ib = ia; best = e; ia = k; }
      else if (e < second) { second = e; ib = k; }
    }
    a[p] = ia;
    b[p] = ib;
    // position along the line a -> b; pixels far from that line are another colour (noise): pure a
    const A = palette[ia], B = palette[ib];
    let len = 0, dot = 0;
    for (let j = 0; j < D; j++) { const v = B[j] - A[j]; len += v * v; dot += (px[j] - A[j]) * v; }
    const s = Math.max(0, Math.min(1, dot / (len || 1)));
    let off = 0;
    for (let j = 0; j < D; j++) off += (px[j] - A[j] - s * (B[j] - A[j])) ** 2;
    const per = D / 3;
    // a little noise near a pure colour stays pure, so flat areas do not turn grainy; two almost equal colours
    // (shades of one dark grey) have no edge worth blending
    if (len < 900 * per || off > (gradient ? 6400 : 1600) * per) t[p] = 0;
    else t[p] = Math.round(255 * (gradient ? s : Math.max(0, Math.min(1, (s - 0.1) / 0.8))));
  }
  return { a, b, t };
}

/**
 * Several colourways of one template (the same design in other colours): pixels belong together when they
 * change colour together, so two areas that happen to share a colour in one version are told apart by another.
 * Each picture is grouped by colour, every combination of groups that covers enough pixels becomes a cluster,
 * and the rest (edge pixels, noise) joins the nearest cluster. Colours shown are those of the first picture.
 */
export function analyzeColorways(datas: ImageData[], tolerance: number): ColorAnalysis & { vectors: ColourVector[] } {
  const N = SIZE * SIZE;
  const per = datas.map((d) => analyzeColors(d, tolerance));
  const tuple = new Int32Array(N).fill(-1);
  const idx = new Map<number, number>();
  const counts: number[] = [];
  const sums: number[][] = [];
  for (let p = 0; p < N; p++) {
    let key = 0;
    let ok = true;
    for (let s = 0; s < per.length; s++) {
      const l = per[s].labels[p];
      if (l === 65535) { ok = false; break; }
      key = key * 64 + l;
    }
    if (!ok) continue;
    let k = idx.get(key);
    if (k === undefined) { k = counts.length; idx.set(key, k); counts.push(0); sums.push(new Array(datas.length * 3).fill(0)); }
    tuple[p] = k;
    counts[k]++;
    const v = sums[k];
    for (let s = 0; s < datas.length; s++) { const d = datas[s].data; v[s * 3] += d[p * 4]; v[s * 3 + 1] += d[p * 4 + 1]; v[s * 3 + 2] += d[p * 4 + 2]; }
  }
  const minCount = Math.max(150, N * 0.0003);
  const kept = counts.map((c, k) => k).filter((k) => counts[k] >= minCount).sort((x, y) => counts[y] - counts[x]).slice(0, 40);
  const vectors = kept.map((k) => sums[k].map((v) => v / counts[k]));
  const newId = new Int32Array(counts.length).fill(-1);
  kept.forEach((k, i) => (newId[k] = i));
  const labels = new Uint16Array(N).fill(65535);
  const count = new Array(kept.length).fill(0);
  const D = datas.length * 3;
  for (let p = 0; p < N; p++) {
    if (tuple[p] < 0) continue;
    let id = newId[tuple[p]];
    if (id < 0) {
      let best = 1e12;
      for (let c = 0; c < vectors.length; c++) {
        let e = 0;
        for (let j = 0; j < D; j++) e += (datas[(j / 3) | 0].data[p * 4 + (j % 3)] - vectors[c][j]) ** 2;
        if (e < best) { best = e; id = c; }
      }
    }
    labels[p] = id;
    count[id]++;
  }
  return {
    clusters: vectors.map((v, i) => ({ id: i, color: [v[0], v[1], v[2]] as [number, number, number], count: count[i] })),
    labels,
    transparent: N - count.reduce((x, y) => x + y, 0),
    vectors,
  };
}

/**
 * Gradient mode: pixels whose colour was not chosen (the shades of a gradient) join the nearest chosen colour,
 * on the kit parts only (not the armband / credit boxes where template sites put their watermark).
 */
export function absorbIntoChosen(labels: Uint16Array, datas: ImageData[], vectors: ColourVector[], chosen: Set<number>): Uint16Array {
  const out = new Uint16Array(labels);
  const kit = partsMask(PES_2021_PARTS.map((p) => p.id).filter((id) => id !== 'armband' && id !== 'credit'));
  const ids = [...chosen];
  const D = datas.length * 3;
  for (let p = 0; p < SIZE * SIZE; p++) {
    if (labels[p] === 65535 || chosen.has(labels[p]) || !kit[p]) continue;
    let best = 1e12, id = labels[p];
    for (const c of ids) {
      let e = 0;
      for (let j = 0; j < D; j++) e += (datas[(j / 3) | 0].data[p * 4 + (j % 3)] - vectors[c][j]) ** 2;
      if (e < best) { best = e; id = c; }
    }
    out[p] = id;
  }
  return out;
}

/**
 * Import PNG -> PSD: every layer (a colour, cut per part group or piece) becomes one flat-colour layer of a
 * PSD_SIZE square PSD, the first one (the largest colour) at the bottom. Edges are soft like in the picture:
 * where two colours meet, the upper layer takes its share as transparency and the lower one stays solid under
 * it, so there is no gap. Read from library/templates, each layer becomes a zone whose colour is a slot.
 * srcs are the picture (and its other colourways) at PSD_SIZE, palette the colour vector of every cluster and
 * rank the stack position of each cluster's layers (-1 = not used).
 */
export async function masksToPsd(
  layers: { name: string; mask: Uint8Array; color: [number, number, number]; cluster: number }[],
  srcs: ImageData[],
  palette: ColourVector[],
  rank: Int16Array,
  gradient = false
): Promise<ArrayBuffer> {
  const { writePsd } = await import('ag-psd');
  const S = PSD_SIZE, k = SIZE / S;
  const { a, b, t } = blendMap(srcs, palette, rank, gradient);
  const composite = newCanvas(S, S);
  const cctx = composite.getContext('2d')!;
  const children: { name: string; canvas: HTMLCanvasElement; left: number; top: number }[] = [];
  for (const l of layers) {
    // the layer's area (cut at 1024) grown a pixel, so the soft edge just outside it is included
    const m = dilate(l.mask);
    const alpha = new Uint8Array(S * S);
    let x0 = S, y0 = S, x1 = -1, y1 = -1;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const p = y * S + x;
        if (!m[((y * k) | 0) * SIZE + ((x * k) | 0)] || a[p] === 65535) continue;
        let v = 255;
        // the bottom layer fills its whole area solid, so nothing shows through under the other colours
        if (rank[l.cluster] !== 0) {
          const own = a[p] === l.cluster, next = b[p] === l.cluster;
          if (!own && !next) continue;
          const other = own ? b[p] : a[p];
          // blending only between two colours that are both drawn; next to an unused colour the pixel is its own
          if (rank[other] < 0 && !own) continue;
          const share = rank[other] < 0 ? 255 : own ? 255 - t[p] : t[p];
          // under a colour drawn above this layer: stay solid, the upper layer blends on top
          v = share > 0 && rank[other] > rank[l.cluster] ? 255 : share;
          if (!v) continue;
        }
        alpha[p] = v;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) continue;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const c = newCanvas(w, h);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = alpha[(y + y0) * S + x + x0];
        if (!v) continue;
        const i = (y * w + x) * 4;
        img.data[i] = l.color[0];
        img.data[i + 1] = l.color[1];
        img.data[i + 2] = l.color[2];
        img.data[i + 3] = v;
      }
    }
    ctx.putImageData(img, 0, 0);
    cctx.drawImage(c, x0, y0);
    children.push({ name: l.name, canvas: c, left: x0, top: y0 });
  }
  return writePsd(
    {
      width: S,
      height: S,
      canvas: composite,
      children,
      imageResources: { xmpMetadata: `<x:xmpmeta xmlns:x="adobe:ns:meta/"><!-- ${PNG_PSD_MARK} --></x:xmpmeta>` },
    } as any,
    { generateThumbnail: false }
  );
}

/** The part groups of the Layer tab, so a colour shared by shirt and shorts becomes one layer in each group. */
const LAYER_GROUPS: [string, string[]][] = [
  ['Baju', ['front', 'back', 'leftSleeve', 'rightSleeve']],
  ['Celana', ['leftShorts', 'rightShorts']],
  ['Kaos kaki', ['leftSock', 'rightSock']],
  ['Detail', ['collar', 'armband', 'credit']],
];

/** Splits a mask by part group; groups with only a few stray pixels are left out. */
export function splitByGroup(mask: Uint8Array, minPixels = 60): { group: string; mask: Uint8Array }[] {
  const out: { group: string; mask: Uint8Array }[] = [];
  for (const [group, parts] of LAYER_GROUPS) {
    const area = partsMask(parts);
    const m = new Uint8Array(SIZE * SIZE);
    let n = 0;
    for (let p = 0; p < SIZE * SIZE; p++) if (mask[p] && area[p]) { m[p] = 1; n++; }
    if (n >= minPixels) out.push({ group, mask: m });
  }
  return out;
}

/** Pixel mask of a whole cluster. */
export function clusterMask(labels: Uint16Array, cluster: number): Uint8Array {
  const m = new Uint8Array(SIZE * SIZE);
  for (let p = 0; p < SIZE * SIZE; p++) if (labels[p] === cluster) m[p] = 1;
  return m;
}

const partsMaskCache = new Map<string, Uint8Array>();

/** 1 where a pixel of the texture belongs to some kit part (or to one of `only`), 0 elsewhere. */
function partsMask(only?: string[]): Uint8Array {
  const key = only?.join(',') ?? '';
  const cached = partsMaskCache.get(key);
  if (cached) return cached;
  const m = new Uint8Array(SIZE * SIZE);
  PES_2021_PARTS.filter((p) => !only || only.includes(p.id)).forEach((p) =>
    p.regions.forEach((r) => {
      const y1 = Math.min(SIZE, Math.ceil(r.y + r.height));
      const x1 = Math.min(SIZE, Math.ceil(r.x + r.width));
      for (let y = Math.max(0, Math.floor(r.y)); y < y1; y++) m.fill(1, y * SIZE + Math.max(0, Math.floor(r.x)), y * SIZE + x1);
    })
  );
  partsMaskCache.set(key, m);
  return m;
}

/**
 * Per cluster: the share (0..1) of its pixels that lie on a kit part. The empty background around the
 * parts is the cluster with almost no pixels on a part, however large it is (a navy kit can be 60% navy).
 */
export function clusterPartShares(labels: Uint16Array, clusterCount: number, only?: string[]): number[] {
  const mask = partsMask(only);
  const inside = new Float64Array(clusterCount);
  const total = new Float64Array(clusterCount);
  for (let p = 0; p < SIZE * SIZE; p++) {
    const l = labels[p];
    if (l === 65535) continue;
    total[l]++;
    if (mask[p]) inside[l]++;
  }
  return Array.from(total, (t, i) => (t ? inside[i] / t : 0));
}
