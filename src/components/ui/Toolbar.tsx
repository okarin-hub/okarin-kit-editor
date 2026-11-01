'use client';

import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, Box, Layout, Columns, X } from 'lucide-react';
import { CanvasViewState, KitPartId } from '@/types/kit';
import { PART_MAP, PES_2021_PARTS } from '@/constants/pes2021Parts';

export type WorkspaceViewMode = '2d' | '3d' | 'split';

interface ToolbarProps {
  viewState: CanvasViewState;
  setViewState: React.Dispatch<React.SetStateAction<CanvasViewState>>;
  onResetSolo: () => void;
  viewMode: WorkspaceViewMode;
  setViewMode: (mode: WorkspaceViewMode) => void;
  onFocusPart: (partId: KitPartId) => void;
}

/** Strip above the workspace: view mode (2D / Split / 3D), the focused part and the zoom. */
export const Toolbar: React.FC<ToolbarProps> = ({ viewState, setViewState, onResetSolo, viewMode, setViewMode, onFocusPart }) => {
  const activePart = viewState.activePartId !== 'all' ? PART_MAP[viewState.activePartId] : null;

  const modes: { id: WorkspaceViewMode; label: string; icon: React.ReactNode }[] = [
    { id: '2d', label: '2D', icon: <Layout className="w-3.5 h-3.5" /> },
    { id: 'split', label: 'Split', icon: <Columns className="w-3.5 h-3.5" /> },
    { id: '3d', label: '3D', icon: <Box className="w-3.5 h-3.5" /> },
  ];

  const zoomBy = (delta: number) =>
    setViewState((prev) => ({
      ...prev,
      zoom: Math.min(8, Math.max(0.4, +(prev.zoom + delta).toFixed(2))),
    }));

  return (
    <div className="relative z-30 h-10 shrink-0 border-b border-slate-800 bg-[#161a26]/90 backdrop-blur px-3 flex items-center gap-2 text-xs text-slate-300 select-none">
      {/* View mode (2D / Split / 3D) */}
      <div className="flex items-center bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg shrink-0" role="group" aria-label="Tampilan">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setViewMode(m.id)}
            aria-pressed={viewMode === m.id}
            title={m.id === '2d' ? 'Hanya canvas 2D' : m.id === '3d' ? 'Hanya model 3D' : 'Canvas 2D + model 3D'}
            className={`flex items-center gap-1.5 h-6 px-2.5 rounded-md font-semibold whitespace-nowrap transition-colors ${
              viewMode === m.id ? 'bg-sky-500/25 text-sky-100' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            {m.icon}
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* Part focus: pick a part to zoom the 2D canvas onto it (replaces the old part strip under the canvas) */}
      {viewMode !== '3d' && (
        <div
          className={`flex items-center gap-1 min-w-0 h-7 pl-2 pr-1 rounded-md border ${
            activePart ? 'bg-sky-500/15 border-sky-600/50 text-sky-100' : 'bg-slate-900/90 border-slate-800 text-slate-300'
          }`}
        >
          <select
            value={activePart ? viewState.activePartId : 'all'}
            onChange={(e) => (e.target.value === 'all' ? onResetSolo() : onFocusPart(e.target.value as KitPartId))}
            aria-label="Fokus ke bagian"
            title="Fokus canvas 2D ke satu bagian"
            className="min-w-0 max-w-40 bg-transparent text-xs font-semibold outline-none cursor-pointer [&>option]:bg-slate-900 [&>option]:text-white"
          >
            <option value="all">Semua bagian</option>
            {PES_2021_PARTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {activePart && (
            <button
              onClick={onResetSolo}
              className="p-1 rounded text-sky-200 hover:text-white hover:bg-sky-800/70 transition-colors"
              title="Kembali ke tampilan penuh"
              aria-label="Kembali ke tampilan penuh"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* Zoom */}
      <div className="flex items-center gap-0.5 bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg shrink-0">
        <button
          onClick={() => zoomBy(-0.2)}
          className="h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="w-10 text-center text-[11px] font-mono text-slate-400">{Math.round(viewState.zoom * 100)}%</span>
        <button
          onClick={() => zoomBy(0.2)}
          className="h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setViewState((prev) => ({ ...prev, zoom: 1, panX: 0, panY: 0 }))}
          className="h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
          title="Reset zoom dan posisi"
          aria-label="Reset zoom dan posisi"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
