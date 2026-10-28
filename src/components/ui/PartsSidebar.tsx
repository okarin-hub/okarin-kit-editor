'use client';

import React from 'react';
import {
  Shirt,
  Scissors,
  Sparkles,
  Eye,
  EyeOff,
  Focus,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { KitPartId, KitPartConfig, KitCategory } from '@/types/kit';
import { PES_2021_PARTS } from '@/constants/pes2021Parts';

interface PartsSidebarProps {
  partsConfig: Record<KitPartId, KitPartConfig>;
  activePartId: KitPartId | 'all';
  onSelectPart: (partId: KitPartId) => void;
  hoveredPartId: KitPartId | null;
  setHoveredPartId: (partId: KitPartId | null) => void;
  onToggleVisibility: (partId: KitPartId) => void;
  onFocusPart: (partId: KitPartId) => void;
  onViewAll: () => void;
}

const CATEGORY_INFO: Record<
  KitCategory,
  { label: string; icon: React.ReactNode }
> = {
  shirt: { label: 'Baju (Jersey)', icon: <Shirt className="w-4 h-4 text-rose-400" /> },
  shorts: {
    label: 'Celana (Shorts)',
    icon: <Scissors className="w-4 h-4 text-emerald-400" />,
  },
  socks: {
    label: 'Kaus Kaki (Socks)',
    icon: <Sparkles className="w-4 h-4 text-sky-400" />,
  },
  details: {
    label: 'Aksesoris & Kerah',
    icon: <Layers className="w-4 h-4 text-amber-400" />,
  },
};

export const PartsSidebar: React.FC<PartsSidebarProps> = ({
  partsConfig,
  activePartId,
  onSelectPart,
  hoveredPartId,
  setHoveredPartId,
  onToggleVisibility,
  onFocusPart,
  onViewAll,
}) => {
  const categories: KitCategory[] = ['shirt', 'shorts', 'socks', 'details'];

  return (
    <aside className="w-72 bg-[#121622] border-r border-slate-800 flex flex-col h-full select-none">
      {/* Header */}
      <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-rose-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Daftar Bagian Kit (Parts)
          </span>
        </div>
        <button
          onClick={onViewAll}
          className={`text-[11px] px-2 py-0.5 rounded transition-all font-medium ${
            activePartId === 'all'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Lihat Semua
        </button>
      </div>

      {/* Part List by Category */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {categories.map((cat) => {
          const partsInCat = PES_2021_PARTS.filter((p) => p.category === cat);
          const catMeta = CATEGORY_INFO[cat];

          return (
            <div key={cat} className="space-y-1">
              <div className="flex items-center gap-2 px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {catMeta.icon}
                <span>{catMeta.label}</span>
                <span className="text-[10px] text-slate-600 ml-auto">
                  {partsInCat.length} part
                </span>
              </div>

              <div className="space-y-1">
                {partsInCat.map((part) => {
                  const config = partsConfig[part.id];
                  const isSelected = activePartId === part.id;
                  const isHovered = hoveredPartId === part.id;

                  return (
                    <div
                      key={part.id}
                      onMouseEnter={() => setHoveredPartId(part.id)}
                      onMouseLeave={() => setHoveredPartId(null)}
                      onClick={() => onSelectPart(part.id)}
                      className={`group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-rose-950/40 border-rose-500/60 text-white shadow-sm'
                          : isHovered
                          ? 'bg-slate-800/70 border-slate-700 text-slate-200'
                          : 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Left: Color swatch & Part Name */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-4 h-4 rounded-full border border-black/40 shadow-sm shrink-0 flex items-center justify-center"
                          style={{ backgroundColor: config.color }}
                        >
                          {config.pattern !== 'none' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                          )}
                        </div>

                        <div className="truncate">
                          <p
                            className={`text-xs font-medium leading-tight truncate ${
                              isSelected ? 'text-white font-semibold' : ''
                            }`}
                          >
                            {part.name}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {part.indoName}
                          </p>
                        </div>
                      </div>

                      {/* Right: Quick Actions */}
                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        {/* Focus Zoom Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onFocusPart(part.id);
                          }}
                          className={`p-1 rounded hover:bg-slate-700/80 transition-colors ${
                            isSelected ? 'text-sky-400' : 'text-slate-400'
                          }`}
                          title={`Fokus zoom ke ${part.name}`}
                        >
                          <Focus className="w-3.5 h-3.5" />
                        </button>

                        {/* Visibility Toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleVisibility(part.id);
                          }}
                          className={`p-1 rounded hover:bg-slate-700/80 transition-colors ${
                            config.visible
                              ? 'text-slate-400 hover:text-white'
                              : 'text-rose-400'
                          }`}
                          title={config.visible ? 'Sembunyikan part' : 'Tampilkan part'}
                        >
                          {config.visible ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform ${
                            isSelected
                              ? 'text-rose-400 translate-x-0.5'
                              : 'text-slate-600'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 bg-[#0e121a]">
        <p className="leading-snug">
          💡 <span className="text-slate-400">Tips:</span> Klik bagian mana saja pada canvas atau daftar untuk mulai mengubah warna & pola.
        </p>
      </div>
    </aside>
  );
};

export default PartsSidebar;
