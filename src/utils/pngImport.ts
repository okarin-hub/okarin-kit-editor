import { finalizeMask, ConvertedZone } from '@/utils/psdImport';

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

export interface ColorCluster {
  id: number;
  color: [number, number, number];
  count: number;
}

export interface ColorAnalysis {
  clusters: ColorCluster[];
  /** Cluster index per pixel (65535 = transparent / unused). */
  labels: Uint16Array;
  transparent: number;
}

const NONE = 65535;

/**
 * Groups the colours of an image into clusters. Colours are first counted in 5-bit bins; bins are
 * then merged greedily (most frequent first) when they lie within `tolerance` of a cluster centre.
 */
export function analyzeColors(data: ImageData, tolerance: number, maxClusters = 32): ColorAnalysis {
  const d = data.data;
  const BINS = 32 * 32 * 32;
  const counts = new Uint32Array(BINS);
  const sums = new Float64Array(BINS * 3);
  let transparent = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) {
      transparent++;
      continue;
    }
    const b = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
    counts[b]++;
    sums[b * 3] += d[i];
    sums[b * 3 + 1] += d[i + 1];
    sums[b * 3 + 2] += d[i + 2];
  }

  const bins: { b: number; n: number; c: [number, number, number] }[] = [];
  for (let b = 0; b < BINS; b++) {
    if (counts[b] > 0) bins.push({ b, n: counts[b], c: [sums[b * 3] / counts[b], sums[b * 3 + 1] / counts[b], sums[b * 3 + 2] / counts[b]] });
  }
  bins.sort((a, b) => b.n - a.n);

  const clusters: { c: [number, number, number]; n: number }[] = [];
  const binToCluster = new Int32Array(BINS).fill(-1);
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  for (const bin of bins) {
    let best = -1;
    let bestD = Infinity;
    clusters.forEach((cl, i) => {
      const dd = dist(cl.c, bin.c);
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    });
    if (best >= 0 && (bestD <= tolerance || clusters.length >= maxClusters)) {
      binToCluster[bin.b] = best;
      const cl = clusters[best];
      cl.c = [
        (cl.c[0] * cl.n + bin.c[0] * bin.n) / (cl.n + bin.n),
        (cl.c[1] * cl.n + bin.c[1] * bin.n) / (cl.n + bin.n),
        (cl.c[2] * cl.n + bin.c[2] * bin.n) / (cl.n + bin.n),
      ];
      cl.n += bin.n;
    } else {
      binToCluster[bin.b] = clusters.length;
      clusters.push({ c: [...bin.c], n: bin.n });
    }
  }

  // clusters ordered by size (largest first); remap labels
  const order = clusters.map((_, i) => i).sort((a, b) => clusters[b].n - clusters[a].n);
  const remap = new Int32Array(clusters.length);
  order.forEach((old, ni) => (remap[old] = ni));

  const labels = new Uint16Array(SIZE * SIZE).fill(NONE);
  for (let p = 0, i = 0; p < SIZE * SIZE; p++, i += 4) {
    if (d[i + 3] < 128) continue;
    const b = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
    labels[p] = remap[binToCluster[b]];
  }

  return {
    clusters: order.map((old, ni) => ({
      id: ni,
      color: [Math.round(clusters[old].c[0]), Math.round(clusters[old].c[1]), Math.round(clusters[old].c[2])] as [number, number, number],
      count: clusters[old].n,
    })),
    labels,
    transparent,
  };
}

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
  return finalizeMask(canvas, ctx, img, { name, mode: 'tint', defaultColor: clusterHex(color) }, index);
}

/** Pixel mask of a whole cluster. */
export function clusterMask(labels: Uint16Array, cluster: number): Uint8Array {
  const m = new Uint8Array(SIZE * SIZE);
  for (let p = 0; p < SIZE * SIZE; p++) if (labels[p] === cluster) m[p] = 1;
  return m;
}
