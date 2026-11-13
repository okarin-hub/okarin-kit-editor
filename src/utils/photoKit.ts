/**
 * Photo -> kit texture by projection: a few points marked on a jersey photo (neck, shoulders, armpits, hem, cuffs)
 * are matched to the same places of the PES 2021 shirt pieces, and the photo between them is copied there piece by
 * piece (triangles for the body, a straightened band per sleeve). The print comes over as it is: gradients, abstract
 * prints and logos included; the PNG colour split cleans it up afterwards (logos apart, colours as slots).
 */
import { PART_MAP } from '@/constants/pes2021Parts';
import { partPolygons, tracePolygons } from '@/utils/partShape';
import { drawSleeveHalf, guessAreas } from '@/utils/photoPattern';
import { analyzeColors } from '@/utils/colorClusters';
import { detectLogos } from '@/utils/logoDetect';
import { inpaint } from '@/utils/pngImport';

type Photo = CanvasImageSource & { width: number; height: number };
type Pt = { x: number; y: number };

/** The points to place on a photo; "L" / "R" are the left / right of the picture. */
export const KIT_MARKS = [
  ['neckL', 'Leher kiri'],
  ['neckC', 'Leher tengah'],
  ['neckR', 'Leher kanan'],
  ['shL', 'Pundak kiri'],
  ['shR', 'Pundak kanan'],
  ['armL', 'Ketiak kiri'],
  ['armR', 'Ketiak kanan'],
  ['waistL', 'Pinggang kiri'],
  ['waistR', 'Pinggang kanan'],
  ['hemL', 'Bawah kiri'],
  ['hemC', 'Bawah tengah'],
  ['hemR', 'Bawah kanan'],
  ['cuffTL', 'Manset atas kiri'],
  ['cuffBL', 'Manset bawah kiri'],
  ['cuffTR', 'Manset atas kanan'],
  ['cuffBR', 'Manset bawah kanan'],
] as const;
export type KitMarkId = (typeof KIT_MARKS)[number][0];
export type KitMarks = Record<KitMarkId, Pt>;

/** Lines drawn between the points on the photo, so the outline they make is easy to read. */
export const KIT_MARK_LINES: KitMarkId[][] = [
  ['shL', 'neckL', 'neckC', 'neckR', 'shR'],
  ['shL', 'armL', 'waistL', 'hemL', 'hemC', 'hemR', 'waistR', 'armR', 'shR'],
  ['shL', 'cuffTL', 'cuffBL', 'armL'],
  ['shR', 'cuffTR', 'cuffBR', 'armR'],
];

/** A first guess of the points from the outline of the shirt in a product photo (front or back, sleeves out). */
export function guessKitMarks(img: Photo): KitMarks {
  const b = guessAreas(img).bounds;
  const at = (u: number, v: number): Pt => ({ x: b.x + b.w * u, y: b.y + b.h * v });
  return {
    neckL: at(0.4, 0.03),
    neckC: at(0.5, 0.11),
    neckR: at(0.6, 0.03),
    shL: at(0.27, 0.09),
    shR: at(0.73, 0.09),
    armL: at(0.27, 0.4),
    armR: at(0.73, 0.4),
    waistL: at(0.265, 0.7),
    waistR: at(0.735, 0.7),
    hemL: at(0.26, 1),
    hemC: at(0.5, 1),
    hemR: at(0.74, 1),
    cuffTL: at(0, 0.27),
    cuffBL: at(0.1, 0.45),
    cuffTR: at(1, 0.27),
    cuffBR: at(0.9, 0.45),
  };
}

