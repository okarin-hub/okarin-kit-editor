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

export interface PsdLayerInfo {
  key: string;
  name: string; // "Group / Layer"
  hidden: boolean;
  opacity: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  layer: any; // ag-psd layer (kept for conversion)
  /** Why the layer is probably not useful as a zone (guide, mesh, shadow, stitch line, ...). Unset = useful. */
  junk?: string;
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
  if (w >= psdW * 0.95 && h >= psdH * 0.95) return 'seukuran kanvas';
  if (Math.min(w, h) <= 8) return 'garis tipis';
  if (info.opacity < 0.15) return 'transparan';
  return undefined;
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
  maskDataUrl: string;
  parts: KitPartId[];
  pixels: number;
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

  const walk = (children: any[] | undefined, trail: string[], parentHidden: boolean) => {
    (children ?? []).forEach((l) => {
      const hidden = parentHidden || !!l.hidden;
      const name = String(l.name ?? 'Layer');
      if (l.children) {
        walk(l.children, [...trail, name], hidden);
        return;
      }
      const full = [...trail, name].join(' / ');
      const w = (l.right ?? 0) - (l.left ?? 0);
      const h = (l.bottom ?? 0) - (l.top ?? 0);
      if (!l.canvas || w <= 0 || h <= 0) {
        skipped.push({
          name: full,
          reason: l.text ? 'layer teks (rasterize dulu)' : l.vectorMask || l.vectorFill ? 'layer vektor/bentuk (rasterize dulu)' : l.adjustment ? 'layer adjustment' : 'tidak ada piksel',
        });
        return;
      }
      layers.push({
        key: `l${counter++}`,
        name: full,
        hidden,
        opacity: typeof l.opacity === 'number' ? l.opacity : 1,
        left: l.left,
        top: l.top,
        right: l.right,
        bottom: l.bottom,
        layer: l,
      });
    });
  };
  walk(psd.children, [], false);
  layers.forEach((l) => {
    l.junk = junkReason(l, psd.width, psd.height);
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
  const keepColor = mode === 'keep' || (mode === 'auto' && chroma / count > 22);

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
  let parts: KitPartId[] = sorted.filter((p) => p.n > 0 && p.n >= minPixels && p.n / Math.max(1, covered) >= minShare).map((p) => p.id);
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

  const crop = document.createElement('canvas');
  crop.width = x1 - x0 + 1;
  crop.height = y1 - y0 + 1;
  crop.getContext('2d')!.drawImage(canvas, x0, y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return { zone, maskFile: file, maskDataUrl: crop.toDataURL('image/png'), parts, pixels: count };
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

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(l.canvas, info.left * sx, info.top * sy, (info.right - info.left) * sx, (info.bottom - info.top) * sy);

  // only the layer's own area is read and processed (most layers are small)
  const rx = Math.max(0, Math.floor(info.left * sx));
  const ry = Math.max(0, Math.floor(info.top * sy));
  const rw = Math.min(SIZE, Math.ceil(info.right * sx)) - rx;
  const rh = Math.min(SIZE, Math.ceil(info.bottom * sy)) - ry;
  if (rw <= 0 || rh <= 0) return null;
  const img = ctx.getImageData(rx, ry, rw, rh);
  const d = img.data;

  // User layer mask (grayscale): multiply it into the alpha
  const m = l.mask;
  if (m && m.canvas && !m.disabled) {
    const mc = document.createElement('canvas');
    mc.width = SIZE;
    mc.height = SIZE;
    const mctx = mc.getContext('2d', { willReadFrequently: true });
    if (mctx) {
      const dc = typeof m.defaultColor === 'number' ? m.defaultColor : 255;
      mctx.fillStyle = `rgb(${dc},${dc},${dc})`;
      mctx.fillRect(0, 0, SIZE, SIZE);
      mctx.drawImage(m.canvas, m.left * sx, m.top * sy, (m.right - m.left) * sx, (m.bottom - m.top) * sy);
      const md = mctx.getImageData(rx, ry, rw, rh).data;
      for (let i = 0; i < d.length; i += 4) d[i + 3] = (d[i + 3] * md[i]) / 255;
    }
  }

  return finalizeMask(canvas, ctx, img, { name: info.name, hidden: info.hidden, opacity: info.opacity }, index, rx, ry);
}
