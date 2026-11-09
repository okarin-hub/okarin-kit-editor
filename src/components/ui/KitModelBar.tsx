'use client';

import React, { useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Shirt, X } from 'lucide-react';
import { parseKitConfig, setKitConfigValue } from '@/utils/kitConfig';
import { COLLARS, SHORTS_MODELS } from '@/utils/kitModelParts';

interface KitModelBarProps {
  kitConfig: string;
  onKitConfigChange: (text: string) => void;
  /** sleeve pieces with the shoulder yoke, or the shorter sleeve (template state, also shapes the 2D canvas) */
  sleeveShape: 'yoke' | 'short';
  onSleeveShapeChange: (shape: 'yoke' | 'short') => void;
}

const box = 'flex items-center gap-0.5 shrink-0';
const iconBtn = 'h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-800';

/**
 * Number with ‹ › arrows that wrap around 1..max; typing commits only values in range. `raw` is the config value
 * as written: one the 3D model doesn't have (Collar 134, ShortsModel 0) is shown as it is, marked, and the 3D
 * view shows model 1 for it.
 */
const Stepper: React.FC<{ name: string; title: string; raw: string | undefined; max: number; onChange: (n: number) => void }> = ({
  name,
  title,
  raw,
  max,
  onChange,
}) => {
  const n = Number(raw);
  const known = Number.isInteger(n) && n >= 1 && n <= max;
  const value = known ? n : 1;
  return (
    <div className={box} title={known ? title : `${title}. Tidak ada di model 3D, preview memakai 1.`}>
      <button onClick={() => onChange(known && value > 1 ? value - 1 : max)} aria-label={`${name} -`} className={iconBtn}>
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <input
        type="number"
        min={1}
        max={max}
        value={raw ?? ''}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isInteger(v) && v >= 1 && v <= max) onChange(v);
        }}
        aria-label={name}
        aria-invalid={!known}
        className={`h-6 w-10 rounded-md bg-slate-950 border text-center text-[11px] font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:border-sky-500 ${
          known ? 'border-slate-700 text-sky-100' : 'border-amber-500/70 text-amber-300'
        }`}
      />
      <button onClick={() => onChange(known && value < max ? value + 1 : 1)} aria-label={`${name} +`} className={iconBtn}>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

const group = 'flex items-center gap-1.5 shrink-0';
const groupLabel = 'text-[11px] font-medium text-slate-400 whitespace-nowrap';
const seg = (on: boolean) =>
  `h-6 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${on ? 'bg-sky-500/25 text-sky-100' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`;
const divider = <span className="h-4 w-px bg-slate-700/80 shrink-0" aria-hidden />;

/** Toolbar button that shows / hides the kit model strip; closed, it shows what is set. */
export const KitModelButton: React.FC<KitModelBarProps & { open: boolean; onToggle: () => void }> = ({ kitConfig, sleeveShape, open, onToggle }) => {
  const c = parseKitConfig(kitConfig);
  const sleeves = c.ShortSleevesModel === '2' || c.ShortSleevesModel === '3' ? c.ShortSleevesModel : '1';
  // [label, number]: label and number are separate text, so the label is translated on its own
  const summary = (
    [
      sleeveShape === 'short' ? ['Tanpa pundak', ''] : null,
      ['Kerah', c.Collar || '1'],
      sleeves === '2' ? ['Kappa', ''] : sleeves === '3' ? ['Wasit', ''] : null,
      c.TightKit === '1' ? ['Ketat', ''] : null,
      ['Celana', c.ShortsModel || '1'],
    ].filter(Boolean) as [string, string][]
  ).map(([label, n], i) => (
    <React.Fragment key={label}>
      {i > 0 && ' · '}
      {label}
      {n && ` ${n}`}
    </React.Fragment>
  ));
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="kit-model-strip"
      title="Bentuk lengan dan model 3D (kerah, lengan, baju ketat, celana)"
      className={`flex items-center gap-1.5 h-7 pl-2 pr-1.5 rounded-lg border text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
        open ? 'bg-sky-500/15 border-sky-600/50 text-sky-100' : 'bg-slate-900/90 border-slate-800 text-slate-200 hover:border-slate-700'
      }`}
    >
      <Shirt className="w-3.5 h-3.5 text-slate-400" aria-hidden />
      <span>Model kit</span>
      {!open && <span className="hidden xl:inline font-normal text-slate-400">{summary}</span>}
      <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
    </button>
  );
};

