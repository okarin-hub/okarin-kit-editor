import { finalizeMask, ConvertedZone, newCanvas, PNG_PSD_MARK, PNG_SHARED_SLOTS, DETAIL_DARK, DETAIL_LIGHT, LAYER_GROUPS } from '@/utils/psdImport';
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
  img: CanvasImageSource & { width: number; height: number; naturalWidth?: number; naturalHeight?: number },
  fit: ImageFit = 'stretch',
  size = SIZE
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; data: ImageData } {
  const SIZE = size;
  // newCanvas: also works in the PNG -> PSD worker (an ImageBitmap comes in there)
  const canvas = newCanvas(SIZE, SIZE);
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
 * Gradient mode helper: the colours (of ids) that lie between two others of them, i.e. a shade of the gradient
 * from one to the other rather than a colour of its own. The end colours are never between two others.
 */
export function blendColours(ids: number[], vectors: ColourVector[]): Set<number> {
  const out = new Set<number>();
  const D = vectors[0]?.length ?? 3;
  for (const c of ids) {
    const C = vectors[c];
    search: for (const a of ids) {
      if (a === c) continue;
      for (const b of ids) {
        if (b === c || b <= a) continue;
        const A = vectors[a], B = vectors[b];
        let len = 0, dot = 0;
        for (let j = 0; j < D; j++) { const v = B[j] - A[j]; len += v * v; dot += (C[j] - A[j]) * v; }
        if (!len) continue;
        const s = dot / len;
        if (s < 0.08 || s > 0.92) continue;
        let off = 0;
        for (let j = 0; j < D; j++) off += (C[j] - A[j] - s * (B[j] - A[j])) ** 2;
        // close to the line from a to b (about 20 levels per channel and picture)
        if (off < 400 * (D / 3)) { out.add(c); break search; }
      }
    }
  }
  return out;
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
  gradient = false,
  /** Colours merged by the user: cluster -> the cluster it joined (itself when not merged). */
  alias?: Int32Array,
  /** Also keep the fabric detail (mesh, shading) of the first picture as two layers on top. */
  detail = false,
  /** ...as colour layers per part group (motifLayers) instead of black / white. */
  motif = false,
  /** Logos and sponsors (logoDetect): each becomes a layer in its own colours, on top. */
  logos?: PngPsdRequest['logos'],
  /** One colour slot per colour for all part groups (read back by assignSlots). */
  sharedSlots = false
): Promise<ArrayBuffer> {
  const { writePsd } = await import('ag-psd');
  const S = PSD_SIZE, k = SIZE / S;
  const { a, b, t } = blendMap(srcs, palette, rank, gradient);
  if (alias) {
    for (let p = 0; p < a.length; p++) {
      if (a[p] === 65535) continue;
      a[p] = alias[a[p]];
      b[p] = alias[b[p]];
      // a pixel between a colour and one merged into it is just that colour
      if (a[p] === b[p]) t[p] = 0;
    }
  }
  const composite = newCanvas(S, S);
  const cctx = composite.getContext('2d')!;
  const children: { name: string; canvas: HTMLCanvasElement; left: number; top: number; blendMode?: string }[] = [];
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
  const logoChildren = logos?.list.length
    ? logoLayers(logos, srcs[0], a, b, t, (cluster) => layers.find((l) => l.cluster === cluster)?.color ?? (palette[cluster].slice(0, 3) as [number, number, number]), palette, alias)
    : [];
  if (detail) {
    // a colour the user left unticked is covered by the Base: its pixels must not come back as detail (a white logo
    // returning as a white screen layer), so they are skipped like edge pixels
    // grown 2 px: the soft edge just outside such a logo is counted as the base colour, a little lighter or darker
    const off = new Uint8Array(t.length);
    for (let p = 0; p < t.length; p++) if (a[p] !== 65535 && rank[a[p]] < 0) off[p] = 1;
    const R = 2;
    const row = new Uint8Array(t.length);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < S && off[y * S + xx]) { row[y * S + x] = 1; break; }
        }
      }
    }
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        for (let dy = -R; dy <= R; dy++) {
          const yy = y + dy;
          if (yy >= 0 && yy < S && row[yy * S + x]) { t[y * S + x] = 255; break; }
        }
      }
    }
    const flat = cctx.getImageData(0, 0, S, S);
    for (const d of motif ? motifLayers(srcs[0], flat, t) : fabricDetail(srcs[0], flat, t)) {
      cctx.save();
      cctx.globalCompositeOperation = d.blendMode as GlobalCompositeOperation;
      cctx.drawImage(d.canvas, d.left, d.top);
      cctx.restore();
      children.push(d);
    }
  }
  for (const l of logoChildren) {
    cctx.drawImage(l.canvas, l.left, l.top);
    children.push(l);
  }
  return writePsd(
    {
      width: S,
      height: S,
      canvas: composite,
      children,
      imageResources: { xmpMetadata: `<x:xmpmeta xmlns:x="adobe:ns:meta/"><!-- ${PNG_PSD_MARK}${sharedSlots ? ` ${PNG_SHARED_SLOTS}` : ''} --></x:xmpmeta>` },
    } as any,
    { generateThumbnail: false }
  );
}

