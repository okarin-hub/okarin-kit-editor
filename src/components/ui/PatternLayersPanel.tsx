'use client';

import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  FolderOpen,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { KitPartId, PatternLayer } from '@/types/kit';
import { PanelSection } from '@/components/ui/PanelSection';
import { PATTERN_LABEL, PATTERN_OPTIONS, REPEATING_PATTERNS, THICKNESS_PATTERNS } from '@/constants/patterns';
import { AssetLibrary } from '@/hooks/useAssetLibrary';
import { getCachedImage, preloadImage } from '@/utils/imageCache';
import { isTintableTile } from '@/utils/patternRenderer';

const PART_GROUPS: { label: string; parts: { id: KitPartId; label: string }[] }[] = [
  { label: 'Baju', parts: [{ id: 'front', label: 'Depan' }, { id: 'back', label: 'Belakang' }, { id: 'collar', label: 'Kerah' }] },
  { label: 'Lengan', parts: [{ id: 'leftSleeve', label: 'Kanan' }, { id: 'rightSleeve', label: 'Kiri' }] },
  { label: 'Celana', parts: [{ id: 'leftShorts', label: 'Kanan' }, { id: 'rightShorts', label: 'Kiri' }] },
  { label: 'Kaus kaki', parts: [{ id: 'leftSock', label: 'Kanan' }, { id: 'rightSock', label: 'Kiri' }] },
];

const SHIRT_PARTS: KitPartId[] = ['front', 'back'];

interface PatternLayersPanelProps {
  layers: PatternLayer[];
  library: AssetLibrary;
  activePartId: KitPartId | 'all';
  onChange: (layers: PatternLayer[]) => void;
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
      className="w-full accent-amber-500 cursor-pointer"
    />
  </div>
);

