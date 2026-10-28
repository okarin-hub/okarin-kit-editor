'use client';

import React, { useState, useEffect } from 'react';
import {
  KitPartId,
  KitPartConfig,
  CanvasViewState,
  KitGraphicItem,
  PlayerMarkingsConfig,
  BaseTexture,
  PatternBrushState,
  TemplateBundle,
  FabricConfig,
  TemplateZoneState,
  Pt,
} from '@/types/kit';
import type Konva from 'konva';

interface KitCanvasWrapperProps {
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
  onSelectZone?: (zoneId: string | null) => void;
  onZoneTransform?: (zoneId: string, patch: Partial<TemplateZoneState>) => void;
  onPatternMaskChange?: (dataUrl: string | null) => void;
  brush?: PatternBrushState;
  isExportingClean?: boolean;
  stageRef: React.RefObject<Konva.Stage | null>;
  canvasDisplaySize: number;
}

export const KitCanvasWrapper: React.FC<KitCanvasWrapperProps> = (props) => {
  const [CanvasComponent, setCanvasComponent] = useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    import('./KitCanvas')
      .then((mod) => {
        if (isMounted) {
          setCanvasComponent(() => mod.default);
        }
      })
      .catch((err) => {
        console.error('Failed to load KitCanvas dynamically:', err);
        if (isMounted) {
          setError(String(err));
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-[600px] bg-red-950/40 rounded-xl border border-red-800 text-red-300 p-4 gap-2">
        <span className="font-bold text-sm">Gagal memuat Canvas 2D:</span>
        <span className="text-xs font-mono">{error}</span>
      </div>
    );
  }

  if (!CanvasComponent) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-[600px] bg-slate-900/60 rounded-xl border border-slate-800 text-slate-400 gap-3">
        <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium tracking-wide">
          Memuat Canvas 2D PES 2021...
        </span>
      </div>
    );
  }

  return <CanvasComponent {...props} />;
};

export default KitCanvasWrapper;
