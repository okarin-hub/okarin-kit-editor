'use client';

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
import { drawPatternLayersForPart, patternLayersForPart } from '@/utils/patternRenderer';
import { subscribeAssets } from '@/utils/imageCache';
import { drawTemplateForPart, SEAM_CURVE_TENSION } from '@/utils/templateRenderer';
import { zoneBox } from '@/utils/zoneGeometry';
import { drawCreditText } from '@/utils/creditRenderer';
import { drawFabricForPart } from '@/utils/fabricRenderer';
import { partPolygons, tracePolygons, polygonsBox } from '@/utils/partShape';
import {
  KitPartId,
  KitPartConfig,
  KitPartDefinition,
  CanvasViewState,
  KitGraphicItem,
  PlayerMarkingsConfig,
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
  markings: PlayerMarkingsConfig;
  baseTexture?: BaseTexture | null;
  patternMask?: string | null;
  templateBundle?: TemplateBundle | null;
  fabricConfig?: FabricConfig;
  selectedZoneId?: string | null;
  onSelectZone?: (zoneId: string | null) => void;
  onZoneTransform?: (zoneId: string, patch: Partial<TemplateZoneState>) => void;
  drawTool?: 'free' | 'poly' | 'stitch' | 'stitchFree' | null;
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
  onPatternMaskChange?: (dataUrl: string | null) => void;
  brush?: PatternBrushState;
  isExportingClean?: boolean;
  stageRef: React.RefObject<Konva.Stage | null>;
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
  onPatternMaskChange,
  brush,
  isExportingClean = false,
  stageRef,
  canvasDisplaySize,
}) => {
  // Part shapes for the chosen sleeve length
  const shapeParts = partsForSleeveShape(templateBundle?.state.sleeveShape);
  // Imported finished design (replaces or overlays the generated parts)
  const [baseImg] = useImage(baseTexture?.src ?? '', 'anonymous');
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

  const handleDrawDown = (stage: Konva.Stage | null) => {
    const pos = stage?.getRelativePointerPosition();
    if (!pos || !drawTool) return;
    const pt: Pt = [Math.round(pos.x * 10) / 10, Math.round(pos.y * 10) / 10];
    if (drawTool === 'free' || drawTool === 'stitchFree') {
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
    if (last && Math.hypot(last[0] - pt[0], last[1] - pt[1]) < 3) return;
    onDrawPts?.([...pts, pt]);
  };

  const handleDrawMove = (stage: Konva.Stage | null) => {
    if (!(drawTool === 'free' || drawTool === 'stitchFree') || !freeDrawing.current) return;
    const pos = stage?.getRelativePointerPosition();
    if (!pos) return;
    const pts = drawPtsRef.current;
    const last = pts[pts.length - 1];
    if (last && Math.hypot(last[0] - pos.x, last[1] - pos.y) < 2.5) return;
    onDrawPts?.([...pts, [Math.round(pos.x * 10) / 10, Math.round(pos.y * 10) / 10]]);
  };

  const handleDrawUp = () => {
    if (!(drawTool === 'free' || drawTool === 'stitchFree') || !freeDrawing.current) return;
    freeDrawing.current = false;
    const pts = drawPtsRef.current;
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
  const cursorLayerRef = useRef<Konva.Layer | null>(null);
  const cursorRef = useRef<Konva.Circle | null>(null);
  const lastCommittedMask = useRef<string | null>(null);
  const strokeRef = useRef<{ x: number; y: number } | null>(null);

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
    const cv = maskCanvasRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx || !brush) return;
    ctx.save();
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
    patternLayerRef.current?.batchDraw();
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
      cursorLayerRef.current?.batchDraw();
    }
    if (strokeRef.current) {
      paintSegment(strokeRef.current, pos);
      strokeRef.current = pos;
    }
  };

  const handleBrushUp = () => {
    if (!strokeRef.current) return;
    strokeRef.current = null;
    const cv = maskCanvasRef.current;
    if (!cv || !onPatternMaskChange) return;
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
    lastCommittedMask.current = url;
    onPatternMaskChange(url);
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

  // Compute view transform (zoom & center)
  const scale = canvasDisplaySize / CANVAS_TEXTURE_SIZE;

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef({ vs: viewState, tt: targetTransform });
  viewRef.current = { vs: viewState, tt: targetTransform };
  const panRef = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null);
  const justPanned = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onViewChange) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { vs, tt } = viewRef.current;
      const rect = el.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * CANVAS_TEXTURE_SIZE;
      const py = ((e.clientY - rect.top) / rect.height) * CANVAS_TEXTURE_SIZE;
      const zoom = Math.min(8, Math.max(0.4, vs.zoom * Math.exp(-e.deltaY * 0.0015)));
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
  const startPan = (target: Konva.Node, evt: MouseEvent) => {
    if (!onViewChange || (evt.button !== 0 && evt.button !== 1)) return;
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

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center w-full h-full overflow-hidden select-none canvas-checkerboard rounded-xl shadow-2xl border border-slate-800"
      style={{
        width: canvasDisplaySize,
        height: canvasDisplaySize,
        maxHeight: 'calc(100vh - 120px)',
        maxWidth: 'calc(100vh - 120px)',
        aspectRatio: '1/1',
      }}
    >
      <Stage
        ref={stageRef}
        width={CANVAS_TEXTURE_SIZE}
        height={CANVAS_TEXTURE_SIZE}
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
        scaleX={targetTransform.zoom * viewState.zoom}
        scaleY={targetTransform.zoom * viewState.zoom}
        x={targetTransform.x + viewState.panX}
        y={targetTransform.y + viewState.panY}
        onMouseDown={(e) => {
          if (drawActive) {
            handleDrawDown(e.target.getStage());
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
          if (drawActive) handleDrawMove(e.target.getStage());
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
        onDblClick={() => {
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
            if (!config || !config.visible || patternLayersForPart(templateBundle?.state.patterns, part.id).length === 0) return null;
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
                  <RenderPattern part={part} layers={templateBundle?.state.patterns ?? []} />
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

        {/* Layer 1c: cuff / hem / collar accents (drawn over patterns, like the texture generator) */}
        <Layer id="accent-layer" listening={false}>
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
        </Layer>

        {/* Layer 1d: template zones + seam / stitch lines (same renderer as the 3D texture) */}
        {templateBundle && (
          <Layer id="template-layer" listening={false}>
            <Shape
              listening={false}
              sceneFunc={(context) => {
                const c = (context as any)._context as CanvasRenderingContext2D;
                shapeParts.renderOrder.forEach((part) => {
                  const cfg = partsConfig[part.id];
                  if (!cfg || !cfg.visible) return;
                  drawTemplateForPart(c, part, templateBundle.def, templateBundle.state, cfg.color);
                });
              }}
            />
          </Layer>
        )}

        {/* Layer 1e: fabric texture on top of colours, patterns and zones (same renderer as the 3D texture) */}
        {fabricConfig && (
          <Layer id="fabric-layer" listening={false}>
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
          </Layer>
        )}

        {/* Imported design drawn over the parts */}
        {baseTexture && baseTexture.mode === 'overlay' && baseImg && (
          <Layer id="import-overlay-layer" opacity={baseTexture.opacity} listening={false}>
            <KonvaImage
              image={baseImg}
              x={0}
              y={0}
              width={CANVAS_TEXTURE_SIZE}
              height={CANVAS_TEXTURE_SIZE}
              listening={false}
            />
          </Layer>
        )}

        {/* Layer 2: Original Template Overlay (Toggleable) */}
        {viewState.showOriginalTemplate && templateImg && (
          <Layer id="template-overlay-layer" opacity={viewState.templateOpacity}>
            <KonvaImage
              image={templateImg}
              x={0}
              y={0}
              width={CANVAS_TEXTURE_SIZE}
              height={CANVAS_TEXTURE_SIZE}
              listening={false}
            />
          </Layer>
        )}

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

          {/* Centralized Transformer: never defaults to (0,0) */}
          {!isExportingClean && (
            <Transformer
              ref={trRef}
              keepRatio={ratioLocked}
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

        {/* Layer 4: Player Markings (Nama & Nomor Punggung - Preview or Optional Export) */}
        <Layer id="markings-layer">
          <PlayerMarkingsLayer
            markings={markings}
            isExportingClean={isExportingClean}
          />
        </Layer>

        {/* Layer 5: Seams, Wireframe, & Part Outlines */}
        {!isExportingClean && (
          <Layer id="wireframe-guide-layer">
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
          </Layer>
        )}
        {/* Template zone editor: drag to move, corner handles to resize, top handle to rotate */}
        {selectedZone && selectedZoneState && zBox && !isExportingClean && !locked && !editPoints && (
          <Layer id="zone-edit-layer">
            <Rect
              ref={zoneRectRef}
              x={zBox.cx + (selectedZoneState.dx ?? 0)}
              y={zBox.cy + (selectedZoneState.dy ?? 0)}
              offsetX={zBox.w / 2}
              offsetY={zBox.h / 2}
              width={zBox.w}
              height={zBox.h}
              scaleX={selectedZoneState.sx ?? 1}
              scaleY={selectedZoneState.sy ?? 1}
              rotation={selectedZoneState.rot ?? 0}
              fill="rgba(56,189,248,0.10)"
              stroke="#38bdf8"
              strokeWidth={1.5}
              strokeScaleEnabled={false}
              dash={[6, 4]}
              draggable
              onDragMove={(e) =>
                onZoneTransform?.(selectedZone.id, {
                  dx: Math.round(e.target.x() - zBox.cx),
                  dy: Math.round(e.target.y() - zBox.cy),
                })
              }
              onTransformEnd={(e) => {
                const node = e.target;
                onZoneTransform?.(selectedZone.id, {
                  dx: Math.round(node.x() - zBox.cx),
                  dy: Math.round(node.y() - zBox.cy),
                  sx: Math.round(node.scaleX() * 1000) / 1000,
                  sy: Math.round(node.scaleY() * 1000) / 1000,
                  rot: Math.round(node.rotation() * 10) / 10,
                });
              }}
            />
            <Transformer
              ref={zoneTrRef}
              rotateEnabled
              keepRatio={false}
              anchorFill="#0284c7"
              anchorStroke="#ffffff"
              anchorSize={9}
              borderStroke="#38bdf8"
              rotateAnchorOffset={24}
              boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 6 || Math.abs(newBox.height) < 6 ? oldBox : newBox)}
            />
          </Layer>
        )}

        {/* New layer being drawn */}
        {drawActive && (
          <Layer id="draw-layer" listening={false}>
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
          </Layer>
        )}

        {/* Point editing of the selected layer: drag points, click a "+" to add, right-click to remove */}
        {editPoints && selectedZone?.polygons && !locked && !isExportingClean && (
          <Layer id="zone-points-layer">
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
                    return (
                      <Circle
                        key={`m-${i}`}
                        x={(p[0] + q[0]) / 2}
                        y={(p[1] + q[1]) / 2}
                        radius={3.5 / zoomK}
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
                      radius={5.5 / zoomK}
                      fill="#0284c7"
                      stroke="#ffffff"
                      strokeWidth={1.2}
                      strokeScaleEnabled={false}
                      draggable
                      onDragMove={(e) =>
                        onZonePointMove?.(selectedZone.id, pi, i, [
                          Math.round(e.target.x() * 10) / 10,
                          Math.round(e.target.y() * 10) / 10,
                        ])
                      }
                      onContextMenu={(e) => {
                        e.evt.preventDefault();
                        onZonePointRemove?.(selectedZone.id, pi, i);
                      }}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </Layer>
        )}

        {/* Brush cursor */}
        {brushActive && brush && (
          <Layer ref={cursorLayerRef} listening={false}>
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
          </Layer>
        )}
      </Stage>
    </div>
  );
};

export default KitCanvas;
