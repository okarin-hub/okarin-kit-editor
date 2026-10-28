import { finalizeMask, ConvertedZone } from '@/utils/psdImport';
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

/** Draws an image stretched to 1024x1024 and returns its pixels. */
export function imageToData(img: HTMLImageElement): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; data: ImageData } {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  return { canvas, ctx, data: ctx.getImageData(0, 0, SIZE, SIZE) };
}

export async function loadPngFile(file: File) {
  const img = await fileToImage(file);
  return { img, width: img.naturalWidth, height: img.naturalHeight, ...imageToData(img) };
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
  mode: 'auto' | 'tint' | 'keep'
): Promise<ConvertedZone | null> {
  const { canvas, ctx, data } = await loadPngFile(input.file);
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

/** Pixel mask of a whole cluster. */
export function clusterMask(labels: Uint16Array, cluster: number): Uint8Array {
  const m = new Uint8Array(SIZE * SIZE);
  for (let p = 0; p < SIZE * SIZE; p++) if (labels[p] === cluster) m[p] = 1;
  return m;
}

let partsMaskCache: Uint8Array | null = null;

/** 1 where a pixel of the texture belongs to some kit part, 0 on the empty background around them. */
function partsMask(): Uint8Array {
  if (partsMaskCache) return partsMaskCache;
  const m = new Uint8Array(SIZE * SIZE);
  PES_2021_PARTS.forEach((p) =>
    p.regions.forEach((r) => {
      const y1 = Math.min(SIZE, Math.ceil(r.y + r.height));
      const x1 = Math.min(SIZE, Math.ceil(r.x + r.width));
      for (let y = Math.max(0, Math.floor(r.y)); y < y1; y++) m.fill(1, y * SIZE + Math.max(0, Math.floor(r.x)), y * SIZE + x1);
    })
  );
  partsMaskCache = m;
  return m;
}

/**
 * Per cluster: the share (0..1) of its pixels that lie on a kit part. The empty background around the
 * parts is the cluster with almost no pixels on a part, however large it is (a navy kit can be 60% navy).
 */
export function clusterPartShares(labels: Uint16Array, clusterCount: number): number[] {
  const mask = partsMask();
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
