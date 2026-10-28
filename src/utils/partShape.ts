import { KitPartDefinition, Pt } from '@/types/kit';

/** Polygons of a part: its real outline, or its rectangles when it has none. */
export function partPolygons(part: KitPartDefinition): Pt[][] {
  if (part.outline) return part.outline;
  return part.regions.map((r) => [
    [r.x, r.y],
    [r.x + r.width, r.y],
    [r.x + r.width, r.y + r.height],
    [r.x, r.y + r.height],
  ]);
}

interface PathLike {
  moveTo(x: number, y: number): unknown;
  lineTo(x: number, y: number): unknown;
  closePath(): unknown;
}

/** Adds the polygons as sub-paths (call beginPath first). */
export function tracePolygons(ctx: PathLike, polys: Pt[][]): void {
  polys.forEach((poly) => {
    poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
  });
}

/** True when the point lies inside at least one of the polygons (ray casting). */
export function pointInPolygons(polys: Pt[][], x: number, y: number): boolean {
  return polys.some((poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  });
}

/** Bounding rectangle of all polygons. */
export function polygonsBox(polys: Pt[][]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  polys.forEach((p) => p.forEach(([x, y]) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Polygon moved towards its own centre by `inset` px (per axis), for inner stitch lines. */
export function insetPolygon(poly: Pt[], inset: number): Pt[] {
  if (inset === 0) return poly;
  const b = polygonsBox([poly]);
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  const sx = Math.max(0.1, 1 - inset / Math.max(1, b.width / 2));
  const sy = Math.max(0.1, 1 - inset / Math.max(1, b.height / 2));
  return poly.map(([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy] as Pt);
}
