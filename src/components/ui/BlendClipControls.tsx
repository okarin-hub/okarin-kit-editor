'use client';

import React from 'react';
import { InfoTip } from '@/components/ui/InfoTip';

// the canvas composite operations Photoshop has a blend mode for (the same set a template may carry)
const BLEND_MODES: [GlobalCompositeOperation, string][] = [
  ['source-over', 'Normal'],
  ['multiply', 'Multiply'],
  ['screen', 'Screen'],
  ['overlay', 'Overlay'],
  ['darken', 'Darken'],
  ['lighten', 'Lighten'],
  ['color-dodge', 'Color Dodge'],
  ['color-burn', 'Color Burn'],
  ['lighter', 'Linear Dodge (Add)'],
  ['hard-light', 'Hard Light'],
  ['soft-light', 'Soft Light'],
  ['difference', 'Difference'],
  ['exclusion', 'Exclusion'],
  ['hue', 'Hue'],
  ['saturation', 'Saturation'],
  ['color', 'Color'],
  ['luminosity', 'Luminosity'],
];

/** Blend mode list and "clip to the layer below" of a layer (object or pattern), side by side. */
export const BlendClipControls: React.FC<{
  blend?: GlobalCompositeOperation;
  onBlend: (blend: GlobalCompositeOperation | undefined) => void;
  clipped: boolean;
  /** Name of the layer it clips (or would clip) to; unset = nothing to clip to. */
  clipTarget?: string;
  onClip: (on: boolean) => void;
}> = ({ blend, onBlend, clipped, clipTarget, onClip }) => (
  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
    <label className="space-y-0.5">
      <span className="flex items-center gap-1">
        Mode blend
        <InfoTip text="Cara warna layer bercampur dengan yang di bawahnya, seperti di Photoshop. Multiply menggelapkan (bayangan, lipatan), Screen menerangkan (kilap), Overlay menebalkan kontras." />
      </span>
      <select
        value={blend ?? 'source-over'}
        onChange={(e) => onBlend(e.target.value === 'source-over' ? undefined : (e.target.value as GlobalCompositeOperation))}
        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white outline-none focus:border-sky-500"
      >
        {BLEND_MODES.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </label>
    <div className="space-y-0.5">
      <span className="flex items-center gap-1">
        Clipping
        <InfoTip text="Layer ini hanya tampil di dalam bentuk layer tepat di bawahnya (Clipping Mask di Photoshop). Contoh: motif atau gradasi yang hanya mengisi sebuah strip." />
      </span>
      <label className={`flex items-center gap-1.5 py-1 ${clipTarget ? 'cursor-pointer text-slate-300' : 'opacity-50'}`}>
        <input type="checkbox" checked={clipped} disabled={!clipTarget} onChange={(e) => onClip(e.target.checked)} className="accent-sky-500" />
        Clip ke layer bawah
      </label>
      <div className="text-[10px] text-slate-500 truncate" title={clipTarget}>
        {clipTarget ? `ke: ${clipTarget}` : 'Tidak ada layer di bawahnya'}
      </div>
    </div>
  </div>
);
