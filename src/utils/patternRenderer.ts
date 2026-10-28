import { KitPartConfig, KitPartDefinition, KitPartId, KitRect, PatternLayer, PatternSettings } from '@/types/kit';
import { PATTERN_LABEL } from '@/constants/patterns';
import { getCachedImage, preloadImage } from '@/utils/imageCache';

/**
 * Single source of truth for drawing a part pattern on a 2D canvas context.
 * Used by both the texture generator (3D preview / export) and the Konva 2D editor so the
 * three always match.
 *
 * Periodic patterns (stripes, hoops, checks, dots, waves) are phase-shifted by the offset, so
 * moving them never leaves an uncovered edge. Single-shape patterns (sash, chevron, cross,
 * halves, gradient) are simply translated.
 */

export const DEFAULT_PATTERN_THICKNESS = 0.5;

// ---------------------------------------------------------------------------------------------
// Library image patterns (custom-image): analysis + tinting
// ---------------------------------------------------------------------------------------------

interface TileInfo {
  hasAlpha: boolean;
  mono: boolean; // every visible pixel is (near) grey / black / white
  lightBg: boolean; // opaque mono image on a light background
}

const tileInfoCache = new Map<string, TileInfo>();
const tintedCache = new Map<string, HTMLCanvasElement>();

function analyzeTile(src: string, img: HTMLImageElement): TileInfo {
  const cached = tileInfoCache.get(src);
  if (cached) return cached;

  const size = 32;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const cx = c.getContext('2d', { willReadFrequently: true });
  let info: TileInfo = { hasAlpha: false, mono: false, lightBg: false };
  if (cx) {
    cx.drawImage(img, 0, 0, size, size);
    const d = cx.getImageData(0, 0, size, size).data;
    let hasAlpha = false;
    let mono = true;
    let lum = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 250) hasAlpha = true;
      if (d[i + 3] >= 128) {
        const mx = Math.max(d[i], d[i + 1], d[i + 2]);
        const mn = Math.min(d[i], d[i + 1], d[i + 2]);
        if (mx - mn > 28) mono = false;
        lum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        n++;
      }
    }
    info = { hasAlpha, mono, lightBg: n > 0 && lum / n > 128 };
  }
  tileInfoCache.set(src, info);
  return info;
}

/** True when the tile is a single-colour motif that can be recoloured with the pattern colour. */
export function isTintableTile(src: string, img: HTMLImageElement): boolean {
  const info = analyzeTile(src, img);
  return info.hasAlpha || info.mono;
}

export function tintedTile(
  src: string,
  img: HTMLImageElement,
  color: string,
  maxSize = 512
): HTMLCanvasElement | null {
  const key = `${src}|${color}|${maxSize}`;
  const cached = tintedCache.get(key);
  if (cached) return cached;

  const iw = img.naturalWidth || 100;
  const ih = img.naturalHeight || 100;
  const k = Math.min(1, maxSize / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * k));
  const h = Math.max(1, Math.round(ih * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true });
  if (!cx) return null;
  cx.drawImage(img, 0, 0, w, h);

  const info = analyzeTile(src, img);
  if (!info.hasAlpha) {
    // Opaque single-colour image: the motif is the darker (or lighter) part, so derive an alpha
    const data = cx.getImageData(0, 0, w, h);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i + 3] = Math.round(info.lightBg ? 255 - lum : lum);
    }
    cx.putImageData(data, 0, 0);
  }
  cx.globalCompositeOperation = 'source-in';
  cx.fillStyle = color;
  cx.fillRect(0, 0, w, h);

  if (tintedCache.size > 60) tintedCache.clear();
  tintedCache.set(key, c);
  return c;
}


/** Start coordinate (<= origin) of a repeating sequence shifted by `offset`. */
function phaseStart(origin: number, offset: number, period: number): number {
  const shift = ((offset % period) + period) % period;
  return origin + shift - period;
}

