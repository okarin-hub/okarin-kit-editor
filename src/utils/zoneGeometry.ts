import { KitPartId, KitZoneDef, Pt, TemplateZoneState } from '@/types/kit';

/** Every part a zone is drawn on (main part first, no duplicates). */
export function zoneParts(zone: KitZoneDef): KitPartId[] {
  return Array.from(new Set([zone.part, ...(zone.parts ?? [])]));
}

/**
 * Geometry of template zones: bounding box, canvas path (with move / scale / rotate and edge
 * shaping) and a "bake" that turns the edited shape into plain polygons so it can be saved as a
 * library template.
 */

export interface ZoneBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Bounding box of the untransformed zone geometry. */
export function zoneBox(zone: KitZoneDef): ZoneBox {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const add = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  zone.rects?.forEach(([x, y, w, h]) => {
    add(x, y);
    add(x + w, y + h);
  });
  zone.ellipses?.forEach(([x, y, w, h]) => {
    add(x, y);
    add(x + w, y + h);
  });
  zone.polygons?.forEach((p) => p.forEach(([x, y]) => add(x, y)));
  if (!Number.isFinite(x0)) {
    if (zone.maskBox) {
      const [mx, my, mw, mh] = zone.maskBox;
      return { cx: mx + mw / 2, cy: my + mh / 2, w: Math.max(1, mw), h: Math.max(1, mh) };
    }
    // mask-only zone: the mask covers the whole texture
    return { cx: 512, cy: 512, w: 1024, h: 1024 };
  }
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

// ---------------------------------------------------------------------------------------------
// Base shapes (before move / scale / rotate), as polygons
// ---------------------------------------------------------------------------------------------

const ALL_CORNERS = [true, true, true, true];

function rectPolygon(x: number, y: number, w: number, h: number, edge: string, amt: number, corners = ALL_CORNERS): Pt[][] {
  const short = Math.min(w, h);
  if (edge === 'rounded') {
    const r = clamp(amt, 0, 1) * short * 0.5;
    if (r < 0.5) return [[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]];
    const pts: Pt[] = [];
    // (px, py) = the box corner, used as-is when that corner is not rounded
    const corner = (on: boolean, px: number, py: number, cx: number, cy: number, a0: number) => {
      if (!on) return void pts.push([px, py]);
      for (let i = 0; i <= 6; i++) {
        const a = rad(a0 + (90 * i) / 6);
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    };
    corner(corners[1], x + w, y, x + w - r, y + r, -90);
    corner(corners[2], x + w, y + h, x + w - r, y + h - r, 0);
    corner(corners[3], x, y + h, x + r, y + h - r, 90);
    corner(corners[0], x, y, x + r, y + r, 180);
    return [pts];
  }
  if (edge === 'pointed') {
    const horizontal = w >= h;
    const a = clamp(amt, 0, 1) * short * 1.5;
    // a corner that is off stays square, so one side of an end can taper alone (both off = a straight end)
    const [tl, tr, br, bl] = corners.map((on) => (on ? 1 : 0));
    if (horizontal) {
      const t = Math.min(a, w / 2);
      return [[[x + t * tl, y], [x + w - t * tr, y], [x + w, y + h / 2], [x + w - t * br, y + h], [x + t * bl, y + h], [x, y + h / 2]]];
    }
    const t = Math.min(a, h / 2);
    return [[[x, y + t * tl], [x + w / 2, y], [x + w, y + t * tr], [x + w, y + h - t * br], [x + w / 2, y + h], [x, y + h - t * bl]]];
  }
  if (edge === 'slant') {
    const horizontal = w >= h;
    const s = clamp(amt, 0, 1) * short * 1.5;
    if (horizontal) {
      const t = Math.min(s, w * 0.45);
      return [[[x + t, y], [x + w, y], [x + w - t, y + h], [x, y + h]]];
    }
    const t = Math.min(s, h * 0.45);
    return [[[x, y + t], [x + w, y], [x + w, y + h - t], [x, y + h]]];
  }
  return [[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]];
}

function ellipsePolygon(x: number, y: number, w: number, h: number): Pt[] {
  const pts: Pt[] = [];
  const n = 48;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    pts.push([x + w / 2 + (w / 2) * Math.cos(a), y + h / 2 + (h / 2) * Math.sin(a)]);
  }
  return pts;
}

/** Rounds the corners of a polygon with the given radius; `keep(p)` true leaves that vertex sharp. */
function roundPolygon(poly: Pt[], radius: number, keep?: (p: Pt) => boolean): Pt[] {
  if (radius < 0.5 || poly.length < 3) return poly;
  const out: Pt[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p0 = poly[(i + n - 1) % n];
    const p1 = poly[i];
    const p2 = poly[(i + 1) % n];
    if (keep?.(p1)) {
      out.push(p1);
      continue;
    }
    const v1: Pt = [p0[0] - p1[0], p0[1] - p1[1]];
    const v2: Pt = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(v1[0], v1[1]);
    const l2 = Math.hypot(v2[0], v2[1]);
    if (l1 < 1e-6 || l2 < 1e-6) {
      out.push(p1);
      continue;
    }
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const a: Pt = [p1[0] + (v1[0] / l1) * r, p1[1] + (v1[1] / l1) * r];
    const b: Pt = [p1[0] + (v2[0] / l2) * r, p1[1] + (v2[1] / l2) * r];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      // quadratic curve through the corner
      const x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * p1[0] + t * t * b[0];
      const y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * p1[1] + t * t * b[1];
      out.push([x, y]);
    }
  }
  return out;
}

