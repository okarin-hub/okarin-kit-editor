'use client';

import React from 'react';
import { FileCog, Type, X } from 'lucide-react';

export type KitserverTab = 'config' | 'font';

const TABS: { id: KitserverTab; label: string; icon: React.ReactNode; hint: string }[] = [
  {
    id: 'config',
    label: 'config.txt',
    icon: <FileCog className="w-3.5 h-3.5" aria-hidden />,
    hint: 'Pengaturan kit untuk kserv.lua (Sider). Batas nilai mengikuti kserv 1.13.',
  },
  {
    id: 'font',
    label: 'Font nomor & nama',
    icon: <Type className="w-3.5 h-3.5" aria-hidden />,
    hint: 'Nomor dan nama untuk kitserver, ditaruh di slot karakter template PES 2021.',
  },
];

/** Header of the Kitserver dialog: its two parts (config.txt and the fonts) as tabs, so they read as one tool. */
export const KitserverHeader: React.FC<{ tab: KitserverTab; onTab: (tab: KitserverTab) => void; onClose: () => void }> = ({ tab, onTab, onClose }) => (
  <div className="flex items-center gap-4 px-5 py-3 border-b border-slate-800 bg-[#0f131c]">
    <div className="flex items-center gap-2 shrink-0">
      <h3 className="text-sm font-bold text-white">Kitserver</h3>
    </div>
    <div className="flex items-center bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg" role="tablist" aria-label="Kitserver">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => onTab(t.id)}
          className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-semibold transition-colors ${
            tab === t.id ? 'bg-sky-500/25 text-sky-100' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
    <p className="flex-1 min-w-0 truncate text-[11px] text-slate-400">{TABS.find((t) => t.id === tab)?.hint}</p>
    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Tutup" title="Tutup">
      <X className="w-4 h-4" />
    </button>
  </div>
);
