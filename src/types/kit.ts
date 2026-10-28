export type KitPartId =
  | 'front'
  | 'back'
  | 'leftSleeve'
  | 'rightSleeve'
  | 'leftShorts'
  | 'rightShorts'
  | 'leftSock'
  | 'rightSock'
  | 'collar'
  | 'armband'
  | 'credit';

export type KitCategory = 'shirt' | 'shorts' | 'socks' | 'details';

export type PatternType =
  | 'none'
  | 'vertical-stripes'
  | 'horizontal-stripes'
  | 'diagonal-stripes'
  | 'sash'
  | 'hoops'
  | 'pinstripes'
  | 'chevron'
  | 'cross'
  | 'halves'
  | 'checkered'
  | 'gradient'
  | 'polka-dots'
  | 'subtle-waves'
  | 'custom-image'; // tiled image from the library/patterns folder

export type FabricTextureType =
  | 'none'
  | 'jersey-dimple'
  | 'jersey-eyelet'
  | 'jersey-knit'
  | 'micro-mesh'
  | 'knit-honeycomb'
  | 'diagonal-twill'
  | 'ribbed'
  | 'custom-image'; // tile image from library/textures (FabricLayer.image)

/** One fabric texture layer: a weave drawn over the chosen parts. */
export interface FabricLayer {
  id: string;
  type: FabricTextureType;
  opacity: number;
  /** Size of the weave / holes (1 = normal). */
  scale: number;
  visible: boolean;
  parts: KitPartId[];
  /** Library tile (URL) used when type is 'custom-image'. */
  image?: string;
  /** Display name of the library tile. */
  name?: string;
}

export interface FabricConfig {
  layers: FabricLayer[];
}

/** The settings that describe one pattern (a part's own legacy pattern or a pattern layer). */
export type PatternSettings = Pick<
  KitPartConfig,
  | 'pattern'
  | 'patternColor'
  | 'patternScale'
  | 'patternOpacity'
  | 'patternThickness'
  | 'patternRotation'
  | 'patternRepeat'
  | 'patternOffsetX'
  | 'patternOffsetY'
  | 'patternImage'
  | 'patternTint'
  | 'patternMirrorX'
  | 'patternMirrorY'
  | 'patternSymmetryX'
  | 'patternSymmetryY'
>;

/** A pattern drawn over the base colour of the chosen parts. */
export interface PatternLayer extends PatternSettings {
  id: string;
  name?: string;
  visible: boolean;
  parts: KitPartId[];
  /** Draw the pattern turned 180 degrees on the (upside-down) back panel so it matches the front when worn. */
  backFlip?: boolean;
}

export interface KitPartConfig {
  color: string;
  pattern: PatternType;
  patternColor: string;
  patternScale: number;
  patternOpacity: number;
  /** Stripe/band thickness as a share of the pattern period (0.05..0.95, default 0.5). */
  patternThickness?: number;
  /** Pattern shift in texture pixels. */
  /** Rotation of the pattern around the centre of the part, in degrees (clockwise). */
  patternRotation?: number;
  /** false = draw the pattern only once (centred) instead of repeating it; undefined = repeat. */
  patternRepeat?: boolean;
  patternOffsetX?: number;
  patternOffsetY?: number;
  /** Flip the pattern left<->right / top<->bottom around the part centre. */
  /** custom-image: URL of the tile image (from library/patterns). */
  patternImage?: string;
  /** custom-image: colour the tile with the pattern colour (undefined = auto-detect). */
  patternTint?: boolean;
  patternMirrorX?: boolean;
  patternMirrorY?: boolean;
  /** Symmetry: the left (top) half is drawn normally and reflected onto the right (bottom) half. */
  patternSymmetryX?: boolean;
  patternSymmetryY?: boolean;
  visible: boolean;
  /** Credit box: the text written in it. */
  label?: string;
  labelColor?: string;
  labelFont?: string;
  /** With an imported design as the base: also paint this part's colour over the design. */
  overDesign?: boolean;
  /** Opacity (0..1) of the colour painted over the imported design. */
  overDesignOpacity?: number;
  cuffStripeEnabled?: boolean;
  /** false = the stripe stays defined but is hidden (eye in the layer list); undefined = shown. */
  cuffStripeVisible?: boolean;
  cuffStripeColor?: string;
  cuffStripeWidth?: number;
}