/** Chaikin corner cutting on a closed polygon: each pass rounds the outline a bit more. */
export function smoothPolygon(poly: Pt[], passes: number): Pt[] {
  let pts = poly;
  for (let k = 0; k < passes && pts.length >= 3; k++) {
    const out: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
      out.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    pts = out;
  }
  return pts;
}

/** Ramer-Douglas-Peucker simplification of an open polyline. */
export function simplifyPath(points: Pt[], epsilon: number): Pt[] {
  if (points.length < 3) return points;
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = Math.abs(dy * points[i][0] - dx * points[i][1] + x2 * y1 - y2 * x1) / len;
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > epsilon) {
    const left = simplifyPath(points.slice(0, idx + 1), epsilon);
    const right = simplifyPath(points.slice(idx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[points.length - 1]];
}

/** All polygons of a zone with the edge shaping applied, before move / scale / rotate. */
export function zoneBasePolygons(zone: KitZoneDef, zs: Partial<TemplateZoneState>): Pt[][] {
  const edge = zs.edge ?? 'sharp';
  const amt = zs.edgeAmount ?? 0.5;
  const corners = zs.edgeCorners ?? ALL_CORNERS;
  const polys: Pt[][] = [];
  zone.rects?.forEach(([x, y, w, h]) => polys.push(...rectPolygon(x, y, w, h, edge, amt, corners)));
  zone.ellipses?.forEach(([x, y, w, h]) => polys.push(ellipsePolygon(x, y, w, h)));
  zone.polygons?.forEach((p) => {
    if (edge === 'rounded') {
      const box = zoneBox(zone);
      // a drawn shape's vertex belongs to the corner of the box quarter it lies in
      const keep = (q: Pt) => !corners[q[1] < box.cy ? (q[0] < box.cx ? 0 : 1) : q[0] < box.cx ? 3 : 2];
      polys.push(roundPolygon(p, clamp(amt, 0, 1) * Math.min(box.w, box.h) * 0.25, keep));
    } else {
      polys.push(p);
    }
  });
  const passes = Math.round(clamp(zs.smooth ?? 0, 0, 1) * 4);
  if (passes > 0) {
    return polys.map((p) => (p.length >= 3 ? smoothPolygon(p, passes) : p));
  }
  return polys;
}

/** Applies move / scale / rotate (about the zone centre) to a point. */
export function transformPoint(p: Pt, box: ZoneBox, zs: Partial<TemplateZoneState>, shrink = 1): Pt {
  const sx = (zs.sx ?? 1) * shrink;
  const sy = (zs.sy ?? 1) * shrink;
  const a = rad(zs.rot ?? 0);
  const x = (p[0] - box.cx) * sx;
  const y = (p[1] - box.cy) * sy;
  return [
    box.cx + (zs.dx ?? 0) + x * Math.cos(a) - y * Math.sin(a),
    box.cy + (zs.dy ?? 0) + x * Math.sin(a) + y * Math.cos(a),
  ];
}

/**
 * Offsets of the copies of a repeated zone: the zone itself first, then one step per copy along its own (rotated)
 * height or width, so the copies of a diagonal strip stay parallel to it.
 */
/** How a zone repeats: number of copies, the (unrotated) axis they go along and the gap between them. */
export function repeatLayout(zone: KitZoneDef, zs: Partial<TemplateZoneState>): { n: number; dir: 'x' | 'y'; gap: number } {
  // clamped here too: a project file from elsewhere could hold any number
  const n = clamp(Math.round(Number(zs.repeat) || 1), 1, 12);
  const box = zoneBox(zone);
  const dir = zs.repeatDir ?? (box.w * (zs.sx ?? 1) >= box.h * (zs.sy ?? 1) ? 'y' : 'x');
  return { n, dir, gap: clamp(Number(zs.repeatGap ?? 12) || 0, 0, 1024) };
}

export function repeatOffsets(zone: KitZoneDef, zs: Partial<TemplateZoneState>): Pt[] {
  const { n, dir, gap } = repeatLayout(zone, zs);
  if (n === 1) return [[0, 0]];
  const box = zoneBox(zone);
  const w = box.w * (zs.sx ?? 1);
  const h = box.h * (zs.sy ?? 1);
  const step = (dir === 'y' ? h : w) + gap;
  const a = rad(zs.rot ?? 0);
  const [ux, uy] = dir === 'y' ? [-Math.sin(a), Math.cos(a)] : [Math.cos(a), Math.sin(a)];
  return Array.from({ length: n }, (_, i) => [ux * step * i, uy * step * i] as Pt);
}

/** The zone moved onto another part: the same relative place inside the part, scaled to the part's size. */
export function moveZoneToPart(
  zone: KitZoneDef,
  part: KitPartId,
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number }
): { zone: KitZoneDef; scale: number } {
  const box = zoneBox(zone);
  const s = Math.min(to.width / from.width, to.height / from.height);
  const cx = to.x + ((box.cx - from.x) / from.width) * to.width;
  const cy = to.y + ((box.cy - from.y) / from.height) * to.height;
  const map = ([x, y]: Pt): Pt => [cx + (x - box.cx) * s, cy + (y - box.cy) * s];
  const rect = ([x, y, w, h]: [number, number, number, number]): [number, number, number, number] => {
    const [nx, ny] = map([x, y]);
    return [nx, ny, w * s, h * s];
  };
  return {
    zone: {
      ...zone,
      part,
      parts: undefined,
      rects: zone.rects?.map(rect),
      ellipses: zone.ellipses?.map(rect),
      polygons: zone.polygons?.map((p) => p.map(map)),
    },
    scale: s,
  };
}

