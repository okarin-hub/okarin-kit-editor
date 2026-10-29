import {
  KitPartId,
  KitPartConfig,
  KitGraphicItem,
  PlayerMarkingsConfig,
  FabricConfig,
  FabricTextureType,
  BaseTexture,
  TemplateBundle,
} from '@/types/kit';
import { drawPatternLayersForPart } from '@/utils/patternRenderer';
import { drawTemplateForPart } from '@/utils/templateRenderer';
import { drawCreditText } from '@/utils/creditRenderer';
import { partPolygons, pointInPolygons, tracePolygons } from '@/utils/partShape';
import { drawFabricForPart } from '@/utils/fabricRenderer';
import { getStyledLogo } from '@/utils/logoStyle';
import { getCachedImage, preloadImage } from '@/utils/imageCache';
import {
  PART_MAP,
  CANVAS_TEXTURE_SIZE,
  BACK_NECK_Y,
  BACK_CENTER_X,
  getAccentRects,
  DEFAULT_BACKGROUND_COLOR,
  partsForSleeveShape,
} from '@/constants/pes2021Parts';

// Shared image cache (also used by the pattern renderer); re-exported for existing imports
export { preloadImage };

/**
 * Pure 2D Canvas Kit Texture Generator
 * Generates exact unzoomed 1024x1024 (or 2048x2048) texture map for 3D model & game export.
 * Completely immune to Konva viewport transforms, zoom, or UI overlays.
 */
