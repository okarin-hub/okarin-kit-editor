/**
 * Turns a photo of a jersey (a product mockup) into a flat kit texture of its pattern: the colours of the pattern
 * are found by clustering (shading and folds fall into the same colour), logos and text (pixels that match no
 * pattern colour) are filled from the pattern around them, and the result is painted onto the shirt parts of the
 * 1024 texture. The texture then goes through the PNG "split by colour" import to become editable layers.
 */
import { PART_MAP } from '@/constants/pes2021Parts';
import { partPolygons, tracePolygons } from '@/utils/partShape';
import { traceCoverage } from '@/utils/glyphTrace';

export interface PhotoRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0;

/**
 * A canvas that also works in a web worker (OffscreenCanvas there). shortcut: typed as HTMLCanvasElement because
 * this file only uses what both have (getContext, width / height, drawing it); no toBlob / toDataURL here.
 */
function newCanvas(w: number, h: number): HTMLCanvasElement {
  if (typeof document === 'undefined') return new OffscreenCanvas(w, h) as unknown as HTMLCanvasElement;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function draw(img: CanvasImageSource & { width: number; height: number }, rect: PhotoRect, maxSize: number) {
  const k = Math.min(1, maxSize / Math.max(rect.w, rect.h));
  const c = newCanvas(Math.max(1, Math.round(rect.w * k)), Math.max(1, Math.round(rect.h * k)));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, c.width, c.height);
  return { c, ctx, d: ctx.getImageData(0, 0, c.width, c.height).data, k };
}

/**
 * The body of the shirt in a mockup photo: the shirt is everything that differs from the plain background
 * (read at the border); the body leaves out the sleeves and the side folds (the outer 22 % on each side) and the collar.
 */
type Photo = CanvasImageSource & { width: number; height: number };

/** The plain background of a mockup photo (median colour along its border) and a test for shirt pixels. */
function inkTest(d: Uint8ClampedArray, w: number, h: number) {
  const border: number[] = [];
  for (let x = 0; x < w; x += 2) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y += 2) border.push(y * w, y * w + w - 1);
  const bg = [0, 1, 2].map((ch) => median(border.map((p) => d[p * 4 + ch])));
  return (p: number) =>
    Math.abs(d[p * 4] - bg[0]) + Math.abs(d[p * 4 + 1] - bg[1]) + Math.abs(d[p * 4 + 2] - bg[2]) > 60 && d[p * 4 + 3] > 128;
}

export function guessTorso(img: Photo): PhotoRect {
  return guessAreas(img).body;
}

/**
 * The body and the two sleeves of a shirt in a mockup photo, as boxes. Sleeves are the outer 22 % on each side,
 * from the shoulder down to the lowest shirt pixel near the outer edge (the cuff).
 */
export function guessAreas(img: Photo): { body: PhotoRect; left: PhotoRect; right: PhotoRect } {
  const full = { x: 0, y: 0, w: img.width, h: img.height };
  const { c, d, k } = draw(img, full, 400);
  const w = c.width, h = c.height;
  const ink = inkTest(d, w, h);
  const cols = Array.from({ length: w }, (_, x) => {
    let n = 0;
    for (let y = 0; y < h; y++) if (ink(y * w + x)) n++;
    return n;
  });
  const rows = Array.from({ length: h }, (_, y) => {
    let n = 0;
    for (let x = 0; x < w; x++) if (ink(y * w + x)) n++;
    return n;
  });
  const x0 = cols.findIndex((n) => n > h * 0.05), x1 = w - 1 - [...cols].reverse().findIndex((n) => n > h * 0.05);
  const y0 = rows.findIndex((n) => n > w * 0.05), y1 = h - 1 - [...rows].reverse().findIndex((n) => n > w * 0.05);
  if (x0 < 0 || y0 < 0 || x1 <= x0 || y1 <= y0) return { body: full, left: full, right: full };
  const bw = x1 - x0, bh = y1 - y0;
  const back = (r: PhotoRect) => ({ x: r.x / k, y: r.y / k, w: r.w / k, h: r.h / k });
  // the cuff: the lowest shirt pixel in a column near the outer edge
  const cuff = (x: number) => {
    const col = Math.round(x);
    for (let y = y1; y > y0; y--) if (ink(y * w + col)) return y;
    return y0 + bh * 0.45;
  };
  const top = y0 + bh * 0.08;
  const sw = bw * 0.22;
  return {
    // narrower than the body: the folds and shading at the sides (under the arms) stay out; a wider box makes
    // the colour groups follow the lighting instead of the pattern
    body: back({ x: x0 + bw * 0.22, y: y0 + bh * 0.17, w: bw * 0.56, h: bh * 0.81 }),
    left: back({ x: x0, y: top, w: sw, h: Math.max(bh * 0.15, cuff(x0 + bw * 0.04) - top) }),
    right: back({ x: x1 - sw, y: top, w: sw, h: Math.max(bh * 0.15, cuff(x1 - bw * 0.04) - top) }),
  };
}

