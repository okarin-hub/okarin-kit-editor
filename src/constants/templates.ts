import { KitTemplate, KitZoneDef, Pt, SeamConfig, TemplateState } from '@/types/kit';

/**
 * Built-in kit templates. A template is a list of independently colourable ZONES (collar, side
 * panels, sleeve cuffs, shoulder panels, hems, stripes ...) drawn on top of the part colours, plus
 * optional extra seam lines. All coordinates are in the 1024x1024 PES texture space (see
 * constants/pes2021Parts.ts). Zones are clipped to their part's regions, so they can never spill
 * onto a neighbouring piece.
 *
 * Positions were calibrated against the 3D model's own UV data:
 *  - sleeves: x runs along the arm (cuff on the outer side of the image); y wraps around it:
 *    y ~ 347/586 = underside, y ~ 440 = back, y ~ 480 = top of the shoulder, y ~ 535 = front.
 *  - shorts: the island is rotated: x runs along the leg (hem at x ~ 81 / 940, waist at x ~ 320 /
 *    704) and y wraps around it (y ~ 583 / 976 = inner seams, y ~ 780 = outer side).
 *  - socks: y runs along the leg (y = 320 is the top), x wraps around it.
 *  - shoulders: the shoulder ridge of the shirt is at y ~ 452..500, x 380..446 and 578..644.
 *
 * Users can add their own templates as JSON files in library/templates (same shape).
 */

export const DEFAULT_SEAMS: SeamConfig = {
  enabled: true,
  style: 'natural',
  opacity: 0.6,
  width: 1.6,
  outline: false,
};

type Rect = [number, number, number, number];

const zone = (
  id: string,
  name: string,
  part: KitZoneDef['part'],
  group: KitZoneDef['group'],
  shape: { rects?: Rect[]; polygons?: Pt[][] },
  defaultColor: string,
  defaultVisible = true
): KitZoneDef => ({ id, name, part, group, defaultColor, defaultVisible, ...shape });

/** Mirrors a polygon around the vertical centre line of the shirt (x = 512). */
const mirrorX = (poly: Pt[]): Pt[] => poly.map(([x, y]) => [1024 - x, y] as Pt);

const LIGHT = '#f8fafc';
const MID = '#94a3b8';
const DARK = '#1e293b';

// ---------------------------------------------------------------------------------------------
// Shared geometry
// ---------------------------------------------------------------------------------------------

// Inner neck lining: a thin band around the neck hole (outer outline + hole, even-odd fill)
const NECK_INNER: Pt[][] = [
  [[454, 447], [570, 447], [570, 503], [512, 552], [454, 503]],
  [[462, 455], [562, 455], [562, 500], [512, 543], [462, 500]],
];
const COLLAR_RIB: Rect = [336, 938, 352, 42]; // the ribbed neck band (the "collar" part)

const FRONT_HEM: Rect = [345, 906, 335, 32];
const BACK_HEM: Rect = [345, 0, 335, 32]; // the back panel is stored upside-down: hem at y = 0

const CUFF_R: Rect = [222, 333, 38, 272]; // texture-left sleeve = player's right sleeve
const CUFF_L: Rect = [764, 333, 38, 272];

// Long-sleeve areas of the PES template (the 3D model only has short sleeves, so these show up in
// the 2D canvas and in the exported texture). The cuff is on the outer edge of the image.
const LONG_CUFF_R: Rect = [0, 68, 40, 247];
const LONG_CUFF_L: Rect = [984, 68, 40, 247];
const LONG_R: Rect = [0, 68, 345, 247];
const LONG_L: Rect = [680, 68, 344, 247];

const SHORTS_HEM_R: Rect = [81, 583, 45, 393];
const SHORTS_HEM_L: Rect = [895, 583, 45, 393];
const SHORTS_SIDE_R: Rect = [81, 700, 240, 160]; // outer side of the leg
const SHORTS_SIDE_L: Rect = [704, 700, 240, 160];

