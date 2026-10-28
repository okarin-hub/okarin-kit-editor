import { KitPartConfig, KitRect } from '@/types/kit';

/** Draws the credit text centred in its box, shrinking the font to fit the width. */
export function drawCreditText(ctx: CanvasRenderingContext2D, rect: KitRect, config: KitPartConfig): void {
  const text = (config.label ?? '').trim();
  if (!text) return;
  ctx.save();
  ctx.fillStyle = config.labelColor ?? '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const family = config.labelFont ?? "'Impact', 'Arial Black', sans-serif";
  let size = rect.height * 0.62;
  ctx.font = `bold ${size}px ${family}`;
  const maxW = rect.width * 0.9;
  const w = ctx.measureText(text).width;
  if (w > maxW) {
    size *= maxW / w;
    ctx.font = `bold ${size}px ${family}`;
  }
  ctx.fillText(text, rect.x + rect.width / 2, rect.y + rect.height / 2 + 1);
  ctx.restore();
}
