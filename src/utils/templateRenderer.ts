import { KitPartDefinition, KitTemplate, KitZoneDef, Pt, SeamConfig, TemplateState } from '@/types/kit';
import { partPolygons, tracePolygons, insetPolygon } from '@/utils/partShape';

const hasShape = (z: KitZoneDef) => !!(z.rects?.length || z.polygons?.length || z.ellipses?.length);
import { getCachedImage, preloadImage } from '@/utils/imageCache';
import { tintedTile } from '@/utils/patternRenderer';
import { zonePath, drawMaskTransformed, zoneParts } from '@/utils/zoneGeometry';

/**
 * Draws template zones (colourable panels) and seam / stitch lines for one part.
 * Shared by the texture generator (3D + export) and the Konva 2D editor, so they always match.
 *
 * Seams are drawn the way real garments look: a soft shadow where two panels meet, a crisp seam
 * line, a faint highlight on the lit side and (for the "natural" style) a fine top-stitch close to
 * the seam. All colours are derived from the fabric colour, so seams stay subtle on any kit.
 */

type RGB = [number, number, number];

function parseHex(hex: string): RGB {
  const m = hex.replace('#', '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return [128, 128, 128];
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const luminance = ([r, g, b]: RGB) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const rgba = ([r, g, b]: RGB, a: number) =>
  `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.max(0, Math.min(1, a))})`;

interface SeamTones {
  shade: RGB; // soft shadow / seam line
  light: RGB; // highlight on the lit side
  stitch: RGB; // thread colour
}

function seamTones(seams: SeamConfig, fabricHex: string): SeamTones {
  const fabric = parseHex(fabricHex);
  const dark = luminance(fabric) < 0.45;
  const shade = mix(fabric, [0, 0, 0], dark ? 0.7 : 0.5);
  const light = mix(fabric, [255, 255, 255], dark ? 0.32 : 0.45);
  // Fixed thread colour when chosen, otherwise a tone close to the fabric (like real thread)
  const stitch = seams.color
    ? parseHex(seams.color)
    : dark
    ? mix(fabric, [255, 255, 255], 0.38)
    : mix(fabric, [0, 0, 0], 0.32);
  return { shade, light, stitch };
}

/** Soft shadow + crisp seam line + faint highlight along a path. */
function softSeam(
  ctx: CanvasRenderingContext2D,
  seams: SeamConfig,
  fabricHex: string,
  build: () => void
): void {
  const t = seamTones(seams, fabricHex);
  const a = seams.opacity;
  const w = Math.max(0.6, seams.width);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);

  const stroke = (color: string, width: number, dx = 0, dy = 0) => {
    ctx.save();
    if (dx || dy) ctx.translate(dx, dy);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    build();
    ctx.stroke();
    ctx.restore();
  };

  // ambient-occlusion falloff, widest first
  stroke(rgba(t.shade, a * 0.1), w * 6);
  stroke(rgba(t.shade, a * 0.16), w * 3.6);
  stroke(rgba(t.shade, a * 0.5), w * 1.3);
  // light catching the edge of the panel next to the seam
  stroke(rgba(t.light, a * 0.35), w * 0.9, w * 0.9, w * 0.9);
}

/** Fine dashed top-stitch. */
function topStitch(
  ctx: CanvasRenderingContext2D,
  seams: SeamConfig,
  fabricHex: string,
  build: () => void
): void {
  const t = seamTones(seams, fabricHex);
  const w = Math.max(0.6, seams.width);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.setLineDash([w * 2.4, w * 2]);
  ctx.strokeStyle = rgba(t.stitch, seams.opacity * 0.75);
  ctx.lineWidth = w * 0.85;
  build();
  ctx.stroke();
  ctx.restore();
}

/** Visible contrast stitching (the older, more graphic look). */
function contrastStitch(
  ctx: CanvasRenderingContext2D,
  seams: SeamConfig,
  fabricHex: string,
  build: () => void
): void {
  const t = seamTones(seams, fabricHex);
  const base = seams.color ? parseHex(seams.color) : luminance(parseHex(fabricHex)) < 0.5 ? ([255, 255, 255] as RGB) : ([0, 0, 0] as RGB);
  const w = Math.max(0.6, seams.width);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const dash = [w * 4, w * 3];
  ctx.setLineDash(dash);
  ctx.strokeStyle = rgba(t.shade, seams.opacity * 0.3);
  ctx.lineWidth = w + 0.8;
  build();
  ctx.stroke();
  ctx.strokeStyle = rgba(base, seams.opacity);
  ctx.lineWidth = w;
  build();
  ctx.stroke();
  ctx.restore();
}

/** Tension of the curve through stitch points (same value the 2D drawing preview uses). */
export const SEAM_CURVE_TENSION = 0.5;

/** Path through the points: straight segments, or a smooth cardinal curve when `smooth` is set. */
export function traceSeamPath(ctx: CanvasRenderingContext2D, points: Pt[], smooth?: boolean, closed?: boolean): void {
  ctx.beginPath();
  const n = points.length;
  if (n === 0) return;
  if (!smooth || n < 3) {
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    if (closed) ctx.closePath();
    return;
  }
  // control points around every inner point (chord-length weighted, like Konva's tension lines)
  const ctrl: [number, number, number, number][] = [];
  for (let i = 1; i < n - 1; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const d01 = Math.hypot(x1 - x0, y1 - y0);
    const d12 = Math.hypot(x2 - x1, y2 - y1);
    const sum = d01 + d12 || 1;
    const fa = (SEAM_CURVE_TENSION * d01) / sum;
    const fb = (SEAM_CURVE_TENSION * d12) / sum;
    ctrl.push([x1 - fa * (x2 - x0), y1 - fa * (y2 - y0), x1 + fb * (x2 - x0), y1 + fb * (y2 - y0)]);
  }
  ctx.moveTo(points[0][0], points[0][1]);
  ctx.quadraticCurveTo(ctrl[0][0], ctrl[0][1], points[1][0], points[1][1]);
  for (let i = 2; i < n - 1; i++) {
    const a = ctrl[i - 2];
    const b = ctrl[i - 1];
    ctx.bezierCurveTo(a[2], a[3], b[0], b[1], points[i][0], points[i][1]);
  }
  const last = ctrl[ctrl.length - 1];
  ctx.quadraticCurveTo(last[2], last[3], points[n - 1][0], points[n - 1][1]);
}

export function drawTemplateForPart(
  ctx: CanvasRenderingContext2D,
  part: KitPartDefinition,
  template: KitTemplate,
  state: TemplateState,
  fabricHex: string
): void {
  const zones = template.zones.filter((z) => zoneParts(z).includes(part.id) && state.zones[z.id]?.visible);
  const extraSeams = (template.seams ?? []).filter((s) => s.part === part.id);
  const seams = state.seams;
  if (zones.length === 0 && !(seams.enabled && part.regions.length)) return;

  ctx.save();
  // Everything stays inside the pieces of this part
  ctx.beginPath();
  tracePolygons(ctx, partPolygons(part));
  ctx.clip();

  // 1. Coloured zones (move / scale / rotate / edge shaping / opacity come from the zone state)
  zones.forEach((zone) => {
    const zs = state.zones[zone.id];
    if (hasShape(zone)) {
      ctx.save();
      ctx.globalAlpha = zs.opacity ?? 1;
      ctx.fillStyle = zs.color;
      zonePath(ctx, zone, zs);
      ctx.fill('evenodd');
      ctx.restore();
    }
    if (zone.mask) {
      const img = getCachedImage(zone.mask);
      if (img) {
        // masks keep the full 1024 px resolution (pattern tiles are downscaled to 512)
        const tinted = zone.keepColor ? img : tintedTile(zone.mask, img, zs.color, 1024);
        if (tinted) {
          ctx.save();
          ctx.globalAlpha = zs.opacity ?? 1;
          drawMaskTransformed(ctx, tinted, zone, zs);
          ctx.restore();
        }
      } else {
        preloadImage(zone.mask);
      }
    }
  });

  // 2. Seams
  if (seams.enabled) {
    // The legacy "flat" style is now the soft seam
    const style = (seams.style as string) === 'flat' ? 'soft' : seams.style;

    // Short AND long sleeve areas get seams (the 3D model only has short sleeves)
    const polyAt = (poly: Pt[], inset: number) => () => {
      ctx.beginPath();
      tracePolygons(ctx, [insetPolygon(poly, inset)]);
    };

    if (seams.outline) partPolygons(part).forEach((poly) => {
      if (style === 'stitch' || style === 'double') {
        const inset = 3;
        contrastStitch(ctx, seams, fabricHex, polyAt(poly, inset));
        if (style === 'double') contrastStitch(ctx, seams, fabricHex, polyAt(poly, inset + 4));
      } else {
        softSeam(ctx, seams, fabricHex, polyAt(poly, 0.5));
        if (style === 'natural') {
          const inset = 5 * Math.max(0.8, seams.width / 1.6);
          topStitch(ctx, seams, fabricHex, polyAt(poly, inset));
        }
      }
    });

    // Each zone has its own stitch line along its outline (can be switched off per zone)
    zones.forEach((zone) => {
      const zs = state.zones[zone.id];
      if (!hasShape(zone) || zs.seam === false) return;
      const outline = () => zonePath(ctx, zone, zs);
      if (style === 'stitch' || style === 'double') {
        contrastStitch(ctx, seams, zs.color, outline);
      } else {
        softSeam(ctx, seams, zs.color, outline);
        if (style === 'natural') {
          topStitch(ctx, seams, zs.color, () => zonePath(ctx, zone, zs, 4 * Math.max(0.8, seams.width / 1.6)));
        }
      }
    });

    extraSeams.forEach((s) => {
      const build = () => traceSeamPath(ctx, s.points, s.smooth, s.closed);
      if (style === 'stitch' || style === 'double') contrastStitch(ctx, seams, fabricHex, build);
      else {
        softSeam(ctx, seams, fabricHex, build);
        if (style === 'natural') topStitch(ctx, seams, fabricHex, build);
      }
    });
  }

  ctx.restore();
}