/**
 * Logo layers: each logo of the detection, cut from the picture at PSD_SIZE with a soft edge. The edge's share of the
 * background colour is taken out (alpha + unmixed colour), so the logo sits clean on any base colour, not in a ring of
 * the old one. Its area (grown 2 px at 1024) is marked in t, so the fabric detail does not bring it back.
 */
function logoLayers(
  logos: NonNullable<PngPsdRequest['logos']>,
  pic: ImageData,
  a: Uint16Array,
  b: Uint16Array,
  t: Uint8Array,
  colourOf: (cluster: number) => [number, number, number],
  palette: ColourVector[],
  alias?: Int32Array
) {
  const S = pic.width, k = SIZE / S, d = pic.data;
  const grow = (src: Uint16Array) => {
    // the ids only: the inside flag stays on the pixels the detection gave it
    const out = src.map((v) => v & 0x7fff);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const p = y * SIZE + x;
        if (src[p]) continue;
        for (let dy = -1; dy <= 1 && !out[p]; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy, xx = x + dx;
            if (yy >= 0 && yy < SIZE && xx >= 0 && xx < SIZE && src[yy * SIZE + xx]) { out[p] = src[yy * SIZE + xx] & 0x7fff; break; }
          }
        }
      }
    }
    return out;
  };
  const area = grow(logos.map);
  const quiet = grow(area);
  const n = logos.list.length;
  const box = Array.from({ length: n }, () => [S, S, -1, -1]);
  const idAt = (m: Uint16Array, p: number) => m[((((p / S) | 0) * k) | 0) * SIZE + (((p % S) * k) | 0)];
  for (let p = 0; p < S * S; p++) {
    const id = idAt(area, p);
    if (!id) continue;
    const bx = box[id - 1], x = p % S, y = (p / S) | 0;
    if (x < bx[0]) bx[0] = x;
    if (y < bx[1]) bx[1] = y;
    if (x > bx[2]) bx[2] = x;
    if (y > bx[3]) bx[3] = y;
  }
  const out: { name: string; canvas: HTMLCanvasElement; left: number; top: number }[] = [];
  logos.list.forEach((logo, i) => {
    const [x0, y0, x1, y1] = box[i];
    if (x1 < 0) return;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const bg = alias ? alias[logo.bg] : logo.bg;
    const [br, bgc, bb] = colourOf(bg);
    // every shade of the background (a base split into light, dark and mesh blue) counts as the background
    const isBg = palette.map((c) => Math.hypot(c[0] - br, c[1] - bgc, c[2] - bb) < 60);
    const c = newCanvas(w, h);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    let solid = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const p = y * S + x;
        if (idAt(area, p) !== i + 1 || a[p] === 65535) continue;
        const i4 = p * 4;
        let al: number;
        // inside a badge's outline: solid, as in the picture
        if (idAt(logos.map, p) & 0x8000) al = 1;
        else if (isBg[a[p]] && !isBg[b[p]] && t[p] > 0) al = t[p] / 255; // an edge between the background and the logo
        else if (isBg[a[p]]) {
          // nearest to the background, off any line to another colour: judged by how far it is from it
          const dist = Math.hypot(d[i4] - br, d[i4 + 1] - bgc, d[i4 + 2] - bb);
          al = Math.max(0, Math.min(1, (dist - 12) / 70));
        } else if (isBg[b[p]]) al = 1 - t[p] / 255;
        else al = 1;
        if (al < 0.04) continue;
        const o = ((y - y0) * w + x - x0) * 4;
        img.data[o] = Math.round((d[i4] - (1 - al) * br) / al);
        img.data[o + 1] = Math.round((d[i4 + 1] - (1 - al) * bgc) / al);
        img.data[o + 2] = Math.round((d[i4 + 2] - (1 - al) * bb) / al);
        img.data[o + 3] = Math.round(al * 255);
        if (al > 0.5) solid++;
      }
    }
    if (solid < 20) return;
    ctx.putImageData(img, 0, 0);
    out.push({ name: `Logo ${out.length + 1} – ${logo.group}`, canvas: c, left: x0, top: y0 });
  });
  // the logos' area gives no fabric detail (it would bring a ghost of the logo back on the new colour)
  for (let p = 0; p < S * S; p++) if (idAt(quiet, p)) t[p] = 255;
  return out;
}