const SOCK_TOP_R: Rect = [0, 320, 222, 40];
const SOCK_TOP_L: Rect = [805, 320, 219, 40];

// Shoulder strips on top of the shoulders (front side y 452..502, back side y 400..452)
const SHOULDER_FRONT: Rect[] = [[380, 452, 66, 50], [578, 452, 66, 50]];
const SHOULDER_BACK: Rect[] = [[380, 400, 66, 52], [578, 400, 66, 52]];

const collarZones = (): KitZoneDef[] => [
  zone('collar-rib', 'Kerah (rib)', 'collar', 'shirt', { rects: [COLLAR_RIB] }, LIGHT),
  zone('collar-inner', 'Kerah (bagian dalam)', 'front', 'shirt', { polygons: NECK_INNER }, LIGHT),
];

const hemZones = (): KitZoneDef[] => [
  zone('hem-front', 'Lis bawah baju (depan)', 'front', 'shirt', { rects: [FRONT_HEM] }, LIGHT),
  zone('hem-back', 'Lis bawah baju (belakang)', 'back', 'shirt', { rects: [BACK_HEM] }, LIGHT),
];

const cuffZones = (): KitZoneDef[] => [
  zone('cuff-r', 'Manset lengan kanan', 'leftSleeve', 'shirt', { rects: [CUFF_R] }, LIGHT),
  zone('cuff-l', 'Manset lengan kiri', 'rightSleeve', 'shirt', { rects: [CUFF_L] }, LIGHT),
  zone('cuff-long-r', 'Manset lengan panjang kanan', 'leftSleeve', 'shirt', { rects: [LONG_CUFF_R] }, LIGHT),
  zone('cuff-long-l', 'Manset lengan panjang kiri', 'rightSleeve', 'shirt', { rects: [LONG_CUFF_L] }, LIGHT),
];

const sockTopZones = (): KitZoneDef[] => [
  zone('sock-top-r', 'Karet kaus kaki kanan', 'leftSock', 'socks', { rects: [SOCK_TOP_R] }, LIGHT),
  zone('sock-top-l', 'Karet kaus kaki kiri', 'rightSock', 'socks', { rects: [SOCK_TOP_L] }, LIGHT),
];

const shortsHemZones = (): KitZoneDef[] => [
  zone('shorts-hem-r', 'Lis celana kanan', 'leftShorts', 'shorts', { rects: [SHORTS_HEM_R] }, LIGHT),
  zone('shorts-hem-l', 'Lis celana kiri', 'rightShorts', 'shorts', { rects: [SHORTS_HEM_L] }, LIGHT),
];

// ---------------------------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------------------------

const BLANK: KitTemplate = {
  id: 'blank',
  name: 'Polos (tanpa zona)',
  description: 'Hanya warna dasar bagian. Cocok sebagai titik awal atau untuk desain impor.',
  source: 'builtin',
  zones: [],
};

const CLASSIC: KitTemplate = {
  id: 'classic',
  name: 'Klasik — kerah, manset, lis',
  description: 'Kerah (rib dan bagian dalam), manset lengan, lis baju dan celana, serta karet kaus kaki.',
  source: 'builtin',
  zones: [
    ...collarZones(),
    ...hemZones(),
    ...cuffZones(),
    ...shortsHemZones(),
    ...sockTopZones(),
  ],
};

const POLO: KitTemplate = {
  id: 'polo',
  name: 'Polo klasik — kerah & plaket',
  description: 'Kerah polo dengan plaket tengah, manset lengan, lis, dan lis celana.',
  source: 'builtin',
  zones: [
    ...collarZones(),
    zone('placket', 'Plaket depan', 'front', 'shirt', { rects: [[496, 543, 32, 150]] }, MID),
    ...cuffZones(),
    ...hemZones(),
    ...shortsHemZones(),
    ...sockTopZones(),
  ],
};