/**
 * The kit model settings as a thin row under the toolbar: it pushes the workspace down instead of covering the 3D
 * view, and stays open while the model is turned, so each change can be watched. Each 3D control writes its
 * kitserver config key, so the 3D view and the Kitserver dialog always agree.
 */
export const KitModelStrip: React.FC<KitModelBarProps & { onClose: () => void }> = ({ kitConfig, onKitConfigChange, sleeveShape, onSleeveShapeChange, onClose }) => {
  const c = parseKitConfig(kitConfig);
  const set = (key: string, value: string | number) => onKitConfigChange(setKitConfigValue(kitConfig, key, String(value)));
  const tight = c.TightKit === '1';
  const sleeves = c.ShortSleevesModel === '2' || c.ShortSleevesModel === '3' ? c.ShortSleevesModel : '1';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === 'Escape' && t.tagName !== 'INPUT' && t.tagName !== 'SELECT' && !document.querySelector('[aria-modal="true"]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      id="kit-model-strip"
      role="group"
      aria-label="Model kit"
      className="h-10 shrink-0 border-b border-slate-800 bg-[#121622] px-3 flex items-center justify-end gap-3 overflow-x-auto select-none"
    >
      <div className={group} title="Sampai pundak mengikuti template PES: lengan menyambung ke area leher. Tanpa pundak memakai lengan yang lebih pendek dan berhenti di lubang lengan.">
        <span className={groupLabel}>Bentuk lengan</span>
        <div className="flex items-center bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg" role="group" aria-label="Bentuk lengan">
          {(
            [
              ['yoke', 'Sampai pundak'],
              ['short', 'Tanpa pundak'],
            ] as const
          ).map(([id, text]) => (
            <button key={id} type="button" aria-pressed={sleeveShape === id} onClick={() => onSleeveShapeChange(id)} className={seg(sleeveShape === id)}>
              {text}
            </button>
          ))}
        </div>
      </div>
      {divider}
      <div className={group}>
        <span className={groupLabel}>Kerah</span>
        <Stepper name="Kerah" title="Nomor kerah (Collar di config.txt kitserver)" raw={c.Collar} max={COLLARS} onChange={(n) => set('Collar', n)} />
      </div>
      <div className={group}>
        <span className={groupLabel}>Model lengan</span>
        <select
          value={sleeves}
          onChange={(e) => set('ShortSleevesModel', e.target.value)}
          aria-label="Model lengan pendek"
          title="Model lengan pendek (ShortSleevesModel)"
          className="h-6 rounded-md bg-slate-950 border border-slate-700 px-1 text-[11px] font-semibold text-sky-100 focus:outline-none focus:border-sky-500"
        >
          <option value="1">Normal</option>
          <option value="2">Kappa</option>
          <option value="3">3 = Wasit</option>
        </select>
      </div>
      <label className={`${group} cursor-pointer`} title="Baju ketat (TightKit)">
        <input type="checkbox" checked={tight} onChange={() => set('TightKit', tight ? 0 : 1)} className="accent-sky-500 w-3.5 h-3.5 cursor-pointer" />
        <span className={groupLabel}>Baju ketat</span>
      </label>
      <div className={group}>
        <span className={groupLabel}>Celana</span>
        <Stepper name="Celana" title="Model celana (ShortsModel di config.txt kitserver)" raw={c.ShortsModel} max={SHORTS_MODELS} onChange={(n) => set('ShortsModel', n)} />
      </div>
      {divider}
      <span className="text-[10px] text-slate-500 whitespace-nowrap shrink-0" title="Kerah, lengan, baju ketat, dan celana ikut tersimpan di config.txt kitserver.">
        Tersimpan di config.txt
      </span>
      <button type="button" onClick={onClose} className="h-6 w-6 shrink-0 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-800" title="Tutup" aria-label="Tutup">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default KitModelStrip;