/**
 * Fabric detail (mesh lines, folds, shading): where the picture is darker than its flat colour layers, a black
 * layer in multiply; where it is lighter, a white layer in screen. The alpha is exactly the change in brightness,
 * so on the picture's own colours the result matches it, and after a colour change the detail stays on the new
 * colour. Edges between two colours (t > 0) and tiny differences (compression noise) are left out.
 */
function fabricDetail(pic: ImageData, flat: ImageData, t: Uint8Array) {
  const S = pic.width, k = SIZE / S;
  // not the armband / credit boxes, where template sites put their watermark
  const kit = partsMask(PES_2021_PARTS.map((p) => p.id).filter((id) => id !== 'armband' && id !== 'credit'));
  const lum = (d: Uint8ClampedArray, i: number) => (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
  const dark = new Uint8Array(S * S), light = new Uint8Array(S * S);
  for (let p = 0, i = 0; p < S * S; p++, i += 4) {
    if (t[p] || !kit[((((p / S) | 0) * k) | 0) * SIZE + (((p % S) * k) | 0)] || flat.data[i + 3] < 255) continue;
    const r = lum(pic.data, i), b = lum(flat.data, i);
    if (Math.abs(r - b) < 5 / 255) continue;
    // multiply with black at alpha a scales by (1 - a); screen with white at alpha a lifts by a towards white
    if (r < b) dark[p] = Math.round(255 * (1 - r / b));
    else if (b < 0.995) light[p] = Math.round((255 * (r - b)) / (1 - b));
  }
  const out: { name: string; canvas: HTMLCanvasElement; left: number; top: number; blendMode: string }[] = [];
  for (const [name, alpha, v, blendMode] of [[DETAIL_DARK, dark, 0, 'multiply'], [DETAIL_LIGHT, light, 255, 'screen']] as const) {
    let x0 = S, y0 = S, x1 = -1, y1 = -1, n = 0;
    for (let p = 0; p < S * S; p++) {
      if (!alpha[p]) continue;
      n++;
      const x = p % S, y = (p / S) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (n < 200) continue;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const c = newCanvas(w, h);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = alpha[(y + y0) * S + x + x0];
        if (!a) continue;
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    out.push({ name, canvas: c, left: x0, top: y0, blendMode });
  }
  return out;
}

/**
 * A tonal motif (camo patches, an embossed pattern a shade off the base) as colour layers: per part group one layer
 * for the darker detail and one for the lighter, each in the motif's own colour M with alpha a so that
 * flat * (1 - a) + M * a matches the picture's brightness. Read back, each is a normal colour layer with a slot, so
 * the motif can take any colour. M is the mean of the stronger half of the detail: the motif itself, not the few
 * logos far off the base that would make the motif faint (they end up solid in M).
 */
export function motifLayers(pic: ImageData, flat: ImageData, t: Uint8Array) {
  const S = pic.width, k = SIZE / S;
  const lum = (d: Uint8ClampedArray, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  const out: { name: string; canvas: HTMLCanvasElement; left: number; top: number; blendMode?: string }[] = [];
  // typed arrays shared by all passes: a 2048 picture has 4M pixels
  const px = new Int32Array(S * S), dl = new Float32Array(S * S);
  for (const [group, parts] of LAYER_GROUPS) {
    const area = partsMask(parts.filter((id) => id !== 'armband' && id !== 'credit'));
    for (const dark of [true, false]) {
      // the brightness change of every detail pixel of this group and direction
      let len = 0;
      for (let p = 0, i = 0; p < S * S; p++, i += 4) {
        if (t[p] || flat.data[i + 3] < 255 || !area[((((p / S) | 0) * k) | 0) * SIZE + (((p % S) * k) | 0)]) continue;
        const d = dark ? lum(flat.data, i) - lum(pic.data, i) : lum(pic.data, i) - lum(flat.data, i);
        if (d < 5) continue;
        px[len] = p;
        dl[len++] = d;
      }
      if (len < 200) continue;
      const cut = dl.slice(0, len).sort()[Math.floor(len * 0.5)];
      const m = [0, 0, 0];
      let n = 0;
      for (let j = 0; j < len; j++) {
        const p = px[j];
        if (dl[j] < cut) continue;
        m[0] += pic.data[p * 4]; m[1] += pic.data[p * 4 + 1]; m[2] += pic.data[p * 4 + 2];
        n++;
      }
      const M = m.map((v) => Math.round(v / n)) as [number, number, number];
      const lumM = 0.299 * M[0] + 0.587 * M[1] + 0.114 * M[2];
      const alpha = new Uint8Array(S * S);
      let x0 = S, y0 = S, x1 = -1, y1 = -1;
      for (let j = 0; j < len; j++) {
        const p = px[j];
        // how far towards M this pixel is, measured from its own flat colour
        const span = dark ? lum(flat.data, p * 4) - lumM : lumM - lum(flat.data, p * 4);
        if (span <= 0) continue;
        const a = Math.min(255, Math.round((255 * dl[j]) / span));
        if (a < 8) continue;
        alpha[p] = a;
        const x = p % S, y = (p / S) | 0;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      if (x1 < 0) continue;
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      const c = newCanvas(w, h);
      const ctx = c.getContext('2d')!;
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const a = alpha[(y + y0) * S + x + x0];
          if (!a) continue;
          const i = (y * w + x) * 4;
          img.data[i] = M[0]; img.data[i + 1] = M[1]; img.data[i + 2] = M[2]; img.data[i + 3] = a;
        }
      }
      ctx.putImageData(img, 0, 0);
      out.push({ name: `${dark ? MOTIF_DARK : MOTIF_LIGHT} – ${group}`, canvas: c, left: x0, top: y0 });
    }
  }
  return out;
}

/** Layer names of the recolourable motif (the group is added: "Motif gelap – Baju"). */
export const MOTIF_DARK = 'Motif gelap';
export const MOTIF_LIGHT = 'Motif terang';

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

/**
 * 3x3 median per channel: removes the speckles and 8x8 blocks of a compressed (WebP / JPG) picture while
 * keeping its edges, before the colours are grouped.
 */
export function median3(src: ImageData): ImageData {
  const { width: W, height: H, data: d } = src;
  const out = new ImageData(new Uint8ClampedArray(d), W, H);
  const o = out.data;
  const v = new Uint8Array(9);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        let n = 0;
        for (let dy = -W * 4; dy <= W * 4; dy += W * 4) {
          for (let dx = -4; dx <= 4; dx += 4) {
            // insertion into the sorted list
            let val = d[i + dy + dx + c], j = n++;
            while (j > 0 && v[j - 1] > val) { v[j] = v[j - 1]; j--; }
            v[j] = val;
          }
        }
        o[i + c] = v[4];
      }
    }
  }
  return out;
}

