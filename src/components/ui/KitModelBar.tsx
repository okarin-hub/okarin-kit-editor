'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { parseKitConfig, setKitConfigValue } from '@/utils/kitConfig';
import { COLLARS, SHORTS_MODELS } from '@/utils/kitModelParts';

interface KitModelBarProps {
  kitConfig: string;
  onKitConfigChange: (text: string) => void;
}

const box = 'flex items-center gap-0.5 bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg shrink-0';
const iconBtn = 'h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-800';
const label = 'px-1.5 text-[11px] font-semibold text-slate-400 whitespace-nowrap';

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
      <span className={label}>{name}</span>
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

/**
 * Model parts of the 3D preview, in the workspace toolbar. Each control writes its kitserver config key, so
 * the 3D view and the Kitserver config.txt dialog always agree.
 */
export const KitModelBar: React.FC<KitModelBarProps> = ({ kitConfig, onKitConfigChange }) => {
  const c = parseKitConfig(kitConfig);
  const set = (key: string, value: string | number) => onKitConfigChange(setKitConfigValue(kitConfig, key, String(value)));
  const tight = c.TightKit === '1';
  const sleeves = c.ShortSleevesModel === '2' || c.ShortSleevesModel === '3' ? c.ShortSleevesModel : '1';

  return (
    <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto" role="group" aria-label="Model 3D">
      <Stepper name="Kerah" title="Nomor kerah (Collar di config.txt kitserver)" raw={c.Collar} max={COLLARS} onChange={(n) => set('Collar', n)} />
      <div className={box}>
        <span className={label}>Model lengan</span>
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
      <button
        onClick={() => set('TightKit', tight ? 0 : 1)}
        aria-pressed={tight}
        title="Baju ketat (TightKit)"
        className={`h-7 px-2.5 rounded-lg border text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
          tight ? 'bg-sky-500/20 border-sky-500/50 text-sky-100' : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white'
        }`}
      >
        Baju ketat
      </button>
      <Stepper name="Celana" title="Model celana (ShortsModel di config.txt kitserver)" raw={c.ShortsModel} max={SHORTS_MODELS} onChange={(n) => set('ShortsModel', n)} />
    </div>
  );
};

export default KitModelBar;