const RAGLAN_FRONT_L: Pt[] = [[380, 452], [458, 452], [380, 548]];
const RAGLAN_BACK_L: Pt[] = [[380, 452], [458, 452], [380, 356]];

const RAGLAN: KitTemplate = {
  id: 'raglan',
  name: 'Raglan modern',
  description: 'Lengan raglan: panel bahu menyambung ke leher, lalu kerah, manset, dan lis.',
  source: 'builtin',
  zones: [
    zone('raglan-sleeve-r', 'Lengan raglan kanan', 'leftSleeve', 'shirt', { rects: [[222, 333, 158, 272]] }, DARK),
    zone('raglan-sleeve-l', 'Lengan raglan kiri', 'rightSleeve', 'shirt', { rects: [[645, 333, 157, 272]] }, DARK),
    zone('raglan-sleeve-long-r', 'Lengan raglan panjang kanan', 'leftSleeve', 'shirt', { rects: [LONG_R] }, DARK),
    zone('raglan-sleeve-long-l', 'Lengan raglan panjang kiri', 'rightSleeve', 'shirt', { rects: [LONG_L] }, DARK),
    zone('raglan-front', 'Panel bahu depan', 'front', 'shirt', { polygons: [RAGLAN_FRONT_L, mirrorX(RAGLAN_FRONT_L)] }, DARK),
    zone('raglan-back', 'Panel bahu belakang', 'back', 'shirt', { polygons: [RAGLAN_BACK_L, mirrorX(RAGLAN_BACK_L)] }, DARK),
    ...collarZones(),
    ...cuffZones(),
    ...hemZones(),
    zone('shorts-side-r', 'Panel samping celana kanan', 'leftShorts', 'shorts', { rects: [SHORTS_SIDE_R] }, DARK),
    zone('shorts-side-l', 'Panel samping celana kiri', 'rightShorts', 'shorts', { rects: [SHORTS_SIDE_L] }, DARK),
    ...sockTopZones(),
  ],
};

const YOKE: KitTemplate = {
  id: 'yoke',
  name: 'Panel bahu (yoke)',
  description: 'Panel di atas bahu depan dan belakang, panel lengan atas, kerah, manset, dan lis.',
  source: 'builtin',
  zones: [
    zone('shoulder-front', 'Panel bahu depan', 'front', 'shirt', { rects: SHOULDER_FRONT }, MID),
    zone('shoulder-back', 'Panel bahu belakang', 'back', 'shirt', { rects: SHOULDER_BACK }, MID),
    zone('sleeve-top-r', 'Panel atas lengan kanan', 'leftSleeve', 'shirt', { rects: [[262, 446, 118, 80]] }, MID),
    zone('sleeve-top-l', 'Panel atas lengan kiri', 'rightSleeve', 'shirt', { rects: [[645, 446, 117, 80]] }, MID),
    zone('sleeve-top-long-r', 'Panel atas lengan panjang kanan', 'leftSleeve', 'shirt', { rects: [[40, 161, 305, 80]] }, MID),
    zone('sleeve-top-long-l', 'Panel atas lengan panjang kiri', 'rightSleeve', 'shirt', { rects: [[680, 161, 304, 80]] }, MID),
    ...collarZones(),
    ...cuffZones(),
    ...hemZones(),
    ...shortsHemZones(),
    ...sockTopZones(),
  ],
};

// Three parallel bands: horizontal ones for sleeves / socks, along the leg for shorts
const bandsH = (x: number, w: number, y0: number): Rect[] => [
  [x, y0, w, 13],
  [x, y0 + 24, w, 13],
  [x, y0 + 48, w, 13],
];

