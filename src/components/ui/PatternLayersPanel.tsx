'use client';

import React, { useState } from 'react';
import { FlipHorizontal2, FlipVertical2, FolderOpen, RefreshCw } from 'lucide-react';
import { KitCategory, KitPartId, PatternLayer } from '@/types/kit';
import { InfoTip } from '@/components/ui/InfoTip';
import { PATTERN_LABEL, PATTERN_OPTIONS, REPEATING_PATTERNS, THICKNESS_PATTERNS } from '@/constants/patterns';
import { AssetLibrary } from '@/hooks/useAssetLibrary';
import { getCachedImage, preloadImage } from '@/utils/imageCache';
import { isTintableTile } from '@/utils/patternRenderer';

/** The parts a pattern can sit on, per layer group (the groups of the Layer list). */
export const PATTERN_GROUP_PARTS: Record<KitCategory, { id: KitPartId; label: string }[]> = {
  shirt: [
    { id: 'front', label: 'Depan' },
    { id: 'back', label: 'Belakang' },
    { id: 'leftSleeve', label: 'Lengan kanan' },
    { id: 'rightSleeve', label: 'Lengan kiri' },
  ],
  shorts: [{ id: 'leftShorts', label: 'Kanan' }, { id: 'rightShorts', label: 'Kiri' }],
  socks: [{ id: 'leftSock', label: 'Kanan' }, { id: 'rightSock', label: 'Kiri' }],
  details: [{ id: 'collar', label: 'Kerah' }],
};

export const groupPartIds = (g: KitCategory): KitPartId[] => PATTERN_GROUP_PARTS[g].map((p) => p.id);

/** A new pattern layer (vertical stripes) on the given parts. */
export const newPatternLayer = (parts: KitPartId[]): PatternLayer => ({
  id: `pattern-${Date.now().toString(36)}`,
  name: PATTERN_LABEL['vertical-stripes'],
  pattern: 'vertical-stripes',
  patternColor: '#ffffff',
  patternScale: 30,
  patternOpacity: 1,
  patternThickness: 0.5,
  patternRotation: 0,
  patternOffsetX: 0,
  patternOffsetY: 0,
  visible: true,
  parts,
  backFlip: true,
});

interface PatternLayerEditorProps {
  layer: PatternLayer;
  /** The Layer-list group the editor is open in: its parts can be switched on and off. */
  group: KitCategory;
  library: AssetLibrary;
  onUpdate: (patch: Partial<PatternLayer>) => void;
  /** In the side panel: no indent / guide line. */
  bare?: boolean;
}

/** Slider with a label and a live value. */
const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, unit = '', onChange }) => (
  <div className="space-y-0.5">
    <div className="flex items-center justify-between text-[11px] text-slate-400">
      <span>{label}</span>
      <span className="font-mono">
        {Number.isInteger(step) || step >= 1 ? Math.round(value) : value.toFixed(2)}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-sky-500 cursor-pointer"
    />
  </div>
);