/** Recolour an image logo with one colour or a gradient (alpha of the logo is kept). */
export interface LogoFill {
  mode: 'original' | 'solid' | 'gradient';
  color: string;
  color2: string;
  /** Gradient direction in degrees (0 = left to right, 90 = top to bottom). */
  angle: number;
}

/** Outline (stroke) around an image logo: inside the edge, centred on it, or outside. */
export interface LogoOutline {
  enabled: boolean;
  color: string;
  width: number;
  position: 'inside' | 'center' | 'outside';
}

export interface KitGraphicItem {
  id: string;
  name: string;
  partId: KitPartId;
  type: 'image' | 'text';
  category?: 'sponsor' | 'crest' | 'brand' | 'badge' | 'custom';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX?: number;
  scaleY?: number;
  opacity: number;
  src?: string; // base64 or URL for image
  color?: string; // color or tint
  locked?: boolean; // lock item position
  /** Keep width : height when resizing (default on for images). Off = stretch width or height alone. */
  lockRatio?: boolean;
  fill?: LogoFill;
  outline?: LogoOutline;
  text?: string;
  textColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  visible?: boolean;
}

export interface PlayerMarkingsConfig {
  showPreview: boolean;
  includeInExport: boolean;
  playerName: string;
  playerNumber: string;
  shortsNumber: string;
  fontFamily: string;
  numberColor: string;
  numberStrokeColor: string;
  numberStrokeWidth: number;
  nameColor: string;
  nameSize: number;
  numberSize: number;
  shortsNumberSize: number;
  nameY: number;
  numberY: number;
  shortsNumberX: number;
  shortsNumberY: number;
}

/** A point in 1024x1024 texture space. */
export type Pt = [number, number];

/**
 * One independently colourable area of a template (collar trim, side panel, sleeve cuff ...).
 * Described by rectangles [x, y, w, h] and/or polygons (even-odd fill, so a polygon inside another
 * one punches a hole) and/or a mask PNG. Always clipped to the regions of `part`.
 */
export interface KitZoneDef {
  id: string;
  name: string;
  /** Main part (used for grouping in the layer list). */
  part: KitPartId;
  /** Extra parts the zone is also drawn on (the same shape, clipped to each part). */
  parts?: KitPartId[];
  group: KitCategory;
  rects?: [number, number, number, number][];
  polygons?: Pt[][];
  /** Ellipses as bounding boxes [x, y, w, h]. */
  ellipses?: [number, number, number, number][];
  /** Optional mask image (white / opaque = zone) covering the full texture; tinted with the colour. */
  mask?: string;
  /** Bounding box [x, y, w, h] of the visible pixels of the mask (used for move / scale / rotate). */
  maskBox?: [number, number, number, number];
  /** Mask zones: use the image's own colours instead of tinting it with the zone colour. */
  keepColor?: boolean;
  /** Starting position / size / rotation / opacity (e.g. imported from a PSD). */
  initial?: Partial<Pick<TemplateZoneState, 'dx' | 'dy' | 'sx' | 'sy' | 'rot' | 'opacity'>>;
  defaultColor: string;
  defaultVisible: boolean;
}

/** Extra seam (stitch) line on top of the automatic seams that follow every piece outline. */
export interface KitSeamDef {
  /** Stable id (lines drawn by the user); older templates have none and are addressed by index. */
  id?: string;
  name?: string;
  part: KitPartId;
  points: Pt[];
  closed?: boolean;
  /** Draw a smooth curve through the points instead of straight segments. */
  smooth?: boolean;
}

export interface KitTemplate {
  id: string;
  name: string;
  description?: string;
  source?: 'builtin' | 'library';
  /** True once the user added, deleted or re-assigned zones (so it is no longer refreshed from code). */
  modified?: boolean;
  zones: KitZoneDef[];
  seams?: KitSeamDef[];
}