/**
 * Both sleeves of a photo as straightened bands, read with the front's pattern colours. They are flattened in one
 * pass over the shirt from sleeve to sleeve: the lighting is then measured over the same large area as the body
 * (a small sleeve box alone would take the stripes themselves for shading).
 */
export function extractSleeves(img: Photo, left: PhotoRect, right: PhotoRect, palette: PatternResult): PhotoSleeves {
  const x0 = Math.min(left.x, right.x), y0 = Math.min(left.y, right.y);
  const area = { x: x0, y: y0, w: Math.max(left.x + left.w, right.x + right.w) - x0, h: Math.max(left.y + left.h, right.y + right.h) - y0 };
  const flat = flattenWithPalette(img, area, palette);
  const k = flat.width / area.w;
  const band = (r: PhotoRect) => {
    const c = newCanvas(Math.max(1, Math.round(r.w * k)), Math.max(1, Math.round(r.h * k)));
    c.getContext('2d')!.drawImage(flat, (r.x - x0) * k, (r.y - y0) * k, r.w * k, r.h * k, 0, 0, c.width, c.height);
    return straightenSleeve(img, r, c);
  };
  return { left: band(left), right: band(right) };
}

/**
 * `rect` of a photo in the known pattern colours: every shirt pixel takes the nearest colour (lighting taken out
 * as in extractPattern), the background and logos (far from every colour) take the colour of the nearest pattern
 * pixel, and a majority filter cleans the speckles. Simpler than extractPattern, which expects a clean body area.
 */
