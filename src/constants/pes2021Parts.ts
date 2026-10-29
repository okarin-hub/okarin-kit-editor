import { KitPartDefinition, KitPartId, KitRect, Pt } from '../types/kit';

export const CANVAS_TEXTURE_SIZE = 1024;

/**
 * Layout follows the official PES 2021 kit template (1024x1024).
 *
 * Orientation notes (important when painting by hand):
 *  - The BACK of the shirt is stored UPSIDE-DOWN: the hem is at the top of the texture
 *    (y = 0) and the neck opening is at y = BACK_NECK_Y. Name/number are drawn rotated 180°.
 *  - Part ids `left*` refer to the LEFT side of the texture image. In the PES template that is
 *    the player's RIGHT side, so the display names are swapped ("leftSleeve" = "Right Sleeve").
 *
 * Each part is made of one or more `regions` (all painted with the part colour); `bounds` is the
 * main piece used for pattern geometry.
 */

/** Y of the shirt-back neckline in texture space (back panel spans y = 0..BACK_NECK_Y). */
export const BACK_NECK_Y = 452;
/** Centre of the shirt back panel on the x axis. */
export const BACK_CENTER_X = 512;

const rectPath = (r: KitRect) =>
  `M ${r.x} ${r.y} L ${r.x + r.width} ${r.y} L ${r.x + r.width} ${r.y + r.height} L ${r.x} ${r.y + r.height} Z`;

const unionPath = (regions: KitRect[]) => regions.map(rectPath).join(' ');
const polyPath = (poly: Pt[]) => poly.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ') + ' Z';

const R = (x: number, y: number, width: number, height: number): KitRect => ({ x, y, width, height });

type PartSeed = Omit<KitPartDefinition, 'clipPathSvg'>;

