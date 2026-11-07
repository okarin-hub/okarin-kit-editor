import { KitPartDefinition, KitPartId, KitTemplate, KitZoneDef, Pt, TemplateState, TemplateZoneState } from '@/types/kit';
import { bakeZone, zoneParts } from '@/utils/zoneGeometry';
import { drawTemplateForPart } from '@/utils/templateRenderer';

const hasShape = (z: KitZoneDef) => !!(z.rects?.length || z.polygons?.length || z.ellipses?.length);

/** Signed area (shoelace): > 0 for one winding, < 0 for the other. */
const area = (p: Pt[]) => p.reduce((s, [x, y], i) => {
  const [nx, ny] = p[(i + 1) % p.length];
  return s + x * ny - nx * y;
}, 0);

/**
 * Merges template layers into one, like Photoshop's Merge Layers. Shapes of one colour (same parts and opacity, no
 * blend, mask or eraser strokes) stay a shape: their final outlines, copies included, joined with the non-zero fill
 * rule. Anything else is drawn the way it shows on the kit (blend, opacity, eraser, stitches) and becomes one image
 * layer that keeps its colours. `ids` in any order; the merged layer takes the place of the top one.
 * Returns null when nothing visible is left to merge.
 */
export function mergeZones(
  def: KitTemplate,
  state: TemplateState,
  ids: string[],
  newId: string,
  parts: Record<KitPartId, KitPartDefinition>
): { zone: KitZoneDef; zs: TemplateZoneState } | null {
  const pick = new Set(ids);
  const members = def.zones.filter((z) => pick.has(z.id));
  if (members.length < 2) return null;
  const top = members[members.length - 1];
  const topState = state.zones[top.id] ?? { color: top.defaultColor, visible: true };
  const st = (z: KitZoneDef) => state.zones[z.id] ?? { color: z.defaultColor, visible: z.defaultVisible };
  const partsKey = (z: KitZoneDef) => [...zoneParts(z)].sort().join(',');
  const clippedTo = new Set(def.zones.filter((z) => z.clipTo).map((z) => z.clipTo));
  const shared = {
    name: 'Gabungan',
    part: top.part,
    group: top.group,
    ...(top.layerGroup ? { layerGroup: top.layerGroup } : {}),
    defaultVisible: true,
  };

  const asShape = members.every(
    (z) =>
      hasShape(z) &&
      !z.mask && !z.blend && !z.clipTo && !z.base && !clippedTo.has(z.id) &&
      !st(z).erase && st(z).visible &&
      st(z).color.toLowerCase() === topState.color.toLowerCase() &&
      (st(z).opacity ?? 1) === (topState.opacity ?? 1) &&
      partsKey(z) === partsKey(top)
  );
  if (asShape) {
    // the final outlines (move / size / turn / edge / smoothing / copies), all wound the same way so the non-zero
    // rule fills overlaps instead of cutting holes
    const polygons = members.flatMap((z) => bakeZone(z, st(z), true).polygons ?? []).map((p) => (area(p) < 0 ? [...p].reverse() : p));
    return {
      zone: { ...shared, id: newId, ...(top.parts ? { parts: top.parts } : {}), polygons, fill: 'nonzero', defaultColor: topState.color },
      zs: { color: topState.color, visible: true, ...(topState.opacity !== undefined ? { opacity: topState.opacity } : {}), ...(topState.seam === false ? { seam: false } : {}) },
    };
  }

  // image layer: these layers alone, drawn part by part exactly as on the kit (without the patterns placed above them)
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const only: KitTemplate = { ...def, zones: members, seams: [] };
  const onlyState: TemplateState = { ...state, seams: { ...state.seams, outline: false } };
  const allParts = Array.from(new Set(members.flatMap(zoneParts)));
  allParts.forEach((pid) => {
    const part = parts[pid];
    if (!part) return;
    drawTemplateForPart(ctx, part, only, onlyState, '#808080', 'base', false);
    drawTemplateForPart(ctx, part, only, onlyState, '#808080', 'top', false);
  });
  // crop to the painted pixels (smaller project files)
  const px = ctx.getImageData(0, 0, 1024, 1024).data;
  let x0 = 1024, y0 = 1024, x1 = -1, y1 = -1;
  for (let y = 0; y < 1024; y++)
    for (let x = 0; x < 1024; x++)
      if (px[(y * 1024 + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const crop = document.createElement('canvas');
  crop.width = w;
  crop.height = h;
  crop.getContext('2d')!.drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
  const rest = allParts.filter((p) => p !== top.part);
  return {
    zone: {
      ...shared,
      id: newId,
      ...(rest.length ? { parts: rest } : {}),
      mask: crop.toDataURL('image/png'),
      maskBox: [x0, y0, w, h],
      maskCropped: true,
      keepColor: true,
      defaultColor: topState.color,
    },
    zs: { color: topState.color, visible: true },
  };
}
