'use client';

import React from 'react';
import { Eraser, Brush, X, Trash2 } from 'lucide-react';
import { PatternBrushState } from '@/types/kit';
import { InfoTip } from '@/components/ui/InfoTip';

interface PatternBrushPanelProps {
  brush: PatternBrushState;
  onChange: (update: Partial<PatternBrushState>) => void;
  /** Name of the selected layer the brush erases; none = it erases the patterns. */
  targetName?: string;
  hasMask: boolean;
  onClear: () => void;
}

/**
 * Compact bar shown above the 2D canvas while the eraser brush is active (it is turned on from
 * the toolbar). With a layer selected it erases only that layer, otherwise the part patterns;
 * "Pulihkan" brings back what was erased.
 */
export const PatternBrushPanel: React.FC<PatternBrushPanelProps> = ({
  brush,
  onChange,
  targetName,
  hasMask,
  onClear,
}) => {
  if (!brush.active) return null;

  return (
    <div className="w-full max-w-[720px] shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-[#121622]/95 border border-slate-700 rounded-xl shadow-lg px-3 py-2 select-none">
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-white whitespace-nowrap">
        <Eraser className="w-3.5 h-3.5 text-rose-400" />
        Kuas Hapus
        <InfoTip text="Pilih layer dulu untuk menghapus layer itu saja di area yang disapu (misalnya watermark atau logo yang tidak diinginkan). Tanpa layer yang dipilih, kuas menghapus pola. Pulihkan mengembalikannya." />
      </span>

      <span className="text-[11px] text-slate-400 whitespace-nowrap max-w-[200px] truncate">
        {targetName ? (
          <>
            Layer: <span className="text-rose-300 font-semibold">{targetName}</span>
          </>
        ) : (
          'Pola'
        )}
      </span>

      <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
        <button
          onClick={() => onChange({ mode: 'erase' })}
          className={`flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium transition-colors ${
            brush.mode === 'erase' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Eraser className="w-3 h-3" />
          Hapus
        </button>
        <button
          onClick={() => onChange({ mode: 'restore' })}
          className={`flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium transition-colors ${
            brush.mode === 'restore' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Brush className="w-3 h-3" />
          Pulihkan
        </button>
      </div>

      <label className="flex items-center gap-2 text-[11px] text-slate-400">
        <span className="whitespace-nowrap">Ukuran</span>
        <input
          type="range"
          min={4}
          max={200}
          step={2}
          value={brush.size}
          onChange={(e) => onChange({ size: Number(e.target.value) })}
          className="w-24 accent-rose-500 cursor-pointer"
        />
        <span className="font-mono w-9 text-right">{brush.size}px</span>
      </label>

      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={onClear}
          disabled={!hasMask}
          className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium text-slate-300 border border-slate-700/60 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={targetName ? 'Kembalikan bagian layer ini yang dihapus' : 'Kembalikan semua pola yang dihapus'}
        >
          <Trash2 className="w-3 h-3" />
          Reset
        </button>
        <button
          onClick={() => onChange({ active: false })}
          className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold text-white bg-slate-700 hover:bg-slate-600 transition-colors"
          title="Selesai memakai kuas"
        >
          <X className="w-3 h-3" />
          Selesai
        </button>
      </div>
    </div>
  );
};

export default PatternBrushPanel;