export function renderKitCanvas(
  partsConfig: Record<KitPartId, KitPartConfig>,
  graphicItems: KitGraphicItem[],
  markings?: PlayerMarkingsConfig,
  includeMarkings = true,
  resolution = 1024,
  fabricConfig?: FabricConfig,
  baseTexture?: BaseTexture | null,
  patternMask?: string | null,
  templateBundle?: TemplateBundle | null
): HTMLCanvasElement | null {
  if (typeof window === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const scaleRatio = resolution / CANVAS_TEXTURE_SIZE;
  const shapeParts = partsForSleeveShape(templateBundle?.state.sleeveShape);

  // Everything below the logos/markings. `withPatterns = false` renders the same scene without
  // part patterns; it is used to reveal the base where the pattern mask was painted.
  const paintLayers = (c: CanvasRenderingContext2D, withPatterns: boolean) => {
    // 1. Fill base dark texture background
    c.fillStyle = templateBundle?.state.background || DEFAULT_BACKGROUND_COLOR;
    c.fillRect(0, 0, resolution, resolution);


    // 2. Render each PES 2021 Part
    const baseImg =
      baseTexture && baseTexture.src ? getCachedImage(baseTexture.src) : undefined;
    const baseReady = !!(baseImg && baseImg.complete && baseImg.naturalWidth > 0);
    const replaceMode = !!baseTexture && baseTexture.mode === 'replace';

    if (baseTexture && !baseReady) preloadImage(baseTexture.src);

    // Imported design replaces the generated parts completely
    if (replaceMode && baseReady) {
      c.drawImage(baseImg!, 0, 0, resolution, resolution);
    }

    // With an imported design the part colours are not painted, but patterns, stripes
    // and cuffs still draw on top of the image.
    const overImport = replaceMode && baseReady;

    shapeParts.renderOrder.forEach((part) => {
      const config = partsConfig[part.id];
      if (!config || !config.visible) return;

      c.save();
      if (scaleRatio !== 1) {
        c.scale(scaleRatio, scaleRatio);
      }

      const b = part.bounds;

      // Base colour on every region of the part (skipped when an imported design is the base)
      // over an imported design the colour is only painted when the user stacks it on top
      const paintBase = !overImport || !!config.overDesign;
      if (paintBase) {
        c.save();
        if (overImport) c.globalAlpha = config.overDesignOpacity ?? 1;
        c.fillStyle = config.color;
        if (part.outline) {
          // shaped pieces get a few px of colour bleed past the edge so the 3D model never shows a dark fringe
          c.beginPath();
          tracePolygons(c, part.outline);
          c.fill();
          c.strokeStyle = config.color;
          c.lineWidth = 4;
          c.lineJoin = 'round';
          c.stroke();
        } else {
          part.regions.forEach((r) => c.fillRect(r.x, r.y, r.width, r.height));
        }
        c.restore();
      }

      // Clip to the part's shape so patterns and sashes never spill onto other pieces
      c.save();
      c.beginPath();
      tracePolygons(c, partPolygons(part));
      c.clip();

      // Pattern (shared renderer keeps 2D editor, 3D and export identical)
      if (withPatterns) drawPatternLayersForPart(c, part, templateBundle?.state.patterns);

      // Cuff / hem / collar accent striping
      if (config.cuffStripeEnabled && config.cuffStripeVisible !== false && config.cuffStripeColor) {
        c.save();
        c.fillStyle = config.cuffStripeColor;
        getAccentRects(part.id, config.cuffStripeWidth || 14).forEach((r) =>
          c.fillRect(r.x, r.y, r.width, r.height)
        );
        c.restore();
      }

      if (part.id === 'credit') drawCreditText(c, part.bounds, config);

    // Template zones (collar trim, side panels, cuffs ...) and seam / stitch lines
    if (templateBundle) {
      drawTemplateForPart(c, part, templateBundle.def, templateBundle.state, config.color);
    }

    // Fabric texture on top of the colours, patterns and zones (and of an imported design), so it is never covered
    drawFabricForPart(c, part, fabricConfig);

    c.restore(); // end clip
      c.restore(); // end part scale
    });

    // Imported design drawn over the parts (e.g. to trace or blend)
    if (baseTexture && baseTexture.mode === 'overlay' && baseReady) {
      c.save();
      c.globalAlpha = baseTexture.opacity;
      c.drawImage(baseImg!, 0, 0, resolution, resolution);
      c.restore();
    }
  };

  paintLayers(ctx, true);

  // Pattern eraser mask: where it is painted, show the scene without patterns instead
  if (patternMask) {
    const maskImg = getCachedImage(patternMask);
    if (maskImg && maskImg.complete && maskImg.naturalWidth > 0) {
      const layer = document.createElement('canvas');
      layer.width = resolution;
      layer.height = resolution;
      const lctx = layer.getContext('2d');
      if (lctx) {
        paintLayers(lctx, false);
        lctx.globalCompositeOperation = 'destination-in';
        lctx.drawImage(maskImg, 0, 0, resolution, resolution);
        ctx.drawImage(layer, 0, 0);
      }
    } else {
      preloadImage(patternMask);
    }
  }

  // 3. Render Graphic Items (Logos, Crest, Sponsor, Text)
  graphicItems.forEach((item) => {
    if (item.visible === false) return;

    ctx.save();
    if (scaleRatio !== 1) {
      ctx.scale(scaleRatio, scaleRatio);
    }

    // Clip to the part's regions so graphics never bleed onto neighbouring pieces. The part is the one under
    // the logo's centre: a logo dragged from the chest onto the shorts must follow it, not stay clipped to the chest.
    const icx = item.x + item.width / 2;
    const icy = item.y + item.height / 2;
    const ownPart = shapeParts.map[item.partId];
    const partDef =
      ownPart && pointInPolygons(partPolygons(ownPart), icx, icy)
        ? ownPart
        : [...shapeParts.renderOrder].reverse().find((p) => pointInPolygons(partPolygons(p), icx, icy)) ?? ownPart;
    if (partDef) {
      ctx.beginPath();
      tracePolygons(ctx, partPolygons(partDef));
      ctx.clip();
    }

    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;

    ctx.translate(cx, cy);
    if (item.rotation) {
      ctx.rotate((item.rotation * Math.PI) / 180);
    }
    ctx.globalAlpha = item.opacity ?? 1;

    if (item.type === 'image' && item.src) {
      const cached = getCachedImage(item.src);
      if (cached && cached.complete && cached.naturalWidth > 0) {
        // recolour / gradient / outline are baked into a bitmap at the output resolution
        const styled = getStyledLogo(cached, item, scaleRatio);
        if (styled) {
          ctx.drawImage(
            styled.canvas,
            -item.width / 2 - styled.pad,
            -item.height / 2 - styled.pad,
            styled.canvas.width / scaleRatio,
            styled.canvas.height / scaleRatio
          );
        } else {
          ctx.drawImage(
            cached,
            -item.width / 2,
            -item.height / 2,
            item.width,
            item.height
          );
        }
      } else {
        // Preload for next tick
        preloadImage(item.src);
      }
    } else if (item.type === 'text' && item.text) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${item.fontSize || 32}px ${item.fontFamily || "'Impact', 'Arial Black', sans-serif"}`;
      if (item.strokeColor && item.strokeWidth) {
        ctx.strokeStyle = item.strokeColor;
        ctx.lineWidth = item.strokeWidth;
        ctx.strokeText(item.text, 0, 0);
      }
      ctx.fillStyle = item.textColor || '#ffffff';
      ctx.fillText(item.text, 0, 0);
    }

    ctx.restore();
  });

  // 4. Render Player Markings (if enabled)
  if (markings && markings.showPreview && includeMarkings) {
    ctx.save();
    if (scaleRatio !== 1) {
      ctx.scale(scaleRatio, scaleRatio);
    }

    // The shirt back is stored upside-down in the PES template (hem at y = 0, neck at
    // BACK_NECK_Y), so name/number are drawn rotated 180° about the neck-centre line.
    // `nameY` / `numberY` are distances measured down the shirt from the neckline.
    ctx.save();
    ctx.beginPath();
    ctx.rect(345, 0, 335, BACK_NECK_Y);
    ctx.clip();

    ctx.translate(BACK_CENTER_X, BACK_NECK_Y);
    ctx.rotate(Math.PI);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Player Name
    if (markings.playerName) {
      ctx.font = `bold ${markings.nameSize}px ${markings.fontFamily}`;
      ctx.fillStyle = markings.nameColor;
      ctx.fillText(markings.playerName.toUpperCase(), 0, markings.nameY);
    }

    // Player Number
    if (markings.playerNumber) {
      ctx.font = `bold ${markings.numberSize}px ${markings.fontFamily}`;

      if (markings.numberStrokeWidth > 0) {
        ctx.strokeStyle = markings.numberStrokeColor;
        ctx.lineWidth = markings.numberStrokeWidth;
        ctx.strokeText(markings.playerNumber, 0, markings.numberY);
      }

      ctx.fillStyle = markings.numberColor;
      ctx.fillText(markings.playerNumber, 0, markings.numberY);
    }
    ctx.restore();

    // Shorts Number (on the texture-left shorts piece). The leg is stored sideways (hem at x 0), so the
    // number is turned 90° to read upright on the leg.
    if (markings.shortsNumber) {
      ctx.save();
      ctx.beginPath();
      const sb = PART_MAP.leftShorts.bounds;
      ctx.rect(sb.x, sb.y, sb.width, sb.height);
      ctx.clip();

      ctx.translate(markings.shortsNumberX, markings.shortsNumberY);
      ctx.rotate(Math.PI / 2);
      ctx.font = `bold ${markings.shortsNumberSize}px ${markings.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (markings.numberStrokeWidth > 0) {
        ctx.strokeStyle = markings.numberStrokeColor;
        ctx.lineWidth = markings.numberStrokeWidth * 0.7;
        ctx.strokeText(markings.shortsNumber, 0, 0);
      }

      ctx.fillStyle = markings.numberColor;
      ctx.fillText(markings.shortsNumber, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  return canvas;
}

/** Same as renderKitCanvas but returns a PNG data URL ('' when unavailable). */
export function generateKitTexture(
  partsConfig: Record<KitPartId, KitPartConfig>,
  graphicItems: KitGraphicItem[],
  markings?: PlayerMarkingsConfig,
  includeMarkings = true,
  resolution = 1024,
  fabricConfig?: FabricConfig,
  baseTexture?: BaseTexture | null,
  patternMask?: string | null,
  templateBundle?: TemplateBundle | null
): string {
  const canvas = renderKitCanvas(
    partsConfig,
    graphicItems,
    markings,
    includeMarkings,
    resolution,
    fabricConfig,
    baseTexture,
    patternMask,
    templateBundle
  );
  return canvas ? canvas.toDataURL('image/png') : '';
}

function loadDataUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat tekstur untuk showcase card'));
    img.src = src;
  });
}

/**
 * Showcase Card: a shareable 1600x900 mockup image (front, back, full texture + color palette).
 */
export async function generateShowcaseCard(
  partsConfig: Record<KitPartId, KitPartConfig>,
  graphicItems: KitGraphicItem[],
  markings: PlayerMarkingsConfig | undefined,
  fabricConfig: FabricConfig | undefined,
  title: string,
  baseTexture?: BaseTexture | null,
  patternMask?: string | null,
  templateBundle?: TemplateBundle | null
): Promise<string> {
  if (typeof window === 'undefined') return '';

  // Make sure every logo is decoded before the synchronous texture render
  await Promise.all(graphicItems.filter((g) => g.src).map((g) => preloadImage(g.src!)));
  if (baseTexture) await preloadImage(baseTexture.src);
  if (patternMask) await preloadImage(patternMask);

  const texSize = 2048;
  const texUrl = generateKitTexture(
    partsConfig,
    graphicItems,
    markings,
    true,
    texSize,
    fabricConfig,
    baseTexture,
    patternMask,
    templateBundle
  );
  if (!texUrl) return '';
  const tex = await loadDataUrl(texUrl);
  const k = texSize / CANVAS_TEXTURE_SIZE;

  const W = 1600;
  const H = 900;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b0e14');
  bg.addColorStop(1, '#1a2030');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px system-ui, Arial, sans-serif';
  ctx.fillText(title, 60, 80);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px system-ui, Arial, sans-serif';
  ctx.fillText('PES 2021 Kit  ·  Okarin Kit Editor', 60, 110);

  const panel = (x: number, y: number, w: number, h: number, label: string) => {
    ctx.fillStyle = '#111318';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - 12, y - 12, w + 24, h + 24, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 13px system-ui, Arial, sans-serif';
    ctx.fillText(label, x, y + h + 40);
  };

  // Crops are taken from the UV texture. The back panel is stored upside-down in the PES
  // template, so it is rotated 180° here to read like the real shirt.
  const s = 1.1;
  const crop = (
    sx: number, sy: number, sw: number, sh: number,
    dx: number, dy: number, rotate180 = false
  ) => {
    ctx.save();
    if (rotate180) {
      ctx.translate(dx + sw * s, dy + sh * s);
      ctx.rotate(Math.PI);
      ctx.drawImage(tex, sx * k, sy * k, sw * k, sh * k, 0, 0, sw * s, sh * s);
    } else {
      ctx.drawImage(tex, sx * k, sy * k, sw * k, sh * k, dx, dy, sw * s, sh * s);
    }
    ctx.restore();
  };
  const py = 150;

  panel(60, py, 335 * s, 486 * s, 'DEPAN');
  crop(345, 452, 335, 486, 60, py);

  panel(470, py, 335 * s, BACK_NECK_Y * s, 'BELAKANG');
  crop(345, 0, 335, BACK_NECK_Y, 470, py, true);

  const full = 580;
  panel(960, py, full, full, 'TEKSTUR PES 2021 (UV)');
  ctx.drawImage(tex, 0, 0, texSize, texSize, 960, py, full, full);

  // Color palette
  const swatches: { label: string; color: string }[] = [
    { label: 'Baju', color: partsConfig.front.color },
    { label: 'Lengan', color: partsConfig.leftSleeve.color },
    { label: 'Celana', color: partsConfig.leftShorts.color },
    { label: 'Kaus Kaki', color: partsConfig.leftSock.color },
    { label: 'Kerah', color: partsConfig.collar.color },
    { label: 'Pola Baju', color: partsConfig.front.patternColor },
  ];
  const sy = 790;
  ctx.font = 'bold 13px system-ui, Arial, sans-serif';
  swatches.forEach((sw, i) => {
    const x = 60 + i * 150;
    ctx.fillStyle = sw.color;
    ctx.beginPath();
    ctx.roundRect(x, sy, 48, 48, 10);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(sw.label, x + 58, sy + 22);
    ctx.fillStyle = '#64748b';
    ctx.font = '12px ui-monospace, Consolas, monospace';
    ctx.fillText(sw.color.toUpperCase(), x + 58, sy + 40);
    ctx.font = 'bold 13px system-ui, Arial, sans-serif';
  });

  return canvas.toDataURL('image/png');
}