// The same places on the 1024 texture (from the part outlines in pes2021Parts). The front piece is seen from the
// front, so the left of a front photo is its left. The back piece is stored upside down and seen from behind: the left
// of a back photo (the player's left) is its right, the neck at the bottom.
const BODY = ['neckL', 'neckC', 'neckR', 'shL', 'shR', 'armL', 'armR', 'waistL', 'waistR', 'hemL', 'hemC', 'hemR'] as const;
type BodyId = (typeof BODY)[number] | 'C' | 'C2';
const FRONT_AT: Record<BodyId, Pt> = {
  neckL: { x: 450, y: 503.5 },
  neckC: { x: 512, y: 500 },
  neckR: { x: 574, y: 503.5 },
  shL: { x: 412.5, y: 518.5 },
  shR: { x: 611.5, y: 518.5 },
  armL: { x: 348, y: 611 },
  armR: { x: 677.5, y: 611 },
  waistL: { x: 348, y: 772 },
  waistR: { x: 677.5, y: 772 },
  hemL: { x: 348, y: 933.5 },
  hemC: { x: 512, y: 933.5 },
  hemR: { x: 677.5, y: 933.5 },
  C: { x: 512, y: 611 },
  C2: { x: 512, y: 772 },
};
const BACK_AT: Record<BodyId, Pt> = {
  neckL: { x: 574.5, y: 439 },
  neckC: { x: 512, y: 452.5 },
  neckR: { x: 449.5, y: 439 },
  shL: { x: 625.5, y: 413.5 },
  shR: { x: 406.5, y: 420 },
  armL: { x: 677.5, y: 341 },
  armR: { x: 348, y: 341 },
  waistL: { x: 677.5, y: 180 },
  waistR: { x: 348, y: 180 },
  hemL: { x: 677.5, y: 19 },
  hemC: { x: 512, y: 19 },
  hemR: { x: 348, y: 19 },
  C: { x: 512, y: 341 },
  C2: { x: 512, y: 180 },
};
/** The body as triangles, by point; C and C2 are the middle of the body at the height of the armpits / the waist. */
const TRIANGLES: [BodyId, BodyId, BodyId][] = [
  ['shL', 'neckL', 'armL'],
  ['neckL', 'C', 'armL'],
  ['neckL', 'neckC', 'C'],
  ['neckC', 'neckR', 'C'],
  ['neckR', 'armR', 'C'],
  ['neckR', 'shR', 'armR'],
  ['armL', 'C', 'waistL'],
  ['C', 'C2', 'waistL'],
  ['waistL', 'C2', 'hemL'],
  ['C2', 'hemC', 'hemL'],
  ['C', 'armR', 'waistR'],
  ['C', 'waistR', 'C2'],
  ['C2', 'waistR', 'hemR'],
  ['C2', 'hemR', 'hemC'],
];

/** The photo points of the body, with C / C2 where they lie on the texture: as far down the middle as the armpits / waist. */
function bodyPoints(m: KitMarks, at: Record<BodyId, Pt>): Record<BodyId, Pt> {
  const mid = (to: Pt): Pt => {
    const k = (to.y - at.neckC.y) / (at.hemC.y - at.neckC.y);
    return { x: m.neckC.x + (m.hemC.x - m.neckC.x) * k, y: m.neckC.y + (m.hemC.y - m.neckC.y) * k };
  };
  return { ...m, C: mid(at.C), C2: mid(at.C2) };
}

