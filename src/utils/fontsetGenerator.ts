/**
 * Builds the PES number / name font textures: every character is put at one common scale on the layout's
 * baseline and centred in its slot (squeezed sideways only when wider than the slot). Characters come from
 * glyph sources, tried in order: a font, or the letters cut out of an imported font sheet image.
 */
import { FontsetLayout } from '@/constants/fontsetSlots';
import { isTintableTile, tintedTile } from '@/utils/patternRenderer';

export interface FontsetStyle {
  fontFamily: string;
  fontWeight: string;
  fill: string;
  outline: string;
  /** outline width in px at 2048 px texture width */
  outlineWidth: number;
}

/** A character ready to place, with its outline already drawn. */
export interface Glyph {
  canvas: HTMLCanvasElement;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** baseline (y in `canvas`) */
  base: number;
  /** capital / digit height in canvas px, without outline: this maps to the layout's top..baseline */
  capH: number;
  /** outline width in canvas px */
  pad: number;
}

/** Returns a character drawn with an outline of `outline` px at the final scale (where capH -> targetH). */
export type GlyphSource = (ch: string, outline: number, targetH: number) => Glyph | null;

/** A logo drawn on every digit (club or league badge on the numbers). */
export interface NumberLogo {
  image: HTMLImageElement | HTMLCanvasElement;
  /** height in % of the digit height */
  size: number;
  /** centre in % of the digit height from its top */
  y: number;
  /** centre offset in % of the digit width */
  x: number;
  opacity: number;
  /** only where the digit is (cut to its shape) */
  clip: boolean;
  /** extra shift per character, in % of the digit size (for digits whose middle is off-centre) */
  offsets?: Record<string, { x: number; y: number }>;
}

/** A tile (library pattern) laid over the characters. */
export interface FontPattern {
  image: HTMLImageElement;
  src: string;
  /** recolour a single-colour tile with this colour; null keeps the tile's own colours */
  color: string | null;
  /** tile width in px at 2048 px texture width */
  scale: number;
  opacity: number;
}

const SRC = 256; // font size the glyphs are drawn at before scaling