/**
 * Builds the canvas path of the zone (move / scale / rotate and edge shaping applied) and leaves
 * it as the current path, ready for fill() / stroke(). `inset` (px) shrinks the shape a little,
 * which is used for the fine top-stitch inside a zone.
 */
export function zonePath(
  ctx: CanvasRenderingContext2D,
  zone: KitZoneDef,
  zs: Partial<TemplateZoneState>,
  inset = 0
): void {
  const box = zoneBox(zone);
  const wScaled = box.w * (zs.sx ?? 1);
  const hScaled = box.h * (zs.sy ?? 1);
  const shrink = inset > 0 ? clamp(1 - (2 * inset) / Math.max(8, Math.min(wScaled, hScaled)), 0.35, 1) : 1;

  const polys = zoneBasePolygons(zone, zs);
  ctx.beginPath();
  repeatOffsets(zone, zs).forEach(([ox, oy]) =>
    polys.forEach((poly) => {
      poly.forEach((p, i) => {
        const [x, y] = transformPoint(p, box, zs, shrink);
        if (i === 0) ctx.moveTo(x + ox, y + oy);
        else ctx.lineTo(x + ox, y + oy);
      });
      ctx.closePath();
    })
  );
}

/** The zone's move / rotate / scale as a matrix in texture space (same as transformPoint, without the repeats). */
export function zoneMatrix(zone: KitZoneDef, zs: Partial<TemplateZoneState>): DOMMatrix {
  const box = zoneBox(zone);
  return new DOMMatrix()
    .translate(box.cx + (zs.dx ?? 0), box.cy + (zs.dy ?? 0))
    .rotate(zs.rot ?? 0)
    .scale(zs.sx ?? 1, zs.sy ?? 1)
    .translate(-box.cx, -box.cy);
}