const SEEDS: PartSeed[] = [
  {
    id: 'front',
    name: 'Shirt Front',
    indoName: 'Depan Baju (Dada & Perut)',
    category: 'shirt',
    // main panel (incl. neck binding) + the two front side panels
    regions: [R(380, 452, 264, 486), R(345, 590, 35, 348), R(644, 590, 36, 348)],
    outline: [
      [[504.5, 500], [538, 500.5], [574, 503.5], [589, 506.5], [605.5, 514], [611.5, 518.5], [624, 531.5], [637.5, 553], [638.5, 575], [642.5, 590.5], [651, 607], [666, 611], [677.5, 611], [677.5, 933.5], [348, 933.5], [348, 611], [359, 611], [373.5, 607], [382.5, 589], [385.5, 577], [386, 554], [400, 531.5], [412.5, 518.5], [418.5, 514], [429, 508.5], [450, 503.5]],
      [[466.5, 452], [557.5, 452.5], [543, 463.5], [533.5, 474.5], [490.5, 474.5], [481, 463.5]],
    ],
    bounds: R(345, 452, 335, 486),
    innerGuides: ['M 512 540 L 512 938'],
    badgeAnchor: { x: 512, y: 650 },
    description: 'Bagian depan jersey (panel utama + panel samping depan): logo sponsor dada, badge klub, dan logo apparel.',
  },
  {
    id: 'back',
    name: 'Shirt Back',
    indoName: 'Belakang Baju (Punggung) — posisi terbalik',
    category: 'shirt',
    // main panel + the two back side panels. NOTE: stored upside-down (hem at y = 0).
    regions: [R(380, 0, 264, BACK_NECK_Y), R(345, 0, 39, 376), R(640, 0, 40, 376)],
    outline: [
      [[348, 19], [677.5, 19], [677.5, 341], [649.5, 342.5], [643, 393], [637, 401.5], [625.5, 413.5], [610, 425], [590.5, 434.5], [574.5, 439], [557.5, 452.5], [466.5, 452.5], [449.5, 439], [428.5, 432.5], [406.5, 420], [390, 405], [381.5, 394], [375, 342.5], [348, 341.5]],
    ],
    bounds: R(345, 0, 335, BACK_NECK_Y),
    innerGuides: [`M 512 0 L 512 ${BACK_NECK_Y}`],
    badgeAnchor: { x: 512, y: 226 },
    description: 'Belakang jersey. Di template PES bagian ini disimpan terbalik: ujung bawah baju di atas (y=0), leher di tengah.',
  },
  {
    id: 'leftSleeve',
    name: 'Right Sleeve',
    indoName: 'Lengan Kanan Pemain (sisi kiri gambar)',
    category: 'shirt',
    // short sleeve + the shoulder yoke that runs up to the neck (painted in the sleeve colour in the PES template) + long sleeve area
    regions: [R(222, 333, 158, 272), R(0, 68, 345, 247)],
    outline: [
      [[346, 341], [375, 342.5], [381.5, 394], [390, 405], [402, 416.5], [416.5, 426.5], [433.5, 434.5], [449.5, 439], [477, 460], [490.5, 474.5], [512, 474.5], [512, 500], [476.5, 501], [444, 504.5], [429, 508.5], [415, 516.5], [400, 531.5], [386, 554], [385.5, 577], [382.5, 589], [373, 607.5], [359, 611], [346, 611], [338, 602], [239, 591.5], [239, 361], [338, 350]],
      [[316.5, 67], [308.5, 75.5], [305.5, 76], [3.5, 111], [3.5, 280.5], [306.5, 315.5], [309, 316], [316.5, 324], [332, 321], [341, 303.5], [346, 279], [346, 219], [342, 129.5], [339.5, 104], [333.5, 69]],
    ],
    bounds: R(222, 333, 158, 272),
    innerGuides: ['M 222 471 L 380 471'],
    badgeAnchor: { x: 301, y: 471 },
    description: 'Lengan pendek kanan pemain (sisi kiri template) beserta area lengan panjang.',
  },
  {
    id: 'rightSleeve',
    name: 'Left Sleeve',
    indoName: 'Lengan Kiri Pemain (sisi kanan gambar)',
    category: 'shirt',
    regions: [R(645, 333, 157, 272), R(680, 68, 344, 247)],
    outline: [
      [[666, 341], [679, 341], [686.5, 350], [785.5, 361], [785.5, 591.5], [686.5, 602], [679, 611], [666, 611], [651.5, 607.5], [642, 589], [638.5, 575], [637.5, 553], [624, 531.5], [609, 516.5], [595, 508.5], [580, 504.5], [547.5, 501], [512, 500], [512, 474.5], [533.5, 474.5], [547, 460], [574.5, 439], [590.5, 434.5], [607.5, 426.5], [622, 416.5], [634, 405], [643, 393], [649.5, 342.5]],
      [[704.5, 67], [691, 68.5], [690, 70.5], [683.5, 112], [681, 148], [678, 219], [678, 279], [681.5, 299], [692, 321], [707.5, 324], [715, 316], [717.5, 315.5], [1020.5, 280.5], [1020.5, 111], [718.5, 76], [715.5, 75.5], [707.5, 67]],
    ],
    bounds: R(645, 333, 157, 272),
    innerGuides: ['M 645 471 L 802 471'],
    badgeAnchor: { x: 723, y: 471 },
    description: 'Lengan pendek kiri pemain (sisi kanan template) beserta area lengan panjang.',
  },
  {
    id: 'leftShorts',
    name: 'Right Shorts',
    indoName: 'Celana Kanan Pemain (sisi kiri gambar)',
    category: 'shorts',
    // two rectangles so the piece never overlaps the sleeve bottom or the collar strip
    regions: [R(0, 583, 222, 393), R(222, 605, 114, 371)],
    outline: [
      [[0, 573], [0, 982], [340.5, 982], [340.5, 604], [155.5, 603.5], [146, 588.5], [145.5, 573]],
    ],
    bounds: R(0, 583, 336, 393),
    innerGuides: ['M 0 773 L 345 773'],
    badgeAnchor: { x: 172, y: 780 },
    description: 'Celana kanan pemain (sisi kiri template). Nomor celana PES berada di sisi ini.',
  },
  {
    id: 'rightShorts',
    name: 'Left Shorts',
    indoName: 'Celana Kiri Pemain (sisi kanan gambar)',
    category: 'shorts',
    regions: [R(802, 583, 222, 393), R(688, 605, 114, 371)],
    outline: [
      [[879, 573], [878, 588.5], [868.5, 603.5], [684, 604], [684, 982], [1024, 982], [1024, 573]],
    ],
    bounds: R(688, 583, 336, 393),
    innerGuides: ['M 680 773 L 1024 773'],
    badgeAnchor: { x: 852, y: 780 },
    description: 'Celana kiri pemain (sisi kanan template): biasanya logo apparel.',
  },
  {
    id: 'leftSock',
    name: 'Right Sock',
    indoName: 'Kaus Kaki Kanan Pemain (sisi kiri gambar)',
    category: 'socks',
    regions: [R(0, 320, 222, 258)],
    outline: [
      [[0, 310], [0, 584.5], [195, 584.5], [195, 310]],
    ],
    bounds: R(0, 320, 222, 258),
    innerGuides: ['M 0 370 L 222 370'],
    badgeAnchor: { x: 111, y: 450 },
    description: 'Kaus kaki kanan pemain (sisi kiri template).',
  },
  {
    id: 'rightSock',
    name: 'Left Sock',
    indoName: 'Kaus Kaki Kiri Pemain (sisi kanan gambar)',
    category: 'socks',
    regions: [R(805, 320, 219, 258)],
    outline: [
      [[829, 310], [829.5, 584.5], [1024, 584.5], [1024, 310]],
    ],
    bounds: R(805, 320, 219, 258),
    innerGuides: ['M 805 370 L 1024 370'],
    badgeAnchor: { x: 914, y: 450 },
    description: 'Kaus kaki kiri pemain (sisi kanan template).',
  },
  {
    id: 'collar',
    name: 'Collar Strip',
    indoName: 'Pita Kerah (Collar)',
    category: 'details',
    regions: [R(336, 938, 352, 42)],
    bounds: R(336, 938, 352, 42),
    badgeAnchor: { x: 512, y: 959 },
    description: 'Pita tekstur kerah yang melingkari leher model 3D PES 2021.',
  },
  {
    id: 'credit',
    name: 'Credit',
    indoName: 'Kotak Kredit (nama pembuat)',
    category: 'details',
    regions: [R(768, 0, 256, 62)],
    bounds: R(768, 0, 256, 62),
    badgeAnchor: { x: 896, y: 31 },
    description: 'Kotak kredit di pojok kanan atas texture (nama pembuat). Tidak dipakai model 3D, hanya tampil di texture dan hasil export.',
  },
  {
    id: 'armband',
    name: 'Captain Armband',
    indoName: 'Ban Kapten (Armband)',
    category: 'details',
    regions: [R(0, 0, 256, 62)],
    bounds: R(0, 0, 256, 62),
    badgeAnchor: { x: 128, y: 31 },
    description: 'Ban lengan kapten di pojok kiri atas template PES 2021.',
  },
];

