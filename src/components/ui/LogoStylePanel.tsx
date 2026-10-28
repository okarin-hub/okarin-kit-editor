'use client';

import React from 'react';
import { Palette, PenLine } from 'lucide-react';
import { KitGraphicItem, LogoFill, LogoOutline } from '@/types/kit';
import { DEFAULT_LOGO_FILL, DEFAULT_LOGO_OUTLINE } from '@/utils/logoStyle';

const SWATCHES = ['#ffffff', '#000000', '#fbbf24', '#e11d48', '#2563eb', '#0f172a', '#facc15', '#16a34a', '#06b6d4'];

const FILL_MODES: { id: LogoFill['mode']; label: string }[] = [
  { id: 'original', label: 'Asli' },
  { id: 'solid', label: 'Warna' },
  { id: 'gradient', label: 'Gradasi' },
];

const OUTLINE_POSITIONS: { id: LogoOutline['position']; label: string; hint: string }[] = [
  { id: 'inside', label: 'Dalam', hint: 'Inline: garis di sisi dalam tepi logo' },
  { id: 'center', label: 'Tengah', hint: 'Center: garis di tengah tepi logo' },
  { id: 'outside', label: 'Luar', hint: 'Outline: garis di sisi luar tepi logo' },
];

interface LogoStylePanelProps {
  item: KitGraphicItem;
  onChange: (item: KitGraphicItem) => void;
}

/** Colour / gradient and outline settings for an image logo. */
export const LogoStylePanel: React.FC<LogoStylePanelProps> = ({ item, onChange }) => {
  const fill: LogoFill = item.fill ?? DEFAULT_LOGO_FILL;
  const outline: LogoOutline = item.outline ?? DEFAULT_LOGO_OUTLINE;
  const setFill = (patch: Partial<LogoFill>) => onChange({ ...item, fill: { ...fill, ...patch } });
  const setOutline = (patch: Partial<LogoOutline>) => onChange({ ...item, outline: { ...outline, ...patch } });

  const seg = (active: boolean) =>
    `flex-1 py-1 rounded-md text-[11px] border transition-all ${
      active ? 'bg-sky-600/30 border-sky-500 text-white font-semibold' : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-white'
    }`;

  return (
    <div className="space-y-3">
      {/* Colour / gradient */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
          <Palette className="w-3 h-3 text-amber-400" />
          <span>Warna Logo:</span>
        </label>
        <div className="flex gap-1">
          {FILL_MODES.map((m) => (
            <button key={m.id} type="button" onClick={() => setFill({ mode: m.id })} className={seg(fill.mode === m.id)}>
              {m.label}
            </button>
          ))}
        </div>

        {fill.mode === 'solid' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFill({ color: c })}
                className={`w-5 h-5 rounded-full border shadow-sm transition-transform hover:scale-110 ${
                  fill.color.toLowerCase() === c ? 'border-sky-400 ring-1 ring-sky-400' : 'border-black/50'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={fill.color}
              onChange={(e) => setFill({ color: e.target.value })}
              className="w-6 h-6 rounded border border-slate-700 cursor-pointer bg-transparent"
              title="Warna kustom"
            />
          </div>
        )}

        {fill.mode === 'gradient' && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="w-12">Dari</span>
              <input type="color" value={fill.color} onChange={(e) => setFill({ color: e.target.value })} className="w-8 h-6 rounded border border-slate-700 bg-transparent cursor-pointer" />
              <span className="w-12 text-right">Ke</span>
              <input type="color" value={fill.color2} onChange={(e) => setFill({ color2: e.target.value })} className="w-8 h-6 rounded border border-slate-700 bg-transparent cursor-pointer" />
              <button
                type="button"
                onClick={() => setFill({ color: fill.color2, color2: fill.color })}
                className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Tukar
              </button>
            </div>
            <div className="space-y-0.5">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Arah</span>
                <span className="font-mono">{fill.angle}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={5}
                value={fill.angle}
                onChange={(e) => setFill({ angle: parseInt(e.target.value) })}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>
            <div className="h-4 rounded border border-slate-700" style={{ background: `linear-gradient(${fill.angle + 90}deg, ${fill.color}, ${fill.color2})` }} />
          </div>
        )}
        {fill.mode !== 'original' && (
          <p className="text-[10px] text-slate-500 leading-snug">Warna menimpa isi logo; bagian transparan tetap transparan.</p>
        )}
      </div>

      {/* Outline */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <PenLine className="w-3 h-3 text-sky-400" />
            <span>List / Outline:</span>
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
            <input type="checkbox" checked={outline.enabled} onChange={(e) => setOutline({ enabled: e.target.checked })} className="accent-sky-500" />
            Aktif
          </label>
        </div>
        {outline.enabled && (
          <div className="space-y-1.5">
            <div className="flex gap-1">
              {OUTLINE_POSITIONS.map((p) => (
                <button key={p.id} type="button" title={p.hint} onClick={() => setOutline({ position: p.id })} className={seg(outline.position === p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="w-12">Warna</span>
              <input type="color" value={outline.color} onChange={(e) => setOutline({ color: e.target.value })} className="w-8 h-6 rounded border border-slate-700 bg-transparent cursor-pointer" />
              <span className="ml-auto font-mono">{outline.width}px</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              step={0.5}
              value={outline.width}
              onChange={(e) => setOutline({ width: parseFloat(e.target.value) })}
              className="w-full accent-sky-500 cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default LogoStylePanel;