function alphaBounds(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const { data } = ctx.getImageData(0, 0, w, h);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (data[(py * w + px) * 4 + 3] > 8) {
        if (px < x0) x0 = px;
        if (px > x1) x1 = px;
        if (py < y0) y0 = py;
        if (py > y1) y1 = py;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

const BASE_Y = Math.round(SRC * 1.4);

function drawFontGlyph(ch: string, font: string, style: FontsetStyle, strokeSrc: number) {
  const c = document.createElement('canvas');
  c.width = SRC * 3;
  c.height = SRC * 2;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (strokeSrc > 0) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeSrc * 2;
    ctx.strokeStyle = style.outline;
    ctx.strokeText(ch, c.width / 2, BASE_Y);
  }
  ctx.fillStyle = style.fill;
  ctx.fillText(ch, c.width / 2, BASE_Y);
  const b = alphaBounds(ctx, c.width, c.height);
  return b && { canvas: c, ...b };
}

const fontOf = (style: FontsetStyle, family = style.fontFamily) => `${style.fontWeight} ${SRC}px ${family}`;

/** Glyphs from a font; `reference` (H for names, 0 for numbers) sets the capital height. */
export function fontGlyphSource(style: FontsetStyle, reference: string): GlyphSource {
  const ref = drawFontGlyph(reference, fontOf(style), style, 0);
  return (ch, outline, targetH) => {
    if (!ref) return null;
    const capH = ref.y1 - ref.y0;
    const strokeSrc = outline / ((targetH - 2 * outline) / capH);
    const g = drawFontGlyph(ch, fontOf(style), style, strokeSrc);
    // the reference bottom (not the font baseline) sits on the layout baseline, so round digits do not overshoot
    return g && { ...g, base: ref.y1, capH, pad: strokeSrc };
  };
}

/** Characters the chosen font does not have (they come out in the fallback font). */
export function missingGlyphs(chars: string[], style: FontsetStyle): string[] {
  const plain = { ...style, outlineWidth: 0 };
  return chars.filter((ch) => {
    const a = drawFontGlyph(ch, fontOf(plain), plain, 0);
    const b = drawFontGlyph(ch, fontOf(plain, 'sans-serif'), plain, 0);
    if (!a) return true;
    return !!b && a.x1 - a.x0 === b.x1 - b.x0 && a.y1 - a.y0 === b.y1 - b.y0 && a.y0 === b.y0;
  });
}

// ---------------------------------------------------------------- font sheet images

/** One character cut out of a sheet: transparent background, original colours. */
export interface SheetGlyph {
  canvas: HTMLCanvasElement;
  /** baseline and capital height of its row, in this canvas */
  base: number;
  capH: number;
}

export interface SheetRow {
  glyphs: SheetGlyph[];
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * Finds the rows and characters of a font sheet. Every separate shape is found (connected pixels); long thin
 * shapes and very large ones are background (lines, frames) and dropped. Shapes are grouped into rows by their
 * height, pieces that sit over each other (a broken stroke) join into one character, and rows of much smaller
 * text than the main rows (titles, captions) are left out. Letters that touch are split at their thinnest column.
 */
export function analyzeFontSheet(image: HTMLImageElement | HTMLCanvasElement): SheetRow[] {
  const scale = Math.min(1, 4096 / Math.max(image.width, image.height));
  const w = Math.round(image.width * scale);
  const h = Math.round(image.height * scale);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  // background: transparent pixels, else the colour around the border
  let transparent = 0;
  for (let i = 3; i < d.length; i += 4 * 97) if (d[i] < 250) transparent++;
  const hasAlpha = transparent > (d.length / 4 / 97) * 0.05;
  const border: number[][] = [];
  for (let x = 0; x < w; x += 4) border.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y += 4) border.push([0, y], [w - 1, y]);
  const bg = [0, 1, 2].map((k) => median(border.map(([x, y]) => d[(y * w + x) * 4 + k])));
  const N = w * h;
  const alpha = new Uint8ClampedArray(N);
  for (let p = 0; p < N; p++) {
    const i = p * 4;
    if (hasAlpha) alpha[p] = d[i + 3];
    else {
      const dist = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]);
      alpha[p] = Math.max(0, Math.min(255, ((dist - 40) / 80) * 255));
    }
    d[i + 3] = alpha[p];
  }

  // connected shapes (8-neighbour)
  interface Comp {
    id: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    area: number;
  }
  const label = new Int32Array(N).fill(-1);
  const comps: Comp[] = [];
  const stack = new Int32Array(N);
  for (let p = 0; p < N; p++) {
    if (label[p] >= 0 || alpha[p] <= 60) continue;
    const comp: Comp = { id: comps.length, x0: w, y0: h, x1: 0, y1: 0, area: 0 };
    let top = 0;
    stack[top++] = p;
    label[p] = comp.id;
    while (top) {
      const q = stack[--top];
      const x = q % w;
      const y = (q - x) / w;
      comp.area++;
      if (x < comp.x0) comp.x0 = x;
      if (x + 1 > comp.x1) comp.x1 = x + 1;
      if (y < comp.y0) comp.y0 = y;
      if (y + 1 > comp.y1) comp.y1 = y + 1;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const n = yy * w + xx;
          if (label[n] < 0 && alpha[n] > 60) {
            label[n] = comp.id;
            stack[top++] = n;
          }
        }
      }
    }
    comps.push(comp);
  }
  const hOf = (k: Comp) => k.y1 - k.y0;
  const wOf = (k: Comp) => k.x1 - k.x0;

  // drop dust, then background shapes measured against the typical shape height
  let cand = comps.filter((k) => k.area >= Math.max(16, N * 0.00002));
  const byArea = [...cand].sort((a, b) => b.area - a.area);
  const H = median(byArea.slice(0, Math.max(1, Math.ceil(byArea.length / 2))).map(hOf)) || 1;
  cand = cand.filter((k) => {
    const fill = k.area / (wOf(k) * hOf(k));
    // frames and long lines; big solid digits next to small letters and solid wide shapes (letters that touch) stay
    if (hOf(k) > H * 3 && fill < 0.25) return false;
    if (wOf(k) > H * 6 && fill < 0.25) return false;
    if (fill < 0.1 && wOf(k) * hOf(k) > 2 * H * H) return false; // thin diagonal strokes larger than a letter
    return true;
  });

  // rows: shapes that share most of their height; the tallest shape of a row sets its band
  interface Row {
    members: Comp[];
    y0: number;
    y1: number;
  }
  const rows: Row[] = [];
  for (const k of [...cand].sort((a, b) => hOf(b) - hOf(a))) {
    let best: Row | null = null;
    let bestOv = 0;
    for (const r of rows) {
      const ov = Math.min(k.y1, r.y1) - Math.max(k.y0, r.y0);
      if (ov >= 0.5 * Math.min(hOf(k), r.y1 - r.y0) && ov > bestOv) {
        best = r;
        bestOv = ov;
      }
    }
    if (best) best.members.push(k);
    else rows.push({ members: [k], y0: k.y0, y1: k.y1 });
  }
  const rowH = (r: Row) => median(r.members.map(hOf));
  const tallest = Math.max(0, ...rows.map(rowH));
  // titles and captions are much smaller than the characters (small letters next to big digits are kept)
  const kept = rows.filter((r) => rowH(r) >= tallest * 0.22).sort((a, b) => a.y0 - b.y0);

  const read = kept.map((row) => {
    // pieces over each other form one character
    const sorted = [...row.members].sort((a, b) => a.x0 - b.x0);
    const groups: { x0: number; x1: number; ids: number[] }[] = [];
    for (const k of sorted) {
      const g = groups[groups.length - 1];
      const ov = g ? Math.min(g.x1, k.x1) - Math.max(g.x0, k.x0) : -1;
      if (g && ov >= 0.5 * Math.min(g.x1 - g.x0, wOf(k))) {
        g.x1 = Math.max(g.x1, k.x1);
        g.ids.push(k.id);
      } else groups.push({ x0: k.x0, x1: k.x1, ids: [k.id] });
    }
    const y0 = Math.min(...row.members.map((k) => k.y0));
    const y1 = Math.max(...row.members.map((k) => k.y1));
    const inGroup = (ids: number[]) => {
      const set = new Set(ids);
      return (x: number, y: number) => set.has(label[y * w + x]);
    };

    // touching letters: a piece far wider than the others is split at its thinnest column near the middle
    let cols = groups.map((g) => ({ x0: g.x0, x1: g.x1, has: inGroup(g.ids) }));
    // with only a few pieces (a whole row stuck together) the median says little: use the row height
    const bandH = median(row.members.map(hOf));
    const typical = cols.length >= 4 ? median(cols.map((k) => k.x1 - k.x0)) : Math.min(median(cols.map((k) => k.x1 - k.x0)), bandH * 0.6);
    for (let guard = 0; guard < 20; guard++) {
      const i = cols.findIndex((k) => k.x1 - k.x0 > typical * 1.8);
      if (i < 0) break;
      const k = cols[i];
      let cut = -1;
      let best = Infinity;
      for (let x = Math.round(k.x0 + (k.x1 - k.x0) * 0.3); x < k.x0 + (k.x1 - k.x0) * 0.7; x++) {
        let n = 0;
        for (let y = y0; y < y1; y++) if (k.has(x, y)) n++;
        if (n < best) {
          best = n;
          cut = x;
        }
      }
      if (cut < 0) break;
      cols = [...cols.slice(0, i), { ...k, x1: cut }, { ...k, x0: cut }, ...cols.slice(i + 1)];
    }

    const boxes = cols
      .map((k) => {
        let top = y1;
        let bottom = y0;
        for (let y = y0; y < y1; y++) {
          for (let x = k.x0; x < k.x1; x++) {
            if (k.has(x, y)) {
              if (y < top) top = y;
              bottom = y + 1;
              break;
            }
          }
        }
        return { ...k, top, bottom };
      })
      .filter((b) => b.bottom > b.top);
    const tall = Math.max(...boxes.map((b) => b.bottom - b.top));
    const main = boxes.filter((b) => b.bottom - b.top >= tall * 0.5);
    const baseline = median(main.map((b) => b.bottom));
    const capTop = median(main.map((b) => b.top));
    const glyphs = boxes.map((b) => {
      const g = document.createElement('canvas');
      g.width = b.x1 - b.x0;
      g.height = b.bottom - b.top;
      const out = new ImageData(g.width, g.height);
      for (let y = b.top; y < b.bottom; y++) {
        for (let x = b.x0; x < b.x1; x++) {
          if (!b.has(x, y)) continue;
          const si = (y * w + x) * 4;
          const di = ((y - b.top) * g.width + (x - b.x0)) * 4;
          out.data[di] = d[si];
          out.data[di + 1] = d[si + 1];
          out.data[di + 2] = d[si + 2];
          out.data[di + 3] = d[si + 3];
        }
      }
      g.getContext('2d')!.putImageData(out, 0, 0);
      return { canvas: g, base: baseline - b.top, capH: Math.max(1, baseline - capTop) };
    });
    return { glyphs };
  });
  // a lone shape (a logo, a stray mark) is not a row of characters
  return read.filter((r) => r.glyphs.length >= 2);
}

