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
};

/**
 * Texture px per config step, measured from in-game Sider screenshots (screen px divided by an estimated
 * screen-to-texture scale: back 1.85 vertical / 1.6 horizontal, front 2.76 / 2.39).
 * shortcut: the scales are estimates from one sponsor logo and the shirt width; refine them with a grid texture.
 */
export const MARKINGS_CAL = {
  // back, distances measured down the shirt from the neckline
  nameCenterAtY15: 228,
  nameStepY: 7.3, // higher NameY = up
  nameHeightAtSize6: 21, // cap height; height grows like (size + 12)
  nameStretch: [1, 0.8, 1, 1.14], // NameStretch 0..3, width only (0 looks like 2 in game)
  // NameShape 0..3: straight, light / medium / extreme curve. shortcut: radii guessed, no in-game shot of a curve yet
  nameCurveRadius: [0, 420, 260, 160],
  numberTopAtY18: 78,
  numberStepY: 5.3, // higher BackNumberY = up
  numberHeightAtSize24: 132, // x1.04 per step, grows downward from its top
  numberSpacingStep: 1.9, // gap between digits per BackNumberSpacing step; the first digit stays
  // gaps between characters cut from a PES font sheet, as a share of their height (back number at spacing 8)
  numberGap: 0.155,
  nameGap: 0.08,
  // front, upright, neckline at (512, 500)
  chestCenterAtX14Y19: [506, 586],
  chestStepX: 7.3, // higher = the player's left (texture right)
  chestStepY: 7.2, // higher = up
  chestHeightAtSize17: 46, // x1.03 per step, grows around its centre
  // shorts: the right leg's piece (texture left), stored sideways with the hem at x 0
  shortsAtX16Y4: [75, 875],
  shortsStepX: 2.6, // along the leg's width
  shortsStepY: 3.9, // higher = up, toward the waist
  shortsHeightAtSize16: 30, // x1.04 per step
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
    // spacing 8 is the font's own spacing; other values move the later digits only, the first one stays
    const w = numberWriter('back', h, (num(cfg, 'BackNumberSpacing', 8) - 8) * C.numberSpacingStep);
    const left = -numberWriter('back', h).width(m.playerNumber) / 2;
    w.draw(m.playerNumber, left, top + h / 2);
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
    const x = C.shortsAtX16Y4[0] + (num(cfg, 'ShortsNumberY', 4) - 4) * C.shortsStepY;
    const y = C.shortsAtX16Y4[1] + (num(cfg, 'ShortsNumberX', 16) - 16) * C.shortsStepX;
    const h = C.shortsHeightAtSize16 * Math.pow(1.04, num(cfg, 'ShortsNumberSize', 16) - 16);
    ctx.save();
    clipRect(ctx, piece.bounds);
    ctx.translate(right ? x : 1024 - x, y);
    // the leg is stored sideways: the number's top points to the waist
    ctx.rotate(right ? Math.PI / 2 : -Math.PI / 2);
    centred(numberWriter('leg', h, 0, { ...numberStyle, strokeWidth: numberStyle.strokeWidth * 0.7 }), shorts, 0, 0);
    ctx.restore();
  }
}