// sRGB <-> CIE Lab (D65), for changing lightness alone
const toLin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toSrgb = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const fLab = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const fInv = (t: number) => (t > 0.206893 ? t * t * t : (t - 16 / 116) / 7.787);
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const R = toLin(r), G = toLin(g), B = toLin(b);
  const x = fLab((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), y = fLab(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = fLab((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
export function labToRgb(L: number, a: number, bb: number): [number, number, number] {
  const y = (L + 16) / 116, x = y + a / 500, z = y - bb / 200;
  const X = fInv(x) * 0.95047, Y = fInv(y), Z = fInv(z) * 1.08883;
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(toSrgb(Math.max(0, v)))));
  return [c(3.2406 * X - 1.5372 * Y - 0.4986 * Z), c(-0.9689 * X + 1.8758 * Y + 0.0415 * Z), c(0.0557 * X - 0.204 * Y + 1.057 * Z)];
}

// self-check: a red, a navy and a grey survive the round trip within a step
for (const c of [[228, 19, 59], [40, 45, 110], [128, 128, 128]] as const) {
  const back = labToRgb(...rgbToLab(c[0], c[1], c[2]));
  if (back.some((v, i) => Math.abs(v - c[i]) > 1)) console.error('photoKit Lab self-check failed', c, back);
}

/**
 * Evens out the photo's lighting on the drawn shirt pieces: each pixel's lightness (Lab L) against the lightness
 * around it (a wide blur, inside the pieces only) is moved towards the pieces' mean by `strength` (0..1). Hue and
 * colourfulness are left alone. Broad shadow and highlight go, sharp print (letters, lines) stays; a very wide
 * gradient of the print itself flattens a little too.
 */
function evenLight(ctx: CanvasRenderingContext2D, strength: number) {
  if (strength <= 0) return;
  const S = 1024, R = 28;
  const img = ctx.getImageData(0, 0, S, S), d = img.data;
  const lum = new Float32Array(S * S), m = new Float32Array(S * S);
  const A = new Float32Array(S * S), Bb = new Float32Array(S * S);
  let sum = 0, n = 0;
  for (let p = 0, i = 0; p < S * S; p++, i += 4) {
    if (d[i + 3] < 200) continue;
    m[p] = 1;
    const [L, a, b] = rgbToLab(d[i], d[i + 1], d[i + 2]);
    lum[p] = L;
    A[p] = a;
    Bb[p] = b;
    sum += L;
    n++;
  }
  if (!n) return;
  const mean = sum / n;
  // box blur (rows, then columns) of the brightness and of the mask: their ratio is the mean around each pixel
  const blur = (src: Float32Array) => {
    const tmp = new Float32Array(S * S), out = new Float32Array(S * S);
    for (let y = 0; y < S; y++) {
      let acc = 0;
      for (let x = -R; x < S; x++) {
        if (x + R < S) acc += src[y * S + x + R];
        if (x - R - 1 >= 0) acc -= src[y * S + x - R - 1];
        if (x >= 0) tmp[y * S + x] = acc;
      }
    }
    for (let x = 0; x < S; x++) {
      let acc = 0;
      for (let y = -R; y < S; y++) {
        if (y + R < S) acc += tmp[(y + R) * S + x];
        if (y - R - 1 >= 0) acc -= tmp[(y - R - 1) * S + x];
        if (y >= 0) out[y * S + x] = acc;
      }
    }
    return out;
  };
  const bl = blur(lum), bm = blur(m);
  for (let p = 0, i = 0; p < S * S; p++, i += 4) {
    if (!m[p] || bm[p] <= 0) continue;
    const around = bl[p] / bm[p];
    const L = Math.max(0, Math.min(100, lum[p] + strength * (mean - around)));
    const [r, g, b] = labToRgb(L, A[p], Bb[p]);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);
}

/** The affine map taking the triangle s onto d, as canvas setTransform arguments (a, b, c, d, e, f). */
export function triangleTransform(s: [Pt, Pt, Pt], d: [Pt, Pt, Pt]): [number, number, number, number, number, number] {
  const [s0, s1, s2] = s, [d0, d1, d2] = d;
  const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y) || 1e-9;
  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den;
  const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den;
  const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den;
  const dd = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den;
  return [a, b, c, dd, d0.x - a * s0.x - c * s0.y, d0.y - b * s0.x - dd * s0.y];
}

// self-check: a triangle scaled by 2 and moved by (10, 5) gives exactly that map
{
  const t = triangleTransform(
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    [{ x: 10, y: 5 }, { x: 12, y: 5 }, { x: 10, y: 7 }]
  );
  if (t.some((v, i) => Math.abs(v - [2, 0, 0, 2, 10, 5][i]) > 1e-9)) console.error('photoKit triangleTransform self-check failed');
}

/** Copies the photo triangle s onto the texture triangle d (clipped to d, grown half a pixel so no seam shows). */
function drawTriangle(ctx: CanvasRenderingContext2D, img: Photo, s: [Pt, Pt, Pt], d: [Pt, Pt, Pt]) {
  const cx = (d[0].x + d[1].x + d[2].x) / 3, cy = (d[0].y + d[1].y + d[2].y) / 3;
  const grow = (p: Pt) => {
    const l = Math.hypot(p.x - cx, p.y - cy) || 1;
    return { x: p.x + ((p.x - cx) / l) * 0.6, y: p.y + ((p.y - cy) / l) * 0.6 };
  };
  ctx.save();
  ctx.beginPath();
  d.map(grow).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
  ctx.transform(...triangleTransform(s, d));
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/** One sleeve of a photo as a straight band: across it from the top of the arm to the underarm, down it to the cuff. */
function sleeveBand(img: Photo, corners: [Pt, Pt, Pt, Pt]): HTMLCanvasElement {
  // corners: band top-left, top-right (both at the shoulder), bottom-left, bottom-right (at the cuff)
  const W = 160, H = 160;
  const c = newCanvas(W, H);
  const ctx = c.getContext('2d')!;
  const [a, b, cc, d] = corners;
  const A = { x: 0, y: 0 }, B = { x: W, y: 0 }, C = { x: 0, y: H }, D = { x: W, y: H };
  drawTriangle(ctx, img, [a, b, cc], [A, B, C]);
  drawTriangle(ctx, img, [b, d, cc], [B, D, C]);
  return c;
}

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** The most common colour of the front body (32 levels per channel, the mean inside the fullest bin). */
function mainColour(ctx: CanvasRenderingContext2D): string {
  const d = ctx.getImageData(400, 560, 224, 360).data;
  const bins = new Map<number, number[]>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
    const b = bins.get(k) ?? [0, 0, 0, 0];
    b[0] += d[i]; b[1] += d[i + 1]; b[2] += d[i + 2]; b[3]++;
    bins.set(k, b);
  }
  let best = [128, 128, 128, 1];
  for (const b of bins.values()) if (b[3] > best[3]) best = b;
  const hex = (v: number) => Math.round(v / best[3]).toString(16).padStart(2, '0');
  return `#${hex(best[0])}${hex(best[1])}${hex(best[2])}`;
}

export interface PhotoShot {
  image: Photo;
  marks: KitMarks;
}

/**
 * The 1024×1024 kit texture of a jersey from a front photo (and a back photo, when there is one): body and short
 * sleeves projected from the photo, the rest of the shirt (collar strip, long sleeves) in the body's main colour.
 * Without a back photo the back gets the front's body, side for side (the player's right stays right); with
 * `cleanBack` the front's logos and sponsors are left out of that copy (found and filled in like Import PNG does,
 * a second or two: for the final texture, not for every move of a point). Shorts and socks stay empty.
 */
export function projectKit(
  front: PhotoShot,
  back: PhotoShot | null,
  cleanBack = false,
  /** 0..1: how much of the photo's broad lighting (shadows at the sides, highlights) is evened out */
  light = 0
): { texture: HTMLCanvasElement; colour: string } {
  const c = newCanvas(1024, 1024);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  const piece = (id: 'front' | 'back', draw: () => void) => {
    ctx.save();
    ctx.beginPath();
    tracePolygons(ctx, partPolygons(PART_MAP[id]));
    ctx.clip();
    draw();
    ctx.restore();
  };
  const body = (shot: PhotoShot, at: Record<BodyId, Pt>) => {
    const p = bodyPoints(shot.marks, at);
    for (const t of TRIANGLES) drawTriangle(ctx, shot.image, [p[t[0]], p[t[1]], p[t[2]]], [at[t[0]], at[t[1]], at[t[2]]]);
  };
  piece('front', () => body(front, FRONT_AT));
  piece('back', () => {
    if (back) return body(back, BACK_AT);
    // no back photo: the front body, the player's right side to the right side (left of the picture <-> right of it)
    const swap: Record<BodyId, BodyId> = {
      neckL: 'neckR', neckC: 'neckC', neckR: 'neckL', shL: 'shR', shR: 'shL', armL: 'armR', armR: 'armL',
      waistL: 'waistR', waistR: 'waistL', hemL: 'hemR', hemC: 'hemC', hemR: 'hemL', C: 'C', C2: 'C2',
    };
    const snapshot = newCanvas(1024, 1024);
    const sctx = snapshot.getContext('2d')!;
    sctx.drawImage(c, 0, 0);
    if (cleanBack) {
      const img = sctx.getImageData(0, 0, 1024, 1024);
      const a = analyzeColors(img, 22);
      const det = detectLogos(a.labels, a.clusters.map((cl) => cl.color));
      if (det.logos.length) {
        // the whole box of each logo, widened: in a photo the ends of a wide sponsor (where it meets a side panel) are
        // often left out of the logo's own pixels, and a ghost of them would stay. On the back that costs little.
        const hole = new Uint8Array(1024 * 1024);
        for (const { box: [x, y, w, h] } of det.logos) {
          const mx = w * 0.12 + 6, my = 6;
          for (let yy = Math.max(0, Math.floor(y - my)); yy < Math.min(1024, Math.ceil(y + h + my)); yy++) {
            for (let xx = Math.max(0, Math.floor(x - mx)); xx < Math.min(1024, Math.ceil(x + w + mx)); xx++) {
              if (img.data[(yy * 1024 + xx) * 4 + 3]) hole[yy * 1024 + xx] = 1;
            }
          }
        }
        inpaint(img, hole);
        sctx.putImageData(img, 0, 0);
      }
    }
    for (const t of TRIANGLES) {
      drawTriangle(ctx, snapshot, [FRONT_AT[t[0]], FRONT_AT[t[1]], FRONT_AT[t[2]]], [BACK_AT[swap[t[0]]], BACK_AT[swap[t[1]]], BACK_AT[swap[t[2]]]]);
    }
  });
  const colour = mainColour(ctx);

  // sleeves as bands the way the photo shows them: the top of the arm on the outer side (left band: left edge)
  const bands = ({ image, marks: m }: PhotoShot) => ({
    left: sleeveBand(image, [m.shL, m.armL, m.cuffTL, m.cuffBL]),
    right: sleeveBand(image, [m.armR, m.shR, m.cuffBR, m.cuffTR]),
  });
  const f = bands(front);
  const b = back ? bands(back) : null;
  // in a front photo the left sleeve is the player's right one (the texture's left piece); from behind it is the other
  const pieces = [
    { id: 'leftSleeve' as const, front: f.left, back: b ? b.right : f.left, backOuterLeft: !b },
    { id: 'rightSleeve' as const, front: f.right, back: b ? b.left : f.right, backOuterLeft: !!b },
  ];
  for (const p of pieces) {
    ctx.save();
    ctx.beginPath();
    tracePolygons(ctx, [partPolygons(PART_MAP[p.id])[0]]);
    ctx.clip();
    drawSleeveHalf(ctx, p.front, p.id, 'front', p.id === 'leftSleeve');
    drawSleeveHalf(ctx, p.back, p.id, 'back', p.backOuterLeft);
    ctx.restore();
  }

  evenLight(ctx, light);
  // everything of the shirt the photo does not cover, in the main colour (under what is drawn)
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = colour;
  for (const id of ['front', 'back', 'leftSleeve', 'rightSleeve'] as const) {
    ctx.beginPath();
    tracePolygons(ctx, partPolygons(PART_MAP[id]));
    ctx.fill();
  }
  ctx.restore();
  return { texture: c, colour };
}