/** What the PNG -> PSD worker needs: the pictures, the colour groups the user chose and how to cut them. */
export interface PngPsdRequest {
  /** The picture and its other colourways. */
  images: ImageBitmap[];
  fit: ImageFit;
  denoise: boolean;
  /** Colour group per pixel at 1024 (from the analysis shown in the dialog). */
  labels: Uint16Array;
  counts: number[];
  vectors: ColourVector[];
  colors: [number, number, number][];
  chosen: { id: number; name: string }[];
  /** Colour group -> the group it was merged into (itself when not merged). */
  alias: Int32Array;
  gradient: boolean;
  /** Keep the fabric detail (mesh, shading) as two layers on top. */
  detail: boolean;
  /** The detail as colour layers per part group (a tonal motif whose colour can be changed) instead of black / white. */
  motif?: boolean;
  splitPieces: boolean;
  minArea: number;
  maxZones: number;
  /** Logos and sponsors found by logoDetect: logo id + 1 per pixel at 1024, and per logo its background colour. */
  logos?: { map: Uint16Array; list: { bg: number; group: string }[] };
  /** One colour slot per colour for the shirt, shorts and socks together. */
  sharedSlots?: boolean;
}

/** The picture at a size, cleaned up when asked (the same way as in the dialog's analysis). */
export function pictureData(img: CanvasImageSource & { width: number; height: number }, fit: ImageFit, size: number, denoise: boolean) {
  const d = imageToData(img, fit, size).data;
  return denoise ? median3(d) : d;
}