function flattenWithPalette(img: Photo, rect: PhotoRect, palette: PatternResult): HTMLCanvasElement {
  const { c, ctx, d } = draw(img, rect, 512);
  const w = c.width, h = c.height, N = w * h;
  const full = draw(img, { x: 0, y: 0, w: img.width, h: img.height }, 400);
  const fullInk = inkTest(full.d, full.c.width, full.c.height);
  const feats = new Float32Array(N * 3);
  for (let p = 0; p < N; p++) feats.set(lab(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]), p * 3);
  const shirt = new Uint8Array(N);
  for (let y = 0; y < h; y++) {
    const py = Math.min(full.c.height - 1, Math.round((rect.y + ((y + 0.5) / h) * rect.h) * full.k));
    for (let x = 0; x < w; x++) {
      const px = Math.min(full.c.width - 1, Math.round((rect.x + ((x + 0.5) / w) * rect.w) * full.k));
      shirt[y * w + x] = fullInk(py * full.c.width + px) ? 1 : 0;
    }
  }
  if (palette.lightWeight > 0) {
    // lighting: lightness against its local mean over the shirt (background and logos count as the typical value)
    const ls: number[] = [];
    for (let p = 0; p < N; p += 5) if (shirt[p]) ls.push(feats[p * 3]);
    const lmed = median(ls);
    const v = new Float32Array(N);
    for (let p = 0; p < N; p++) v[p] = shirt[p] && Math.abs(feats[p * 3] - lmed) <= 25 ? feats[p * 3] : lmed;
    const lc = newCanvas(w, h);
    const lctx = lc.getContext('2d', { willReadFrequently: true })!;
    const limg = lctx.createImageData(w, h);
    for (let p = 0; p < N; p++) {
      limg.data[p * 4] = Math.round(v[p] * 2.55);
      limg.data[p * 4 + 3] = 255;
    }
    lctx.putImageData(limg, 0, 0);
    const bc = newCanvas(w, h);
    const bctx = bc.getContext('2d', { willReadFrequently: true })!;
    bctx.fillStyle = `rgb(${Math.round(lmed * 2.55)},0,0)`;
    bctx.fillRect(0, 0, w, h);
    bctx.filter = `blur(${Math.max(w, h) * 0.08}px)`;
    bctx.drawImage(lc, 0, 0);
    const local = bctx.getImageData(0, 0, w, h).data;
    for (let p = 0; p < N; p++) feats[p * 3] = feats[p * 3] - local[p * 4] / 2.55 + lmed;
  }
  const lw = palette.lightWeight;
  let out = new Int16Array(N).fill(-1);
  for (let p = 0; p < N; p++) {
    if (!shirt[p]) continue;
    const f = [feats[p * 3] * lw, feats[p * 3 + 1], feats[p * 3 + 2]];
    let k = -1, best = 28;
    palette.centres.forEach((cc, i) => {
      const dd = fdist(f, cc);
      if (dd < best) {
        best = dd;
        k = i;
      }
    });
    out[p] = k;
  }
  // background and logos: the nearest pattern pixel
  const queue = new Int32Array(N);
  let head = 0, tail = 0;
  for (let p = 0; p < N; p++) if (out[p] >= 0) queue[tail++] = p;
  if (!tail) out.fill(0);
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    for (const q of [p - w, p + w, x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1]) {
      if (q >= 0 && q < N && out[q] < 0) {
        out[q] = out[p];
        queue[tail++] = q;
      }
    }
  }
  // majority filter (5×5, twice)
  const votes = new Array(palette.centres.length).fill(0);
  for (let pass = 0; pass < 2; pass++) {
    const next = new Int16Array(N);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        votes.fill(0);
        for (let yy = Math.max(0, y - 2); yy <= Math.min(h - 1, y + 2); yy++)
          for (let xx = Math.max(0, x - 2); xx <= Math.min(w - 1, x + 2); xx++) votes[out[yy * w + xx]]++;
        next[y * w + x] = votes.indexOf(Math.max(...votes));
      }
    }
    out = next;
  }
  dropSpecks(out, w, h, Math.max(20, Math.round(N * 0.001)));
  const rgb = palette.palette.map((hx) => [1, 3, 5].map((o) => parseInt(hx.slice(o, o + 2), 16)));
  const im = ctx.createImageData(w, h);
  for (let p = 0; p < N; p++) {
    const [r, g, b] = rgb[out[p]];
    im.data[p * 4] = r;
    im.data[p * 4 + 1] = g;
    im.data[p * 4 + 2] = b;
    im.data[p * 4 + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  return c;
}

/**
 * A flattened sleeve (`flat`, the pattern of `rect`) straightened: every row is stretched from the outer to the
 * inner edge of the shirt in that row, so a slanted sleeve becomes an upright band (shoulder at the top, cuff at
 * the bottom). Rows with hardly any shirt (below the cuff) repeat the nearest good row.
 */
export function straightenSleeve(img: Photo, rect: PhotoRect, flat: HTMLCanvasElement): HTMLCanvasElement {
  const full = draw(img, { x: 0, y: 0, w: img.width, h: img.height }, 400);
  const fullInk = inkTest(full.d, full.c.width, full.c.height);
  const w = flat.width, h = flat.height;
  const span: ([number, number] | null)[] = [];
  for (let y = 0; y < h; y++) {
    const py = Math.min(full.c.height - 1, Math.round((rect.y + ((y + 0.5) / h) * rect.h) * full.k));
    let l = -1, r = -1;
    for (let x = 0; x < w; x++) {
      const px = Math.min(full.c.width - 1, Math.round((rect.x + ((x + 0.5) / w) * rect.w) * full.k));
      if (fullInk(py * full.c.width + px)) {
        if (l < 0) l = x;
        r = x + 1;
      }
    }
    span.push(r - l > w * 0.2 ? [l, r] : null);
  }
  const out = newCanvas(w, h);
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y++) {
    let s = span[y];
    for (let t = 1; !s && t < h; t++) s = span[y - t] ?? span[y + t] ?? null;
    const [l, r] = s ?? [0, w];
    ctx.drawImage(flat, l, y, r - l, 1, 0, y, w, 1);
  }
  return out;
}

// ---------------------------------------------------------------- colour