/** The settings of one pattern layer, opened under its row in the Layer list. */
export const PatternLayerEditor: React.FC<PatternLayerEditorProps> = ({ layer: l, group, library, onUpdate, bare }) => {
  const update = (_id: string, patch: Partial<PatternLayer>) => onUpdate(patch);
  const isLib = l.pattern === 'custom-image';
  const img = isLib && l.patternImage ? getCachedImage(l.patternImage) : undefined;
  const tintAuto = img && l.patternImage ? isTintableTile(l.patternImage, img) : true;
  const groupParts = PATTERN_GROUP_PARTS[group];
  const onHere = groupParts.filter((p) => l.parts.includes(p.id));
  const togglePart = (part: KitPartId) =>
    onUpdate({ parts: l.parts.includes(part) ? l.parts.filter((p) => p !== part) : [...l.parts, part] });

  return (
              <div className={bare ? 'p-3 space-y-3' : 'mt-1 ml-3 border-l border-slate-800 pl-2 pb-2 pt-1.5 space-y-3'}>
                {/* Pattern type */}
                <select
                  value={l.pattern}
                  onChange={(e) =>
                    update(l.id, {
                      pattern: e.target.value as PatternLayer['pattern'],
                      name: PATTERN_LABEL[e.target.value] ?? l.name,
                    })
                  }
                  aria-label="Jenis pola"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:border-sky-500 outline-none"
                >
                  {PATTERN_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                  {isLib && <option value="custom-image">Gambar dari Pustaka</option>}
                </select>

                {/* Library patterns */}
                <div className="space-y-1.5 bg-slate-900/40 border border-slate-800 rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                      Pola dari Pustaka ({library.patterns.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => library.reload()}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center gap-1"
                      title="Baca ulang folder library/patterns"
                    >
                      <RefreshCw className={`w-3 h-3 ${library.loading ? 'animate-spin' : ''}`} />
                      Muat ulang
                    </button>
                  </div>
                  {library.patterns.length === 0 ? (
                    <p className="text-[10px] text-slate-500 leading-snug">
                      Belum ada pola. Taruh gambar (PNG, JPG, SVG, WebP) di folder <code>library/patterns</code> lalu klik Muat ulang.
                    </p>
                  ) : (
                    <div className="grid grid-cols-5 gap-1.5 max-h-32 overflow-y-auto pr-0.5">
                      {library.patterns.map((p) => {
                        const active = isLib && l.patternImage === p.url;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            title={`${p.name}${p.category ? ' - ' + p.category : ''}`}
                            onClick={async () => {
                              await preloadImage(p.url);
                              update(l.id, {
                                pattern: 'custom-image',
                                patternImage: p.url,
                                patternTint: undefined,
                                name: p.name,
                                patternOpacity: Math.max(l.patternOpacity, 0.5),
                              });
                            }}
                            className={`aspect-square rounded-md border p-1 flex items-center justify-center overflow-hidden transition-all ${
                              active ? 'border-sky-400 bg-sky-500/10' : 'border-slate-700 bg-slate-800 hover:border-slate-500'
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url} alt={p.name} className="max-w-full max-h-full object-contain" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {isLib && (
                  <label className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={l.patternTint ?? tintAuto}
                      onChange={(e) => update(l.id, { patternTint: e.target.checked })}
                      className="mt-0.5 accent-sky-500"
                    />
                    <span className="flex items-center gap-1">
                      Warnai dengan Warna Pola
                      <InfoTip text={tintAuto ? 'Gambar ini satu warna, jadi otomatis bisa diwarnai.' : 'Gambar ini berwarna; matikan agar warna aslinya dipakai.'} />
                    </span>
                  </label>
                )}

                {/* Colour */}
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="w-20">Warna Pola</span>
                  <input
                    type="color"
                    value={l.patternColor}
                    onChange={(e) => update(l.id, { patternColor: e.target.value })}
                    className="w-8 h-7 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={l.patternColor}
                    onChange={(e) => update(l.id, { patternColor: e.target.value })}
                    className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200 uppercase"
                  />
                </div>

                {REPEATING_PATTERNS.includes(l.pattern) && (
                  <label className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={l.patternRepeat !== false}
                      onChange={(e) => update(l.id, { patternRepeat: e.target.checked })}
                      className="mt-0.5 accent-sky-500"
                    />
                    <span className="flex items-center gap-1">
                      Berulang (Kontinu)
                      <InfoTip
                        text={
                          l.patternRepeat !== false
                            ? 'Pola diulang memenuhi bagian. Matikan agar muncul sekali saja.'
                            : 'Pola muncul sekali di tengah bagian; geser X/Y untuk memindahkannya.'
                        }
                      />
                    </span>
                  </label>
                )}

                <Slider label="Ukuran / Skala" value={l.patternScale} min={8} max={200} step={2} unit="px" onChange={(v) => update(l.id, { patternScale: v })} />
                {THICKNESS_PATTERNS.includes(l.pattern) && (
                  <Slider
                    label="Ketebalan Garis"
                    value={Math.round((l.patternThickness ?? 0.5) * 100)}
                    min={5}
                    max={95}
                    step={5}
                    unit="%"
                    onChange={(v) => update(l.id, { patternThickness: v / 100 })}
                  />
                )}
                <Slider label="Opasitas" value={Math.round(l.patternOpacity * 100)} min={5} max={100} step={5} unit="%" onChange={(v) => update(l.id, { patternOpacity: v / 100 })} />

                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-300">Posisi dan Rotasi</span>
                    <button
                      type="button"
                      onClick={() => update(l.id, { patternOffsetX: 0, patternOffsetY: 0, patternRotation: 0 })}
                      className="text-[10px] px-2 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Reset
                    </button>
                  </div>
                  <Slider label="Geser Kiri / Kanan (X)" value={l.patternOffsetX ?? 0} min={-300} max={300} step={1} unit="px" onChange={(v) => update(l.id, { patternOffsetX: v })} />
                  <Slider label="Geser Atas / Bawah (Y)" value={l.patternOffsetY ?? 0} min={-300} max={300} step={1} unit="px" onChange={(v) => update(l.id, { patternOffsetY: v })} />
                  <Slider label="Rotasi" value={l.patternRotation ?? 0} min={-180} max={180} step={1} unit="°" onChange={(v) => update(l.id, { patternRotation: v })} />
                  <div className="grid grid-cols-5 gap-1">
                    {[-90, -45, 45, 90, 180].map((deg) => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => update(l.id, { patternRotation: deg })}
                        className={`text-[10px] py-1 rounded border transition-colors ${
                          (l.patternRotation ?? 0) === deg
                            ? 'bg-sky-500/20 border-sky-500 text-sky-100'
                            : 'bg-slate-800/70 border-slate-700/60 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {deg > 0 ? `+${deg}` : deg}°
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mirror / symmetry */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
                    Cermin
                    <InfoTip text="Simetris: pola digambar di satu sisi lalu dicerminkan ke sisi lawannya (cocok untuk diagonal dan sash). Balik: pola dibalik di tempat." />
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        ['patternSymmetryX', 'Simetris Kiri ↔ Kanan', FlipHorizontal2],
                        ['patternSymmetryY', 'Simetris Atas ↔ Bawah', FlipVertical2],
                        ['patternMirrorX', 'Balik Horizontal', FlipHorizontal2],
                        ['patternMirrorY', 'Balik Vertikal', FlipVertical2],
                      ] as const
                    ).map(([key, label, Icon]) => {
                      const active = !!l[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => update(l.id, { [key]: !active })}
                          className={`flex items-center justify-center gap-1 text-[10px] font-medium py-1.5 px-1.5 rounded-lg border transition-colors ${
                            active
                              ? 'bg-sky-500/20 border-sky-500 text-sky-100'
                              : 'bg-slate-800/70 border-slate-700/60 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <Icon className="w-3 h-3 shrink-0" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Parts of this group (the group itself is chosen by dragging the row) */}
                {(groupParts.length > 1 || group === 'shirt') && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
                      Bagian
                      <InfoTip text="Seret baris pola ke grup lain (Baju, Celana, Kaus kaki, Aksesoris) untuk memindahkannya. Tahan Ctrl saat melepas untuk menyalinnya." />
                    </div>
                    {groupParts.length > 1 && (
                      <div className="flex flex-wrap gap-1">
                        {groupParts.map((p) => {
                          const on = l.parts.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              aria-pressed={on}
                              // the last part of the group stays on: removing the pattern from a group is the trash button
                              disabled={on && onHere.length === 1}
                              onClick={() => togglePart(p.id)}
                              className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors disabled:cursor-not-allowed ${
                                on
                                  ? 'bg-sky-500/20 border-sky-500 text-sky-100'
                                  : 'bg-slate-800/70 border-slate-700/60 text-slate-400 hover:bg-slate-700'
                              }`}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {group === 'shirt' && (
                      <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!l.backFlip}
                          onChange={(e) => update(l.id, { backFlip: e.target.checked })}
                          className="accent-sky-500"
                        />
                        Putar 180° di punggung
                        <InfoTip text="Punggung di template PES terbalik. Nyalakan agar pola di punggung tampak sama dengan depan saat dipakai." />
                      </label>
                    )}
                  </div>
                )}
              </div>
  );
};

export default PatternLayerEditor;