/**
 * Import PNG -> PSD (runs in a worker): one layer per chosen colour and part group (Base: the whole group, at
 * the bottom), cut again at PSD_SIZE with soft edges.
 */
export async function buildPngPsd(r: PngPsdRequest, onProgress?: (done: number, total: number) => void): Promise<ArrayBuffer> {
  const labels = r.labels.map((l) => (l === 65535 ? l : r.alias[l]));
  const counts = new Array(r.counts.length).fill(0);
  r.counts.forEach((c, i) => (counts[r.alias[i]] += c));
  // the largest colour is the kit's base (drawn under the patterns), at the bottom of the PSD
  const ordered = [...r.chosen].sort((a, b) => counts[b.id] - counts[a.id]);
  // gradient: the shades in between join the chosen colours, so their layers cover the whole gradient
  const lab = r.gradient
    ? absorbIntoChosen(labels, r.images.map((i) => pictureData(i, r.fit, SIZE, r.denoise)), r.vectors, new Set(r.chosen.map((c) => c.id)))
    : labels;
  const layers: { name: string; mask: Uint8Array; color: [number, number, number]; cluster: number }[] = [];
  const first = pictureData(r.images[0], r.fit, SIZE, r.denoise);
  for (const [k, cl] of ordered.entries()) {
    const color = dominantColour(first, labels, cl.id) ?? r.colors[cl.id];
    // numbered by size, like the colour slots the PSD gets when it is read (see assignSlots)
    const name = k === 0 ? 'Base' : /^Warna \d+$/.test(cl.name) ? `Warna ${k + 1}` : cl.name;
    // one layer per part group (shirt, shorts, socks, details), so each shows in its own group of the Layer tab
    // in a gradient a colour fades out far from where it is the nearest one: its layer may reach the whole group
    // (its share decides how much shows), otherwise the fade is cut halfway and the gradient turns into blocks
    const area = k === 0 || r.gradient ? new Uint8Array(lab.length).fill(1) : clusterMask(lab, cl.id);
    for (const g of splitByGroup(area)) {
      const label = `${name} – ${g.group}`;
      const pieces = r.splitPieces && k > 0 ? splitComponents(Uint16Array.from(g.mask, (v) => (v ? 1 : 65535)), 1, r.minArea) : [g.mask];
      pieces.slice(0, r.maxZones - layers.length).forEach((mask, i) =>
        layers.push({ name: pieces.length > 1 ? `${label} ${i + 1}` : label, mask, color, cluster: cl.id })
      );
    }
    onProgress?.(k + 1, ordered.length + 1);
  }
  const rank = new Int16Array(r.counts.length).fill(-1);
  ordered.forEach((cl, k) => (rank[cl.id] = k));
  const srcs = r.images.map((i) => pictureData(i, r.fit, PSD_SIZE, r.denoise));
  const buf = await masksToPsd(layers, srcs, r.vectors, rank, r.gradient, r.alias, r.detail, r.motif, r.logos, r.sharedSlots);
  onProgress?.(ordered.length + 1, ordered.length + 1);
  return buf;
}

/**
 * The most common colour of a cluster (32 levels per channel, the mean inside the fullest bin). The plain mean also
 * counts the edges and logos inside the cluster, which pulls a light grey next to maroon towards pink.
 */
export function dominantColour(data: ImageData, labels: Uint16Array, cluster: number): [number, number, number] | undefined {
  const bins = new Map<number, [number, number, number, number]>();
  const d = data.data;
  for (let p = 0; p < labels.length; p++) {
    if (labels[p] !== cluster) continue;
    const i = p * 4;
    const key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
    const b = bins.get(key) ?? [0, 0, 0, 0];
    b[0] += d[i]; b[1] += d[i + 1]; b[2] += d[i + 2]; b[3]++;
    bins.set(key, b);
  }
  let best: [number, number, number, number] | undefined;
  for (const b of bins.values()) if (!best || b[3] > best[3]) best = b;
  return best ? [Math.round(best[0] / best[3]), Math.round(best[1] / best[3]), Math.round(best[2] / best[3])] : undefined;
}