/** How the ends / corners of a zone are shaped. */
export type ZoneEdge = 'sharp' | 'rounded' | 'pointed' | 'slant';

export interface TemplateZoneState {
  color: string;
  visible: boolean;
  /** Move, in texture pixels. */
  dx?: number;
  dy?: number;
  /** Scale around the zone centre (1 = original size). */
  sx?: number;
  sy?: number;
  /** Rotation in degrees around the zone centre. */
  rot?: number;
  /** Shape of the ends: sharp (square), rounded ("tumpul"), pointed ("runcing") or slanted. */
  edge?: ZoneEdge;
  /** 0..1 strength of the edge shaping. */
  edgeAmount?: number;
  /** Stitch line along the outline of this zone (default on). */
  seam?: boolean;
  /** 0..1 fill opacity (default 1). */
  opacity?: number;
  /** 0..1 smoothing of polygon outlines (drawn shapes become curves). */
  smooth?: number;
}

export interface SeamConfig {
  enabled: boolean;
  /** natural = soft seam + fine top-stitch, soft = soft seam only, stitch / double = visible stitching ('flat' is the old name of soft). */
  style: 'natural' | 'soft' | 'stitch' | 'double' | 'flat';
  opacity: number; // 0..1
  width: number; // px in texture space
  /** Fixed stitch colour. Omitted = automatic (light on dark fabric, dark on light fabric). */
  color?: string;
  /** Also stitch along the outline of every piece. Off = clean canvas, only the lines the user drew. */
  outline?: boolean;
}

/** Which template is active and the colour / visibility of each of its zones. */
export interface TemplateState {
  templateId: string;
  zones: Record<string, TemplateZoneState>;
  seams: SeamConfig;
  /** Pattern layers drawn over the base colour of their parts (first = bottom). */
  patterns?: PatternLayer[];
  /** Colour of the empty space around the parts (undefined = the default dark background). */
  background?: string;
  /** Sleeve shape: with the shoulder yoke (default) or the shorter shape that stops at the armhole. */
  sleeveShape?: 'yoke' | 'short';
}

/** Active template definition + its zone state, passed to the renderers. */
export interface TemplateBundle {
  def: KitTemplate;
  state: TemplateState;
}

/** Settings of the pattern eraser brush (2D editor tool). */
export interface PatternBrushState {
  active: boolean;
  size: number; // px in texture space
  mode: 'erase' | 'restore';
}

/** An imported finished design (kit texture) shown on the canvas. */
export interface BaseTexture {
  src: string; // data URL (PNG/JPG/WebP)
  name: string;
  /** replace: only the imported image is drawn; overlay: drawn over the parts at `opacity`. */
  mode: 'replace' | 'overlay';
  opacity: number; // 0..1, used for overlay mode
  /** false = the design is kept but not used (the base is the part colours); undefined = used. */
  enabled?: boolean;
}

export interface KitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KitPartDefinition {
  id: KitPartId;
  name: string;
  indoName: string;
  category: KitCategory;
  /** Main piece, used for pattern geometry and focus/zoom. */
  bounds: KitRect;
  /** All rectangles belonging to the part (painted + clipped together). */
  regions: KitRect[];
  /** Real piece shapes (polygons in texture space). Used instead of `regions` for clipping and seams when set. */
  outline?: Pt[][];
  clipPathSvg: string;
  innerGuides?: string[];
  badgeAnchor: { x: number; y: number };
  description: string;
}

export interface CanvasViewState {
  zoom: number;
  panX: number;
  panY: number;
  activePartId: KitPartId | 'all';
  /** Part the 2D view is zoomed to (set by the part shortcuts); selecting a part by clicking does not move the view. */
  focusPartId?: KitPartId;
  showWireframe: boolean;
  showPartLabels: boolean;
  showOriginalTemplate: boolean;
  templateOpacity: number;
  wireframeOpacity: number;
  wireframeColor: string;
}