/** Start of a repeating sequence (phase anchored at `origin`) that is at or before `min`. */
function startAt(origin: number, offset: number, period: number, min: number): number {
  let s = phaseStart(origin, offset, period);
  while (s > min) s -= period;
  return s;
}

function drawPatternBody(
  ctx: CanvasRenderingContext2D,
  b: KitRect,
  config: PatternSettings
): void {
  const { pattern, patternColor, patternOpacity, patternScale } = config;
  if (!pattern || pattern === 'none') return;

  const ox = config.patternOffsetX ?? 0;
  const oy = config.patternOffsetY ?? 0;
  const thickness = Math.min(0.95, Math.max(0.05, config.patternThickness ?? DEFAULT_PATTERN_THICKNESS));
  const scale = Math.max(8, patternScale);
  const right = b.x + b.width;
  const bottom = b.y + b.height;

  // A rotated pattern must cover the corners of the part too: draw over the circle around the part
  const rotation = config.patternRotation ?? 0;
  const half = rotation % 360 === 0 ? 0 : Math.hypot(b.width, b.height) / 2;
  const ex = half ? b.x + b.width / 2 - half : b.x;
  const ey = half ? b.y + b.height / 2 - half : b.y;
  const ew = half ? half * 2 : b.width;
  const eh = half ? half * 2 : b.height;
  const eRight = ex + ew;
  const eBottom = ey + eh;

  // Repeat off: a periodic pattern shows a single motif, centred on the part and moved by the offset
  const once = config.patternRepeat === false;
  const pcx = b.x + b.width / 2;
  const pcy = b.y + b.height / 2;
  /** Start positions along one axis: the repeating sequence, or just one centred motif of `size`. */
  const run = (origin: number, offset: number, period: number, min: number, max: number, center: number, size: number) => {
    if (once) return [center - size / 2 + offset];
    const out: number[] = [];
    for (let v = startAt(origin, offset, period, min); v < max; v += period) out.push(v);
    return out;
  };

  ctx.save();

  // Mirror around the centre of the part. Offsets below are applied inside the mirrored space,
  // so a shift keeps its meaning relative to the (flipped) pattern.
  if (config.patternMirrorX || config.patternMirrorY) {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    ctx.translate(cx, cy);
    ctx.scale(config.patternMirrorX ? -1 : 1, config.patternMirrorY ? -1 : 1);
    ctx.translate(-cx, -cy);
  }

  if (half) {
    const rx = b.x + b.width / 2;
    const ry = b.y + b.height / 2;
    ctx.translate(rx, ry);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-rx, -ry);
  }

  ctx.globalAlpha = patternOpacity;
  ctx.fillStyle = patternColor;
  ctx.strokeStyle = patternColor;

  if (pattern === 'vertical-stripes') {
    const sw = Math.max(2, scale * thickness);
    for (const x of run(b.x, ox, scale, ex, eRight, pcx, sw)) ctx.fillRect(x, ey, sw, eh);
  } else if (pattern === 'horizontal-stripes') {
    const sh = Math.max(2, scale * thickness);
    for (const y of run(b.y, oy, scale, ey, eBottom, pcy, sh)) ctx.fillRect(ex, y, ew, sh);
  } else if (pattern === 'hoops') {
    // Thick Celtic/Sporting hoops
    const period = Math.max(32, scale * 3.2);
    const band = period * thickness;
    for (const y of run(b.y, oy, period, ey, eBottom, pcy, band)) ctx.fillRect(ex, y, ew, band);
  } else if (pattern === 'pinstripes') {
    // Fine vertical pinstripes
    const w = Math.max(1, 2.5 * (thickness / DEFAULT_PATTERN_THICKNESS));
    const spacing = Math.max(14, scale * 1.2);
    for (const x of run(b.x, ox, spacing, ex, eRight, pcx, w)) ctx.fillRect(x, ey, w, eh);
  } else if (pattern === 'sash') {
    // Diagonal sash across the part (River Plate / Monaco)
    ctx.translate(ox, oy);
    const sashWidth = Math.max(30, scale * 2.2) * (thickness / DEFAULT_PATTERN_THICKNESS);
    ctx.lineWidth = sashWidth;
    ctx.beginPath();
    ctx.moveTo(b.x - 40, b.y - 40);
    ctx.lineTo(right + 40, bottom + 40);
    ctx.stroke();

    // Subtle accent border lines on both edges
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - 40 - sashWidth / 2, b.y - 40);
    ctx.lineTo(right + 40 - sashWidth / 2, bottom + 40);
    ctx.moveTo(b.x - 40 + sashWidth / 2, b.y - 40);
    ctx.lineTo(right + 40 + sashWidth / 2, bottom + 40);
    ctx.stroke();
  } else if (pattern === 'chevron') {
    // V-Chest shape (Bordeaux / Man Utd)
    ctx.translate(ox, oy);
    ctx.lineWidth = Math.max(20, scale * 1.5) * (thickness / DEFAULT_PATTERN_THICKNESS);
    ctx.lineJoin = 'miter';
    const vMidY = b.y + b.height * 0.44;
    const vTopY = b.y + b.height * 0.22;
    ctx.beginPath();
    ctx.moveTo(b.x - 20, vTopY);
    ctx.lineTo(b.x + b.width / 2, vMidY);
    ctx.lineTo(right + 20, vTopY);
    ctx.stroke();
  } else if (pattern === 'cross') {
    // Chest cross (Inter Centenario / Parma)
    ctx.translate(ox, oy);
    const crossW = Math.max(24, scale * 1.6) * (thickness / DEFAULT_PATTERN_THICKNESS);
    ctx.fillRect(b.x + b.width / 2 - crossW / 2, b.y - 400, crossW, b.height + 800);
    ctx.fillRect(b.x - 400, b.y + b.height * 0.36, b.width + 800, crossW);
  } else if (pattern === 'gradient') {
    // Smooth top-to-bottom colour fade
    ctx.translate(ox, oy);
    const grad = ctx.createLinearGradient(b.x, b.y, b.x, bottom);
    grad.addColorStop(0, patternColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(b.x - 1500, b.y - 1500, b.width + 3000, b.height + 3000);
  } else if (pattern === 'diagonal-stripes') {
    // 45-degree diagonal stripes
    const step = Math.max(16, scale * 1.5);
    ctx.lineWidth = Math.max(4, step * thickness);
    // Lines follow x - y = k, so a shift (ox, oy) moves the constant by ox - oy
    const ks = once
      ? [pcx - pcy + ox - oy]
      : run(b.x - b.height - b.y, ox - oy, step, ex - eBottom - step, eRight - ey + step, 0, 0);
    for (const k of ks) {
      ctx.beginPath();
      ctx.moveTo(k + ey, ey);
      ctx.lineTo(k + eBottom, eBottom);
      ctx.stroke();
    }
  } else if (pattern === 'halves') {
    ctx.translate(ox, oy);
    ctx.fillRect(b.x + b.width / 2, b.y - 400, b.width / 2 + 400, b.height + 800);
  } else if (pattern === 'checkered') {
    const cell = scale;
    if (once) {
      ctx.fillRect(pcx - cell / 2 + ox, pcy - cell / 2 + oy, cell, cell);
    } else {
      const startX = startAt(b.x, ox, cell * 2, ex);
      const startY = startAt(b.y, oy, cell * 2, ey);
      for (let y = startY, r = 0; y < eBottom; y += cell, r++) {
        for (let x = startX, c = 0; x < eRight; x += cell, c++) {
          if ((r + c) % 2 === 0) ctx.fillRect(x, y, cell, cell);
        }
      }
    }
  } else if (pattern === 'subtle-waves') {
    ctx.lineWidth = 1.5;
    const step = Math.max(8, Math.floor(scale / 2));
    ctx.translate(ox, 0);
    for (const y of run(b.y, oy, step, ey, eBottom, pcy, 0)) {
      ctx.beginPath();
      ctx.moveTo(ex - Math.abs(ox) - 1, y);
      ctx.quadraticCurveTo(ex + ew / 2, y + 2, eRight + Math.abs(ox) + 1, y);
      ctx.stroke();
    }
  } else if (pattern === 'polka-dots') {
    const pitch = scale * 2;
    const radius = (scale / 3) * (thickness / DEFAULT_PATTERN_THICKNESS);
    if (once) {
      ctx.beginPath();
      ctx.arc(pcx + ox, pcy + oy, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const startX = startAt(b.x, ox, pitch, ex);
      const startY = startAt(b.y, oy, pitch, ey);
      for (let y = startY; y < eBottom + pitch; y += pitch) {
        for (let x = startX; x < eRight + pitch; x += pitch) {
          ctx.beginPath();
          ctx.arc(x + scale, y + scale, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  } else if (pattern === 'custom-image') {
    // Tiled image from the library/patterns folder. `scale` is half the tile width in px.
    const src = config.patternImage;
    const img = src ? getCachedImage(src) : undefined;
    if (src && !img) {
      preloadImage(src); // redraws are triggered when it finishes loading
    } else if (src && img) {
      const iw = img.naturalWidth || 100;
      const tileW = Math.max(8, scale * 2);
      const tint = config.patternTint ?? isTintableTile(src, img);
      const source: CanvasImageSource | null = tint ? tintedTile(src, img, patternColor) : img;
      if (source) {
        const srcW = tint ? (source as HTMLCanvasElement).width : iw;
        const ih = source instanceof HTMLCanvasElement ? source.height : img.naturalHeight || 100;
        const pat = once ? null : ctx.createPattern(source, 'repeat');
        if (once) {
          const tileH = (tileW * ih) / srcW;
          ctx.drawImage(source, pcx - tileW / 2 + ox, pcy - tileH / 2 + oy, tileW, tileH);
        } else if (pat) {
          const m = new DOMMatrix();
          m.translateSelf(b.x + ox, b.y + oy);
          m.scaleSelf(tileW / srcW);
          pat.setTransform(m);
          ctx.fillStyle = pat;
          ctx.fillRect(ex, ey, ew, eh);
        }
      }
    }
  }

  ctx.restore();
}

/**
 * Draws a part pattern. With symmetry enabled the left (top) half of the pattern is drawn as-is
 * and reflected onto the right (bottom) half, so the two sides run in opposite directions
 * (e.g. diagonal stripes forming a herringbone / V, or a sash mirrored across the chest).
 */
export function drawPartPattern(
  ctx: CanvasRenderingContext2D,
  b: KitRect,
  config: PatternSettings
): void {
  if (!config.pattern || config.pattern === 'none') return;

  const symX = !!config.patternSymmetryX;
  const symY = !!config.patternSymmetryY;
  if (!symX && !symY) {
    drawPatternBody(ctx, b, config);
    return;
  }

  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const BIG = 3000;

  for (const mx of symX ? [false, true] : [false]) {
    for (const my of symY ? [false, true] : [false]) {
      ctx.save();
      if (mx) {
        ctx.translate(cx, 0);
        ctx.scale(-1, 1);
        ctx.translate(-cx, 0);
      }
      if (my) {
        ctx.translate(0, cy);
        ctx.scale(1, -1);
        ctx.translate(0, -cy);
      }
      // Source half in the original coordinate space
      const x0 = symX ? cx - BIG : -BIG;
      const x1 = symX ? cx : BIG;
      const y0 = symY ? cy - BIG : -BIG;
      const y1 = symY ? cy : BIG;
      ctx.beginPath();
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.clip();
      drawPatternBody(ctx, b, config);
      ctx.restore();
    }
  }
}

/**
 * Pattern settings to copy onto a counterpart part so the design looks continuous.
 *  - rotate180: front <-> back. The back panel is stored upside-down in the PES template, so the
 *    pattern is flipped on both axes to read the same once the shirt is worn.
 *  - mirrorX: left <-> right pieces get a horizontally mirrored copy (symmetric design).
 */
export function counterpartPatternPatch(
  src: KitPartConfig,
  mode: 'rotate180' | 'mirrorX'
): Partial<KitPartConfig> {
  return {
    pattern: src.pattern,
    patternColor: src.patternColor,
    patternScale: src.patternScale,
    patternOpacity: src.patternOpacity,
    patternThickness: src.patternThickness,
    patternRotation: src.patternRotation ?? 0,
    patternOffsetX: src.patternOffsetX ?? 0,
    patternOffsetY: src.patternOffsetY ?? 0,
    patternSymmetryX: !!src.patternSymmetryX,
    patternSymmetryY: !!src.patternSymmetryY,
    patternImage: src.patternImage,
    patternTint: src.patternTint,
    patternMirrorX: !src.patternMirrorX,
    patternMirrorY: mode === 'rotate180' ? !src.patternMirrorY : !!src.patternMirrorY,
  };
}

/** Pattern layers that cover a part, in drawing order (first = bottom). */
export function patternLayersForPart(layers: PatternLayer[] | undefined, partId: KitPartId): PatternLayer[] {
  return (layers ?? []).filter((l) => l.visible && l.pattern && l.pattern !== 'none' && l.parts.includes(partId));
}

/** Draws every visible pattern layer of a part (the caller clips to the part's shape). */
export function drawPatternLayersForPart(
  ctx: CanvasRenderingContext2D,
  part: KitPartDefinition,
  layers: PatternLayer[] | undefined
): void {
  patternLayersForPart(layers, part.id).forEach((layer) => {
    ctx.save();
    if (layer.backFlip && part.id === 'back') {
      const cx = part.bounds.x + part.bounds.width / 2;
      const cy = part.bounds.y + part.bounds.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI);
      ctx.translate(-cx, -cy);
    }
    drawPartPattern(ctx, part.bounds, layer);
    ctx.restore();
  });
}

const SETTING_KEYS: (keyof PatternSettings)[] = [
  'pattern',
  'patternColor',
  'patternScale',
  'patternOpacity',
  'patternThickness',
  'patternRotation',
  'patternRepeat',
  'patternOffsetX',
  'patternOffsetY',
  'patternImage',
  'patternTint',
  'patternMirrorX',
  'patternMirrorY',
  'patternSymmetryX',
  'patternSymmetryY',
];

/**
 * Moves the old one-pattern-per-part settings into pattern layers (parts with identical settings share
 * one layer). Returns null when no part has a legacy pattern.
 */
export function migrateLegacyPatterns(
  partsConfig: Record<KitPartId, KitPartConfig>,
  existing: PatternLayer[] | undefined
): { partsConfig: Record<KitPartId, KitPartConfig>; patterns: PatternLayer[] } | null {
  const groups = new Map<string, { settings: PatternSettings; parts: KitPartId[] }>();
  (Object.keys(partsConfig) as KitPartId[]).forEach((id) => {
    const cfg = partsConfig[id];
    if (!cfg || !cfg.pattern || cfg.pattern === 'none') return;
    const settings = {} as Record<string, unknown>;
    SETTING_KEYS.forEach((k) => {
      if (cfg[k] !== undefined) settings[k] = cfg[k];
    });
    const key = JSON.stringify(settings);
    const g = groups.get(key);
    if (g) g.parts.push(id);
    else groups.set(key, { settings: settings as unknown as PatternSettings, parts: [id] });
  });
  if (groups.size === 0) return null;

  const patterns: PatternLayer[] = [...(existing ?? [])];
  let n = 0;
  groups.forEach((g) => {
    patterns.push({
      ...g.settings,
      id: `pattern-${Date.now().toString(36)}-${n++}`,
      name: PATTERN_LABEL[g.settings.pattern] ?? 'Pola',
      visible: true,
      parts: g.parts,
      backFlip: false, // legacy patterns were drawn as-is on every part
    });
  });

  const next = { ...partsConfig };
  groups.forEach((g) => g.parts.forEach((id) => (next[id] = { ...next[id], pattern: 'none' })));
  return { partsConfig: next, patterns };
}