/**
 * The most common colour group of each part group (shirt, shorts, socks, details). Such a colour is never a shade of
 * a gradient, even when it lies between two others (a light grey on the line from white to black).
 */
export function groupMainColours(labels: Uint16Array): Set<number> {
  const out = new Set<number>();
  for (const [, parts] of LAYER_GROUPS) {
    const area = partsMask(parts);
    const count = new Map<number, number>();
    for (let p = 0; p < labels.length; p++) if (area[p] && labels[p] !== 65535) count.set(labels[p], (count.get(labels[p]) ?? 0) + 1);
    let best = -1, n = 0;
    for (const [c, k] of count) if (k > n) { best = c; n = k; }
    if (best >= 0) out.add(best);
  }
  return out;
}

/**
 * Shades of one colour: clusters a step apart (RGB distance < 48) whose pixels are mixed through each other (their
 * shared border is at least 0.2 of the smaller one's pixels: mesh, folds, light and shadow) are one colour. Two
 * shades that each make an area of their own (stripes, a panel, a gradient band) share little border and stay apart.
 * Returns per cluster the cluster it joins: the largest of its group (itself when alone).
 */
export function shadeMerges(labels: Uint16Array, colors: [number, number, number][], width = SIZE): Int32Array {
  const K = colors.length;
  const count = new Float64Array(K);
  const border = new Float64Array(K * K);
  const h = labels.length / width;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x, l = labels[p];
      if (l === 65535) continue;
      count[l]++;
      for (const q of [x < width - 1 ? p + 1 : -1, y < h - 1 ? p + width : -1]) {
        if (q < 0) continue;
        const m = labels[q];
        if (m === 65535 || m === l) continue;
        border[l * K + m]++;
        border[m * K + l]++;
      }
    }
  }
  const root = Int32Array.from(colors, (_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  for (let i = 0; i < K; i++) {
    for (let j = i + 1; j < K; j++) {
      const [a, b] = [colors[i], colors[j]];
      if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) >= 48) continue;
      if (border[i * K + j] < 0.2 * Math.min(count[i], count[j])) continue;
      const ri = find(i), rj = find(j);
      if (ri !== rj) root[count[ri] >= count[rj] ? rj : ri] = count[ri] >= count[rj] ? ri : rj;
    }
  }
  return Int32Array.from(colors, (_, i) => find(i));
}

// self-check: a checkerboard of two close blues joins (the larger wins); two halves of them stay apart
{
  const chk = Uint16Array.from({ length: 80 }, (_, p) => ((p % 20) + ((p / 20) | 0)) % 2);
  chk[1] = 0;
  const halves = Uint16Array.from({ length: 80 }, (_, p) => (p % 20 < 10 ? 0 : 1));
  const c: [number, number, number][] = [[20, 30, 120], [25, 35, 135]];
  const m1 = shadeMerges(chk, c, 20), m2 = shadeMerges(halves, c, 20);
  if (!(m1[0] === 0 && m1[1] === 0 && m2[0] === 0 && m2[1] === 1)) console.error('pngImport shadeMerges self-check failed');
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

/** Part group index per texture pixel: 0 = no part, 1.. = LAYER_GROUPS order (shirt, shorts, socks, details). */
let groupMapCache: Uint8Array | null = null;
export function groupMap(): Uint8Array {
  if (groupMapCache) return groupMapCache;
  const m = new Uint8Array(SIZE * SIZE);
  LAYER_GROUPS.forEach(([, parts], g) => {
    const area = partsMask(parts);
    for (let p = 0; p < m.length; p++) if (area[p] && !m[p]) m[p] = g + 1;
  });
  return (groupMapCache = m);
}

/** The part groups a colour would be cut into, with the same 60-pixel floor as splitByGroup. */
export function clusterGroups(labels: Uint16Array, clusterCount: number, alias: Int32Array): string[][] {
  const gm = groupMap();
  const n = LAYER_GROUPS.length;
  const counts = new Uint32Array(clusterCount * n);
  for (let p = 0; p < labels.length; p++) {
    const l = labels[p];
    if (l === 65535 || !gm[p]) continue;
    counts[alias[l] * n + gm[p] - 1]++;
  }
  return Array.from({ length: clusterCount }, (_, c) => LAYER_GROUPS.filter((_, g) => counts[c * n + g] >= 60).map(([name]) => name));
}
