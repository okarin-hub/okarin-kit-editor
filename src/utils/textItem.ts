import { KitGraphicItem } from '@/types/kit';

/**
 * Drawing of a text graphic, shared by the 2D editor, the texture generator (3D + export) and the preview in
 * the Logo tab, so all of them show the same thing: one line, bold, centred on the box centre, an optional
 * outline around the letters (drawn behind them, `strokeWidth` px outside) and an optional drop shadow.
 */

export const DEFAULT_TEXT_FONT = "'Impact', 'Arial Black', sans-serif";

type TextStyle = Pick<KitGraphicItem, 'text' | 'textColor' | 'fontFamily' | 'fontSize' | 'strokeColor' | 'strokeWidth' | 'textShadow'>;

const fontOf = (t: TextStyle) => `bold ${t.fontSize || 32}px ${t.fontFamily || DEFAULT_TEXT_FONT}`;

/** Draws the text centred on (0, 0) of the current transform. */
export function drawTextItem(ctx: CanvasRenderingContext2D, t: TextStyle): void {
  if (!t.text) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = fontOf(t);
  const outline = !!(t.strokeColor && t.strokeWidth);
  // the shadow goes on whatever is drawn first (the outline, or the letters), never twice
  if (t.textShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = Math.max(2, (t.fontSize || 32) * 0.12);
    ctx.shadowOffsetX = ctx.shadowOffsetY = Math.max(1, (t.fontSize || 32) * 0.06);
  }
  if (outline) {
    ctx.strokeStyle = t.strokeColor!;
    // behind the letters: half the line is covered by them, so twice the width shows `strokeWidth` outside
    ctx.lineWidth = t.strokeWidth! * 2;
    ctx.lineJoin = 'round';
    ctx.strokeText(t.text, 0, 0);
    ctx.shadowColor = 'transparent';
  }
  ctx.fillStyle = t.textColor || '#ffffff';
  ctx.fillText(t.text, 0, 0);
  ctx.restore();
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** The box a text needs (its width and height in texture px, outline and shadow included). */
export function textBoxSize(t: TextStyle): { width: number; height: number } {
  if (!measureCtx && typeof document !== 'undefined') measureCtx = document.createElement('canvas').getContext('2d');
  const size = t.fontSize || 32;
  const extra = (t.strokeWidth || 0) * 2 + (t.textShadow ? size * 0.15 : 0) + 6;
  let w = (t.text?.length || 1) * size * 0.6;
  if (measureCtx) {
    measureCtx.font = fontOf(t);
    w = measureCtx.measureText(t.text || ' ').width;
  }
  return { width: Math.max(12, Math.ceil(w + extra)), height: Math.max(12, Math.ceil(size * 1.2 + extra)) };
}

/** The item with its box fitted to the text again, keeping the box centre where it was. */
export function fitTextBox(item: KitGraphicItem): KitGraphicItem {
  const { width, height } = textBoxSize(item);
  return {
    ...item,
    x: Math.round(item.x + (item.width - width) / 2),
    y: Math.round(item.y + (item.height - height) / 2),
    width,
    height,
  };
}