/** Pattern layers: any number of patterns drawn over the base colour, each with its own settings and parts. */
export const PatternLayersPanel: React.FC<PatternLayersPanelProps> = ({ layers, library, activePartId, onChange }) => {
  const [openId, setOpenId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<PatternLayer>) =>
    onChange(layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const addLayer = () => {
    const id = `pattern-${Date.now().toString(36)}`;
    const defaultParts: KitPartId[] =
      activePartId !== 'all' ? [activePartId] : SHIRT_PARTS;
    onChange([
      ...layers,
      {
        id,
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
        parts: defaultParts,
        backFlip: true,
      },
    ]);
    setOpenId(id);
  };

  const duplicate = (l: PatternLayer) => {
    const id = `pattern-${Date.now().toString(36)}`;
    const i = layers.findIndex((x) => x.id === l.id);
    const next = [...layers];
    next.splice(i + 1, 0, { ...l, id, name: `${l.name ?? 'Pola'} (salinan)` });
    onChange(next);
    setOpenId(id);
  };

  const remove = (id: string) => {
    onChange(layers.filter((l) => l.id !== id));
    if (openId === id) setOpenId(null);
  };

  // layers[0] is the bottom one; the list shows the top layer first, so "up" moves later in the array
  const move = (id: string, dir: 'up' | 'down') => {
    const i = layers.findIndex((l) => l.id === id);
    const j = dir === 'up' ? i + 1 : i - 1;
    if (i < 0 || j < 0 || j >= layers.length) return;
    const next = [...layers];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const togglePart = (l: PatternLayer, part: KitPartId) =>
    update(l.id, { parts: l.parts.includes(part) ? l.parts.filter((p) => p !== part) : [...l.parts, part] });

  const toggleGroup = (l: PatternLayer, ids: KitPartId[]) => {
    const all = ids.every((i) => l.parts.includes(i));
    update(l.id, { parts: all ? l.parts.filter((p) => !ids.includes(p)) : Array.from(new Set([...l.parts, ...ids])) });
  };

  const shown = [...layers].reverse();

  return (
    <PanelSection
      id="patterns"
      title="Layer Pola"
      icon={<Sparkles className="w-3.5 h-3.5 text-amber-400" />}
      badge={layers.length}
      action={
        <button
          type="button"
          onClick={addLayer}
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-amber-700/60 bg-amber-900/20 text-amber-100 hover:bg-amber-800/30"
        >
          <Plus className="w-3 h-3" />
          Tambah pola
        </button>
      }
    >
      <p className="text-[10px] text-slate-500 leading-snug">
        Pola digambar di atas warna dasar. Layer paling atas di daftar tampil paling depan. Tiap layer punya ukuran,
        posisi, rotasi, dan bagian sendiri.
      </p>

      {layers.length === 0 && (
        <p className="text-[11px] text-slate-500 text-center py-2">Belum ada pola. Klik Tambah pola.</p>
      )}

      {shown.map((l) => {
        const open = openId === l.id;
        const isLib = l.pattern === 'custom-image';
        const img = isLib && l.patternImage ? getCachedImage(l.patternImage) : undefined;
        const tintAuto = img && l.patternImage ? isTintableTile(l.patternImage, img) : true;
        const topIndex = layers.length - 1;
        const idx = layers.findIndex((x) => x.id === l.id);
        return (
          <div key={l.id} className="rounded-lg border border-slate-800 bg-slate-900/40">
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <button
                type="button"
                onClick={() => update(l.id, { visible: !l.visible })}
                className="text-slate-400 hover:text-white"
                title="Tampilkan / sembunyikan"
              >
                {l.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <button type="button" onClick={() => setOpenId(open ? null : l.id)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                <span className="w-4 h-4 rounded border border-slate-600 shrink-0" style={{ backgroundColor: l.patternColor }} />
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-semibold text-slate-200">
                    {l.name ?? PATTERN_LABEL[l.pattern] ?? 'Pola'}
                  </span>
                  <span className="block text-[10px] text-slate-500">{l.parts.length} bagian</span>
                </span>
                {open ? <ChevronDown className="w-3.5 h-3.5 ml-auto text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-500" />}
              </button>
              <button type="button" disabled={idx === topIndex} onClick={() => move(l.id, 'up')} className="text-slate-500 hover:text-white disabled:opacity-30" title="Naikkan (lebih depan)">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" disabled={idx === 0} onClick={() => move(l.id, 'down')} className="text-slate-500 hover:text-white disabled:opacity-30" title="Turunkan">
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => duplicate(l)} className="text-slate-500 hover:text-white" title="Gandakan">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => remove(l.id)} className="text-slate-500 hover:text-rose-400" title="Hapus layer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {open && (
              <div className="px-2.5 pb-3 pt-2.5 space-y-3 border-t border-slate-800">
                {/* Pattern type */}
                <select
                  value={l.pattern}
                  onChange={(e) =>
                    update(l.id, {
                      pattern: e.target.value as PatternLayer['pattern'],
                      name: PATTERN_LABEL[e.target.value] ?? l.name,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:border-amber-500 outline-none"
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
                      <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
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
                              active ? 'border-amber-400 bg-amber-500/10' : 'border-slate-700 bg-slate-800 hover:border-slate-500'
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
                      className="mt-0.5 accent-amber-500"
                    />
                    <span>
                      Warnai dengan Warna Pola
                      <span className="block text-[10px] text-slate-500">
                        {tintAuto ? 'Gambar ini satu warna, jadi otomatis bisa diwarnai.' : 'Gambar ini berwarna; matikan agar warna aslinya dipakai.'}
                      </span>
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
                      className="mt-0.5 accent-amber-500"
                    />
                    <span>
                      Berulang (Kontinu)
                      <span className="block text-[10px] text-slate-500">
                        {l.patternRepeat !== false
                          ? 'Pola diulang memenuhi bagian. Matikan agar muncul sekali saja.'
                          : 'Pola muncul sekali di tengah bagian; geser X/Y untuk memindahkannya.'}
                      </span>
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
                            ? 'bg-amber-500/20 border-amber-500 text-amber-200'
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
                  <span className="text-[11px] font-semibold text-slate-300">Cermin</span>
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
                              ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                              : 'bg-slate-800/70 border-slate-700/60 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <Icon className="w-3 h-3 shrink-0" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    Simetris: pola digambar di satu sisi lalu dicerminkan ke sisi lawannya (cocok untuk diagonal dan sash).
                  </p>
                </div>

                {/* Parts */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dipakai di bagian</div>
                  {PART_GROUPS.map((g) => {
                    const ids = g.parts.map((p) => p.id);
                    const all = ids.every((i) => l.parts.includes(i));
                    const some = ids.some((i) => l.parts.includes(i));
                    return (
                      <div key={g.label} className="flex items-start gap-2 text-[11px] text-slate-300">
                        <label className="flex items-center gap-1.5 w-20 cursor-pointer font-medium shrink-0">
                          <input
                            type="checkbox"
                            checked={all}
                            ref={(el) => {
                              if (el) el.indeterminate = some && !all;
                            }}
                            onChange={() => toggleGroup(l, ids)}
                            className="accent-amber-500"
                          />
                          {g.label}
                        </label>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {g.parts.map((p) => (
                            <label key={p.id} className="flex items-center gap-1 cursor-pointer text-slate-400">
                              <input type="checkbox" checked={l.parts.includes(p.id)} onChange={() => togglePart(l, p.id)} className="accent-amber-500" />
                              {p.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <label className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={!!l.backFlip}
                      onChange={(e) => update(l.id, { backFlip: e.target.checked })}
                      className="mt-0.5 accent-amber-500"
                    />
                    <span>
                      Putar 180° di punggung
                      <span className="block text-[10px] text-slate-500">
                        Punggung di template PES terbalik. Nyalakan agar pola di punggung tampak sama dengan depan saat dipakai.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </PanelSection>
  );
};

export default PatternLayersPanel;
