/**
 * Player name / numbers drawn on the kit texture from the kitserver config values (NameY, BackNumberSize,
 * ChestNumberX ...), so the preview sits where PES puts them. One drawing for the 2D canvas, the 3D preview
 * and the export.
 */
import { PlayerMarkingsConfig } from '@/types/kit';
import { BACK_NECK_Y, BACK_CENTER_X, PART_MAP } from '@/constants/pes2021Parts';
import { FontsetLayout, NUMBER_LAYOUT, BACK_NUMBER_LAYOUT, NAME_LAYOUT, NAME_EX_LAYOUT } from '@/constants/fontsetSlots';
import { getCachedImage, preloadImage } from '@/utils/imageCache';

/** Markings plus the parsed config.txt values that place them. */
export type FontsetKind = 'back' | 'chest' | 'leg' | 'name' | 'name_ex';

export type MarkingsView = PlayerMarkingsConfig & {
  config?: Record<string, string>;
  /** PNG sheets of the chosen PES fontset (library/fonts/font_pes), by file kind */
  fontsetFiles?: Partial<Record<FontsetKind, string>>;
  /** true only for the editor's own views (2D canvas, 3D preview): sleeve badge markers never go into an export */
  preview?: boolean;
};

/**
 * Texture px per config step, measured from in-game Sider screenshots (screen px divided by an estimated
 * screen-to-texture scale: back 1.85 vertical / 1.6 horizontal, front 2.76 / 2.39).
 * shortcut: the scales are estimates from one sponsor logo and the shirt width; refine them with a grid texture.
 */
export const MARKINGS_CAL = {
  // back, distances measured down the shirt from the neckline. Read off a grid texture in game (FC Imabari GK:
  // NameY 14 size 8, BackNumberY 18 size 24; AC Milan: NameY 35 size 12, BackNumberY 14 size 25)
  nameCenterAtY15: 262,
  nameStepY: 9.8, // higher NameY = up
  nameHeightAtSize6: 30, // cap height; height grows like (size + 12)
  nameStretch: [1, 0.8, 1, 1.14], // NameStretch 0..3, width only (0 looks like 2 in game)
  // NameShape 0..3: straight, light / medium / extreme curve (end letters turn about 5 / 11 / 16 degrees in game)
  nameCurveRadius: [0, 380, 190, 130],
  numberTopAtY18: 79,
  numberStepY: 8.4, // higher BackNumberY = up
  numberHeightAtSize24: 150, // x1.04 per step, grows downward from its top (ink: 161 and 142, two fonts)
  numberSpacingStep: 3.1, // gap between digits per BackNumberSpacing step; the number stays centred
  // gaps between characters cut from a PES font sheet, as a share of their height (back number at spacing 8)
  numberGap: 0.155,
  nameGap: 0.08,
  // front, upright, neckline at (512, 500)
  chestCenterAtX14Y19: [507, 628], // grid shots: X14 Y19, X20 Y16, X10 Y12 (Indonesia, size 17)
  chestStepX: 7, // higher = the player's left (texture right)
  chestStepY: 8.5, // higher = up
  chestHeightAtSize17: 56, // x1.03 per step, grows around its centre
  // shorts: the right leg's piece (texture left), stored sideways with the hem at x 0
  // (front views of FC Imabari, shorts model 1; the leg's front half runs from the side seam at y 773 to the inner
  // thigh at y 976, and only x 0..148 shows below the shirt hem)
  shortsAtY8: 84, // centre's distance from the hem (grid shot: X14 Y8 size 16 at x 84, y 842)
  shortsStepY: 7.3, // higher = up, toward the waist
  // X6 = the front of the leg (y 875, half way between the seams), X16 = 45° toward the outer seam (user, in game);
  // a quarter turn is 102 px, so about 5.1 px per step, and X 30 / 31 land past the outer seam (invisible in game)
  shortsAtX16: 832, // grid shot: X14 at y 842
  shortsStepX: 5.1, // higher = toward the outer side seam, lower = toward the inner thigh
  shortsHeightAtSize16: 59, // x1.04 per step: about 40% of the leg's front width, as in the game
  // shorts model 0 (Indonesia grid shots) puts the number 14 px higher up the leg and 16 px nearer the inner thigh.
  // shortcut: only models 0 and 1 measured, the other 14 use the model 1 spot
  shortsModel0Shift: [14, 16],
  // sleeve badges: the arm runs along the texture x axis (cuff at low x), its front toward higher y. Mirrored for the
  // left sleeve. Grid shots of AC Milan's Serie A badge at X14 Y11 and X20 Y18, short and long sleeves.
  badgeShort: { at: [314, 513], stepX: 5.8, stepY: 4, size: [54, 48] },
  badgeLong: { at: [280, 190], stepX: 3.5, stepY: 4.6, size: [36, 48] },
  // stepX: higher X = toward the front of the shirt; stepY: higher Y = DOWN the arm, toward the cuff; size: across / along
};