export const PES_2021_PARTS: KitPartDefinition[] = SEEDS.map((p) => ({
  ...p,
  clipPathSvg: p.outline ? p.outline.map(polyPath).join(' ') : unionPath(p.regions),
}));

/**
 * Paint order: shorts/socks first so the sleeve panels (which overlap the shorts' top
 * edge) always render on top of them.
 */
const RENDER_ORDER: KitPartId[] = [
  'leftShorts', 'rightShorts', 'leftSock', 'rightSock',
  'front', 'back', 'leftSleeve', 'rightSleeve', 'collar', 'armband', 'credit',
];

export const PES_2021_PARTS_RENDER_ORDER: KitPartDefinition[] = RENDER_ORDER.map(
  (id) => PES_2021_PARTS.find((p) => p.id === id)!
);

/** Colour of the texture space outside every part, unless the user picks another one. */
export const DEFAULT_BACKGROUND_COLOR = '#111318';

export const PART_MAP: Record<KitPartId, KitPartDefinition> = PES_2021_PARTS.reduce(
  (acc, part) => {
    acc[part.id] = part;
    return acc;
  },
  {} as Record<KitPartId, KitPartDefinition>
);


/** How far the sleeves reach: with the shoulder yoke (PES template art), or the shorter shape that stops at the armhole. */
export type SleeveShape = 'yoke' | 'short';

const SHORT_SLEEVE_OUTLINES: Partial<Record<KitPartId, Pt[][]>> = {
  front: [
    [[374, 452], [650, 452], [648, 492], [649, 565], [653, 581], [661, 597], [677, 600], [677, 933], [348, 933], [348, 600], [363, 597], [371, 581], [374, 568], [376, 542]],
  ],
  back: [
    [[348, 19], [677, 19], [677, 352], [660, 352], [659, 368], [654, 395], [650, 452], [374, 452], [371, 403], [364, 352], [348, 352]],
  ],
  leftSleeve: [
    [[346, 341], [338, 349.5], [239, 361], [239, 591], [338, 602], [346, 610.5], [358.5, 610.5], [372.5, 607], [381.5, 589.5], [385, 576], [386.5, 482.5], [382, 400], [375, 344.5], [374.5, 342.5]],
    [[316.5, 67], [308.5, 75.5], [305.5, 76], [3.5, 111], [3.5, 280.5], [306.5, 315.5], [309, 316], [316.5, 324], [332, 321], [341, 303.5], [346, 279], [346, 219], [342, 129.5], [339.5, 104], [333.5, 69]],
  ],
  rightSleeve: [
    [[666, 341], [649.5, 342.5], [642, 399.5], [637.5, 482], [637.5, 559.5], [638.5, 573.5], [642.5, 590], [651.5, 607], [666, 610.5], [678.5, 610.5], [686, 602], [785, 591], [785, 361], [686, 349.5], [678.5, 341]],
    [[704.5, 67], [691, 68.5], [690, 70.5], [683.5, 112], [681, 148], [678, 219], [678, 279], [681.5, 299], [692, 321], [707.5, 324], [715, 316], [717.5, 315.5], [1020.5, 280.5], [1020.5, 111], [718.5, 76], [715.5, 75.5], [707.5, 67]],
  ],
};

