'use client';

import type { MarkingsView } from '@/utils/markingsLayout';
import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Stage,
  Layer,
  Rect,
  Shape,
  Path,
  Group,
  Text,
  Line,
  Image as KonvaImage,
  Circle,
  Transformer,
} from 'react-konva';
import useImage from 'use-image';
import { drawPatternLayersForPart, patternLayersForPart, patternsUnderLayers } from '@/utils/patternRenderer';
import { preloadImage, subscribeAssets } from '@/utils/imageCache';
import { renderKitCanvas } from '@/utils/textureGenerator';
import { drawTemplateForPart, setLiveErase, SEAM_CURVE_TENSION } from '@/utils/templateRenderer';
import { getCanvasArea, getCanvasRulers, onPrefsChange, zoomFactor } from '@/utils/uiPrefs';
import { CanvasRulers } from '@/components/canvas/CanvasRulers';
import { bakeZone, repeatLayout, zoneBox, zoneMatrix } from '@/utils/zoneGeometry';
import { drawCreditText } from '@/utils/creditRenderer';
import { drawFabricForPart } from '@/utils/fabricRenderer';
import { partPolygons, tracePolygons, polygonsBox } from '@/utils/partShape';
import {
  KitPartId,
  KitPartConfig,
  KitPartDefinition,
  KitZoneDef,
  CanvasViewState,
  KitGraphicItem,
  BaseTexture,
  PatternBrushState,
  TemplateBundle,
  FabricConfig,
  PatternLayer,
  TemplateZoneState,
  Pt,
} from '@/types/kit';
import {
  PES_2021_PARTS,
  CANVAS_TEXTURE_SIZE,
  getAccentRects,
  DEFAULT_BACKGROUND_COLOR,
  partsForSleeveShape,
} from '@/constants/pes2021Parts';
import InteractiveGraphicItem from './InteractiveGraphicItem';
import PlayerMarkingsLayer from './PlayerMarkingsLayer';
import Konva from 'konva';
import { lockAxis, lockStart, snap45, ROTATION_SNAPS } from '@/utils/dragLock';

interface KitCanvasProps {
  partsConfig: Record<KitPartId, KitPartConfig>;
  viewState: CanvasViewState;
  onSelectPart: (partId: KitPartId) => void;
  hoveredPartId: KitPartId | null;
  setHoveredPartId: (partId: KitPartId | null) => void;
  graphicItems: KitGraphicItem[];
  selectedGraphicId: string | null;
  onSelectGraphic: (id: string | null) => void;
  onUpdateGraphic: (item: KitGraphicItem) => void;
  onDeleteGraphic: (id: string) => void;
  markings: MarkingsView;
  baseTexture?: BaseTexture | null;
  patternMask?: string | null;
  templateBundle?: TemplateBundle | null;
  fabricConfig?: FabricConfig;
  selectedZoneId?: string | null;
  /** All selected layers (Ctrl / Shift click in the layer list); with more than one a shared box moves them together. */
  selectedZoneIds?: string[];
  onSelectZone?: (zoneId: string | null) => void;
  onZoneTransform?: (zoneId: string, patch: Partial<TemplateZoneState>) => void;
  drawTool?: 'free' | 'poly' | 'stitch' | 'stitchFree' | 'gradient' | null;
  drawPts?: Pt[];
  onViewChange?: (patch: Partial<CanvasViewState>) => void;
  drawCurve?: boolean;
  onDrawPts?: (pts: Pt[]) => void;
  onDrawFinish?: (pts: Pt[]) => void;
  onDrawCancel?: () => void;
  editPoints?: boolean;
  onZonePointMove?: (zoneId: string, poly: number, idx: number, pt: Pt) => void;
  onZonePointInsert?: (zoneId: string, poly: number, afterIdx: number, pt: Pt) => void;
  onZonePointRemove?: (zoneId: string, poly: number, idx: number) => void;
  /** Stitch line whose points are edited (key: its id or "seam-<index>"). */
  editSeam?: string | null;
  onSeamPointMove?: (key: string, idx: number, pt: Pt) => void;
  onSeamPointInsert?: (key: string, afterIdx: number, pt: Pt) => void;
  onSeamPointRemove?: (key: string, idx: number) => void;
  onPatternMaskChange?: (dataUrl: string | null) => void;
  brush?: PatternBrushState;
  isExportingClean?: boolean;
  stageRef: React.RefObject<Konva.Stage | null>;
  /** a picture shown faintly over everything (tracing guide); not part of the kit */
  traceGuide?: { src: string; opacity: number } | null;
  canvasDisplaySize: number;
}

// Pattern within the part boundary. Drawn by the shared renderer so it always matches the
// texture generator (3D preview + export).
const RenderPattern: React.FC<{
  part: KitPartDefinition;
  layers: PatternLayer[];
}> = ({ part, layers }) => {
  return (
    <Shape
      listening={false}
      sceneFunc={(context) => {
        // Konva's context wraps the native 2D context (transform already applied)
        drawPatternLayersForPart((context as any)._context as CanvasRenderingContext2D, part, layers);
      }}
    />
  );
};

// Cuff / hem / collar accent striping (not affected by the pattern eraser mask)
const RenderAccents: React.FC<{
  part: KitPartDefinition;
  config: KitPartConfig;
}> = ({ part, config }) => {
  if (part.id === 'credit') {
    return (
      <Shape
        listening={false}
        sceneFunc={(context) => {
          drawCreditText((context as any)._context as CanvasRenderingContext2D, part.bounds, config);
        }}
      />
    );
  }
  if (!config.cuffStripeEnabled || config.cuffStripeVisible === false || !config.cuffStripeColor) return null;
  return (
    <>
      {getAccentRects(part.id, config.cuffStripeWidth || 14).map((r, i) => (
        <Rect
          key={`accent-${i}`}
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          fill={config.cuffStripeColor}
          listening={false}
        />
      ))}
    </>
  );
};