const THREE_STRIPES: KitTemplate = {
  id: 'three-stripes',
  name: 'Tiga garis (bahu, celana, kaus kaki)',
  description: 'Tiga garis sejajar di atas bahu dan lengan, sisi celana, dan kaus kaki, plus kerah dan lis.',
  source: 'builtin',
  zones: [
    // the top of the arm is at y ~ 480: bands at y 454 / 478 / 502
    zone('sleeve-stripes-r', 'Garis bahu kanan', 'leftSleeve', 'shirt', { rects: bandsH(262, 118, 454) }, LIGHT),
    zone('sleeve-stripes-l', 'Garis bahu kiri', 'rightSleeve', 'shirt', { rects: bandsH(645, 117, 454) }, LIGHT),
    // long sleeves: bands along the middle of the arm
    zone('sleeve-stripes-long-r', 'Garis lengan panjang kanan', 'leftSleeve', 'shirt', { rects: bandsH(40, 305, 172) }, LIGHT),
    zone('sleeve-stripes-long-l', 'Garis lengan panjang kiri', 'rightSleeve', 'shirt', { rects: bandsH(680, 304, 172) }, LIGHT),
    ...collarZones(),
    ...hemZones(),
    // outer side of the leg is at y ~ 780: bands at y 752 / 776 / 800 along the leg
    zone('shorts-stripes-r', 'Garis celana kanan', 'leftShorts', 'shorts', { rects: bandsH(100, 200, 752) }, LIGHT),
    zone('shorts-stripes-l', 'Garis celana kiri', 'rightShorts', 'shorts', { rects: bandsH(724, 200, 752) }, LIGHT),
    zone('sock-stripes-r', 'Garis kaus kaki kanan', 'leftSock', 'socks', { rects: bandsH(0, 222, 340) }, LIGHT),
    zone('sock-stripes-l', 'Garis kaus kaki kiri', 'rightSock', 'socks', { rects: bandsH(805, 219, 340) }, LIGHT),
  ],
};

const SIDE_PANELS: KitTemplate = {
  id: 'side-panels',
  name: 'Panel samping lebar',
  description: 'Panel samping lebar di baju dan celana, panel punggung atas, kerah, manset, dan lis.',
  source: 'builtin',
  zones: [
    zone('side-front', 'Panel samping baju (depan)', 'front', 'shirt', { rects: [[345, 540, 80, 398], [599, 540, 81, 398]] }, MID),
    zone('side-back', 'Panel samping baju (belakang)', 'back', 'shirt', { rects: [[345, 0, 80, 452], [599, 0, 81, 452]] }, MID),
    zone('back-yoke', 'Panel punggung atas', 'back', 'shirt', { rects: [[345, 372, 335, 80]] }, DARK),
    ...collarZones(),
    ...cuffZones(),
    ...hemZones(),
    zone('shorts-side-r', 'Panel samping celana kanan', 'leftShorts', 'shorts', { rects: [[81, 660, 240, 240]] }, MID),
    zone('shorts-side-l', 'Panel samping celana kiri', 'rightShorts', 'shorts', { rects: [[704, 660, 240, 240]] }, MID),
    ...sockTopZones(),
  ],
};

export const BUILTIN_TEMPLATES: KitTemplate[] = [
  BLANK,
  CLASSIC,
  POLO,
  RAGLAN,
  YOKE,
  THREE_STRIPES,
  SIDE_PANELS,
];

export const DEFAULT_TEMPLATE_ID = 'blank';

export function findTemplate(id: string, libraryTemplates: KitTemplate[] = []): KitTemplate {
  return (
    libraryTemplates.find((t) => t.id === id) ??
    BUILTIN_TEMPLATES.find((t) => t.id === id) ??
    BLANK
  );
}

/** Fresh zone colours/visibility for a template. */
export function buildTemplateState(template: KitTemplate, seams: SeamConfig = DEFAULT_SEAMS): TemplateState {
  const zones: TemplateState['zones'] = {};
  template.zones.forEach((z) => {
    zones[z.id] = { color: z.defaultColor, visible: z.defaultVisible, ...(z.initial ?? {}) };
  });
  return { templateId: template.id, zones, seams: { ...seams } };
}

export const DEFAULT_TEMPLATE_STATE: TemplateState = buildTemplateState(BLANK);
