import { KitPartId } from '@/types/kit';
import { PES_2021_PARTS } from '@/constants/pes2021Parts';

/**
 * PSD -> template conversion (runs in the browser).
 *
 * Every pixel layer becomes a full-size 1024x1024 mask PNG plus a zone entry: bounding box (so the
 * layer can be moved / scaled / rotated around its own centre), the parts it covers (from the
 * pixels' position in the PES texture), a default colour and visibility. Layer masks are applied;
 * groups give the layer its path name. Text, shape, adjustment and smart-object layers that have
 * no pixel data are reported as skipped (rasterize them in Photoshop first).
 */

const SIZE = 1024;

/** Written into the XMP of a PSD made by Import PNG (see parsePsd). */
export const PNG_PSD_MARK = 'okarin-kit-editor:png-template';

/** A canvas that also works inside a web worker (OffscreenCanvas there). */
export function newCanvas(w: number, h: number): HTMLCanvasElement {
  if (typeof document === 'undefined') return new OffscreenCanvas(w, h) as unknown as HTMLCanvasElement;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export interface PsdLayerInfo {
  key: string;
  name: string; // "Group / Layer"
  hidden: boolean;
  /** Layer opacity × fill opacity × the opacity of its groups. */
  opacity: number;
  /** Blend mode (its own, or its group's when the layer itself is normal). */
  blend?: GlobalCompositeOperation;
  /** Clipping mask: the key of the layer it is clipped to. */
  clipBase?: string;
  /** Raster and vector masks of the layer and of its groups (all of them cut the layer). */
  masks: any[];
  vmasks: any[];
  /** Shape / solid colour fill layer (no pixels in the file): drawn from this colour and its vector mask. */
  fillColor?: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  layer: any; // ag-psd layer (kept for conversion)
  /** Why the layer is probably not useful as a zone (guide, mesh, shadow, stitch line, ...). Unset = useful. */
  junk?: string;
  /** One option of a set of alternative layers or groups (Collar 1 / Collar 2, Seams / Seams v2). */
  variant?: { set: string; option: string };
}

/**
 * Finds alternatives among sibling layers / groups: names that differ only by a trailing number
 * ("Collar 1", "Collar 13") or a " v2" suffix ("Seams", "Seams v2"), of which exactly one is shown.
 * Siblings that are all shown (Shirt Details 1 / 2) are separate layers, not alternatives.
 */
export function findVariants(siblings: { name?: string; hidden?: boolean }[]): Map<number, { set: string; option: string }> {
  const sets = new Map<string, { i: number; option: string }[]>();
  const names = siblings.map((l) => String(l.name ?? '').trim());
  // "Seams v2" makes plain "Seams" its first option
  const vBases = new Set(names.map((s) => /^(.*\S)\s+v\d+$/i.exec(s)?.[1]).filter(Boolean));
  names.forEach((name, i) => {
    const v = /^(.*\S)\s+v(\d+)$/i.exec(name);
    const n = /^(.*\D)\s*(\d+)$/.exec(name);
    const [set, option] = v ? [v[1], `v${v[2]}`] : vBases.has(name) || !n ? [name, 'v1'] : [n[1].trim(), n[2]];
    sets.set(set, [...(sets.get(set) ?? []), { i, option }]);
  });
  const out = new Map<number, { set: string; option: string }>();
  for (const [set, members] of sets) {
    if (members.length < 2 || members.filter((m) => !siblings[m.i].hidden).length !== 1) continue;
    for (const m of members) out.set(m.i, { set, option: m.option });
  }
  return out;
}

/**
 * Words (English and the Japanese ones used by the official Konami PSDs) that mark layers which only
 * help the artist: mesh overlays, stitch lines, shadows, guides, masks and backgrounds.
 */
const JUNK_NAMES: [RegExp, string][] = [
  [/mesh|メッシュ/i, 'mesh'],
  [/shadow|影/i, 'bayangan'],
  [/dotted|stitch|ステッチ|縫/i, 'jahitan'],
  [/\bguides?\b|\blabels?\b|\buv\b|ガイド|ラベル|領域/i, 'panduan'],
  [/\bmask\b|マスク/i, 'mask'],
  [/background|背景|下地/i, 'latar'],
];

/** The helper kind a layer name points at (mesh, guide, stitch…), or undefined for an ordinary layer. */
export function helperName(name: string): string | undefined {
  for (const [re, reason] of JUNK_NAMES) if (re.test(name)) return reason;
  return undefined;
}

/** Returns the reason a layer is most likely not a useful zone, or undefined when it looks useful. */
export function junkReason(info: Pick<PsdLayerInfo, 'name' | 'opacity' | 'left' | 'top' | 'right' | 'bottom'>, psdW: number, psdH: number): string | undefined {
  const byName = helperName(info.name);
  if (byName) return byName;
  const w = info.right - info.left;
  const h = info.bottom - info.top;
  // a full-size "Base" or "Seams" layer is the kit's base colour or its stitch lines, not a backdrop
  if (w >= psdW * 0.95 && h >= psdH * 0.95 && !/^(base|seams?)\b/i.test(info.name.split(' / ').pop() ?? '')) return 'seukuran kanvas';
  if (Math.min(w, h) <= 8) return 'garis tipis';
  if (info.opacity < 0.15) return 'transparan';
  return undefined;
}

/** PSD blend modes as canvas composite operations; the ones the canvas lacks get the closest it has. */
const BLENDS: Record<string, GlobalCompositeOperation> = {
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color dodge': 'color-dodge',
  'color burn': 'color-burn',
  'hard light': 'hard-light',
  'soft light': 'soft-light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
  'linear dodge': 'lighter',
  'linear burn': 'multiply',
  'darker color': 'darken',
  'lighter color': 'lighten',
  'vivid light': 'hard-light',
  'linear light': 'hard-light',
  'pin light': 'hard-light',
};
export const blendOf = (mode: unknown): GlobalCompositeOperation | undefined =>
  typeof mode === 'string' ? BLENDS[mode] : undefined;

const rgbHex = (c: any): string | undefined =>
  c && typeof c.r === 'number' ? `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}` : undefined;

/**
 * Fills the closed paths of a vector mask (document pixels, scaled by sx / sy) in the current fill style.
 * A path's operation (combine / subtract / intersect / exclude) carries on to the paths after it until another one is set.
 */
export function fillVectorPaths(ctx: CanvasRenderingContext2D, vm: any, sx: number, sy: number): void {
  let op = 'combine';
  for (const p of vm.paths ?? []) {
    op = p.operation ?? op;
    const k = p.knots ?? [];
    if (p.open || k.length < 2) continue;
    ctx.globalCompositeOperation =
      op === 'subtract' ? 'destination-out' : op === 'intersect' ? 'destination-in' : op === 'exclude' ? 'xor' : 'source-over';
    // knot points: control in, anchor, control out
    const pt = (i: number, j: number) => [k[i].points[j] * sx, k[i].points[j + 1] * sy] as const;
    ctx.beginPath();
    ctx.moveTo(...pt(0, 2));
    for (let i = 1; i <= k.length; i++) {
      const a = i - 1, b = i % k.length;
      ctx.bezierCurveTo(...pt(a, 4), ...pt(b, 0), ...pt(b, 2));
    }
    ctx.closePath();
    ctx.fill(p.fillRule === 'non-zero' ? 'nonzero' : 'evenodd');
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** Box [left, top, right, bottom] around the closed paths of a vector mask (anchors and control points). */
function pathBounds(vm: any): [number, number, number, number] | undefined {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of vm.paths ?? []) {
    if (p.open) continue;
    for (const k of p.knots ?? []) {
      for (let j = 0; j < 6; j += 2) {
        x0 = Math.min(x0, k.points[j]);
        x1 = Math.max(x1, k.points[j]);
        y0 = Math.min(y0, k.points[j + 1]);
        y1 = Math.max(y1, k.points[j + 1]);
      }
    }
  }
  return x1 > x0 && y1 > y0 ? [Math.floor(x0), Math.floor(y0), Math.ceil(x1), Math.ceil(y1)] : undefined;
}

export interface ParsedPsd {
  fileName: string;
  width: number;
  height: number;
  layers: PsdLayerInfo[];
  skipped: { name: string; reason: string }[];
}

export interface ConvertedZone {
  zone: Record<string, unknown>;
  maskFile: string;
  /** Empty inside a worker (OffscreenCanvas has no toDataURL): encode maskCanvas there instead. */
  maskDataUrl: string;
  maskCanvas: HTMLCanvasElement;
  parts: KitPartId[];
  pixels: number;
  /** The one flat grey of a grey-coded layer (its colour slot), when the layer is that flat. */
  flat?: string;
}

export async function parsePsd(file: File): Promise<ParsedPsd> {
  const { readPsd } = await import('ag-psd');
  const buffer = await file.arrayBuffer();
  const head = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  if (head[0] === 0x50 && head[1] === 0x4b) {
    throw new Error('File ini ZIP, bukan PSD. Ekstrak dulu, lalu pilih file .psd di dalamnya.');
  }
  const psd = readPsd(buffer, {
    skipCompositeImageData: true,
    skipThumbnail: true,
    skipLinkedFilesData: true,
  } as any);

  const layers: PsdLayerInfo[] = [];
  const skipped: { name: string; reason: string }[] = [];
  let counter = 0;

  interface Inherited {
    hidden: boolean;
    variant?: PsdLayerInfo['variant'];
    opacity: number;
    blend?: GlobalCompositeOperation;
    masks: any[];
    vmasks: any[];
  }
  const walk = (children: any[] | undefined, trail: string[], up: Inherited) => {
    const variants = findVariants(children ?? []);
    // children run from the bottom layer up: a clipped layer is clipped to the nearest unclipped layer below it
    let below: string | undefined;
    (children ?? []).forEach((l, i) => {
      // a hidden option of a variant set is still imported (as a hidden choice)
      const variant = up.variant ?? variants.get(i);
      const hidden = up.hidden || !!l.hidden;
      const name = String(l.name ?? 'Layer');
      const opacity = up.opacity * (typeof l.opacity === 'number' ? l.opacity : 1);
      const own = blendOf(l.blendMode);
      const masks = l.mask?.canvas && !l.mask.disabled ? [...up.masks, l.mask] : up.masks;
      const vmasks = l.vectorMask?.paths?.length && !l.vectorMask.disable ? [...up.vmasks, l.vectorMask] : up.vmasks;
      if (l.children) {
        below = undefined;
        walk(l.children, [...trail, name], { hidden, variant, opacity, blend: own ?? up.blend, masks, vmasks });
        return;
      }
      const clipBase = l.clipping ? below : undefined;
      const full = [...trail, name].join(' / ');
      let left = l.left ?? 0, top = l.top ?? 0, right = l.right ?? 0, bottom = l.bottom ?? 0;
      const fill = l.vectorFill?.type === 'color' ? rgbHex(l.vectorFill.color) : undefined;
      if (fill) {
        // a shape layer's box is its outline; a solid colour fill without a shape covers the document (its mask cuts it)
        const box = l.vectorMask?.paths?.length ? pathBounds(l.vectorMask) : undefined;
        if (box) [left, top, right, bottom] = box;
        else if (right <= left || bottom <= top) [left, top, right, bottom] = [0, 0, psd.width, psd.height];
      }
      if ((!l.canvas && !fill) || right <= left || bottom <= top) {
        skipped.push({
          name: full,
          reason: l.text ? 'layer teks (rasterize dulu)' : l.vectorMask || l.vectorFill ? 'layer vektor/bentuk (rasterize dulu)' : l.adjustment ? 'layer adjustment' : 'tidak ada piksel',
        });
        if (!l.clipping) below = undefined;
        return;
      }
      const key = `l${counter++}`;
      if (!l.clipping) below = key;
      layers.push({
        key,
        name: full,
        hidden,
        opacity: opacity * (typeof l.fillOpacity === 'number' ? l.fillOpacity : 1),
        blend: own ?? up.blend,
        clipBase,
        masks,
        vmasks,
        // a shape layer may also carry pixels (empty, or the shape drawn by Photoshop): its colour and outline are exact
        fillColor: fill,
        left,
        top,
        right,
        bottom,
        layer: l,
        variant,
      });
    });
  };
  walk(psd.children, [], { hidden: false, opacity: 1, masks: [], vmasks: [] });
  // a PSD written by Import PNG has only real colour layers: none of them is a helper or a backdrop
  const fromPng = String((psd as any).imageResources?.xmpMetadata ?? '').includes(PNG_PSD_MARK);
  layers.forEach((l) => {
    l.junk = fromPng ? undefined : junkReason(l, psd.width, psd.height);
  });

  return { fileName: file.name, width: psd.width, height: psd.height, layers, skipped };
}

const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'layer';

export interface MaskMeta {
  name: string;
  hidden?: boolean;
  opacity?: number;
  /** 'auto' decides from the colourfulness; 'tint' = recolourable mask; 'keep' = keep own colours. */
  mode?: 'auto' | 'tint' | 'keep';
  /** Fixed default colour (otherwise the mean colour of the visible pixels). */
  defaultColor?: string;
  /** A part joins the zone when it holds at least this share of the zone's pixels (default 0.15). */
  minPartShare?: number;
  /** ...and at least this many pixels (default 0). Colour-split zones use low values so a small logo is not dropped. */
  minPartPixels?: number;
}

/**
 * Turns a 1024x1024 canvas holding one layer's pixels into a template zone + mask PNG:
 * bounding box, covered parts, colour handling. Returns null when nothing is visible.
 * `img` may hold only the area at (ox, oy) of the canvas (the rest is known to be empty): much faster for small layers.
 */
export function finalizeMask(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  meta: MaskMeta,
  index: number,
  ox = 0,
  oy = 0
): ConvertedZone | null {
  const d = img.data;
  const W = img.width, H = img.height;

  // A layer that is one flat colour (grey-coded templates: the grey names the colour slot) keeps only that
  // colour: leftovers such as the backdrop around a full-size Base layer are dropped.
  let flat: string | undefined;
  if (meta.mode !== 'keep') {
    const hist = new Map<number, number>();
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      // faint edge pixels come back with rounded colours: judge the layer by its solid pixels
      if (d[i + 3] < 128) continue;
      n++;
      const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      hist.set(k, (hist.get(k) ?? 0) + 1);
    }
    let dom = 0, domN = 0;
    for (const [k, c] of hist) if (c > domN) { dom = k; domN = c; }
    const r = dom >> 16, g = (dom >> 8) & 255, b = dom & 255;
    // colours a step or two off (rounded by scaling) count as the same colour
    domN = 0;
    for (const [k, c] of hist) {
      if (Math.max(Math.abs((k >> 16) - r), Math.abs(((k >> 8) & 255) - g), Math.abs((k & 255) - b)) <= 4) domN += c;
    }
    // a grey may carry leftovers (a backdrop); a coloured layer counts only when it is all one colour (a layer
    // written from a PNG), so the white text of a mostly red badge is never thrown away
    const grey = Math.max(r, g, b) - Math.min(r, g, b) <= 6;
    if (n > 0 && domN / n >= (grey ? 0.75 : 0.97)) {
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] >= 128 && Math.max(Math.abs(d[i] - r), Math.abs(d[i + 1] - g), Math.abs(d[i + 2] - b)) > 24) d[i + 3] = 0;
      }
      flat = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
    }
  }

  // Statistics: bounding box, pixel count, mean colour, chroma
  let x0 = SIZE, y0 = SIZE, x1 = -1, y1 = -1, count = 0;
  let sr = 0, sg = 0, sb = 0, chroma = 0;
  for (let ly = 0; ly < H; ly++) {
    for (let lx = 0; lx < W; lx++) {
      const i = (ly * W + lx) * 4;
      if (d[i + 3] < 12) continue;
      const x = lx + ox, y = ly + oy;
      count++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      sr += d[i]; sg += d[i + 1]; sb += d[i + 2];
      chroma += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    }
  }
  if (count < 20) return null;

  const mean: [number, number, number] = [sr / count, sg / count, sb / count];
  const mode = meta.mode ?? 'auto';
  // a flat layer is a colour to choose (its slot), whatever colour it has
  const keepColor = mode === 'keep' || (mode === 'auto' && !flat && chroma / count > 22);

  // Which parts does the layer cover? (pixel counts inside each part's regions)
  const perPart: { id: KitPartId; n: number }[] = PES_2021_PARTS.map((p) => {
    let n = 0;
    p.regions.forEach((r) => {
      // sample every 2nd pixel on the same grid as a full scan, but only inside the layer's box
      const ya0 = Math.max(0, Math.floor(r.y));
      const xa0 = Math.max(0, Math.floor(r.x));
      const ya = ya0 + Math.max(0, Math.ceil((y0 - ya0) / 2) * 2);
      const xa = xa0 + Math.max(0, Math.ceil((x0 - xa0) / 2) * 2);
      const yb = Math.min(y1 + 1, Math.ceil(r.y + r.height));
      const xb = Math.min(x1 + 1, Math.ceil(r.x + r.width));
      for (let y = ya; y < yb; y += 2) {
        for (let x = xa; x < xb; x += 2) if (d[((y - oy) * W + x - ox) * 4 + 3] >= 12) n++;
      }
    });
    return { id: p.id, n: n * 4 };
  });
  const covered = perPart.reduce((a, b) => a + b.n, 0);
  const sorted = [...perPart].sort((a, b) => b.n - a.n);
  const minShare = meta.minPartShare ?? 0.15;
  const minPixels = meta.minPartPixels ?? 0;
  // a part also joins when the layer covers most of that part (a full-size Base layer spreads over every part,
  // so none of them holds 15% of its pixels)
  const area = (id: KitPartId) => PES_2021_PARTS.find((p) => p.id === id)!.regions.reduce((a, r) => a + r.width * r.height, 0);
  let parts: KitPartId[] = sorted
    .filter((p) => p.n > 0 && p.n >= minPixels && (p.n / Math.max(1, covered) >= minShare || p.n >= area(p.id) * 0.3))
    .map((p) => p.id);
  if (parts.length === 0) parts = [sorted[0].n > 0 ? sorted[0].id : 'front'];

  // Tinted layers keep only their shading: grey levels scaled so the lightest pixel is white (a flat layer
  // becomes plain white); the zone colour is multiplied in when drawn. Coloured layers keep their pixels.
  if (!keepColor) {
    let lo = 255, hi = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 12) continue;
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (l < lo) lo = l;
      if (l > hi) hi = l;
    }
    const flat = hi - lo < 8 || hi < 1;
    for (let i = 0; i < d.length; i += 4) {
      const v = flat ? 255 : Math.round((255 * (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])) / hi);
      d[i] = v; d[i + 1] = v; d[i + 2] = v;
    }
  }
  ctx.putImageData(img, ox, oy);

  const file = `${String(index + 1).padStart(2, '0')}-${slug(meta.name)}.png`;
  const zoneId = `psd-${String(index + 1).padStart(2, '0')}-${slug(meta.name)}`.slice(0, 60);
  const opacity = meta.opacity ?? 1;
  const zone: Record<string, unknown> = {
    id: zoneId,
    name: meta.name,
    part: parts[0],
    ...(parts.length > 1 ? { parts: parts.slice(1) } : {}),
    mask: `masks/${file}`,
    maskBox: [x0, y0, x1 - x0 + 1, y1 - y0 + 1],
    maskCropped: true,
    ...(keepColor ? { keepColor: true } : {}),
    defaultColor: meta.defaultColor ?? `#${hex2(mean[0])}${hex2(mean[1])}${hex2(mean[2])}`,
    defaultVisible: !meta.hidden,
    ...(opacity < 0.995 ? { initial: { opacity: Math.round(opacity * 100) / 100 } } : {}),
  };

  const crop = newCanvas(x1 - x0 + 1, y1 - y0 + 1);
  crop.getContext('2d')!.drawImage(canvas, x0, y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return { zone, maskFile: file, maskDataUrl: 'toDataURL' in crop ? crop.toDataURL('image/png') : '', maskCanvas: crop, parts, pixels: count, flat: keepColor ? undefined : flat };
}

