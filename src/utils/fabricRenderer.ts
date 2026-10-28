import { FabricConfig, FabricTextureType, KitPartDefinition } from '@/types/kit';
import { partPolygons, polygonsBox } from '@/utils/partShape';
import { getCachedImage, preloadImage } from '@/utils/imageCache';

/**
 * Creates procedural fabric texture pattern tile (Micro-mesh, Honeycomb, Twill, Ribbed)
 */
export function createFabricPattern(ctx: CanvasRenderingContext2D, type: FabricTextureType, scale = 1): CanvasPattern | null {
  /** Tiles are drawn at 4x so the weave stays sharp when the user enlarges it. */
  const SS = 4;
  const tile = document.createElement('canvas');
  const tctx = tile.getContext('2d');
  if (!tctx) return null;

  if (type === 'jersey-dimple') {
    // Sports jersey mesh: rows of flat horizontal ovals, every other row shifted half a step.
    // Each oval is a soft dimple (dark rim, lighter bottom edge) like the white mesh swatch.
    tile.width = 20 * SS;
    tile.height = 14 * SS;
    tctx.scale(SS, SS);
    [[5, 3.5], [15, 10.5]].forEach(([cx, cy]) => {
      tctx.fillStyle = 'rgba(0,0,0,0.46)';
      tctx.beginPath();
      tctx.ellipse(cx, cy, 3.6, 1.8, 0, 0, Math.PI * 2);
      tctx.fill();
      tctx.fillStyle = 'rgba(255,255,255,0.28)';
      tctx.beginPath();
      tctx.ellipse(cx, cy + 0.55, 2.6, 0.9, 0, 0, Math.PI * 2);
      tctx.fill();
    });
    tctx.fillStyle = 'rgba(255,255,255,0.07)';
    tctx.fillRect(0, 0, 20, 14);
  } else if (type === 'jersey-eyelet') {
    // Airy mesh: upright oval eyelets with a bright rim on one side, light and soft overall.
    tile.width = 14 * SS;
    tile.height = 18 * SS;
    tctx.scale(SS, SS);
    [[3.5, 4.5], [10.5, 13.5]].forEach(([cx, cy]) => {
      tctx.fillStyle = 'rgba(255,255,255,0.55)';
      tctx.beginPath();
      tctx.ellipse(cx + 0.5, cy + 0.5, 2.0, 3.8, 0, 0, Math.PI * 2);
      tctx.fill();
      tctx.fillStyle = 'rgba(0,0,0,0.5)';
      tctx.beginPath();
      tctx.ellipse(cx, cy, 1.6, 3.3, 0, 0, Math.PI * 2);
      tctx.fill();
    });
  } else if (type === 'jersey-knit') {
    // Dense knit: fine diagonal yarn grain plus tiny dark vertical slits (dark football jersey mesh).
    tile.width = 12 * SS;
    tile.height = 14 * SS;
    tctx.scale(SS, SS);
    tctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let i = -14; i < 26; i += 3) {
      tctx.save();
      tctx.translate(i, 0);
      tctx.transform(1, 0, -0.6, 1, 0, 0);
      tctx.fillRect(0, 0, 1, 14);
      tctx.restore();
    }
    tctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < 14; y += 2) tctx.fillRect(0, y, 12, 0.6);
    [[3, 3.5], [9, 10.5]].forEach(([cx, cy]) => {
      tctx.fillStyle = 'rgba(0,0,0,0.7)';
      tctx.beginPath();
      tctx.ellipse(cx, cy, 0.9, 2.7, 0, 0, Math.PI * 2);
      tctx.fill();
    });
  } else if (type === 'micro-mesh') {
    // 8x8 micro-mesh breathable athletic perforations (Dri-FIT / Climacool style)
    tile.width = 8 * SS;
    tile.height = 8 * SS;
    tctx.scale(SS, SS);
    tctx.fillStyle = 'rgba(0,0,0,0.38)';
    tctx.fillRect(1, 1, 1.5, 1.5);
    tctx.fillRect(5, 5, 1.5, 1.5);
    tctx.fillStyle = 'rgba(255,255,255,0.20)';
    tctx.fillRect(2, 2, 1, 1);
    tctx.fillRect(6, 6, 1, 1);
  } else if (type === 'knit-honeycomb') {
    // 12x12 hexagonal athletic weave (Heat.RDY / Ultraweave style)
    tile.width = 12 * SS;
    tile.height = 12 * SS;
    tctx.scale(SS, SS);
    tctx.strokeStyle = 'rgba(0,0,0,0.32)';
    tctx.lineWidth = 1;
    tctx.beginPath();
    tctx.moveTo(3, 0); tctx.lineTo(9, 0); tctx.lineTo(12, 6);
    tctx.lineTo(9, 12); tctx.lineTo(3, 12); tctx.lineTo(0, 6);
    tctx.closePath();
    tctx.stroke();
    tctx.fillStyle = 'rgba(255,255,255,0.15)';
    tctx.fillRect(4, 4, 4, 4);
  } else if (type === 'diagonal-twill') {
    // 8x8 jacquard diagonal twill weave
    tile.width = 8 * SS;
    tile.height = 8 * SS;
    tctx.scale(SS, SS);
    tctx.strokeStyle = 'rgba(0,0,0,0.32)';
    tctx.lineWidth = 1.5;
    tctx.beginPath();
    tctx.moveTo(0, 8); tctx.lineTo(8, 0);
    tctx.moveTo(-4, 4); tctx.lineTo(4, -4);
    tctx.moveTo(4, 12); tctx.lineTo(12, 4);
    tctx.stroke();
    tctx.strokeStyle = 'rgba(255,255,255,0.18)';
    tctx.lineWidth = 1;
    tctx.beginPath();
    tctx.moveTo(0, 7); tctx.lineTo(7, 0);
    tctx.stroke();
  } else if (type === 'ribbed') {
    // 6x6 vertical fine ribbing
    tile.width = 6 * SS;
    tile.height = 6 * SS;
    tctx.scale(SS, SS);
    tctx.fillStyle = 'rgba(0,0,0,0.35)';
    tctx.fillRect(0, 0, 2, 6);
    tctx.fillStyle = 'rgba(255,255,255,0.22)';
    tctx.fillRect(3, 0, 1.5, 6);
  } else {
    return null;
  }

  const pattern = ctx.createPattern(tile, 'repeat');
  pattern?.setTransform(new DOMMatrix().scale(scale / SS));
  return pattern;
}

