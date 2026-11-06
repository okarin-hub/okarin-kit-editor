/**
 * Recognises a regular pattern in the flattened body of a jersey photo (see photoPattern) and describes it as a
 * pattern layer of the editor: stripes at any angle (vertical, horizontal, slanted), one band (a sash or a centre
 * stripe), or a plain shirt. Irregular patterns, and patterns of three or more colours, are not recognised; they
 * keep the colour-layer route.
 *
 * The body is measured in texture pixels of the front piece. For each angle the pixels are projected onto the
 * axis across the stripes; when nearly every pixel is explained by "stripe or not" along that axis, the pattern is
 * stripes at that angle, and the runs along the axis give their period, width and position.
 */
import { PART_MAP } from '@/constants/pes2021Parts';
import type { PatternSettings } from '@/types/kit';
import { FRONT_BODY, PatternResult, PhotoSleeves } from '@/utils/photoPattern';

export interface RecognisedPattern {
  kind: 'plain' | 'stripes' | 'band';
  /** across-the-stripes direction in degrees (0 = vertical stripes, 90 = horizontal) */
  angle: number;
  /** texture px (stripes) */
  period: number;
  /** stripe or band width, texture px */
  width: number;
  /** colour of the shirt body and of the sleeves */
  ground: string;
  sleeve: string;
  /** the sleeves are patterned too (they get the layer) */
  sleevesPatterned: boolean;
  /** the pattern layer to add (null for a plain shirt) */
  layer: PatternSettings | null;
  /** share of the body pixels the recognised pattern explains */
  fit: number;
}

/** share of the pixels the best stripe direction must explain (a maze or a print explains far less) */
const ACCEPT = 0.86;
/** share the fitted stripes (period, width, phase) must match: a little lower, the photo's spacing wobbles */
const FIT = 0.82;

const rgbOf = (hex: string) => [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16));

/** For every pixel of `canvas`, the index of the nearest palette colour. */
function labelsOf(canvas: HTMLCanvasElement, w: number, h: number, palette: string[]): Uint8Array {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const d = ctx.getImageData(0, 0, w, h).data;
  const pal = palette.map(rgbOf);
  const out = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    let best = 0, bd = Infinity;
    pal.forEach(([r, g, b], i) => {
      const dd = (d[p * 4] - r) ** 2 + (d[p * 4 + 1] - g) ** 2 + (d[p * 4 + 2] - b) ** 2;
      if (dd < bd) {
        bd = dd;
        best = i;
      }
    });
    out[p] = best;
  }
  return out;
}

/** Profile of the mask along direction `deg`: per 1-px bin of t (offset by `D`), pixel count and stripe count. */
function profile(mask: Uint8Array, xs: Float32Array, ys: Float32Array, deg: number, D: number, step: number) {
  const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const bins = 2 * D + 1;
  const cnt = new Uint32Array(bins), sum = new Uint32Array(bins);
  for (let p = 0; p < mask.length; p += step) {
    const b = Math.round(xs[p] * ca + ys[p] * sa) + D;
    cnt[b]++;
    sum[b] += mask[p];
  }
  let ok = 0, all = 0;
  for (let b = 0; b < bins; b++) {
    ok += Math.max(sum[b], cnt[b] - sum[b]);
    all += cnt[b];
  }
  return { cnt, sum, purity: all ? ok / all : 0 };
}