/** Returns the zone with its parts replaced (first = main part, the rest go to `parts`). */
export function withZoneParts(zone: Record<string, unknown>, parts: KitPartId[]): Record<string, unknown> {
  const { parts: _old, ...rest } = zone;
  return { ...rest, part: parts[0], ...(parts.length > 1 ? { parts: parts.slice(1) } : {}) };
}

/** Converts one PSD layer. Returns null for layers without visible pixels. */
export function convertLayer(info: PsdLayerInfo, psdW: number, psdH: number, index: number): ConvertedZone | null {
  const sx = SIZE / psdW;
  const sy = SIZE / psdH;
  const l = info.layer;

  const canvas = newCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  if (info.fillColor) {
    // shape / colour fill layer: its colour over its box, the vector mask below gives the shape
    ctx.fillStyle = info.fillColor;
    ctx.fillRect(info.left * sx, info.top * sy, (info.right - info.left) * sx, (info.bottom - info.top) * sy);
  } else {
    ctx.drawImage(l.canvas, info.left * sx, info.top * sy, (info.right - info.left) * sx, (info.bottom - info.top) * sy);
  }

  // only the layer's own area is read and processed (most layers are small)
  const rx = Math.max(0, Math.floor(info.left * sx));
  const ry = Math.max(0, Math.floor(info.top * sy));
  const rw = Math.min(SIZE, Math.ceil(info.right * sx)) - rx;
  const rh = Math.min(SIZE, Math.ceil(info.bottom * sy)) - ry;
  if (rw <= 0 || rh <= 0) return null;
  const img = ctx.getImageData(rx, ry, rw, rh);
  const d = img.data;

  // Layer masks of the layer and its groups (grayscale): multiplied into the alpha
  for (const m of info.masks) {
    const mc = newCanvas(SIZE, SIZE);
    const mctx = mc.getContext('2d', { willReadFrequently: true });
    if (!mctx) continue;
    const dc = typeof m.defaultColor === 'number' ? m.defaultColor : 255;
    mctx.fillStyle = `rgb(${dc},${dc},${dc})`;
    mctx.fillRect(0, 0, SIZE, SIZE);
    mctx.drawImage(m.canvas, m.left * sx, m.top * sy, (m.right - m.left) * sx, (m.bottom - m.top) * sy);
    const md = mctx.getImageData(rx, ry, rw, rh).data;
    for (let i = 0; i < d.length; i += 4) d[i + 3] = (d[i + 3] * md[i]) / 255;
  }
  // Vector masks (shape outlines) of the layer and its groups
  for (const vm of info.vmasks) {
    const mc = newCanvas(SIZE, SIZE);
    const mctx = mc.getContext('2d', { willReadFrequently: true });
    if (!mctx) continue;
    mctx.fillStyle = '#fff';
    if (vm.invert) {
      mctx.fillRect(0, 0, SIZE, SIZE);
      mctx.globalCompositeOperation = 'destination-out';
      const inner = newCanvas(SIZE, SIZE);
      const ictx = inner.getContext('2d')!;
      ictx.fillStyle = '#fff';
      fillVectorPaths(ictx, vm, sx, sy);
      mctx.drawImage(inner, 0, 0);
      mctx.globalCompositeOperation = 'source-over';
    } else {
      fillVectorPaths(mctx, vm, sx, sy);
    }
    const md = mctx.getImageData(rx, ry, rw, rh).data;
    for (let i = 0; i < d.length; i += 4) d[i + 3] = (d[i + 3] * md[i + 3]) / 255;
  }

  const out = finalizeMask(canvas, ctx, img, { name: info.name, hidden: info.hidden, opacity: info.opacity }, index, rx, ry);
  if (out && info.blend) out.zone.blend = info.blend;
  // a Base layer is the kit's base colour (drawn under the pattern layers); Import PNG writes one per part group
  if (out && /^base\b/i.test(info.name.split(' / ').pop() ?? '')) out.zone.base = true;
  return out;
}

/**
 * Grey-coded templates: zones whose layer is the same flat grey share one colour slot. Slots are named
 * "Warna 1", "Warna 2"... from the largest total area down. Needs at least two flat layers.
 */
export function assignSlots(zones: Record<string, unknown>[], flats: { flat?: string; pixels: number }[]): void {
  const area = new Map<string, number>();
  flats.forEach((f) => f.flat && area.set(f.flat, (area.get(f.flat) ?? 0) + f.pixels));
  if (flats.filter((f) => f.flat).length < 2) return;
  const order = [...area].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  zones.forEach((z, i) => {
    const g = flats[i]?.flat;
    if (!g) return;
    // every Base layer (one per part group from Import PNG) is its own colour: shirt, shorts and socks can differ
    z.slot = z.base
      ? String(z.name).split(' / ').pop()!.replace(/\.[a-z]+$/i, '')
      : `Warna ${order.indexOf(g) + 1}`;
  });
}