/** sRGB -> CIE Lab */
function lab(r: number, g: number, b: number): [number, number, number] {
  const lin = (v: number) => {
    v /= 255;
    return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92;
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505);
  const Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

const fdist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export interface PatternResult {
  /** the flat pattern, one colour per pattern region, same proportions as the chosen area */
  canvas: HTMLCanvasElement;
  /** pattern colours, largest first */
  palette: string[];
  /** the pattern colours as clustering centres (to read another photo of the same kit with them) */
  centres: number[][];
  /** weight of lightness in the clustering: 0 when the pattern colours differ in hue (shading is then ignored) */
  lightWeight: number;
}

/**
 * The pattern inside `rect` of a jersey photo, flattened to its few colours with logos removed.
 * `minShare`: a colour must cover this much of the area to count as a pattern colour (logos and text cover less).
 */
export function extractPattern(
  img: CanvasImageSource & { width: number; height: number },
  rect: PhotoRect,
  minShare = 0.08,
  /** the pattern colours of the front: the back is read with them (its big number and name are not pattern) */
  palette?: PatternResult
): PatternResult {
  const { c, ctx, d } = draw(img, rect, 512);
  const w = c.width, h = c.height, N = w * h;
  // Lab, with the lighting taken out of the lightness: each pixel is compared with the mean lightness around it
  // (radius 8 % of the area). Shading and folds change slowly over a large area and drop out; the pattern,
  // which changes over a short distance, stays. Two pattern colours a few shades apart then separate clearly.
  const feats = new Float32Array(N * 3);
  const lc = newCanvas(w, h);
  const lctx = lc.getContext('2d', { willReadFrequently: true })!;
  const limg = lctx.createImageData(w, h);
  let mean = 0;
  for (let p = 0; p < N; p++) {
    const f = lab(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]);
    feats[p * 3] = f[0];
    feats[p * 3 + 1] = f[1];
    feats[p * 3 + 2] = f[2];
  }
  const lsorted = Array.from({ length: Math.ceil(N / 7) }, (_, i) => feats[i * 7 * 3]).sort((a, b) => a - b);
  const lmed = lsorted[Math.floor(lsorted.length / 2)];
  for (let p = 0; p < N; p++) {
    // logos (far brighter or darker than the shirt) count as the typical shirt lightness
    const v = Math.abs(feats[p * 3] - lmed) > 25 ? lmed : feats[p * 3];
    mean += v;
    limg.data[p * 4] = limg.data[p * 4 + 1] = limg.data[p * 4 + 2] = Math.round(v * 2.55);
    limg.data[p * 4 + 3] = 255;
  }
  mean /= N;
  lctx.putImageData(limg, 0, 0);
  const bc = newCanvas(w, h);
  const bctx = bc.getContext('2d', { willReadFrequently: true })!;
  bctx.fillStyle = `rgb(${Math.round(mean * 2.55)},0,0)`; // edges blur into the mean, not into black
  bctx.fillRect(0, 0, w, h);
  bctx.filter = `blur(${Math.max(w, h) * 0.08}px)`;
  bctx.drawImage(lc, 0, 0);
  const local = bctx.getImageData(0, 0, w, h).data;
  for (let p = 0; p < N; p++) feats[p * 3] = feats[p * 3] - local[p * 4] / 2.55 + mean;
  const step = Math.max(1, Math.floor(N / 30000));
  const sample: number[] = [];
  for (let p = 0; p < N; p += step) sample.push(p);
  const lightWeight = palette ? palette.lightWeight : hueSeparates(feats, sample, minShare) ? 0 : 1;
  const fp = (p: number) => [feats[p * 3] * lightWeight, feats[p * 3 + 1], feats[p * 3 + 2]];

  // k-means (k = 8, farthest-point start: logo colours take a few, the pattern colours still get their own),
  // then close clusters merge
  let centres = palette ? palette.centres.map((c) => [...c]) : [fp(sample[0])];
  while (!palette && centres.length < 8) {
    let far = sample[0], best = -1;
    for (const p of sample) {
      const m = Math.min(...centres.map((cc) => fdist(fp(p), cc)));
      if (m > best) {
        best = m;
        far = p;
      }
    }
    centres.push(fp(far));
  }
  const nearest = (f: number[]) => {
    let k = 0, best = Infinity;
    centres.forEach((cc, i) => {
      const dd = fdist(f, cc);
      if (dd < best) {
        best = dd;
        k = i;
      }
    });
    return { k, d: best };
  };
  for (let round = 0; round < (palette ? 0 : 10); round++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (const p of sample) {
      const f = fp(p);
      const s = sums[nearest(f).k];
      s[0] += f[0];
      s[1] += f[1];
      s[2] += f[2];
      s[3]++;
    }
    centres = centres.map((cc, i) => (sums[i][3] ? [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]] : cc));
    // two clusters that ended up close together are one colour
    for (let i = 0; i < centres.length; i++)
      for (let j = i + 1; j < centres.length; j++)
        if (fdist(centres[i], centres[j]) < 7) {
          centres.splice(j, 1);
          j--;
        }
  }

  // every pixel to its colour; pattern colours are the big clusters
  const label = new Int16Array(N);
  const count = new Array(centres.length).fill(0);
  for (let p = 0; p < N; p++) {
    const n = nearest(fp(p));
    label[p] = n.k;
    count[n.k]++;
  }
  const pattern = palette
    ? centres.map((_, i) => i)
    : centres.map((_, i) => i).filter((i) => count[i] / N >= minShare).sort((a, b) => count[b] - count[a]);
  if (!pattern.length) pattern.push(count.indexOf(Math.max(...count)));
  // a colour that lies between two other pattern colours is their blend (the soft edge of a brush stroke, a
  // print's dither), not a colour of its own: it is left out and its pixels take the colour around them
  if (!palette && pattern.length > 2) {
    const blend = (k: number) =>
      pattern.some((i) =>
        pattern.some((j) => {
          if (i === j || i === k || j === k) return false;
          const a = centres[i], b = centres[j], c = centres[k];
          const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
          const len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
          if (!len2) return false;
          const t = ((c[0] - a[0]) * ab[0] + (c[1] - a[1]) * ab[1] + (c[2] - a[2]) * ab[2]) / len2;
          if (t < 0.15 || t > 0.85) return false;
          const p = [a[0] + t * ab[0], a[1] + t * ab[1], a[2] + t * ab[2]];
          // close to the line, and smaller than both ends
          return fdist(c, p) < Math.max(6, Math.sqrt(len2) * 0.12) && count[k] < count[i] && count[k] < count[j];
        })
      );
    const blends = pattern.filter(blend);
    for (const k of blends) pattern.splice(pattern.indexOf(k), 1);
  }
  const keep = new Int16Array(centres.length).fill(-1);
  pattern.forEach((k, i) => (keep[k] = i));
  const out = new Int16Array(N);
  for (let p = 0; p < N; p++) {
    const k = keep[label[p]];
    // also out: a pixel far from its pattern colour (a highlight, a logo edge)
    out[p] = k >= 0 && fdist(fp(p), centres[label[p]]) < 28 ? k : -1;
  }

  for (let pass = 0; pass < 2; pass++) {
    const grow: number[] = [];
    for (let p = 0; p < N; p++) {
      if (out[p] >= 0) continue;
      const x = p % w;
      for (const q of [p - w, p + w, x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1]) if (q >= 0 && q < N && out[q] >= 0) grow.push(q);
    }
    for (const q of grow) out[q] = -1;
  }

  // main direction of the pattern (structure tensor of the lightness over the visible pattern): stripes run
  // across the gradient. Only used when one direction clearly dominates (coherence).
  let jxx = 0, jyy = 0, jxy = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (out[p] < 0 || out[p - 1] < 0 || out[p + 1] < 0 || out[p - w] < 0 || out[p + w] < 0) continue;
      const gx = (feats[(p + 1) * 3] - feats[(p - 1) * 3]) / 2;
      const gy = (feats[(p + w) * 3] - feats[(p - w) * 3]) / 2;
      jxx += gx * gx;
      jyy += gy * gy;
      jxy += gx * gy;
    }
  }
  const coherence = Math.hypot(jxx - jyy, 2 * jxy) / (jxx + jyy || 1);
  // even a pattern with two directions (a maze) has one that is stronger: continue along it
  if (coherence > 0.08) {
    const ga = 0.5 * Math.atan2(2 * jxy, jxx - jyy);
    const dx = -Math.sin(ga), dy = Math.cos(ga); // along the stripes
    const filled = new Int16Array(out);
    for (let p = 0; p < N; p++) {
      if (out[p] >= 0) continue;
      const x0 = p % w, y0 = (p - x0) / w;
      const look = (sgn: number) => {
        for (let t = 1; t < Math.max(w, h); t++) {
          const x = Math.round(x0 + sgn * dx * t), y = Math.round(y0 + sgn * dy * t);
          if (x < 0 || y < 0 || x >= w || y >= h) return null;
          const v = out[y * w + x];
          if (v >= 0) return { v, t };
        }
        return null;
      };
      const a = look(1), b = look(-1);
      if (a && b) filled[p] = a.v === b.v || a.t <= b.t ? a.v : b.v;
      else if (a || b) filled[p] = (a ?? b)!.v;
    }
    out.set(filled);
  }

  // logos and text the pattern could not reach take the pattern colour around them (nearest known pixel)
  const queue = new Int32Array(N);
  let head = 0, tail = 0;
  for (let p = 0; p < N; p++) if (out[p] >= 0) queue[tail++] = p;
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    for (const q of [p - w, p + w, x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1]) {
      if (q >= 0 && q < N && out[q] < 0) {
        out[q] = out[p];
        queue[tail++] = q;
      }
    }
  }

  // Pattern edges are sharp, shading and folds are gradual: split the photo into areas bounded by sharp edges
  // and give each area the colour most of its pixels have, so a fold across a stripe goes with that stripe.
  {
    const ch = [0, 1, 2].map((k) => {
      const v = new Float32Array(N);
      for (let p = 0; p < N; p++) v[p] = (k === 0 ? lightWeight : 1) * feats[p * 3 + k];
      return boxBlur(v, w, h);
    });
    // an edge is a step of at least a quarter of the smallest gap between two pattern colours
    let gap = Infinity;
    const pc = pattern.map((k) => centres[k]);
    for (let i = 0; i < pc.length; i++) for (let j = i + 1; j < pc.length; j++) gap = Math.min(gap, fdist(pc[i], pc[j]));
    if (Number.isFinite(gap)) {
      const thr = gap * 0.1;
      const edge = new Uint8Array(N);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const q = y * w + x;
          let g = 0;
          for (const c of ch) g += ((c[q + 1] - c[q - 1]) / 2) ** 2 + ((c[q + w] - c[q - w]) / 2) ** 2;
          if (Math.sqrt(g) > thr) edge[q] = 1;
        }
      }
      // close small gaps in the edge lines so areas do not leak into each other
      const closed = new Uint8Array(edge);
      for (let q = 0; q < N; q++) if (edge[q]) for (const r of [q - 1, q + 1, q - w, q + w]) if (r >= 0 && r < N) closed[r] = 1;
      const seen = new Uint8Array(N);
      const stack = new Int32Array(N);
      const members: number[] = [];
      const votes = new Array(pattern.length).fill(0);
      for (let s0 = 0; s0 < N; s0++) {
        if (seen[s0] || closed[s0]) continue;
        let top = 0;
        stack[top++] = s0;
        seen[s0] = 1;
        members.length = 0;
        votes.fill(0);
        while (top) {
          const q = stack[--top];
          members.push(q);
          votes[out[q]]++;
          const x = q % w;
          for (const r of [q - w, q + w, x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1]) {
            if (r >= 0 && r < N && !seen[r] && !closed[r]) {
              seen[r] = 1;
              stack[top++] = r;
            }
          }
        }
        const win = votes.indexOf(Math.max(...votes));
        for (const q of members) out[q] = win;
      }
    }
  }

  // majority filter (5×5, twice): clean speckles and ragged edges
  let cur = out;
  for (let pass = 0; pass < 2; pass++) {
    const next = new Int16Array(N);
    const votes = new Array(pattern.length).fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        votes.fill(0);
        for (let dy = -2; dy <= 2; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx;
            if (xx >= 0 && xx < w) votes[cur[yy * w + xx]]++;
          }
        }
        next[y * w + x] = votes.indexOf(Math.max(...votes));
      }
    }
    cur = next;
  }

  // the real colour of each pattern region: median of its clearly-matching photo pixels (the front's for the back)
  const rgb = pattern.map((k, i) => {
    if (palette) return [1, 3, 5].map((o) => parseInt(palette.palette[i].slice(o, o + 2), 16));
    const rs: number[] = [], gs: number[] = [], bs: number[] = [];
    for (let p = 0; p < N; p += 3) {
      if (label[p] === k && out[p] >= 0) {
        rs.push(d[p * 4]);
        gs.push(d[p * 4 + 1]);
        bs.push(d[p * 4 + 2]);
      }
    }
    return [median(rs), median(gs), median(bs)];
  });
  dropSpecks(cur, w, h, Math.max(30, Math.round(N * 0.0015)));
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  const palHex = rgb.map(([r, g, b]) => `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase());
  // the most common colour is the ground; every other colour is drawn on it as clean vector shapes
  const area = pattern.map((_, i) => cur.reduce((n, v) => n + (v === i ? 1 : 0), 0));
  const order = pattern.map((_, i) => i).sort((a, b) => area[b] - area[a]);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = palHex[order[0]];
  ctx.fillRect(0, 0, w, h);
  for (const i of order.slice(1)) {
    // a slightly blurred coverage gives the tracer a soft edge to follow (sub-pixel, not pixel steps)
    const cov = new Float32Array(N);
    for (let p = 0; p < N; p++) cov[p] = cur[p] === i ? 1 : 0;
    const path = traceCoverage(boxBlur(cov, w, h), w, h);
    if (!path) continue;
    ctx.fillStyle = palHex[i];
    ctx.fill(new Path2D(path), 'evenodd');
  }
  return { canvas: c, palette: palHex, centres: pattern.map((k) => centres[k]), lightWeight };
}

/**
 * Whether the pattern colours already differ in hue (a, b of Lab): the two biggest colours found on hue alone are
 * far apart compared with how much each varies. Shading changes lightness, not hue, so it can then be ignored.
 */
function hueSeparates(feats: Float32Array, sample: number[], minShare: number): boolean {
  const ab = (p: number) => [feats[p * 3 + 1], feats[p * 3 + 2]];
  const d2 = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let cs = [ab(sample[0])];
  while (cs.length < 6) {
    let far = sample[0], best = -1;
    for (const p of sample) {
      const m = Math.min(...cs.map((c) => d2(ab(p), c)));
      if (m > best) {
        best = m;
        far = p;
      }
    }
    cs.push(ab(far));
  }
  let members: number[][][] = [];
  for (let round = 0; round < 8; round++) {
    members = cs.map(() => []);
    for (const p of sample) {
      const v = ab(p);
      let k = 0;
      cs.forEach((c, i) => d2(v, c) < d2(v, cs[k]) && (k = i));
      members[k].push(v);
    }
    cs = cs.map((c, i) => (members[i].length ? [0, 1].map((j) => members[i].reduce((s, v) => s + v[j], 0) / members[i].length) : c));
  }
  const big = cs.map((_, i) => i).filter((i) => members[i].length / sample.length >= minShare).sort((a, b) => members[b].length - members[a].length);
  if (big.length < 2) return false;
  const [i, j] = big;
  const spread = Math.sqrt(
    [i, j].reduce((s, k) => s + members[k].reduce((t, v) => t + d2(v, cs[k]) ** 2, 0), 0) / (members[i].length + members[j].length)
  );
  return d2(cs[i], cs[j]) > 3 * Math.max(spread, 1);
}

/** 3×3 box blur, twice (a soft ~2 px edge) */
function boxBlur(a: Float32Array, w: number, h: number): Float32Array {
  let src = a;
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            s += src[yy * w + xx];
            n++;
          }
        }
        out[y * w + x] = s / n;
      }
    }
    src = out;
  }
  return src;
}

/** regions smaller than `min` pixels (leftover shading, creases) take the colour around them */
function dropSpecks(lab: Int16Array, w: number, h: number, min: number) {
  const N = w * h;
  const seen = new Uint8Array(N);
  const stack = new Int32Array(N);
  const members: number[] = [];
  for (let s = 0; s < N; s++) {
    if (seen[s]) continue;
    const v = lab[s];
    let top = 0;
    stack[top++] = s;
    seen[s] = 1;
    members.length = 0;
    const around = new Map<number, number>();
    while (top) {
      const p = stack[--top];
      members.push(p);
      const x = p % w;
      for (const q of [p - w, p + w, x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1]) {
        if (q < 0 || q >= N) continue;
        if (lab[q] === v) {
          if (!seen[q]) {
            seen[q] = 1;
            stack[top++] = q;
          }
        } else around.set(lab[q], (around.get(lab[q]) ?? 0) + 1);
      }
    }
    if (members.length < min && around.size) {
      const to = [...around.entries()].sort((a, b) => b[1] - a[1])[0][0];
      for (const p of members) lab[p] = to;
    }
  }
}

// ---------------------------------------------------------------- texture

/** body area of the front and back pieces in the 1024 texture (the back is stored upside down) */
export const FRONT_BODY = { x: 380, y: 452, w: 264, h: 486 };
const BACK_BODY = { x: 380, y: 0, w: 264, h: 452 };

/**
 * The 1024×1024 kit texture: shirt front, back and sleeves in the main pattern colour, the front and back bodies
 * filled with the flattened pattern; everything else stays transparent (shorts and socks are left alone).
 */
/** Straightened sleeves of one photo, by their side in that photo (see straightenSleeve). */
export interface PhotoSleeves {
  left: HTMLCanvasElement;
  right: HTMLCanvasElement;
}

/**
 * Sleeve pieces in the 1024 texture (measured on pes_kit.glb): the arm runs along x, shoulder at x 386 (right
 * piece 638) and the cuff 147 px further out; y 471 is the top of the arm, the front half runs down to the underarm
 * at 611, the back half up to 341. The shoulder strip up to the neck (x 512) continues the top of the sleeve.
 */
function drawSleeveHalf(
  ctx: CanvasRenderingContext2D,
  band: HTMLCanvasElement,
  piece: 'leftSleeve' | 'rightSleeve',
  half: 'front' | 'back',
  /** the top of the arm is the band's left edge (else its right edge) */
  outerLeft: boolean
) {
  const W = band.width, H = band.height;
  const x0 = piece === 'leftSleeve' ? 386 : 638;
  const dx = piece === 'leftSleeve' ? -147 : 147;
  const len = half === 'front' ? 140 : -130;
  // band (cx, cy) -> texture: cy runs shoulder -> cuff along x, cx runs top of arm -> underarm along y
  ctx.setTransform(0, (outerLeft ? len : -len) / W, dx / H, 0, x0, 471 + (outerLeft ? 0 : len));
  ctx.drawImage(band, 0, 0);
  // shoulder strip up to the neck: the top row of the band, stretched
  const k = 126 / 147;
  ctx.drawImage(band, 0, 0, W, 1, 0, -H * k, W, H * k);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function buildKitTexture(
  front: PatternResult,
  back: PatternResult | null,
  sleeves?: { front: PhotoSleeves; back: PhotoSleeves | null } | null
): HTMLCanvasElement {
  const c = newCanvas(1024, 1024);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false; // keep the flat colours flat (no blended edge colours for the colour split)
  for (const id of ['front', 'back', 'leftSleeve', 'rightSleeve'] as const) {
    ctx.beginPath();
    tracePolygons(ctx, partPolygons(PART_MAP[id]));
    ctx.fillStyle = front.palette[0];
    ctx.fill();
  }
  ctx.save();
  ctx.beginPath();
  tracePolygons(ctx, partPolygons(PART_MAP.front));
  ctx.clip();
  ctx.drawImage(front.canvas, FRONT_BODY.x, FRONT_BODY.y, FRONT_BODY.w, FRONT_BODY.h);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  tracePolygons(ctx, partPolygons(PART_MAP.back));
  ctx.clip();
  // upside down: the neck of the back piece is at the bottom of its area
  ctx.translate(BACK_BODY.x + BACK_BODY.w, BACK_BODY.y + BACK_BODY.h);
  ctx.rotate(Math.PI);
  ctx.drawImage((back ?? front).canvas, 0, 0, BACK_BODY.w, BACK_BODY.h);
  ctx.restore();
  if (sleeves) {
    const f = sleeves.front, b = sleeves.back;
    // the player's right sleeve (texture left piece) is on the left of the front photo and the right of the back
    const pieces = [
      { id: 'leftSleeve' as const, front: f.left, back: b ? b.right : f.left, backOuterLeft: !b },
      { id: 'rightSleeve' as const, front: f.right, back: b ? b.left : f.right, backOuterLeft: !!b },
    ];
    for (const p of pieces) {
      ctx.save();
      ctx.beginPath();
      // the short sleeve and its shoulder strip (the first outline); the long sleeve area keeps the main colour
      tracePolygons(ctx, [partPolygons(PART_MAP[p.id])[0]]);
      ctx.clip();
      drawSleeveHalf(ctx, p.front, p.id, 'front', p.id === 'leftSleeve');
      drawSleeveHalf(ctx, p.back, p.id, 'back', p.backOuterLeft);
      ctx.restore();
    }
  }
  return c;
}
