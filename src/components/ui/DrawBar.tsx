'use client';

import React from 'react';
import { PenLine, Pencil, Check, Undo2, X, Spline } from 'lucide-react';

interface DrawBarProps {
  tool: 'free' | 'poly' | 'stitch' | 'stitchFree' | null;
  pointCount: number;
  onFinish: () => void;
  onUndoPoint: () => void;
  onCancel: () => void;
  /** Stitch lines by points: smooth curve through the points. */
  curve: boolean;
  onToggleCurve: () => void;
}

/** Bar shown above the 2D canvas while a new template layer is being drawn. */
export const DrawBar: React.FC<DrawBarProps> = ({ tool, pointCount, onFinish, onUndoPoint, onCancel, curve, onToggleCurve }) => {
  if (!tool) return null;
  const isPoly = tool === 'poly' || tool === 'stitch';
  const isStitch = tool === 'stitch' || tool === 'stitchFree';
  const minPts = tool === 'poly' ? 3 : 2;
  return (
    <div className="w-full max-w-[720px] shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-[#121622]/95 border border-sky-700/70 rounded-xl shadow-lg px-3 py-2 select-none">
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-white whitespace-nowrap">
        {isPoly ? <PenLine className="w-3.5 h-3.5 text-sky-400" /> : <Pencil className="w-3.5 h-3.5 text-sky-400" />}
        {isStitch ? (isPoly ? 'Garis jahit (titik)' : 'Garis jahit (bebas)') : isPoly ? 'Gambar titik' : 'Gambar bebas'}
      </span>
      <span className="text-[11px] text-slate-400 order-last basis-full leading-snug">
        {isStitch
          ? isPoly
            ? `Klik di canvas untuk menaruh titik garis jahit (${pointCount}${curve ? ', lengkung, butuh minimal 3 titik untuk melengkung' : ''}). Klik dua kali atau tekan Enter untuk selesai.`
            : 'Tekan dan seret di canvas untuk menggambar garis jahit. Lepas mouse untuk menyelesaikan.'
          : isPoly
          ? `Klik di canvas untuk menaruh titik (${pointCount}). Klik titik merah pertama, klik dua kali, atau tekan Enter untuk menutup.`
          : 'Tekan dan seret di canvas untuk menggambar bentuk. Lepas mouse untuk menyelesaikan.'}
      </span>
      <div className="flex items-center gap-1">
        {tool === 'stitch' && (
          <button
            onClick={onToggleCurve}
            className={`flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium border transition-colors ${
              curve
                ? 'bg-sky-600/30 border-sky-500 text-sky-100'
                : 'text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
            title="Hubungkan titik dengan garis melengkung, bukan garis lurus"
          >
            <Spline className="w-3 h-3" />
            Lengkung {curve ? 'ON' : 'OFF'}
          </button>
        )}
        {isPoly && (
          <>
            <button
              onClick={onUndoPoint}
              disabled={pointCount === 0}
              className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium text-slate-300 border border-slate-700/60 hover:bg-slate-800 disabled:opacity-40"
              title="Hapus titik terakhir (Backspace)"
            >
              <Undo2 className="w-3 h-3" />
              Mundur
            </button>
            <button
              onClick={onFinish}
              disabled={pointCount < minPts}
              className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40"
            >
              <Check className="w-3 h-3" />
              Selesai
            </button>
          </>
        )}
        <button
          onClick={onCancel}
          className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium text-slate-300 border border-slate-700/60 hover:bg-slate-800"
          title="Batal (Esc)"
        >
          <X className="w-3 h-3" />
          Batal
        </button>
      </div>
    </div>
  );
};

export default DrawBar;