const num = (cfg: Record<string, string> | undefined, key: string, def: number) => {
  const v = cfg?.[key];
  const n = v === undefined || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : def;
};

interface TextStyle {
  fill: string;
  stroke?: string;
  strokeWidth: number;
}

/** Writes one line whose capitals / digits are `h` tall, vertically centred on cy; x is its left edge. */
interface Writer {
  width: (text: string) => number;
  draw: (text: string, x: number, cy: number) => void;
}

/** A system / library font. `spacing` is added between characters. */
function fontWriter(ctx: CanvasRenderingContext2D, family: string, sample: string, h: number, s: TextStyle, spacing = 0): Writer {
  ctx.font = `bold 100px ${family}`;
  const m = ctx.measureText(sample);
  const ink = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const font = `bold ${ink > 0 ? (100 * h) / ink : h}px ${family}`;
  ctx.font = font;
  const k = ctx.measureText(sample);
  const shift = (k.actualBoundingBoxAscent - k.actualBoundingBoxDescent) / 2;
  const setup = () => {
    ctx.font = font;
    ctx.letterSpacing = `${spacing}px`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  };
  return {
    width: (text) => {
      setup();
      // letterSpacing also follows the last character
      const w = ctx.measureText(text).width - spacing;
      ctx.letterSpacing = '0px';
      return w;
    },
    draw: (text, x, cy) => {
      setup();
      ctx.lineJoin = 'round';
      if (s.stroke && s.strokeWidth > 0) {
        ctx.strokeStyle = s.stroke;
        ctx.lineWidth = s.strokeWidth * 2; // the outer half shows, the fill covers the rest
        ctx.strokeText(text, x, cy + shift);
      }
      ctx.fillStyle = s.fill;
      ctx.fillText(text, x, cy + shift);
      ctx.letterSpacing = '0px';
    },
  };
}

interface Sheet {
  url: string | undefined;
  layout: FontsetLayout;
}

/**
 * Characters cut from the PES font textures the generator saved (their slots are fixed, see fontsetSlots), so the
 * preview shows the generated font with its colours and effects. Null until every sheet image has loaded.
 * `gap` is the space between characters as a share of h; a character no sheet has is left as a space.
 */
function sheetWriter(sheets: Sheet[], ctx: CanvasRenderingContext2D, h: number, gap: number, extra = 0): Writer | null {
  const loaded: { img: HTMLImageElement; layout: FontsetLayout }[] = [];
  for (const sh of sheets) {
    if (!sh.url) continue;
    const img = getCachedImage(sh.url);
    if (!img) {
      preloadImage(sh.url); // the canvas redraws once it is in
      return null;
    }
    loaded.push({ img, layout: sh.layout });
  }
  if (!loaded.length) return null;
  const find = (ch: string) => {
    for (const s of loaded)
      for (let r = 0; r < s.layout.rows.length; r++) {
        const slot = s.layout.rows[r].find((x) => x.ch === ch);
        if (slot) return { ...s, slot, row: r };
      }
    return null;
  };
  const step = gap * h + extra;
  const advance = (ch: string) => {
    const g = find(ch);
    return g ? ((g.slot.x1 - g.slot.x0) * h) / (g.layout.baseline - g.layout.top) : 0.35 * h;
  };
  return {
    width: (text) => {
      const chars = Array.from(text);
      return chars.reduce((w, ch) => w + advance(ch), 0) + step * Math.max(0, chars.length - 1);
    },
    draw: (text, x, cy) => {
      let at = x;
      for (const ch of Array.from(text)) {
        const g = find(ch);
        if (g) {
          const k = h / (g.layout.baseline - g.layout.top);
          const sy = g.row * g.layout.rowHeight;
          const w = g.slot.x1 - g.slot.x0;
          ctx.drawImage(g.img, g.slot.x0, sy, w, g.layout.rowHeight, at, cy - h / 2 - g.layout.top * k, w * k, g.layout.rowHeight * k);
        }
        at += advance(ch) + step;
      }
    },
  };
}

