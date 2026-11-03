/**
 * One-colour logos: a logo turned into a single colour and redrawn as a traced vector outline (see glyphTrace), so
 * its edges are clean. 'shape' fills the whole logo; 'detail' keeps only its dark parts (or its light parts when
 * inverted), so the drawing inside the logo stays visible as holes.
 */
import { traceCoverage } from '@/utils/glyphTrace';

export type LogoMonoMode = 'none' | 'shape' | 'detail';

const MAX = 512; // the logo is drawn small on the digits; this keeps the trace quick

export function oneColourLogo(
  image: HTMLImageElement | HTMLCanvasElement,
  mode: Exclude<LogoMonoMode, 'none'>,
  color: string,
  /** 'detail': brightness (0..100) that separates ink from the rest */
  cut = 50,
  /** 'detail': the light parts become the colour */
  invert = false
): HTMLCanvasElement {
  const iw = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const ih = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  const k = Math.min(1, MAX / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k));
  // one pixel of margin so the outline closes around shapes that touch the picture edge
  const W = w + 2, H = h + 2;
  const src = document.createElement('canvas');
  src.width = W;
  src.height = H;
  const sctx = src.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(image, 1, 1, w, h);
  const d = sctx.getImageData(0, 0, W, H).data;
  const N = W * H;

  // the logo itself: its own transparency, or (a JPG on a plain background) its difference from the border colour
  let see = 0, clear = 0;
  for (let x = 1; x <= w; x++) for (const y of [1, h]) {
    see++;
    if (d[(y * W + x) * 4 + 3] < 250) clear++;
  }
  for (let y = 1; y <= h; y++) for (const x of [1, w]) {
    see++;
    if (d[(y * W + x) * 4 + 3] < 250) clear++;
  }
  const transparent = clear > see * 0.05;
  const border: number[][] = [];
  if (!transparent) {
    for (let x = 1; x <= w; x += 2) border.push([x, 1], [x, h]);
    for (let y = 1; y <= h; y += 2) border.push([1, y], [w, y]);
  }
  const med = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0;
  const bg = [0, 1, 2].map((c) => med(border.map(([x, y]) => d[(y * W + x) * 4 + c])));
  const near = (p: number) => Math.abs(d[p * 4] - bg[0]) + Math.abs(d[p * 4 + 1] - bg[1]) + Math.abs(d[p * 4 + 2] - bg[2]);
  // background = background-coloured pixels joined to the picture edge; the same colour enclosed by the logo
  // (a white centre, white letters) belongs to the logo
  const outside = new Uint8Array(N);
  if (!transparent) {
    const stack: number[] = [];
    for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
    for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
    while (stack.length) {
      const p = stack.pop()!;
      if (outside[p] || (near(p) >= 70 && d[p * 4 + 3] > 0)) continue;
      outside[p] = 1;
      const x = p % W;
      if (x > 0) stack.push(p - 1);
      if (x < W - 1) stack.push(p + 1);
      if (p >= W) stack.push(p - W);
      if (p < N - W) stack.push(p + W);
    }
  }
  const cov = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    const i = p * 4;
    let logo: number;
    if (transparent) logo = d[i + 3] / 255;
    // the edge keeps its anti-aliasing: how far it is from the background colour
    else logo = outside[p] ? Math.max(0, Math.min(1, (near(p) - 30) / 40)) : 1;
    if (mode === 'detail' && logo > 0) {
      const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 2.55; // 0..100
      // a soft step around the cut, so the traced edge follows the anti-aliasing
      const t = Math.max(0, Math.min(1, ((invert ? lum - cut : cut - lum) / 8 + 0.5)));
      logo *= t;
    }
    cov[p] = logo;
  }
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const path = traceCoverage(cov, W, H);
  if (path) {
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fill(new Path2D(path), 'evenodd');
  }
  return out;
}