/** Average colour of the solid pixels of a sheet, as #RRGGBB (the fill for characters taken from the fallback font). */
export function sheetInkColor(rows: SheetRow[]): string | null {
  let r = 0, g = 0, b = 0, n = 0;
  for (const glyph of rows.flatMap((row) => row.glyphs).slice(0, 12)) {
    const { data } = glyph.canvas.getContext('2d')!.getImageData(0, 0, glyph.canvas.width, glyph.canvas.height);
    for (let i = 0; i < data.length; i += 16) {
      if (data[i + 3] > 220) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    }
  }
  if (!n) return null;
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

const smoothCache = new WeakMap<SheetGlyph, { k: number; out: SheetGlyph }>();

/**
 * Enlarges a sheet letter by `k` without staircase edges: the enlarged letter is blurred by about half a source
 * pixel and its edge cut again with a narrow soft ramp, which turns the pixel steps into smooth curves (and closes
 * pinholes left by JPG compression).
 */
function smoothUpscale(sg: SheetGlyph, k: number): SheetGlyph {
  const hit = smoothCache.get(sg);
  if (hit && Math.abs(hit.k - k) < 0.01) return hit.out;
  const r = k * 0.5;
  const pad = Math.ceil(r * 2) + 1;
  const w = Math.round(sg.canvas.width * k);
  const h = Math.round(sg.canvas.height * k);
  const c = document.createElement('canvas');
  c.width = w + 2 * pad;
  c.height = h + 2 * pad;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.filter = `blur(${r}px)`;
  ctx.drawImage(sg.canvas, pad, pad, w, h);
  ctx.filter = 'none';
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  // the blurred edge spans about 2r px; cut it back to ~1.5 px of anti-aliasing
  const steep = Math.max(1, (2 * r) / 1.5);
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const a = Math.max(0, Math.min(1, (d[i + 3] / 255 - 0.5) * steep + 0.5));
    d[i + 3] = a * 255;
    if (a > 0) {
      const x = p % c.width, y = (p - x) / c.width;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return sg;
  ctx.putImageData(img, 0, 0);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  const res = { canvas: out, base: sg.base * k + pad - y0, capH: sg.capH * k };
  smoothCache.set(sg, { k, out: res });
  return res;
}

/** Glyphs from a font sheet: `recolor` paints them in the fill colour, else they keep the sheet's colours. */
export function sheetGlyphSource(map: Map<string, SheetGlyph>, style: FontsetStyle, recolor: boolean): GlyphSource {
  const tint = (src: HTMLCanvasElement, color: string) => {
    const t = document.createElement('canvas');
    t.width = src.width;
    t.height = src.height;
    const tc = t.getContext('2d')!;
    tc.drawImage(src, 0, 0);
    tc.globalCompositeOperation = 'source-in';
    tc.fillStyle = color;
    tc.fillRect(0, 0, t.width, t.height);
    return t;
  };
  return (ch, outline, targetH) => {
    const raw = map.get(ch);
    if (!raw) return null;
    const k = (targetH - 2 * outline) / raw.capH;
    const sg = k > 1.2 ? smoothUpscale(raw, k) : raw;
    const oSrc = outline / ((targetH - 2 * outline) / sg.capH);
    const m = Math.ceil(oSrc) + 1;
    const c = document.createElement('canvas');
    c.width = sg.canvas.width + 2 * m;
    c.height = sg.canvas.height + 2 * m;
    const ctx = c.getContext('2d')!;
    if (oSrc > 0) {
      // outline: the shape stamped around a circle, rings from the inside out
      const shape = tint(sg.canvas, style.outline);
      for (let r = Math.min(1, oSrc); r <= oSrc + 0.01; r += Math.max(0.75, oSrc / 4)) {
        const steps = Math.max(12, Math.ceil(r * 6));
        for (let k = 0; k < steps; k++) {
          const a = (k / steps) * Math.PI * 2;
          ctx.drawImage(shape, m + Math.cos(a) * r, m + Math.sin(a) * r);
        }
      }
    }
    ctx.drawImage(recolor ? tint(sg.canvas, style.fill) : sg.canvas, m, m);
    return {
      canvas: c,
      x0: Math.floor(m - oSrc),
      y0: Math.floor(m - oSrc),
      x1: Math.ceil(m + sg.canvas.width + oSrc),
      y1: Math.ceil(m + sg.canvas.height + oSrc),
      base: m + sg.base,
      capH: sg.capH,
      pad: oSrc,
    };
  };
}

// ---------------------------------------------------------------- texture

/** Renders one font texture from the glyph sources (the first one that has a character wins). */
export function renderFontset(
  layout: FontsetLayout,
  sources: GlyphSource[],
  outlineWidth: number,
  logo?: NumberLogo | null,
  pattern?: FontPattern | null
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = layout.width;
  out.height = layout.height;
  const ctx = out.getContext('2d')!;
  const o = (outlineWidth * layout.width) / 2048;
  const targetH = layout.baseline - layout.top;
  ctx.imageSmoothingQuality = 'high';

  let fill: CanvasPattern | null = null;
  if (pattern && pattern.image.naturalWidth > 0) {
    const tile =
      pattern.color && isTintableTile(pattern.src, pattern.image)
        ? tintedTile(pattern.src, pattern.image, pattern.color) ?? pattern.image
        : pattern.image;
    fill = ctx.createPattern(tile, 'repeat');
    const k = ((pattern.scale * layout.width) / 2048) / tile.width;
    fill?.setTransform(new DOMMatrix().scale(k, k));
  }

  layout.rows.forEach((row, r) => {
    const rowTop = r * layout.rowHeight;
    row.forEach((slot) => {
      let g: Glyph | null = null;
      for (const src of sources) if ((g = src(slot.ch, o, targetH))) break;
      if (!g) return;
      const s = Math.max(0.01, (targetH - 2 * o) / g.capH);
      // glyph y -> texture y: its baseline lands on the layout baseline (minus the outline)
      const destY = (y: number) => rowTop + layout.baseline - o + (y - g!.base) * s;
      const boxW = slot.x1 - slot.x0;
      const dw = Math.min((g.x1 - g.x0) * s, boxW);
      const dx = (slot.x0 + slot.x1) / 2 - dw / 2;
      const dy = destY(g.y0);
      const dh = (g.y1 - g.y0) * s;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, rowTop, layout.width, layout.rowHeight);
      ctx.clip();
      const room = rowTop + layout.top * 0.15;
      const capSrc = g.base - g.capH - g.pad;
      if (dy < room && g.y1 > capSrc) {
        // accent taller than the space above the capitals: keep the letter, squeeze only the part above it
        const capY = destY(capSrc);
        ctx.drawImage(g.canvas, g.x0, g.y0, g.x1 - g.x0, capSrc - g.y0, dx, room, dw, capY - room);
        ctx.drawImage(g.canvas, g.x0, capSrc, g.x1 - g.x0, g.y1 - capSrc, dx, capY, dw, (g.y1 - capSrc) * s);
      } else {
        ctx.drawImage(g.canvas, g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0, dx, dy, dw, dh);
      }
      if (fill) {
        // only over the character just drawn (its slot); outline included
        ctx.globalAlpha = pattern!.opacity;
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = fill;
        ctx.fillRect(slot.x0, rowTop, boxW, layout.rowHeight);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      if (logo && logo.image.width > 0) {
        const lh = (logo.size / 100) * dh;
        const lw = lh * (logo.image.width / logo.image.height);
        ctx.globalAlpha = logo.opacity;
        if (logo.clip) ctx.globalCompositeOperation = 'source-atop';
        const off = logo.offsets?.[slot.ch] ?? { x: 0, y: 0 };
        ctx.drawImage(
          logo.image,
          dx + dw / 2 + ((logo.x + off.x) / 100) * dw - lw / 2,
          dy + ((logo.y + off.y) / 100) * dh - lh / 2,
          lw,
          lh
        );
      }
      ctx.restore();
    });
  });
  return out;
}

/**
 * Pixels for the DDS encoder. Transparent pixels take the average glyph colour, so mipmaps do not get a dark
 * halo (done on the ImageData: a canvas would drop the colour of fully transparent pixels again).
 */
export function fontsetImageData(canvas: HTMLCanvasElement): ImageData {
  const img = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 200) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
      n++;
    }
  }
  if (!n) return img;
  r /= n;
  g /= n;
  b /= n;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
  }
  return img;
}
