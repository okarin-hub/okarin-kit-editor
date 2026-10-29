/**
 * Builds the PES number / name font textures from a font: every character is drawn at one common scale,
 * sat on the layout's baseline and centred in its slot (squeezed sideways only when wider than the slot).
 */
import { FontsetLayout } from '@/constants/fontsetSlots';

export interface FontsetStyle {
  fontFamily: string;
  fontWeight: string;
  fill: string;
  outline: string;
  /** outline width in px at 2048 px texture width */
  outlineWidth: number;
}

const SRC = 256; // font size the glyphs are drawn at before scaling

interface Glyph {
  canvas: HTMLCanvasElement;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function drawGlyph(ch: string, font: string, style: FontsetStyle, strokeSrc: number): Glyph | null {
  const c = document.createElement('canvas');
  c.width = SRC * 3;
  c.height = SRC * 2;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const x = c.width / 2;
  const y = Math.round(SRC * 1.4);
  if (strokeSrc > 0) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeSrc * 2;
    ctx.strokeStyle = style.outline;
    ctx.strokeText(ch, x, y);
  }
  ctx.fillStyle = style.fill;
  ctx.fillText(ch, x, y);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      if (data[(py * width + px) * 4 + 3] > 8) {
        if (px < x0) x0 = px;
        if (px > x1) x1 = px;
        if (py < y0) y0 = py;
        if (py > y1) y1 = py;
      }
    }
  }
  return x1 < 0 ? null : { canvas: c, x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

const fontOf = (style: FontsetStyle, family = style.fontFamily) => `${style.fontWeight} ${SRC}px ${family}`;

/** Characters the chosen font does not have (they come out in the fallback font). */
export function missingGlyphs(chars: string[], style: FontsetStyle): string[] {
  const plain = { ...style, outlineWidth: 0 };
  return chars.filter((ch) => {
    const a = drawGlyph(ch, fontOf(plain), plain, 0);
    const b = drawGlyph(ch, fontOf(plain, 'sans-serif'), plain, 0);
    if (!a) return true;
    return !!b && a.x1 - a.x0 === b.x1 - b.x0 && a.y1 - a.y0 === b.y1 - b.y0 && a.y0 === b.y0;
  });
}

/**
 * Renders one font texture. `reference` sets the scale: its outlined height spans the layout's top..baseline
 * (capital H for names, 0 for numbers); every other glyph keeps its own position relative to the baseline.
 */
export function renderFontset(
  layout: FontsetLayout,
  style: FontsetStyle,
  reference: string
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = layout.width;
  out.height = layout.height;
  const ctx = out.getContext('2d')!;
  const ref = drawGlyph(reference, fontOf(style), style, 0);
  if (!ref) return out;
  const o = (style.outlineWidth * layout.width) / 2048;
  const targetH = layout.baseline - layout.top;
  const s = Math.max(0.01, (targetH - 2 * o) / (ref.y1 - ref.y0));
  const strokeSrc = o / s;
  // source y -> row y: the reference's fill top lands at top + outline
  const rowY = (y: number) => layout.top + o + (y - ref.y0) * s;

  ctx.imageSmoothingQuality = 'high';
  layout.rows.forEach((row, r) => {
    row.forEach((slot) => {
      const g = drawGlyph(slot.ch, fontOf(style), style, strokeSrc);
      if (!g) return;
      const boxW = slot.x1 - slot.x0;
      const dw = Math.min((g.x1 - g.x0) * s, boxW);
      const dh = (g.y1 - g.y0) * s;
      const dx = (slot.x0 + slot.x1) / 2 - dw / 2;
      const dy = r * layout.rowHeight + rowY(g.y0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, r * layout.rowHeight, layout.width, layout.rowHeight);
      ctx.clip();
      const rowTop = r * layout.rowHeight;
      const room = rowTop + layout.top * 0.15;
      const capSrc = ref.y0 - strokeSrc;
      if (dy < room && g.y1 > capSrc) {
        // accent taller than the space above the capitals: keep the letter, squeeze only the part above it
        const capY = rowTop + rowY(capSrc);
        ctx.drawImage(g.canvas, g.x0, g.y0, g.x1 - g.x0, capSrc - g.y0, dx, room, dw, capY - room);
        ctx.drawImage(g.canvas, g.x0, capSrc, g.x1 - g.x0, g.y1 - capSrc, dx, capY, dw, (g.y1 - capSrc) * s);
      } else {
        ctx.drawImage(g.canvas, g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0, dx, dy, dw, dh);
      }
      ctx.restore();
    });
  });

  return out;
}

/**
 * Pixels for the DDS encoder. Transparent pixels take the edge colour, so mipmaps do not get a dark halo
 * (done on the ImageData: a canvas would drop the colour of fully transparent pixels again).
 */
export function fontsetImageData(canvas: HTMLCanvasElement, style: FontsetStyle): ImageData {
  const img = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  const edge = style.outlineWidth > 0 ? style.outline : style.fill;
  const er = parseInt(edge.slice(1, 3), 16), eg = parseInt(edge.slice(3, 5), 16), eb = parseInt(edge.slice(5, 7), 16);
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) {
      img.data[i] = er;
      img.data[i + 1] = eg;
      img.data[i + 2] = eb;
    }
  }
  return img;
}