export const KitCanvas: React.FC<KitCanvasProps> = ({
  partsConfig,
  viewState,
  onSelectPart,
  hoveredPartId,
  setHoveredPartId,
  graphicItems,
  selectedGraphicId,
  onSelectGraphic,
  onUpdateGraphic,
  onDeleteGraphic,
  markings,
  baseTexture,
  patternMask,
  templateBundle,
  fabricConfig,
  selectedZoneId,
  selectedZoneIds,
  onSelectZone,
  onZoneTransform,
  drawTool,
  drawPts = [],
  onViewChange,
  drawCurve = false,
  onDrawPts,
  onDrawFinish,
  onDrawCancel,
  editPoints,
  onZonePointMove,
  onZonePointInsert,
  onZonePointRemove,
  editSeam,
  onSeamPointMove,
  onSeamPointInsert,
  onSeamPointRemove,
  onPatternMaskChange,
  brush,
  isExportingClean = false,
  traceGuide = null,
  stageRef,
  canvasDisplaySize,
}) => {
  // Part shapes for the chosen sleeve length
  const shapeParts = partsForSleeveShape(templateBundle?.state.sleeveShape);
  // patterns placed above a template layer are drawn with the template layers (static layer), not here
  // shortcut: in 2D the pattern eraser does not reach those raised patterns (3D / export do), upgrade if users erase them
  const underPatterns = patternsUnderLayers(templateBundle?.state.patterns, templateBundle?.def.zones.map((z) => z.id) ?? []);
  // Imported finished design (replaces or overlays the generated parts)
  const [baseImg] = useImage(baseTexture?.src ?? '', 'anonymous');
  const [guideImg] = useImage(traceGuide?.src ?? '');
  const replaceWithImport = !!baseTexture && baseTexture.mode === 'replace' && !!baseImg;
  // Official PES 2021 template guide (labelled pieces) from /public/templates
  const [templateImg] = useImage('/templates/pes2021_template_labeled.png');

  // Redraw when a library image / font finishes loading (patterns draw from the shared cache)
  useEffect(
    () => subscribeAssets(() => stageRef.current?.batchDraw()),
    [stageRef]
  );

  // ---- Pattern eraser mask (offscreen canvas painted with the brush) ----
  const brushActive = !!brush?.active && !isExportingClean;

  // ---- Drawing a new template layer: freehand stroke or point-by-point polygon ----
  const drawActive = !!drawTool && !isExportingClean;
  const freeDrawing = useRef(false);
  const drawPtsRef = useRef<Pt[]>(drawPts);
  drawPtsRef.current = drawPts;
  const locked = brushActive || drawActive;
  // Shift held: the transformers turn in 15° steps (like Photoshop)
  const [shiftHeld, setShiftHeld] = useState(false);
  useEffect(() => {
    const on = (e: KeyboardEvent) => setShiftHeld(e.shiftKey);
    const off = () => setShiftHeld(false);
    window.addEventListener('keydown', on);
    window.addEventListener('keyup', on);
    window.addEventListener('blur', off);
    return () => {
      window.removeEventListener('keydown', on);
      window.removeEventListener('keyup', on);
      window.removeEventListener('blur', off);
    };
  }, []);
  const rotationSnaps = shiftHeld ? ROTATION_SNAPS : [];

  const handleDrawDown = (stage: Konva.Stage | null, shift = false) => {
    const pos = stage?.getRelativePointerPosition();
    if (!pos || !drawTool) return;
    let pt: Pt = [Math.round(pos.x * 10) / 10, Math.round(pos.y * 10) / 10];
    if (drawTool === 'free' || drawTool === 'stitchFree' || drawTool === 'gradient') {
      freeDrawing.current = true;
      onDrawPts?.([pt]);
      return;
    }
    const pts = drawPtsRef.current;
    // clicking next to the first point closes the shape
    if (drawTool === 'poly' && pts.length >= 3 && Math.hypot(pts[0][0] - pt[0], pts[0][1] - pt[1]) < 12) {
      onDrawFinish?.(pts);
      return;
    }
    const last = pts[pts.length - 1];
    // Shift: the new segment goes straight on, at a multiple of 45°
    if (last && shift) pt = snap45(last, pt);
    if (last && Math.hypot(last[0] - pt[0], last[1] - pt[1]) < 3) return;
    onDrawPts?.([...pts, pt]);
  };

  const handleDrawMove = (stage: Konva.Stage | null, shift = false) => {
    if (!(drawTool === 'free' || drawTool === 'stitchFree' || drawTool === 'gradient') || !freeDrawing.current) return;
    const pos = stage?.getRelativePointerPosition();
    if (!pos) return;
    const pts = drawPtsRef.current;
    // gradient: just the start point and where the mouse is now
    if (drawTool === 'gradient') {
      const end: Pt = [Math.round(pos.x * 10) / 10, Math.round(pos.y * 10) / 10];
      onDrawPts?.([pts[0], shift ? snap45(pts[0], end) : end]);
      return;
    }
    const last = pts[pts.length - 1];
    if (last && Math.hypot(last[0] - pos.x, last[1] - pos.y) < 2.5) return;
    onDrawPts?.([...pts, [Math.round(pos.x * 10) / 10, Math.round(pos.y * 10) / 10]]);
  };

  const handleDrawUp = () => {
    if (!(drawTool === 'free' || drawTool === 'stitchFree' || drawTool === 'gradient') || !freeDrawing.current) return;
    freeDrawing.current = false;
    const pts = drawPtsRef.current;
    if (drawTool === 'gradient') {
      if (pts.length === 2 && Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) >= 6) onDrawFinish?.(pts);
      else onDrawPts?.([]);
      return;
    }
    if (pts.length >= 4) onDrawFinish?.(pts);
    else onDrawPts?.([]);
  };

  useEffect(() => {
    if (!drawActive) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onDrawCancel?.();
      } else if (e.key === 'Enter' && (drawTool === 'poly' || drawTool === 'stitch') && drawPtsRef.current.length >= (drawTool === 'poly' ? 3 : 2)) {
        e.preventDefault();
        onDrawFinish?.(drawPtsRef.current);
      } else if (e.key === 'Backspace' && (drawTool === 'poly' || drawTool === 'stitch')) {
        e.preventDefault();
        onDrawPts?.(drawPtsRef.current.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawActive, drawTool, onDrawCancel, onDrawFinish, onDrawPts]);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const patternLayerRef = useRef<Konva.Layer | null>(null);
  const cursorRef = useRef<Konva.Circle | null>(null);
  const lastCommittedMask = useRef<string | null>(null);
  const strokeRef = useRef<{ x: number; y: number } | null>(null);

  // eraser strokes of the selected layer: with a layer selected the brush erases only that layer
  const zoneEraseRef = useRef<{ id: string; cv: HTMLCanvasElement; committed: string | undefined } | null>(null);
  const staticLayerRef = useRef<Konva.Layer | null>(null);

  if (!maskCanvasRef.current && typeof document !== 'undefined') {
    const cv = document.createElement('canvas');
    cv.width = CANVAS_TEXTURE_SIZE;
    cv.height = CANVAS_TEXTURE_SIZE;
    maskCanvasRef.current = cv;
  }

  // Keep the offscreen mask in sync when the mask changes from outside (undo/redo, load, clear)
  useEffect(() => {
    const cv = maskCanvasRef.current;
    if (!cv) return;
    if ((patternMask ?? null) === lastCommittedMask.current) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!patternMask) {
      lastCommittedMask.current = null;
      patternLayerRef.current?.batchDraw();
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      lastCommittedMask.current = patternMask;
      patternLayerRef.current?.batchDraw();
    };
    img.src = patternMask;
    return () => {
      cancelled = true;
    };
  }, [patternMask]);

  const paintSegment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const target = zoneEraseRef.current;
    const cv = target?.cv ?? maskCanvasRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx || !brush) return;
    ctx.save();
    if (target) {
      // a layer's mask lives in the layer's own space: undo its move / turn / scale
      const z = templateBundle?.def.zones.find((d) => d.id === target.id);
      const zs = templateBundle?.state.zones[target.id];
      if (z && zs) ctx.setTransform(zoneMatrix(z, zs).inverse());
    }
    ctx.globalCompositeOperation = brush.mode === 'erase' ? 'source-over' : 'destination-out';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = brush.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x + 0.01, to.y);
    ctx.stroke();
    ctx.restore();
    if (zoneEraseRef.current) staticLayerRef.current?.batchDraw();
    else patternLayerRef.current?.batchDraw();
  };

  const pointerInTexture = (stage: Konva.Stage | null) => stage?.getRelativePointerPosition() ?? null;

  const handleBrushDown = (stage: Konva.Stage | null) => {
    const pos = pointerInTexture(stage);
    if (!pos) return;
    strokeRef.current = pos;
    paintSegment(pos, pos);
  };

  const handleBrushMove = (stage: Konva.Stage | null) => {
    const pos = pointerInTexture(stage);
    if (!pos) return;
    if (cursorRef.current) {
      cursorRef.current.position(pos);
      cursorRef.current?.getLayer()?.batchDraw();
    }
    if (strokeRef.current) {
      paintSegment(strokeRef.current, pos);
      strokeRef.current = pos;
    }
  };

  const handleBrushUp = () => {
    if (!strokeRef.current) return;
    strokeRef.current = null;
    const target = zoneEraseRef.current;
    const cv = target?.cv ?? maskCanvasRef.current;
    if (!cv || !(target ? onZoneTransform : onPatternMaskChange)) return;
    // An empty mask is stored as null so projects stay small
    const ctx = cv.getContext('2d');
    const data = ctx?.getImageData(0, 0, cv.width, cv.height).data;
    let hasPaint = false;
    if (data) {
      for (let i = 3; i < data.length; i += 16) {
        if (data[i] > 0) {
          hasPaint = true;
          break;
        }
      }
    }
    const url = hasPaint ? cv.toDataURL('image/png') : null;
    if (target) {
      target.committed = url ?? undefined;
      if (url) preloadImage(url);
      onZoneTransform!(target.id, { erase: url ?? undefined });
      return;
    }
    lastCommittedMask.current = url;
    onPatternMaskChange!(url);
  };

  // ---- Template zone editing: a transformable box over the selected zone ----
  const zoneRectRef = useRef<Konva.Rect | null>(null);
  const zoneTrRef = useRef<Konva.Transformer | null>(null);
  const selectedZone =
    templateBundle && selectedZoneId
      ? templateBundle.def.zones.find((z) => z.id === selectedZoneId) ?? null
      : null;
  const selectedZoneState = selectedZone ? templateBundle!.state.zones[selectedZone.id] : undefined;
  const zBox = selectedZone ? zoneBox(selectedZone) : null;
  // A repeated layer's box covers all its copies: it keeps the first copy's centre as its origin (offset = half the
  // first copy) and grows along the copies by n sizes plus the gaps (the gaps don't scale with the layer, so in the
  // box's own unscaled units a gap is gap / scale).
  const zRepeat = selectedZone && selectedZoneState ? repeatLayout(selectedZone, selectedZoneState) : { n: 1, dir: 'y' as const, gap: 0 };
  // ---- Several layers selected: one upright box around all of them moves / scales / turns them together ----
  const multiZones =
    templateBundle && selectedZoneIds && selectedZoneIds.length > 1
      ? templateBundle.def.zones.filter((z) => selectedZoneIds.includes(z.id))
      : [];
  const multi = multiZones.length > 1;
  const zsOf = (z: KitZoneDef) => templateBundle?.state.zones[z.id] ?? { color: z.defaultColor, visible: z.defaultVisible };
  let multiBox: { cx: number; cy: number; w: number; h: number } | null = null;
  if (multi) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x: number, y: number) => {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    };
    multiZones.forEach((z) => {
      const zs = zsOf(z);
      if (z.rects?.length || z.polygons?.length || z.ellipses?.length) {
        (bakeZone(z, zs, true).polygons ?? []).forEach((p) => p.forEach(([x, y]) => add(x, y)));
      } else {
        // image layer: the corners of its box, moved / turned / scaled
        const b = zoneBox(z);
        const m = zoneMatrix(z, zs);
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
          const p = m.transformPoint(new DOMPoint(b.cx + (sx * b.w) / 2, b.cy + (sy * b.h) / 2));
          add(p.x, p.y);
        });
      }
    });
    if (Number.isFinite(x0)) multiBox = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: Math.max(4, x1 - x0), h: Math.max(4, y1 - y0) };
  }
  const multiRectRef = useRef<Konva.Rect | null>(null);
  const multiTrRef = useRef<Konva.Transformer | null>(null);
  // where everything was when a drag / transform of the shared box started
  const multiStartRef = useRef<{ box: { cx: number; cy: number }; zones: { id: string; cx: number; cy: number; dx: number; dy: number; sx: number; sy: number; rot: number }[] } | null>(null);
  const snapshotMulti = () => {
    if (!multiBox) return;
    multiStartRef.current = {
      box: { cx: multiBox.cx, cy: multiBox.cy },
      zones: multiZones.map((z) => {
        const zs = zsOf(z);
        const b = zoneBox(z);
        return { id: z.id, cx: b.cx, cy: b.cy, dx: zs.dx ?? 0, dy: zs.dy ?? 0, sx: zs.sx ?? 1, sy: zs.sy ?? 1, rot: zs.rot ?? 0 };
      }),
    };
  };
  useEffect(() => {
    if (!multiTrRef.current) return;
    multiTrRef.current.nodes(multi && multiRectRef.current && !locked && !editPoints ? [multiRectRef.current] : []);
    multiTrRef.current.getLayer()?.batchDraw();
  });

  const zBoxSize = zBox
    ? {
        w: zRepeat.dir === 'x' ? zBox.w * zRepeat.n + ((zRepeat.n - 1) * zRepeat.gap) / Math.abs(selectedZoneState?.sx ?? 1) : zBox.w,
        h: zRepeat.dir === 'y' ? zBox.h * zRepeat.n + ((zRepeat.n - 1) * zRepeat.gap) / Math.abs(selectedZoneState?.sy ?? 1) : zBox.h,
      }
    : null;

  // Load the selected layer's eraser mask into a canvas the brush paints on (again after undo / redo)
  const eraseTargetId = brushActive && selectedZone ? selectedZone.id : null;
  const eraseTargetUrl = selectedZoneState?.erase;
  useEffect(() => {
    const cur = zoneEraseRef.current;
    if (cur && cur.id !== eraseTargetId) {
      setLiveErase(cur.id, null);
      zoneEraseRef.current = null;
      staticLayerRef.current?.batchDraw();
    }
    if (!eraseTargetId) return;
    const now = zoneEraseRef.current;
    if (now && now.committed === eraseTargetUrl) return;
    const id = eraseTargetId;
    const cv = now?.cv ?? document.createElement('canvas');
    zoneEraseRef.current = { id, cv, committed: eraseTargetUrl };
    const show = (img?: HTMLImageElement) => {
      cv.width = CANVAS_TEXTURE_SIZE;
      cv.height = CANVAS_TEXTURE_SIZE;
      if (img) cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
      setLiveErase(id, cv);
      staticLayerRef.current?.batchDraw();
    };
    if (!eraseTargetUrl) {
      show();
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => !cancelled && show(img);
    img.src = eraseTargetUrl;
    return () => {
      cancelled = true;
    };
  }, [eraseTargetId, eraseTargetUrl]);
  useEffect(
    () => () => {
      if (zoneEraseRef.current) setLiveErase(zoneEraseRef.current.id, null);
    },
    []
  );

  useEffect(() => {
    if (!zoneTrRef.current) return;
    if (selectedZone && zoneRectRef.current && !locked && !editPoints) {
      zoneTrRef.current.nodes([zoneRectRef.current]);
    } else {
      zoneTrRef.current.nodes([]);
    }
    zoneTrRef.current.getLayer()?.batchDraw();
  }, [selectedZone?.id, locked, editPoints, selectedZoneState]);

  // Single centralized transformer reference
  const trRef = useRef<Konva.Transformer | null>(null);
  const selectedItemForRatio = graphicItems.find((g) => g.id === selectedGraphicId);
  const ratioLocked = selectedItemForRatio ? selectedItemForRatio.lockRatio ?? selectedItemForRatio.type === 'image' : true;

  // Update transformer node safely
  useEffect(() => {
    if (!trRef.current) return;
    if (selectedGraphicId && !isExportingClean) {
      const stage = trRef.current.getStage();
      if (stage) {
        const selectedNode = stage.findOne('#' + selectedGraphicId);
        if (selectedNode) {
          trRef.current.nodes([selectedNode]);
          trRef.current.getLayer()?.batchDraw();
          return;
        }
      }
    }
    trRef.current.nodes([]);
    trRef.current.getLayer()?.batchDraw();
  }, [selectedGraphicId, isExportingClean, graphicItems]);

  // Canvas area (Settings): the kit's square, or the whole panel with the kit centred and the space around it dimmed
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [prefs, setPrefs] = useState({ wide: false, rulers: false });
  useEffect(() => {
    const read = () => setPrefs({ wide: getCanvasArea() === 'wide', rulers: getCanvasRulers() });
    read();
    return onPrefsChange(read);
  }, []);
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setArea({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [prefs.wide]);
  // the kit keeps its size (canvasDisplaySize, smaller only when the panel is); the stage grows around it, in texture px
  // with rulers the kit sits in the space right of / below them (18 CSS px), with a small margin all round
  const rul = prefs.rulers ? 18 : 0;
  const wide = prefs.wide && !!area;
  const boxW = wide ? area!.w : canvasDisplaySize;
  const boxH = wide ? area!.h : canvasDisplaySize;
  const kitSize = wide ? Math.max(100, Math.min(canvasDisplaySize, boxW - rul - 24, boxH - rul - 24)) : canvasDisplaySize - rul;
  const scale = kitSize / CANVAS_TEXTURE_SIZE;
  const stageW = boxW / scale;
  const stageH = boxH / scale;
  const offX = (stageW - CANVAS_TEXTURE_SIZE) / 2 + rul / 2 / scale;
  const offY = (stageH - CANVAS_TEXTURE_SIZE) / 2 + rul / 2 / scale;

  // Solo focus transform when activePartId is not 'all'
  const targetTransform = useMemo(() => {
    if (!viewState.focusPartId) {
      return { x: 0, y: 0, zoom: 1 };
    }
    const part = PES_2021_PARTS.find((p) => p.id === viewState.focusPartId);
    if (!part) return { x: 0, y: 0, zoom: 1 };

    const padding = 40;
    const partW = part.bounds.width + padding * 2;
    const partH = part.bounds.height + padding * 2;
    const zoomX = CANVAS_TEXTURE_SIZE / partW;
    const zoomY = CANVAS_TEXTURE_SIZE / partH;
    const partZoom = Math.min(zoomX, zoomY, 3.2);

    const centerX = part.bounds.x + part.bounds.width / 2;
    const centerY = part.bounds.y + part.bounds.height / 2;

    const x = CANVAS_TEXTURE_SIZE / 2 - centerX * partZoom;
    const y = CANVAS_TEXTURE_SIZE / 2 - centerY * partZoom;

    return { x, y, zoom: partZoom };
  }, [viewState.focusPartId]);

  // Free navigation: wheel = zoom towards the cursor, drag on empty space / a part (or middle button) = pan
  const viewRef = useRef({ vs: viewState, tt: targetTransform, offX, offY });
  viewRef.current = { vs: viewState, tt: targetTransform, offX, offY };
  const stageSizeRef = useRef({ w: stageW, h: stageH });
  stageSizeRef.current = { w: stageW, h: stageH };
  const panRef = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null);
  const justPanned = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onViewChange) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { vs, tt, offX: ox, offY: oy } = viewRef.current;
      const rect = el.getBoundingClientRect();
      // the pointer in stage px, measured from where the kit's square starts
      const { w: sw, h: sh } = stageSizeRef.current;
      const px = ((e.clientX - rect.left) / rect.width) * sw - ox;
      const py = ((e.clientY - rect.top) / rect.height) * sh - oy;
      const zoom = Math.min(8, Math.max(0.4, vs.zoom * Math.exp(-e.deltaY * 0.0015 * zoomFactor())));
      const s1 = tt.zoom * vs.zoom;
      const s2 = tt.zoom * zoom;
      const wx = (px - (tt.x + vs.panX)) / s1;
      const wy = (py - (tt.y + vs.panY)) / s1;
      onViewChange({ zoom, panX: px - wx * s2 - tt.x, panY: py - wy * s2 - tt.y });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onViewChange]);

  useEffect(() => {
    if (!onViewChange) return;
    const onMove = (e: MouseEvent) => {
      const p = panRef.current;
      if (!p) return;
      const dxPx = e.clientX - p.sx;
      const dyPx = e.clientY - p.sy;
      if (!p.moved && Math.hypot(dxPx, dyPx) < 4) return;
      p.moved = true;
      justPanned.current = true;
      onViewChange({ panX: p.px + dxPx / scale, panY: p.py + dyPx / scale });
    };
    const onUp = () => {
      if (!panRef.current) return;
      panRef.current = null;
      // a drag must not count as a click on the part under the cursor
      setTimeout(() => {
        justPanned.current = false;
      }, 0);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onViewChange, scale]);

  /** Dragging a logo, a transformer handle or an edit point must not pan the view. */
  const startPan = (target: Konva.Node, evt: MouseEvent, rightToo = false) => {
    if (!onViewChange || !(evt.button === 0 || evt.button === 1 || (rightToo && evt.button === 2))) return;
    for (let n: Konva.Node | null = target; n; n = n.getParent()) {
      if (n.className === 'Transformer' || (n.draggable && n.draggable())) return;
    }
    const { vs } = viewRef.current;
    panRef.current = { sx: evt.clientX, sy: evt.clientY, px: vs.panX, py: vs.panY, moved: false };
    if (evt.button === 1) evt.preventDefault();
  };

  // Keyboard navigation for selected graphic (Del to remove, arrows to nudge)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedGraphicId) return;

      // Don't intercept when user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const item = graphicItems.find((g) => g.id === selectedGraphicId);
      if (!item) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteGraphic(selectedGraphicId);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onUpdateGraphic({ ...item, y: item.y - (e.shiftKey ? 10 : 1) });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onUpdateGraphic({ ...item, y: item.y + (e.shiftKey ? 10 : 1) });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onUpdateGraphic({ ...item, x: item.x - (e.shiftKey ? 10 : 1) });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onUpdateGraphic({ ...item, x: item.x + (e.shiftKey ? 10 : 1) });
      } else if (e.key === 'Escape') {
        onSelectGraphic(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedGraphicId, graphicItems, onDeleteGraphic, onUpdateGraphic, onSelectGraphic]);

  // Arrow keys nudge the selected template layer(s) too (Shift = 10 px), like a selected logo
  const nudgeTargets = multi ? multiZones : selectedZone ? [selectedZone] : [];
  useEffect(() => {
    if (!nudgeTargets.length || locked || editPoints || selectedGraphicId) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const step = e.shiftKey ? 10 : 1;
      const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const d = move[e.key];
      if (!d) return;
      e.preventDefault();
      nudgeTargets.forEach((z) => {
        const zs = zsOf(z);
        onZoneTransform?.(z.id, { dx: (zs.dx ?? 0) + d[0], dy: (zs.dy ?? 0) + d[1] });
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center overflow-hidden select-none rounded-xl shadow-2xl border border-slate-800 ${
        prefs.wide ? 'w-full flex-1 min-h-0 bg-[#0b0e14]' : 'w-full h-full canvas-checkerboard'
      }`}
      style={
        prefs.wide
          ? undefined
          : {
              width: canvasDisplaySize,
              height: canvasDisplaySize,
              maxHeight: 'calc(100vh - 120px)',
              maxWidth: 'calc(100vh - 120px)',
              aspectRatio: '1/1',
            }
      }
    >
      {prefs.rulers && (
        <CanvasRulers
          w={stageW * scale}
          h={stageH * scale}
          originX={(offX + targetTransform.x + viewState.panX) * scale}
          originY={(offY + targetTransform.y + viewState.panY) * scale}
          pxPerUnit={scale * targetTransform.zoom * viewState.zoom}
        />
      )}
      <Stage
        ref={stageRef}
        width={stageW}
        height={stageH}
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
        scaleX={targetTransform.zoom * viewState.zoom}
        scaleY={targetTransform.zoom * viewState.zoom}
        x={offX + targetTransform.x + viewState.panX}
        y={offY + targetTransform.y + viewState.panY}
        onMouseDown={(e) => {
          // while drawing / erasing only the left button paints; middle or right button pans the view
          if ((drawActive || brushActive) && e.evt.button !== 0) {
            startPan(e.target, e.evt, true);
            return;
          }
          if (drawActive) {
            handleDrawDown(e.target.getStage(), e.evt.shiftKey);
            return;
          }
          if (brushActive) {
            handleBrushDown(e.target.getStage());
            return;
          }
          startPan(e.target, e.evt);
          // Deselect when clicking on empty background
          const clickedOnEmpty = e.target === e.target.getStage() || e.target.hasName('canvas-bg');
          if (clickedOnEmpty) {
            onSelectGraphic(null);
            onSelectZone?.(null);
          }
        }}
        onMouseMove={(e) => {
          if (drawActive) handleDrawMove(e.target.getStage(), e.evt.shiftKey);
          else if (brushActive) handleBrushMove(e.target.getStage());
        }}
        onMouseUp={() => {
          if (drawActive) handleDrawUp();
          else if (brushActive) handleBrushUp();
        }}
        onMouseLeave={() => {
          if (drawActive) handleDrawUp();
          else if (brushActive) handleBrushUp();
        }}
        onContextMenu={(e) => {
          if (drawActive || brushActive) e.evt.preventDefault();
        }}
        onDblClick={(e) => {
          // Konva counts two quick clicks anywhere as a double click; the browser's count needs the same spot
          if (e.evt.button !== 0 || e.evt.detail < 2) return;
          if (drawActive && (drawTool === 'poly' || drawTool === 'stitch') && drawPtsRef.current.length >= (drawTool === 'poly' ? 3 : 2)) {
            onDrawFinish?.(drawPtsRef.current);
          }
        }}
        onTouchStart={(e) => brushActive && handleBrushDown(e.target.getStage())}
        onTouchMove={(e) => brushActive && handleBrushMove(e.target.getStage())}
        onTouchEnd={() => brushActive && handleBrushUp()}
      >
        {/* Layer 1: Kit Parts Base colours (+ imported design as base) */}
        <Layer id="parts-layer" listening={!locked}>
          {/* Base background black canvas for PES 2021 */}
          <Rect
            name="canvas-bg"
            x={0}
            y={0}
            width={CANVAS_TEXTURE_SIZE}
            height={CANVAS_TEXTURE_SIZE}
            fill={templateBundle?.state.background || DEFAULT_BACKGROUND_COLOR}
          />

          {replaceWithImport && (
            <KonvaImage
              image={baseImg}
              x={0}
              y={0}
              width={CANVAS_TEXTURE_SIZE}
              height={CANVAS_TEXTURE_SIZE}
              listening={false}
            />
          )}

          {/* Render each PES 2021 Part */}
          {shapeParts.renderOrder.map((part) => {
            const config = partsConfig[part.id];
            if (!config || !config.visible) return null;

            const isDimmed =
              viewState.activePartId !== 'all' && viewState.activePartId !== part.id;

            return (
              <Group key={part.id} id={`part-wrapper-${part.id}`}>
                {(() => {
                  const box = polygonsBox(partPolygons(part));
                  return (
                    <Group
                      key={`${part.id}-region-0`}
                      id={`part-${part.id}-0`}
                      opacity={isDimmed ? 0.25 : 1}
                      clipFunc={(ctx) => {
                        ctx.beginPath();
                        tracePolygons(ctx, partPolygons(part));
                      }}
                      onMouseEnter={() => setHoveredPartId(part.id)}
                      onMouseLeave={() => setHoveredPartId(null)}
                      onClick={() => {
                        if (justPanned.current) return;
                        onSelectGraphic(null);
                        onSelectPart(part.id);
                      }}
                      onTap={() => {
                        onSelectGraphic(null);
                        onSelectPart(part.id);
                      }}
                    >
                      {/* Part Base Color (an imported design is the base instead; keep an
                          almost-invisible hit area so the piece stays selectable) */}
                      <Rect
                        x={box.x}
                        y={box.y}
                        width={box.width}
                        height={box.height}
                        fill={replaceWithImport && !config.overDesign ? 'rgba(0,0,0,0.01)' : config.color}
                        opacity={replaceWithImport && config.overDesign ? config.overDesignOpacity ?? 1 : 1}
                      />
                      {/* template layers that are part of the base (a PSD's Base layer): under the patterns */}
                      {templateBundle && (!replaceWithImport || config.overDesign) && templateBundle.def.zones.some((z) => z.base) && (
                        <Shape
                          listening={false}
                          sceneFunc={(context) =>
                            drawTemplateForPart((context as any)._context as CanvasRenderingContext2D, part, templateBundle.def, templateBundle.state, config.color, 'base')
                          }
                        />
                      )}
                    </Group>
                  );
                })()}
              </Group>
            );
          })}
        </Layer>

        {/* Layer 1b: Part patterns. Own layer so the eraser mask (destination-out) only cuts
            the patterns and reveals the colour / imported design underneath. */}
        <Layer id="pattern-layer" ref={patternLayerRef} listening={false}>
          {shapeParts.renderOrder.map((part) => {
            const config = partsConfig[part.id];
            if (!config || !config.visible || patternLayersForPart(underPatterns, part.id).length === 0) return null;
            const isDimmed =
              viewState.activePartId !== 'all' && viewState.activePartId !== part.id;
            return (
              <Group key={`pattern-${part.id}`} opacity={isDimmed ? 0.25 : 1} listening={false}>
                <Group
                  clipFunc={(ctx) => {
                    ctx.beginPath();
                    tracePolygons(ctx, partPolygons(part));
                  }}
                  listening={false}
                >
                  <RenderPattern part={part} layers={underPatterns} />
                </Group>
              </Group>
            );
          })}
          {maskCanvasRef.current && (
            <KonvaImage
              image={maskCanvasRef.current}
              x={0}
              y={0}
              width={CANVAS_TEXTURE_SIZE}
              height={CANVAS_TEXTURE_SIZE}
              globalCompositeOperation="destination-out"
              listening={false}
            />
          )}
        </Layer>

        {/* Layer 1c: everything static over the patterns, in one canvas (fewer layers = less memory; Konva warns
            above 5): cuff / hem / collar accents, template zones and seams, fabric texture, imported overlay */}
        <Layer id="static-layer" ref={staticLayerRef} listening={false}>
        <Group id="accent-group" listening={false}>
          {shapeParts.renderOrder.map((part) => {
            const config = partsConfig[part.id];
            if (!config || !config.visible) return null;
            const isDimmed =
              viewState.activePartId !== 'all' && viewState.activePartId !== part.id;
            return (
              <Group key={`accent-${part.id}`} opacity={isDimmed ? 0.25 : 1} listening={false}>
                <Group
                  clipFunc={(ctx) => {
                    ctx.beginPath();
                    tracePolygons(ctx, partPolygons(part));
                  }}
                  listening={false}
                >
                  <RenderAccents part={part} config={config} />
                </Group>
              </Group>
            );
          })}
        </Group>

        {/* template zones + seam / stitch lines (same renderer as the 3D texture) */}
        {templateBundle && (
          <Group id="template-group" listening={false}>
            <Shape
              listening={false}
              sceneFunc={(context) => {
                const c = (context as any)._context as CanvasRenderingContext2D;
                // A blended layer (multiply…) must see the colours and patterns under it, which the 2D view keeps on
                // other canvases: then draw the whole kit up to the template here, exactly like the 3D texture (the
                // fabric and an overlaid design still come after, from this layer). Not while one part is focused:
                // the other parts are dimmed on the lower canvases only.
                const blended = templateBundle.def.zones.some(
                  (z) => z.blend && !z.base && !z.clipTo && templateBundle.state.zones[z.id]?.visible
                );
                if (blended && viewState.activePartId === 'all') {
                  const replace = baseTexture?.mode === 'replace' ? baseTexture : null;
                  const kit = renderKitCanvas(partsConfig, [], undefined, false, CANVAS_TEXTURE_SIZE, undefined, replace, patternMask, templateBundle);
                  if (kit) {
                    c.drawImage(kit, 0, 0, CANVAS_TEXTURE_SIZE, CANVAS_TEXTURE_SIZE);
                    return;
                  }
                }
                shapeParts.renderOrder.forEach((part) => {
                  const cfg = partsConfig[part.id];
                  if (!cfg || !cfg.visible) return;
                  drawTemplateForPart(c, part, templateBundle.def, templateBundle.state, cfg.color, 'top');
                });
              }}
            />
          </Group>
        )}

        {/* fabric texture on top of colours, patterns and zones (same renderer as the 3D texture) */}
        {fabricConfig && (
          <Group id="fabric-group" listening={false}>
            <Shape
              listening={false}
              sceneFunc={(context) => {
                const c = (context as any)._context as CanvasRenderingContext2D;
                shapeParts.renderOrder.forEach((part) => {
                  const cfg = partsConfig[part.id];
                  if (!cfg || !cfg.visible) return;
                  c.save();
                  c.beginPath();
                  tracePolygons(c, partPolygons(part));
                  c.clip();
                  drawFabricForPart(c, part, fabricConfig);
                  c.restore();
                });
              }}
            />
          </Group>
        )}

        {/* imported design drawn over the parts */}
        {baseTexture && baseTexture.mode === 'overlay' && baseImg && (
          <Group id="import-overlay-group" opacity={baseTexture.opacity} listening={false}>
            <KonvaImage
              image={baseImg}
              x={0}
              y={0}
              width={CANVAS_TEXTURE_SIZE}
              height={CANVAS_TEXTURE_SIZE}
              listening={false}
            />
          </Group>
        )}
          {/* Original PES template overlay (toggleable) */}
          {viewState.showOriginalTemplate && templateImg && (
            <Group id="template-overlay-group" opacity={viewState.templateOpacity}>
              <KonvaImage
                image={templateImg}
                x={0}
                y={0}
                width={CANVAS_TEXTURE_SIZE}
                height={CANVAS_TEXTURE_SIZE}
                listening={false}
              />
            </Group>
          )}
        </Layer>


        {/* Layer 3: Graphics, Badges, and Logos Layer */}
        <Layer id="graphics-layer" listening={!locked}>
          {graphicItems
            .filter((item) => item.visible !== false)
            .map((item) => (
              <InteractiveGraphicItem
                key={item.id}
                item={item}
                isSelected={selectedGraphicId === item.id}
                onSelect={() => onSelectGraphic(item.id)}
                onChange={onUpdateGraphic}
              />
            ))}

          {/* Player markings (name & number preview) share this layer: Konva warns above 5 layers */}
          <PlayerMarkingsLayer
            markings={markings}
            isExportingClean={isExportingClean}
          />

          {/* Centralized Transformer: never defaults to (0,0) */}
          {!isExportingClean && (
            <Transformer
              ref={trRef}
              keepRatio={ratioLocked}
              rotationSnaps={rotationSnaps}
              rotationSnapTolerance={7.5}
              enabledAnchors={
                ratioLocked
                  ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
                  : ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']
              }
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 12 || newBox.height < 12) {
                  return oldBox;
                }
                return newBox;
              }}
              anchorFill="#0284c7"
              anchorStroke="#ffffff"
              anchorStrokeWidth={1.5}
              anchorSize={8}
              anchorCornerRadius={2}
              borderStroke="#38bdf8"
              borderStrokeWidth={1.5}
              borderDash={[4, 4]}
              rotateAnchorOffset={20}
            />
          )}
        </Layer>

        {/* Layer 5: Seams, Wireframe, & Part Outlines */}
        {!isExportingClean && (
          <Layer id="wireframe-guide-layer">{/* also holds the zone editor, drawing, point editing and brush cursor */}
            {PES_2021_PARTS.map((part) => {
              const isHovered = hoveredPartId === part.id;
              const isSelected = viewState.activePartId === part.id;

              return (
                <Group key={`wireframe-${part.id}`}>
                  {/* Part Seam Outline */}
                  {viewState.showWireframe && (
                    <>
                      <Path
                        data={part.clipPathSvg}
                        stroke={
                          isSelected
                            ? '#38bdf8'
                            : isHovered
                            ? '#facc15'
                            : viewState.wireframeColor
                        }
                        strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1.2}
                        dash={isSelected ? undefined : [6, 4]}
                        opacity={
                          isSelected
                            ? 1
                            : isHovered
                            ? 0.95
                            : viewState.wireframeOpacity
                        }
                        listening={false}
                      />
                      {part.innerGuides?.map((guide, idx) => (
                        <Path
                          key={`inner-guide-${part.id}-${idx}`}
                          data={guide}
                          stroke={isSelected ? '#38bdf8' : viewState.wireframeColor}
                          strokeWidth={1}
                          dash={[3, 3]}
                          opacity={
                            isSelected
                              ? 0.8
                              : viewState.wireframeOpacity * 0.6
                          }
                          listening={false}
                        />
                      ))}
                    </>
                  )}

                  {/* Highlight outline when hovered or selected */}
                  {(isHovered || isSelected) && (
                    <Path
                      data={part.clipPathSvg}
                      stroke={isSelected ? '#0284c7' : '#eab308'}
                      strokeWidth={1.5}
                      dash={[4, 4]}
                      listening={false}
                      opacity={0.8}
                    />
                  )}

                  {/* Part Label Tag */}
                  {viewState.showPartLabels && (
                    <Group
                      x={part.bounds.x + 8}
                      y={part.bounds.y + 8}
                      listening={false}
                    >
                      <Rect
                        width={part.name.length * 7.5 + 16}
                        height={20}
                        fill="rgba(15, 23, 42, 0.85)"
                        cornerRadius={4}
                        stroke={isSelected ? '#38bdf8' : '#334155'}
                        strokeWidth={1}
                      />
                      <Text
                        x={8}
                        y={4}
                        text={part.name}
                        fontSize={11}
                        fontFamily="system-ui, sans-serif"
                        fontStyle="bold"
                        fill={isSelected ? '#38bdf8' : '#e2e8f0'}
                      />
                    </Group>
                  )}
                </Group>
              );
            })}
        {/* Template zone editor: drag to move, corner handles to resize, top handle to rotate */}
        {/* Several layers selected: one box moves / scales (keeping proportions) / turns them all around its centre */}
        {multi && multiBox && !isExportingClean && !locked && !editPoints && (
          <Group id="multi-edit-group">
            <Rect
              ref={multiRectRef}
              x={multiBox.cx}
              y={multiBox.cy}
              offsetX={multiBox.w / 2}
              offsetY={multiBox.h / 2}
              width={multiBox.w}
              height={multiBox.h}
              fill="rgba(56,189,248,0.08)"
              stroke="#38bdf8"
              strokeWidth={1.5}
              strokeScaleEnabled={false}
              dash={[6, 4]}
              draggable
              onDragStart={(e) => {
                lockStart(e);
                snapshotMulti();
              }}
              onDragMove={(e) => {
                lockAxis(e);
                const s = multiStartRef.current;
                if (!s) return;
                const ddx = e.target.x() - s.box.cx;
                const ddy = e.target.y() - s.box.cy;
                s.zones.forEach((z) => onZoneTransform?.(z.id, { dx: Math.round(z.dx + ddx), dy: Math.round(z.dy + ddy) }));
              }}
              onTransformStart={snapshotMulti}
              onTransformEnd={(e) => {
                const node = e.target;
                const s = multiStartRef.current;
                if (!s) return;
                const k = node.scaleX();
                const turn = node.rotation();
                const a = (turn * Math.PI) / 180;
                // each layer's centre turns and scales about the box centre; its own size and angle follow
                s.zones.forEach((z) => {
                  const px = z.cx + z.dx - s.box.cx;
                  const py = z.cy + z.dy - s.box.cy;
                  const nx = node.x() + k * (px * Math.cos(a) - py * Math.sin(a));
                  const ny = node.y() + k * (px * Math.sin(a) + py * Math.cos(a));
                  onZoneTransform?.(z.id, {
                    dx: Math.round(nx - z.cx),
                    dy: Math.round(ny - z.cy),
                    sx: Math.round(z.sx * k * 1000) / 1000,
                    sy: Math.round(z.sy * k * 1000) / 1000,
                    rot: Math.round((z.rot + turn) * 10) / 10,
                  });
                });
                // the box is rebuilt around the result, upright
                node.scale({ x: 1, y: 1 });
                node.rotation(0);
              }}
            />
            <Transformer
              ref={multiTrRef}
              rotateEnabled
              rotationSnaps={rotationSnaps}
              rotationSnapTolerance={7.5}
              keepRatio
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
              anchorFill="#0284c7"
              anchorStroke="#ffffff"
              anchorSize={9}
              borderStroke="#38bdf8"
              rotateAnchorOffset={24}
              boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 6 || Math.abs(newBox.height) < 6 ? oldBox : newBox)}
            />
          </Group>
        )}
        {selectedZone && selectedZoneState && zBox && zBoxSize && !multi && !isExportingClean && !locked && !editPoints && (
          <Group id="zone-edit-group">
            <Rect
              ref={zoneRectRef}
              x={zBox.cx + (selectedZoneState.dx ?? 0)}
              y={zBox.cy + (selectedZoneState.dy ?? 0)}
              offsetX={zBox.w / 2}
              offsetY={zBox.h / 2}
              width={zBoxSize.w}
              height={zBoxSize.h}
              scaleX={selectedZoneState.sx ?? 1}
              scaleY={selectedZoneState.sy ?? 1}
              rotation={selectedZoneState.rot ?? 0}
              fill="rgba(56,189,248,0.10)"
              stroke="#38bdf8"
              strokeWidth={1.5}
              strokeScaleEnabled={false}
              dash={[6, 4]}
              draggable
              onDragStart={lockStart}
              onDragMove={(e) => {
                lockAxis(e);
                onZoneTransform?.(selectedZone.id, {
                  dx: Math.round(e.target.x() - zBox.cx),
                  dy: Math.round(e.target.y() - zBox.cy),
                });
              }}
              onTransformEnd={(e) => {
                const node = e.target;
                let sx = node.scaleX();
                let sy = node.scaleY();
                let x = node.x();
                let y = node.y();
                const { n, dir, gap } = zRepeat;
                if (n > 1) {
                  // the box is n copies + gaps long: the scale of one copy keeps the gaps as they are, and the first
                  // copy's centre moves so the edge of the box that was not dragged stays put
                  const base = dir === 'y' ? zBox.h : zBox.w;
                  const s = dir === 'y' ? sy : sx;
                  const len = (dir === 'y' ? node.height() : node.width()) * Math.abs(s);
                  const one = (Math.sign(s) || 1) * Math.max(0.02, (len - (n - 1) * gap) / (n * base));
                  const shift = (base * (Math.abs(one) - Math.abs(s))) / 2;
                  const a = (node.rotation() * Math.PI) / 180;
                  const [ux, uy] = dir === 'y' ? [-Math.sin(a), Math.cos(a)] : [Math.cos(a), Math.sin(a)];
                  x += ux * shift;
                  y += uy * shift;
                  if (dir === 'y') sy = one;
                  else sx = one;
                }
                onZoneTransform?.(selectedZone.id, {
                  dx: Math.round(x - zBox.cx),
                  dy: Math.round(y - zBox.cy),
                  sx: Math.round(sx * 1000) / 1000,
                  sy: Math.round(sy * 1000) / 1000,
                  rot: Math.round(node.rotation() * 10) / 10,
                });
              }}
            />
            <Transformer
              ref={zoneTrRef}
              rotateEnabled
              rotationSnaps={rotationSnaps}
              rotationSnapTolerance={7.5}
              keepRatio={false}
              anchorFill="#0284c7"
              anchorStroke="#ffffff"
              anchorSize={9}
              borderStroke="#38bdf8"
              rotateAnchorOffset={24}
              boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 6 || Math.abs(newBox.height) < 6 ? oldBox : newBox)}
            />
          </Group>
        )}

        {/* New layer being drawn */}
        {drawActive && (
          <Group id="draw-group" listening={false}>
            {drawPts.length > 1 && (
              <Line
                points={drawPts.flat()}
                stroke="#38bdf8"
                strokeWidth={2}
                strokeScaleEnabled={false}
                dash={drawTool === 'poly' || drawTool === 'stitch' ? [6, 4] : undefined}
                closed={drawTool === 'free'}
                tension={drawTool === 'stitch' && drawCurve ? SEAM_CURVE_TENSION : 0}
                fill={drawTool === 'free' ? 'rgba(56,189,248,0.15)' : undefined}
                lineJoin="round"
              />
            )}
            {(drawTool === 'poly' || drawTool === 'stitch') &&
              drawPts.map((p, i) => (
                <Circle
                  key={i}
                  x={p[0]}
                  y={p[1]}
                  radius={(i === 0 && drawTool === 'poly' ? 7 : 4) / Math.max(0.3, targetTransform.zoom * viewState.zoom)}
                  fill={i === 0 && drawTool === 'poly' ? '#f43f5e' : '#38bdf8'}
                  stroke="#ffffff"
                  strokeWidth={1}
                  strokeScaleEnabled={false}
                />
              ))}
          </Group>
        )}

        {/* Point editing of the selected layer: drag points, click a "+" to add, right-click to remove */}
        {editPoints && selectedZone?.polygons && !locked && !isExportingClean && (
          <Group id="zone-points-group">
            {selectedZone.polygons.map((poly, pi) => {
              const zoomK = Math.max(0.3, targetTransform.zoom * viewState.zoom);
              return (
                <React.Fragment key={pi}>
                  <Line
                    points={poly.flat()}
                    closed
                    stroke="#38bdf8"
                    strokeWidth={1.5}
                    strokeScaleEnabled={false}
                    listening={false}
                  />
                  {poly.map((p, i) => {
                    const q = poly[(i + 1) % poly.length];
                    // no "+" on a side too short to tell it from its points (screen px)
                    if (Math.hypot(q[0] - p[0], q[1] - p[1]) * zoomK < 26) return null;
                    return (
                      <Circle
                        key={`m-${i}`}
                        x={(p[0] + q[0]) / 2}
                        y={(p[1] + q[1]) / 2}
                        radius={5 / zoomK}
                        hitStrokeWidth={8}
                        fill="rgba(15,23,42,0.85)"
                        stroke="#38bdf8"
                        strokeWidth={1}
                        strokeScaleEnabled={false}
                        onClick={() =>
                          onZonePointInsert?.(selectedZone.id, pi, i, [
                            Math.round(((p[0] + q[0]) / 2) * 10) / 10,
                            Math.round(((p[1] + q[1]) / 2) * 10) / 10,
                          ])
                        }
                      />
                    );
                  })}
                  {poly.map((p, i) => (
                    <Circle
                      key={`p-${i}`}
                      x={p[0]}
                      y={p[1]}
                      radius={8 / zoomK}
                      // a wider invisible ring around the point is still a hit, so it is easy to grab
                      hitStrokeWidth={10}
                      fill="#0284c7"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      strokeScaleEnabled={false}
                      draggable
                      onDragStart={lockStart}
                      onDragMove={(e) => {
                        lockAxis(e);
                        onZonePointMove?.(selectedZone.id, pi, i, [
                          Math.round(e.target.x() * 10) / 10,
                          Math.round(e.target.y() * 10) / 10,
                        ]);
                      }}
                      onContextMenu={(e) => {
                        e.evt.preventDefault();
                        onZonePointRemove?.(selectedZone.id, pi, i);
                      }}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </Group>
        )}

        {/* Point editing of a stitch line: drag points, click a "+" to add, right-click to remove */}
        {(() => {
          if (!editSeam || locked || isExportingClean || !templateBundle) return null;
          const seams = templateBundle.def.seams ?? [];
          const idx = seams.findIndex((s, i) => (s.id ?? `seam-${i}`) === editSeam);
          if (idx < 0) return null;
          const pts = seams[idx].points;
          const zoomK = Math.max(0.3, targetTransform.zoom * viewState.zoom);
          const round = (v: number) => Math.round(v * 10) / 10;
          return (
            <Group id="seam-points-group">
              <Line
                points={pts.flat()}
                stroke="#f472b6"
                strokeWidth={1.5}
                dash={[6, 4]}
                tension={seams[idx].smooth ? SEAM_CURVE_TENSION : 0}
                strokeScaleEnabled={false}
                listening={false}
              />
              {pts.slice(0, -1).map((p, i) => {
                const q = pts[i + 1];
                if (Math.hypot(q[0] - p[0], q[1] - p[1]) * zoomK < 26) return null;
                return (
                  <Circle
                    key={`sm-${i}`}
                    x={(p[0] + q[0]) / 2}
                    y={(p[1] + q[1]) / 2}
                    radius={5 / zoomK}
                    hitStrokeWidth={8}
                    fill="rgba(15,23,42,0.85)"
                    stroke="#f472b6"
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    onClick={() => onSeamPointInsert?.(editSeam, i, [round((p[0] + q[0]) / 2), round((p[1] + q[1]) / 2)])}
                  />
                );
              })}
              {pts.map((p, i) => (
                <Circle
                  key={`sp-${i}`}
                  x={p[0]}
                  y={p[1]}
                  radius={8 / zoomK}
                  hitStrokeWidth={10}
                  fill="#db2777"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  strokeScaleEnabled={false}
                  draggable
                  onDragStart={lockStart}
                  onDragMove={(e) => {
                    lockAxis(e);
                    onSeamPointMove?.(editSeam, i, [round(e.target.x()), round(e.target.y())]);
                  }}
                  onContextMenu={(e) => {
                    e.evt.preventDefault();
                    onSeamPointRemove?.(editSeam, i);
                  }}
                />
              ))}
            </Group>
          );
        })()}

        {/* Brush cursor */}
        {brushActive && brush && (
          <Group listening={false}>
            <Circle
              ref={cursorRef}
              x={-1000}
              y={-1000}
              radius={brush.size / 2}
              stroke={brush.mode === 'erase' ? '#f43f5e' : '#38bdf8'}
              strokeWidth={2}
              dash={[6, 4]}
              listening={false}
            />
          </Group>
        )}
          </Layer>
        )}
        {traceGuide && guideImg && !isExportingClean && (
          <Layer listening={false} opacity={traceGuide.opacity}>
            <KonvaImage image={guideImg} x={0} y={0} width={CANVAS_TEXTURE_SIZE} height={CANVAS_TEXTURE_SIZE} listening={false} />
          </Layer>
        )}
        {prefs.wide && (
          // outside the kit's square: dimmed (it is not in the texture), with a thin line along the kit's edge
          <Layer listening={false}>
            <Shape
              sceneFunc={(ctx, shape) => {
                const S = CANVAS_TEXTURE_SIZE;
                ctx.beginPath();
                ctx.rect(-20000, -20000, 40000 + S, 40000 + S);
                ctx.rect(0, 0, S, S);
                ctx.fillStyle = 'rgba(11,14,20,0.72)';
                ctx.fill('evenodd');
                ctx.strokeStyle = 'rgba(148,163,184,0.5)';
                ctx.lineWidth = 1 / (shape.getStage()?.scaleX() || 1);
                ctx.strokeRect(0, 0, S, S);
              }}
            />
          </Layer>
        )}
      </Stage>
    </div>
  );
};

export default KitCanvas;
