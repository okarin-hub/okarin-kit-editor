'use client';

import React from 'react';
import { Blend, Eraser, MousePointer2, Pencil, PenTool, Spline, Brush } from 'lucide-react';

export type ToolId = 'select' | 'free' | 'poly' | 'stitch' | 'stitchFree' | 'gradient' | 'eraser';

interface ToolRailProps {
  active: ToolId;
  onSelect: (tool: ToolId) => void;
}

const GROUPS: { id: ToolId; icon: React.ReactNode; title: string; key: string }[][] = [
  [{ id: 'select', icon: <MousePointer2 className="w-4 h-4" />, title: 'Pilih dan geser', key: 'V' }],
  [
    {
      id: 'free',
      icon: <Pencil className="w-4 h-4" />,
      title: 'Gambar bentuk bebas dengan menyeret mouse di canvas 2D',
      key: 'B',
    },
    {
      id: 'poly',
      icon: <PenTool className="w-4 h-4" />,
      title: 'Klik titik demi titik di canvas 2D; klik titik pertama atau tekan Enter untuk menutup',
      key: 'P',
    },
  ],
  [
    {
      id: 'stitch',
      icon: <Spline className="w-4 h-4" />,
      title: 'Klik titik demi titik di canvas 2D untuk membuat garis jahit; Enter atau klik dua kali untuk selesai',
      key: 'S',
    },
    {
      id: 'stitchFree',
      icon: <Brush className="w-4 h-4" />,
      title: 'Seret mouse di canvas 2D untuk menggambar garis jahit bebas',
      key: 'J',
    },
  ],
  [
    {
      id: 'gradient',
      icon: <Blend className="w-4 h-4" />,
      title: 'Gradasi: tekan dan seret di canvas 2D dari warna awal ke arah pudarnya',
      key: 'G',
    },
  ],
  [
    {
      id: 'eraser',
      icon: <Eraser className="w-4 h-4" />,
      title: 'Kuas hapus: layer yang dipilih, atau pola',
      key: 'E',
    },
  ],
];

/** Vertical tool rail on the left of the workspace (like an image editor): one tool is active at a time. */
export const ToolRail: React.FC<ToolRailProps> = ({ active, onSelect }) => (
  <aside className="w-11 shrink-0 border-r border-slate-800 bg-[#121620] py-2 flex flex-col items-center gap-1 select-none" aria-label="Tools">
    {GROUPS.map((group, gi) => (
      <React.Fragment key={gi}>
        {gi > 0 && <span className="w-6 h-px bg-slate-700/70 my-1" />}
        {group.map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(on && t.id !== 'select' ? 'select' : t.id)}
              title={`${t.title} (${t.key})`}
              aria-label={t.title}
              aria-keyshortcuts={t.key}
              aria-pressed={on}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${
                on
                  ? 'bg-sky-500/20 border-sky-500/60 text-sky-100'
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {t.icon}
            </button>
          );
        })}
      </React.Fragment>
    ))}
  </aside>
);

export default ToolRail;
