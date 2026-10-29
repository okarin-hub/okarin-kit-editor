/**
 * Cuts the letters of a font sheet out of their background (PNG with transparency, or JPG / any picture
 * on a plain, gradient or noisy background). The result keeps the picture's colours with a new alpha.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface InkOptions {
  /** background colour; null = read from the border of the area */
  bg: [number, number, number] | null;
  /** letter colour; null = anything far enough from the background */
  ink: [number, number, number] | null;
  /** 0..100: higher keeps fainter / closer-to-background pixels */
  tolerance: number;
  /** keep the picture's own transparency when it has some */
  useAlpha: boolean;
}

const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0;

/** Colour of a pixel (for the click pickers). */
export function colorAt(image: CanvasImageSource & { width: number; height: number }, x: number, y: number): [number, number, number] {
  const c = document.createElement('canvas');
  c.width = 5;
  c.height = 5;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, Math.round(x) - 2, Math.round(y) - 2, 5, 5, 0, 0, 5, 5);
  const d = ctx.getImageData(0, 0, 5, 5).data;
  const ch = (k: number) => median(Array.from({ length: 25 }, (_, i) => d[i * 4 + k]));
  return [ch(0), ch(1), ch(2)];
}

/** Removes ink islands smaller than `minArea` pixels (JPG noise, dust). */
function removeSpecks(alpha: Uint8ClampedArray, w: number, h: number, minArea: number) {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const members: number[] = [];
  for (let p = 0; p < w * h; p++) {
    if (seen[p] || alpha[p] < 128) continue;
    let top = 0;
    stack[top++] = p;
    seen[p] = 1;
    members.length = 0;
    while (top) {
      const q = stack[--top];
      members.push(q);
      const x = q % w;
      const nb = [q - w, q + w, x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1];
      for (const n of nb) {
        if (n >= 0 && n < w * h && !seen[n] && alpha[n] >= 128) {
          seen[n] = 1;
          stack[top++] = n;
        }
      }
    }
    if (members.length < minArea) for (const q of members) alpha[q] = 0;
  }
}

/**
 * Returns the area `rect` of the picture with the background made transparent, at most `maxSize` px on its long side.
 */
export function extractInk(
  image: CanvasImageSource & { width: number; height: number },
  rect: Rect,
  opts: InkOptions,
  maxSize = 4096
): HTMLCanvasElement {
  const k = Math.min(1, maxSize / Math.max(rect.w, rect.h));
  const w = Math.max(1, Math.round(rect.w * k));
  const h = Math.max(1, Math.round(rect.h * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  let transparent = 0;
  for (let i = 3; i < d.length; i += 4 * 61) if (d[i] < 250) transparent++;
  const hasAlpha = opts.useAlpha && transparent > (d.length / 4 / 61) * 0.05;

  const alpha = new Uint8ClampedArray(w * h);
  if (hasAlpha) {
    for (let p = 0; p < w * h; p++) alpha[p] = d[p * 4 + 3];
  } else {
    let bg = opts.bg;
    if (!bg) {
      const border: number[] = [];
      for (let x = 0; x < w; x += 3) border.push(x, (h - 1) * w + x);
      for (let y = 0; y < h; y += 3) border.push(y * w, y * w + w - 1);
      bg = [0, 1, 2].map((ch) => median(border.map((p) => d[p * 4 + ch]))) as [number, number, number];
    }
    const dist = (i: number, c: [number, number, number]) =>
      Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]);
    const t = opts.tolerance / 100; // 0..1
    // where background ends and ink starts, from the picture itself (Otsu on the distance to the background):
    // a gradient or noisy background stays below it, the letters above
    let otsu = 150;
    if (!opts.ink) {
      const hist = new Float64Array(766);
      for (let p = 0; p < w * h; p += 3) hist[Math.min(765, dist(p * 4, bg))]++;
      const total = hist.reduce((s, v) => s + v, 0);
      const sumAll = hist.reduce((s, v, i) => s + v * i, 0);
      let wB = 0, sumB = 0, best = -1;
      for (let i = 0; i < 766; i++) {
        wB += hist[i];
        if (!wB || wB === total) continue;
        sumB += i * hist[i];
        const mB = sumB / wB, mF = (sumAll - sumB) / (total - wB);
        const between = wB * (total - wB) * (mB - mF) ** 2;
        if (between > best) {
          best = between;
          otsu = i;
        }
      }
      otsu = Math.max(40, otsu);
    }
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      const dBg = dist(i, bg);
      let a: number;
      if (opts.ink) {
        // a pixel on the line background -> letter colour is a mix of the two: its place on the line is the
        // letter's coverage (smooth anti-aliased edge); a colour off that line (neon lines, glow) is background
        const ink = opts.ink;
        const u0 = ink[0] - bg[0], u1 = ink[1] - bg[1], u2 = ink[2] - bg[2];
        const v0 = d[i] - bg[0], v1 = d[i + 1] - bg[1], v2 = d[i + 2] - bg[2];
        const along = (v0 * u0 + v1 * u1 + v2 * u2) / Math.max(1, u0 * u0 + u1 * u1 + u2 * u2);
        const k = Math.max(0, Math.min(1, along));
        const off = Math.hypot(v0 - k * u0, v1 - k * u1, v2 - k * u2);
        const onLine = Math.max(0, Math.min(1, (20 + t * 100 - off) / 25 + 0.5));
        a = Math.max(0, Math.min(1, (along - 0.15) / 0.7)) * onLine;
        // edge pixels take the letter colour, so no background tint is left around the letters
        if (a > 0 && along < 0.85) {
          d[i] = ink[0];
          d[i + 1] = ink[1];
          d[i + 2] = ink[2];
        }
      } else {
        // colour distance where a pixel becomes ink; tolerance 50 = the measured split
        const cut = otsu * (1.5 - t);
        a = (dBg - cut) / Math.max(20, otsu * 0.3) + 0.5;
      }
      alpha[p] = Math.max(0, Math.min(1, a)) * 255;
    }
  }
  removeSpecks(alpha, w, h, Math.max(12, Math.round(w * h * 0.00004)));
  for (let p = 0; p < w * h; p++) d[p * 4 + 3] = alpha[p];
  ctx.putImageData(img, 0, 0);
  return c;
}