const clipRect = (ctx: CanvasRenderingContext2D, r: { x: number; y: number; width: number; height: number }) => {
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.width, r.height);
  ctx.clip();
};

/** Draws name, back / chest / shorts number in 1024 texture space. */
/** A shield marker where the game puts a sleeve badge (preview only: the game draws the competition badge). */
function drawBadgeMarker(ctx: CanvasRenderingContext2D, cx: number, cy: number, rotation: number, label: string, size: number[]) {
  const [w, h] = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(w / 2, -h / 2);
  ctx.lineTo(w / 2, h * 0.15);
  ctx.quadraticCurveTo(w / 2, h * 0.4, 0, h / 2);
  ctx.quadraticCurveTo(-w / 2, h * 0.4, -w / 2, h * 0.15);
  ctx.closePath();
  ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#38bdf8';
  ctx.stroke();
  ctx.fillStyle = '#e0f2fe';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, -h * 0.08);
  ctx.restore();
}

/** Sleeve badge markers from the config (RightShortX ... LeftLongY). Only for the preview, never in an export. */
export function drawBadgeMarkers(ctx: CanvasRenderingContext2D, m: MarkingsView) {
  const cfg = m.config;
  const C = MARKINGS_CAL;
  for (const side of ['Right', 'Left'] as const) {
    for (const len of ['Short', 'Long'] as const) {
      const bx = num(cfg, `${side}${len}X`, 15);
      const by = num(cfg, `${side}${len}Y`, 15);
      const b = len === 'Long' ? C.badgeLong : C.badgeShort;
      const x = b.at[0] - (by - 11) * b.stepY;
      const y = b.at[1] + (bx - 14) * b.stepX;
      // the player's right sleeve is the texture-left piece; the left one is its mirror
      const right = side === 'Right';
      drawBadgeMarker(ctx, right ? x : 1024 - x, y, right ? Math.PI / 2 : -Math.PI / 2, `${right ? 'R' : 'L'} ${len === 'Short' ? 'S' : 'L'}`, b.size);
    }
  }
}

