'use client';

import React from 'react';
import { Eye, EyeOff, Minus, Plus, Trash2 } from 'lucide-react';
import { KitPartConfig, KitPartId } from '@/types/kit';

/** Parts that can carry a trim stripe (lis). */
export const ACCENT_PART_IDS: KitPartId[] = [
  'leftSleeve',
  'rightSleeve',
  'leftShorts',
  'rightShorts',
  'leftSock',
  'rightSock',
  'collar',
];

interface AccentRowProps {
  partId: KitPartId;
  config: KitPartConfig;
  onUpdatePartConfig: (partId: KitPartId, update: Partial<KitPartConfig>) => void;
}

/** Trim stripe (lis) line shown right under its part in the layer list: eye, colour, width, delete. */
export const AccentRow: React.FC<AccentRowProps> = ({ partId, config, onUpdatePartConfig }) => {
  if (!ACCENT_PART_IDS.includes(partId)) return null;

  if (!config.cuffStripeEnabled) {
    return (
      <div className="mt-1 ml-3 border-l border-slate-800 pl-2">
        <button
          type="button"
          onClick={() =>
            onUpdatePartConfig(partId, {
              cuffStripeEnabled: true,
              cuffStripeVisible: true,
              cuffStripeColor: config.cuffStripeColor || '#ffffff',
              cuffStripeWidth: config.cuffStripeWidth || 14,
            })
          }
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-sky-300"
        >
          <Plus className="w-3 h-3" />
          Tambah lis
        </button>
      </div>
    );
  }

  const visible = config.cuffStripeVisible !== false;
  const width = config.cuffStripeWidth || 14;
  return (
    <div className="mt-1 ml-3 flex items-center gap-1.5 border-l border-slate-800 pl-2 text-[11px]">
      <button
        type="button"
        onClick={() => onUpdatePartConfig(partId, { cuffStripeVisible: !visible })}
        className={`shrink-0 ${visible ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-400'}`}
        title={visible ? 'Sembunyikan lis' : 'Tampilkan lis'}
      >
        {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
      </button>
      <input
        type="color"
        value={config.cuffStripeColor || '#ffffff'}
        onChange={(e) => onUpdatePartConfig(partId, { cuffStripeColor: e.target.value, cuffStripeVisible: true })}
        className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5 shrink-0"
        title="Warna lis"
      />
      <span className={`flex-1 truncate ${visible ? 'text-slate-300' : 'text-slate-500'}`}>Lis</span>
      <button
        type="button"
        onClick={() => onUpdatePartConfig(partId, { cuffStripeWidth: Math.max(4, width - 2) })}
        className="shrink-0 text-slate-400 hover:text-white"
        title="Tipiskan"
      >
        <Minus className="w-3 h-3" />
      </button>
      <span className="w-9 text-center text-[10px] font-mono text-slate-300 shrink-0">{width}px</span>
      <button
        type="button"
        onClick={() => onUpdatePartConfig(partId, { cuffStripeWidth: Math.min(60, width + 2) })}
        className="shrink-0 text-slate-400 hover:text-white"
        title="Tebalkan"
      >
        <Plus className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={() => onUpdatePartConfig(partId, { cuffStripeEnabled: false })}
        className="shrink-0 text-slate-500 hover:text-rose-400"
        title="Hapus lis"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
};

export default AccentRow;