/** Draws a full-texture mask image with the zone's move / scale / rotate applied. */
export function drawMaskTransformed(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  zone: KitZoneDef,
  zs: Partial<TemplateZoneState>
): void {
  const box = zoneBox(zone);
  ctx.save();
  ctx.translate(box.cx + (zs.dx ?? 0), box.cy + (zs.dy ?? 0));
  ctx.rotate(rad(zs.rot ?? 0));
  ctx.scale(zs.sx ?? 1, zs.sy ?? 1);
  ctx.translate(-box.cx, -box.cy);
  if (zone.maskCropped && zone.maskBox) ctx.drawImage(img, ...zone.maskBox);
  else ctx.drawImage(img, 0, 0, 1024, 1024);
  ctx.restore();
}

/** Turns an edited zone into plain polygons (final position / size / shape) for saving; `withRepeats` also bakes the copies. */
export function bakeZone(zone: KitZoneDef, zs: Partial<TemplateZoneState>, withRepeats = false): KitZoneDef {
  const box = zoneBox(zone);
  const base = zoneBasePolygons(zone, zs);
  const offsets: Pt[] = withRepeats ? repeatOffsets(zone, zs) : [[0, 0]];
  const polygons = offsets.flatMap(([ox, oy]) =>
    base.map((poly) =>
      poly.map((p) => {
        const [x, y] = transformPoint(p, box, zs);
        return [Math.round((x + ox) * 10) / 10, Math.round((y + oy) * 10) / 10] as Pt;
      })
    )
  );
  const baked: KitZoneDef = { ...zone, rects: undefined, ellipses: undefined, polygons };
  if (!polygons.length) delete baked.polygons;
  return baked;
}

let hitCtx: CanvasRenderingContext2D | null = null;

/** True when texture point (x, y) lies on (or very near) the zone as currently drawn. */
export function zoneHitTest(
  zone: KitZoneDef,
  zs: Partial<TemplateZoneState>,
  x: number,
  y: number,
  tolerance = 7
): boolean {
  if (typeof document === 'undefined') return false;
  if (!hitCtx) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    hitCtx = c.getContext('2d');
  }
  const ctx = hitCtx;
  if (!ctx) return false;
  const hasShape = !!(zone.rects?.length || zone.polygons?.length || zone.ellipses?.length);
  if (!hasShape) {
    const b = zoneBox(zone);
    return Math.abs(x - b.cx - (zs.dx ?? 0)) <= (b.w * (zs.sx ?? 1)) / 2 && Math.abs(y - b.cy - (zs.dy ?? 0)) <= (b.h * (zs.sy ?? 1)) / 2;
  }
  zonePath(ctx, zone, zs);
  if (ctx.isPointInPath(x, y, zone.fill ?? 'evenodd')) return true;
  ctx.lineWidth = tolerance * 2;
  return ctx.isPointInStroke(x, y);
}