const patternCache = new Map<string, CanvasPattern>();

/** Width in px of a library tile at scale 1 (texture space is 1024 px wide). */
export const IMAGE_TILE_BASE = 64;

/**
 * Tiles a library image as a fabric texture. The image is drawn to a tile canvas at 2x its final size
 * first, so large photos are not sampled with aliasing when they are shrunk to a fine weave.
 */
function imagePattern(ctx: CanvasRenderingContext2D, src: string, scale: number): CanvasPattern | null {
  const img = getCachedImage(src);
  if (!img) {
    preloadImage(src); // redraws are triggered when it finishes loading
    return null;
  }
  const key = `img:${src}@${scale}`;
  const cached = patternCache.get(key);
  if (cached) return cached;

  const SS = 2;
  const tileW = Math.max(4, IMAGE_TILE_BASE * scale);
  const iw = img.naturalWidth || 100;
  const ih = img.naturalHeight || 100;
  const tile = document.createElement('canvas');
  tile.width = Math.max(1, Math.round(tileW * SS));
  tile.height = Math.max(1, Math.round(((tileW * ih) / iw) * SS));
  const tctx = tile.getContext('2d');
  if (!tctx) return null;
  tctx.drawImage(img, 0, 0, tile.width, tile.height);
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return null;
  pattern.setTransform(new DOMMatrix().scale(1 / SS));
  if (patternCache.size > 80) patternCache.clear();
  patternCache.set(key, pattern);
  return pattern;
}

/** Cached fabric pattern (a CanvasPattern works on any 2D context). */
function cachedPattern(
  ctx: CanvasRenderingContext2D,
  type: FabricTextureType,
  scale: number,
  image?: string
): CanvasPattern | null {
  if (type === 'custom-image') return image ? imagePattern(ctx, image, scale) : null;
  const key = `${type}@${scale}`;
  let p = patternCache.get(key);
  if (!p) {
    const made = createFabricPattern(ctx, type, scale);
    if (!made) return null;
    p = made;
    patternCache.set(key, p);
  }
  return p;
}

/**
 * Draws every visible fabric layer that covers `part`, clipped by the caller to the part's shape.
 * Shared by the texture generator (3D + export) and the 2D editor so they always match.
 */
export function drawFabricForPart(ctx: CanvasRenderingContext2D, part: KitPartDefinition, config?: FabricConfig): void {
  if (!config) return;
  const layers = config.layers.filter((l) => l.visible && l.type !== 'none' && l.parts.includes(part.id));
  if (layers.length === 0) return;
  const box = polygonsBox(partPolygons(part));
  layers.forEach((l) => {
    const pattern = cachedPattern(ctx, l.type, l.scale || 1, l.image);
    if (!pattern) return;
    ctx.save();
    ctx.globalAlpha = l.opacity || 0.22;
    ctx.fillStyle = pattern;
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.restore();
  });
}