export function drawPlayerMarkings(ctx: CanvasRenderingContext2D, m: MarkingsView) {
  const cfg = m.config;
  const C = MARKINGS_CAL;
  const files = m.fontsetFiles ?? {};
  const numberStyle: TextStyle = { fill: m.numberColor, stroke: m.numberStrokeColor, strokeWidth: m.numberStrokeWidth };
  // a PES fontset sheet when there is one, the chosen font otherwise
  const numberWriter = (kind: 'back' | 'chest' | 'leg', h: number, extra = 0, style = numberStyle) =>
    sheetWriter([{ url: files[kind], layout: kind === 'back' ? BACK_NUMBER_LAYOUT : NUMBER_LAYOUT }], ctx, h, C.numberGap, extra) ??
    fontWriter(ctx, m.fontFamily, '0', h, style, extra);
  const centred = (w: Writer, text: string, cx: number, cy: number) => w.draw(text, cx - w.width(text) / 2, cy);

  // ---- back: stored upside down, so draw in a frame turned 180° about the neckline centre
  ctx.save();
  clipRect(ctx, PART_MAP.back.bounds);
  ctx.translate(BACK_CENTER_X, BACK_NECK_Y);
  ctx.rotate(Math.PI);

  const name = m.playerName.toUpperCase();
  if (name && num(cfg, 'Name', 0) === 0) {
    const cy = C.nameCenterAtY15 - (num(cfg, 'NameY', 15) - 15) * C.nameStepY;
    const h = (C.nameHeightAtSize6 * (num(cfg, 'NameSize', 6) + 12)) / 18;
    const sx = C.nameStretch[num(cfg, 'NameStretch', 2)] ?? 1;
    const w =
      sheetWriter([{ url: files.name, layout: NAME_LAYOUT }, { url: files.name_ex, layout: NAME_EX_LAYOUT }], ctx, h, C.nameGap) ??
      fontWriter(ctx, m.fontFamily, 'H', h, { fill: m.nameColor, strokeWidth: 0 });
    ctx.save();
    ctx.scale(sx, 1);
    const radius = C.nameCurveRadius[num(cfg, 'NameShape', 0)];
    if (!radius) centred(w, name, 0, cy);
    else {
      // each character on a circle through (0, cy), the ends lower: an arch when the shirt is upright
      const chars = Array.from(name);
      const total = w.width(name);
      chars.forEach((ch, i) => {
        const cw = w.width(ch);
        const start = w.width(chars.slice(0, i + 1).join('')) - cw;
        const a = (start + cw / 2 - total / 2) / radius;
        ctx.save();
        ctx.translate(radius * Math.sin(a), cy + radius * (1 - Math.cos(a)));
        ctx.rotate(a);
        w.draw(ch, -cw / 2, 0);
        ctx.restore();
      });
    }
    ctx.restore();
  }

  if (m.playerNumber && m.showBackNumber !== false) {
    const top = C.numberTopAtY18 + (18 - num(cfg, 'BackNumberY', 18)) * C.numberStepY;
    const h = C.numberHeightAtSize24 * Math.pow(1.04, num(cfg, 'BackNumberSize', 24) - 24);
    // spacing 8 is the font's own spacing; the number widens / narrows around its centre
    centred(numberWriter('back', h, (num(cfg, 'BackNumberSpacing', 8) - 8) * C.numberSpacingStep), m.playerNumber, 0, top + h / 2);
  }
  ctx.restore();

  // ---- chest number on the front (upright)
  if (m.playerNumber && m.showChestNumber !== false) {
    ctx.save();
    clipRect(ctx, PART_MAP.front.bounds);
    const cx = C.chestCenterAtX14Y19[0] + (num(cfg, 'ChestNumberX', 14) - 14) * C.chestStepX;
    const cy = C.chestCenterAtX14Y19[1] - (num(cfg, 'ChestNumberY', 19) - 19) * C.chestStepY;
    const h = C.chestHeightAtSize17 * Math.pow(1.03, num(cfg, 'ChestNumberSize', 17) - 17);
    centred(numberWriter('chest', h), m.playerNumber, cx, cy);
    ctx.restore();
  }

  // ---- shorts number: ShortsNumberSide 1 (Right) = the right leg = texture-left piece; Left is its mirror
  const shorts = m.shortsNumber;
  if (shorts && m.showShortsNumber !== false) {
    const right = num(cfg, 'ShortsNumberSide', 1) === 1;
    const piece = right ? PART_MAP.leftShorts : PART_MAP.rightShorts;
    const m0 = num(cfg, 'ShortsModel', 1) === 0;
    const x = C.shortsAtY8 + (num(cfg, 'ShortsNumberY', 8) - 8) * C.shortsStepY + (m0 ? C.shortsModel0Shift[0] : 0);
    const y = C.shortsAtX16 - (num(cfg, 'ShortsNumberX', 16) - 16) * C.shortsStepX + (m0 ? C.shortsModel0Shift[1] : 0);
    const h = C.shortsHeightAtSize16 * Math.pow(1.04, num(cfg, 'ShortsNumberSize', 16) - 16);
    ctx.save();
    clipRect(ctx, piece.bounds);
    ctx.translate(right ? x : 1024 - x, y);
    // the leg is stored sideways: the number's top points to the waist
    ctx.rotate(right ? Math.PI / 2 : -Math.PI / 2);
    centred(numberWriter('leg', h, 0, { ...numberStyle, strokeWidth: numberStyle.strokeWidth * 0.7 }), shorts, 0, 0);
    ctx.restore();
  }

  if (m.preview && m.showBadges) drawBadgeMarkers(ctx, m);
}