/** sRGB hex -> CIE Lab */
function labOf(hex: string): [number, number, number] {
  const lin = (v: number) => {
    v /= 255;
    return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92;
  };
  const [r, g, b] = rgbOf(hex).map(lin);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/**
 * Folds split one colour of the shirt into a lit and a shaded cluster (red and dark red). Colours of the same
 * hue that differ only in lightness are grouped; each group is one pattern colour.
 */
function sameHueGroups(palette: string[]): number[][] {
  const lab = palette.map(labOf);
  const groups: number[][] = [];
  palette.forEach((_, i) => {
    const g = groups.find((gr) =>
      gr.some((j) => Math.hypot(lab[i][1] - lab[j][1], lab[i][2] - lab[j][2]) < 15 && Math.abs(lab[i][0] - lab[j][0]) < 30)
    );
    if (g) g.push(i);
    else groups.push([i]);
  });
  return groups;
}

const med = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

export function recognisePattern(front: PatternResult, sleeves: PhotoSleeves | null): RecognisedPattern | null {
  // more than two colours: try again with the shaded copies of a colour joined to it; two colours that are
  // nearly the same (a lit and a shaded half of a plain shirt) are one colour too
  const twoClose =
    front.palette.length === 2 &&
    (() => {
      const [a, c] = front.palette.map(labOf);
      return Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]) < 12;
    })();
  const groups = twoClose ? [[0, 1]] : front.palette.length <= 2 ? front.palette.map((_, i) => [i]) : sameHueGroups(front.palette);
  if (groups.length > 2) return null;
  const groupOf = new Uint8Array(front.palette.length);
  groups.forEach((g, k) => g.forEach((i) => (groupOf[i] = k)));
  const W = FRONT_BODY.w, H = FRONT_BODY.h, N = W * H;
  // the flattened body at texture scale (it fills FRONT_BODY in the texture)
  const c = (typeof document === 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H })) as HTMLCanvasElement;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(front.canvas, 0, 0, W, H);
  const raw = labelsOf(c, W, H, front.palette);
  const rawCounts = front.palette.map((_, i) => raw.reduce((n, v) => n + (v === i ? 1 : 0), 0));
  const labels = raw.map((v) => groupOf[v]);
  const counts = groups.map((g) => g.reduce((n, i) => n + rawCounts[i], 0));
  // a group's colour: its most common member (the lit one, as a rule)
  const colours = groups.map((g) => front.palette[g.reduce((a, i) => (rawCounts[i] > rawCounts[a] ? i : a), g[0])]);
  const ground = counts[0] >= (counts[1] ?? 0) ? 0 : 1;

  // sleeves: their main colour, and whether they are patterned
  let sleeve = colours[ground], sleevesPatterned = false;
  if (sleeves?.colour) {
    // plain sleeves in a colour of their own (raglan)
    sleeve = sleeves.colour;
  } else if (sleeves) {
    const sc = groups.map(() => 0);
    let total = 0;
    for (const band of [sleeves.left, sleeves.right]) {
      const l = labelsOf(band, band.width, band.height, front.palette);
      l.forEach((v) => sc[groupOf[v]]++);
      total += l.length;
    }
    const top = sc.indexOf(Math.max(...sc));
    sleeve = colours[top];
    sleevesPatterned = sc[top] / total < 0.8;
  }

  const minority = 1 - ground;
  const share = groups.length < 2 ? 0 : counts[minority] / N;
  const base = { ground: colours[ground], sleeve, sleevesPatterned };
  if (share < 0.03) return { kind: 'plain', angle: 0, period: 0, width: 0, layer: null, fit: 1 - share, ...base };

  // texture coordinates relative to the centre of the front piece (the pattern renderer turns around it)
  const b = PART_MAP.front.bounds;
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  const xs = new Float32Array(N), ys = new Float32Array(N), mask = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      xs[p] = FRONT_BODY.x + x + 0.5 - cx;
      ys[p] = FRONT_BODY.y + y + 0.5 - cy;
      mask[p] = labels[p] === minority ? 1 : 0;
    }
  }
  const D = Math.ceil(Math.hypot(b.width, b.height) / 2) + 2;

  // the angle that explains the most pixels: coarse on a sample, then fine
  let bestDeg = 0, bestPurity = -1;
  for (let deg = -88; deg <= 90; deg += 2) {
    const { purity } = profile(mask, xs, ys, deg, D, 3);
    if (purity > bestPurity) {
      bestPurity = purity;
      bestDeg = deg;
    }
  }
  const coarse = bestDeg;
  for (let deg = coarse - 2; deg <= coarse + 2; deg += 0.5) {
    const { purity } = profile(mask, xs, ys, deg, D, 1);
    if (purity > bestPurity || deg === coarse - 2) {
      bestPurity = purity;
      bestDeg = deg;
    }
  }
  if (bestPurity < ACCEPT) return null;
  // nearly level / upright: exactly so
  let angle = bestDeg;
  if (Math.abs(angle) <= 2) angle = 0;
  else if (Math.abs(angle - 90) <= 2 || Math.abs(angle + 90) <= 2) angle = 90;
  const { cnt, sum } = profile(mask, xs, ys, angle, D, 1);

  // runs of stripe along the axis; a run cut by the end of the body box is partial
  let lo = 0, hi = cnt.length - 1;
  while (lo < hi && cnt[lo] < 3) lo++;
  while (hi > lo && cnt[hi] < 3) hi--;
  const on = (i: number) => cnt[i] >= 3 && sum[i] * 2 > cnt[i];
  const runs: { s: number; e: number; partial: boolean }[] = [];
  for (let i = lo; i <= hi; i++) {
    if (!on(i)) continue;
    let j = i;
    while (j + 1 <= hi && on(j + 1)) j++;
    if (j - i >= 1) runs.push({ s: i - D, e: j + 1 - D, partial: i === lo || j === hi });
    i = j;
  }
  if (!runs.length) return null;

  const a = (angle * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  // share of pixels the model gets right, but 0 unless it also covers the pattern pixels themselves (overlap of
  // model and pattern ≥ 0.6): on a mostly plain shirt any model is "right" for the ground alone
  const accuracy = (inStripe: (t: number) => boolean) => {
    let ok = 0, both = 0, either = 0;
    for (let p = 0; p < N; p++) {
      const m = inStripe(xs[p] * ca + ys[p] * sa), k = mask[p] === 1;
      if (m === k) ok++;
      if (m && k) both++;
      if (m || k) either++;
    }
    return either && both / either >= 0.6 ? ok / N : 0;
  };
  const horizontal = angle === 90;
  // the renderer measures the phase from the piece's left (top) edge, inside the turned frame
  const edge = horizontal ? b.height / 2 : b.width / 2;
  const layerBase = {
    pattern: horizontal ? ('horizontal-stripes' as const) : ('vertical-stripes' as const),
    patternColor: colours[minority],
    patternOpacity: 1,
    patternRotation: horizontal ? 0 : angle,
    patternOffsetX: 0,
    patternOffsetY: 0,
  };
  const setOffset = (v: number) => (horizontal ? { patternOffsetY: v } : { patternOffsetX: v });
  const full = runs.filter((r) => !r.partial);

  // stripes: at least two whole stripes at a steady spacing
  if (full.length >= 2) {
    const starts = runs.filter((r, i) => !(r.partial && i === 0)).map((r) => r.s);
    const gaps = starts.slice(1).map((s, i) => s - starts[i]);
    const g0 = med(gaps);
    // perspective and rounding make the spacing wobble a little: the period and phase that fit all the stripe
    // starts best (a straight line through start i = t0 + i·P), not the first stripe alone
    const n = starts.length, mi = (n - 1) / 2, ms = starts.reduce((x, y) => x + y, 0) / n;
    let num = 0, den = 0;
    starts.forEach((v, i) => {
      num += (i - mi) * (v - ms);
      den += (i - mi) ** 2;
    });
    const P = den ? num / den : g0;
    const t0 = ms - mi * P;
    const Wd = full.reduce((x, r) => x + r.e - r.s, 0) / full.length;
    if (P >= 8 && gaps.every((g) => Math.abs(g - P) < 0.25 * P) && Wd < P) {
      const fit = accuracy((t) => ((((t - t0) % P) + P) % P) < Wd);
      if (fit >= FIT) {
        return {
          kind: 'stripes',
          angle,
          period: P,
          width: Wd,
          fit,
          ...base,
          layer: {
            ...layerBase,
            patternScale: P,
            patternThickness: Math.min(0.95, Math.max(0.05, Wd / P)),
            ...setOffset((((t0 + edge) % P) + P) % P),
          },
        };
      }
    }
  }

  // one band (a sash, a centre stripe, a half): drawn once; a band cut by the box edge runs on past it
  if (runs.length === 1) {
    const r = runs[0];
    const s = r.s === lo - D ? r.s - 400 : r.s;
    const e = r.e === hi + 1 - D ? r.e + 400 : r.e;
    const Wd = e - s, tc = (s + e) / 2;
    const fit = accuracy((t) => Math.abs(t - tc) < Wd / 2);
    if (fit >= ACCEPT) {
      return {
        kind: 'band',
        angle,
        period: 0,
        width: Math.min(Wd, r.e - r.s),
        fit,
        ...base,
        layer: { ...layerBase, patternScale: Math.max(8, Wd * 2), patternThickness: 0.5, patternRepeat: false, ...setOffset(tc) },
      };
    }
  }
  return null;
}
