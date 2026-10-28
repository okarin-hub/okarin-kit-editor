import { KitGraphicItem, LogoFill, LogoOutline } from '@/types/kit';

/**
 * Recolour / gradient / outline for image logos.
 *
 * The result is a bitmap (with padding for an outside outline) that both the 2D editor and the texture
 * generator draw instead of the plain image, so 2D, 3D and export always match.
 */

export const DEFAULT_LOGO_FILL: LogoFill = { mode: 'original', color: '#ffffff', color2: '#e11d48', angle: 90 };
export const DEFAULT_LOGO_OUTLINE: LogoOutline = { enabled: false, color: '#000000', width: 3, position: 'outside' };

export interface StyledLogo {
  canvas: HTMLCanvasElement;
  /** Padding around the logo in logo units (outside outlines grow past the logo box). */
  pad: number;
}

const cache = new Map<string, StyledLogo>();

export function logoHasStyle(item: KitGraphicItem): boolean {
  return (item.fill && item.fill.mode !== 'original') || !!item.outline?.enabled;
}

function make(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return [c, c.getContext('2d')!];
}

/** The logo's silhouette painted in one colour (alpha of the image is kept). */
function silhouette(
  img: CanvasImageSource,
  w: number,
  h: number,
  pad: number,
  paint: ((x: CanvasRenderingContext2D) => string | CanvasGradient) | null
): HTMLCanvasElement {
  const [c, x] = make(w + pad * 2, h + pad * 2);
  x.drawImage(img, pad, pad, w, h);
  if (paint) {
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = paint(x);
    x.fillRect(0, 0, c.width, c.height);
  }
  return c;
}

/** Grows a shape by `r` px: the union of the shape moved around circles up to radius r. */
function dilate(src: HTMLCanvasElement, r: number): HTMLCanvasElement {
  const [c, x] = make(src.width, src.height);
  x.drawImage(src, 0, 0);
  const rings = Math.max(1, Math.ceil(r / 3));
  for (let k = 1; k <= rings; k++) {
    const rad = (r * k) / rings;
    const n = Math.min(64, Math.max(16, Math.ceil(rad * 6)));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      x.drawImage(src, Math.cos(a) * rad, Math.sin(a) * rad);
    }
  }
  return c;
}

function tint(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const [c, x] = make(src.width, src.height);
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Everything that is NOT the shape (inside of the padded canvas), as an alpha mask. */
function inverse(src: HTMLCanvasElement): HTMLCanvasElement {
  const [c, x] = make(src.width, src.height);
  x.fillStyle = '#000';
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-out';
  x.drawImage(src, 0, 0);
  return c;
}

function linearGradient(x: CanvasRenderingContext2D, w: number, h: number, ox: number, oy: number, fill: LogoFill): CanvasGradient {
  const a = (fill.angle * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = ox + w / 2;
  const cy = oy + h / 2;
  const g = x.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  g.addColorStop(0, fill.color);
  g.addColorStop(1, fill.color2);
  return g;
}

/**
 * Returns the styled bitmap for an image logo at `scale` px per logo unit, or null when the logo has no style
 * (draw the plain image then). Results are cached.
 */
export function getStyledLogo(img: HTMLImageElement, item: KitGraphicItem, scale: number): StyledLogo | null {
  if (!logoHasStyle(item)) return null;
  const fill = item.fill ?? DEFAULT_LOGO_FILL;
  const outline = item.outline?.enabled ? item.outline : null;
  const key = JSON.stringify([item.src?.length, item.src?.slice(-24), item.width, item.height, scale, fill, outline]);
  const hit = cache.get(key);
  if (hit) return hit;

  const w = Math.max(1, Math.round(item.width * scale));
  const h = Math.max(1, Math.round(item.height * scale));
  const ow = outline ? outline.width * scale : 0;
  const outsideR = !outline ? 0 : outline.position === 'outside' ? ow : outline.position === 'center' ? ow / 2 : 0;
  const insideR = !outline ? 0 : outline.position === 'inside' ? ow : outline.position === 'center' ? ow / 2 : 0;
  const pad = Math.ceil(outsideR) + 2;

  // the logo itself, recoloured
  const paintFn =
    fill.mode === 'solid'
      ? () => fill.color
      : fill.mode === 'gradient'
      ? (x: CanvasRenderingContext2D) => linearGradient(x, w, h, pad, pad, fill)
      : null;
  const body = silhouette(img, w, h, pad, paintFn);

  const [out, ox] = make(w + pad * 2, h + pad * 2);
  if (outline) {
    const alpha = silhouette(img, w, h, pad, null);
    if (outsideR > 0) ox.drawImage(tint(dilate(alpha, outsideR), outline.color), 0, 0);
    ox.drawImage(body, 0, 0);
    if (insideR > 0) {
      // ring inside the edge: the part of the shape that lies within insideR of the outside
      const ring = dilate(inverse(alpha), insideR);
      const rx = ring.getContext('2d')!;
      rx.globalCompositeOperation = 'destination-in';
      rx.drawImage(alpha, 0, 0);
      ox.drawImage(tint(ring, outline.color), 0, 0);
    }
  } else {
    ox.drawImage(body, 0, 0);
  }

  const result: StyledLogo = { canvas: out, pad: pad / scale };
  if (cache.size > 60) cache.clear();
  cache.set(key, result);
  return result;
}