const shapeCache = new Map<SleeveShape, { all: KitPartDefinition[]; renderOrder: KitPartDefinition[]; map: Record<KitPartId, KitPartDefinition> }>();

/** The parts with the chosen sleeve shape (the default shape is the one in PES_2021_PARTS). */
export function partsForSleeveShape(shape: SleeveShape | undefined) {
  const key: SleeveShape = shape === 'short' ? 'short' : 'yoke';
  let hit = shapeCache.get(key);
  if (!hit) {
    const all =
      key === 'yoke'
        ? PES_2021_PARTS
        : PES_2021_PARTS.map((p) => {
            const outline = SHORT_SLEEVE_OUTLINES[p.id];
            return outline ? { ...p, outline, clipPathSvg: outline.map(polyPath).join(' ') } : p;
          });
    hit = {
      all,
      renderOrder: RENDER_ORDER.map((id) => all.find((p) => p.id === id)!),
      map: Object.fromEntries(all.map((p) => [p.id, p])) as Record<KitPartId, KitPartDefinition>,
    };
    shapeCache.set(key, hit);
  }
  return hit;
}

/**
 * Cuff / hem / collar accent rectangles for a part, in texture space.
 * Sleeve cuffs sit on the OUTER vertical edge of the sleeve pieces (not at the bottom).
 */
export function getAccentRects(partId: KitPartId, stripeW: number): KitRect[] {
  const b = PART_MAP[partId].bounds;
  switch (partId) {
    case 'leftSleeve':
      return [R(222, 333, 20 + stripeW, 272), R(0, 68, stripeW, 247)];
    case 'rightSleeve':
      return [R(782 - stripeW, 333, 20 + stripeW, 272), R(1024 - stripeW, 68, stripeW, 247)];
    // The shorts are stored turned sideways: top-to-bottom runs left-to-right on the player's left
    // shorts (right of the image) and right-to-left on the right shorts, so the hem is a vertical strip.
    case 'leftShorts':
      return [R(0, 573, stripeW, 409)];
    case 'rightShorts':
      return [R(1024 - stripeW, 573, stripeW, 409)];
    case 'leftSock':
    case 'rightSock':
      return [R(b.x, b.y, b.width, stripeW)];
    case 'collar':
      return [R(b.x, b.y + 16, b.width, 10)];
    default:
      return [];
  }
}

/** Which part a pattern can be copied to, and how the copy is oriented. */
export const PART_COUNTERPART: Partial<
  Record<KitPartId, { id: KitPartId; mode: 'rotate180' | 'mirrorX'; label: string }>
> = {
  front: { id: 'back', mode: 'rotate180', label: 'Belakang' },
  back: { id: 'front', mode: 'rotate180', label: 'Depan' },
  leftSleeve: { id: 'rightSleeve', mode: 'mirrorX', label: 'Lengan Kiri' },
  rightSleeve: { id: 'leftSleeve', mode: 'mirrorX', label: 'Lengan Kanan' },
  leftShorts: { id: 'rightShorts', mode: 'mirrorX', label: 'Celana Kiri' },
  rightShorts: { id: 'leftShorts', mode: 'mirrorX', label: 'Celana Kanan' },
  leftSock: { id: 'rightSock', mode: 'mirrorX', label: 'Kaus Kaki Kiri' },
  rightSock: { id: 'leftSock', mode: 'mirrorX', label: 'Kaus Kaki Kanan' },
};

/** True when (x, y) falls inside any region of the part. */
export function isInsidePart(partId: KitPartId, x: number, y: number): boolean {
  return PART_MAP[partId].regions.some(
    (r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height
  );
}

/**
 * Shorts number on the texture-left leg (the player's right). The leg runs along the texture x axis with the
 * hem at x 0, so the number is rotated 90° to read upright, and sits where the leg faces the front below the
 * shirt hem (same spot as the logo anchor, measured on the 3D model's UV).
 */
export const SHORTS_NUMBER_POS = { x: 75, y: 875 };

/** Old projects stored the shorts number at the first guess (120, 760), which ends up under the shirt hem. */
export function migrateMarkings<T extends { shortsNumberX: number; shortsNumberY: number }>(m: T): T {
  if (m && m.shortsNumberX === 120 && m.shortsNumberY === 760) {
    return { ...m, shortsNumberX: SHORTS_NUMBER_POS.x, shortsNumberY: SHORTS_NUMBER_POS.y };
  }
  return m;
}
