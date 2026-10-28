'use client';

import React from 'react';
import { Eraser, MousePointer2, Pencil, PenTool, Spline, Brush } from 'lucide-react';

export type ToolId = 'select' | 'free' | 'poly' | 'stitch' | 'stitchFree' | 'eraser';

interface ToolRailProps {
  active: ToolId;
  onSelect: (tool: ToolId) => void;
}

const GROUPS: { id: ToolId; icon: React.ReactNode; title: string }[][] = [
  [{ id: 'select', icon: <MousePointer2 className="w-4 h-4" />, title: 'Pilih dan geser' }],
  [
    {
      id: 'free',
      icon: <Pencil className="w-4 h-4" />,
      title: 'Gambar bentuk bebas dengan menyeret mouse di canvas 2D',
    },
    {
      id: 'poly',
      icon: <PenTool className="w-4 h-4" />,
      title: 'Klik titik demi titik di canvas 2D; klik titik pertama atau tekan Enter untuk menutup',
    },
  ],
  [
    {
      id: 'stitch',
      icon: <Spline className="w-4 h-4" />,
      title: 'Klik titik demi titik di canvas 2D untuk membuat garis jahit; Enter atau klik dua kali untuk selesai',
    },
    {
      id: 'stitchFree',
      icon: <Brush className="w-4 h-4" />,
      title: 'Seret mouse di canvas 2D untuk menggambar garis jahit bebas',
    },
  ],
  [
    {
      id: 'eraser',
      icon: <Eraser className="w-4 h-4" />,
      title: 'Kuas hapus pola (agar logo bawaan desain tidak tertimpa)',
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
              title={t.title}
              aria-pressed={on}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${
                on
                  ? 'bg-rose-600/25 border-rose-500/70 text-rose-100'
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
