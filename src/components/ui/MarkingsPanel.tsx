'use client';

import React, { useMemo } from 'react';
import { Type, Eye, EyeOff } from 'lucide-react';
import { PlayerMarkingsConfig } from '@/types/kit';
import { AssetLibrary } from '@/hooks/useAssetLibrary';
import FontPicker from '@/components/ui/FontPicker';
import { InfoTip } from '@/components/ui/InfoTip';
import { KIT_CONFIG_FIELDS, KitConfigField, parseKitConfig, setKitConfigValue } from '@/utils/kitConfig';

const FIELD: Record<string, KitConfigField> = Object.fromEntries(KIT_CONFIG_FIELDS.map((f) => [f.key, f]));

const CONFIG_SECTIONS: [string, string[]][] = [
  ['Punggung', ['NameShape', 'NameY', 'NameSize', 'NameStretch', 'BackNumberY', 'BackNumberSize', 'BackNumberSpacing', 'BackNumberType']],
  ['Nomor dada', ['ChestNumberX', 'ChestNumberY', 'ChestNumberSize']],
  ['Celana', ['ShortsNumberSide', 'ShortsNumberX', 'ShortsNumberY', 'ShortsNumberSize']],
  ['Badge lengan', ['RightShortX', 'RightShortY', 'LeftShortX', 'LeftShortY', 'RightLongX', 'RightLongY', 'LeftLongX', 'LeftLongY']],
];

// values the preview does not show yet
const NOTES: Record<string, string> = {
  BackNumberType: 'Belum dipratinjau.',
  RightShortX: 'Penanda badge hanya untuk mengukur posisi (centang Badge lengan di Tampilkan); tidak ikut export.',
};

interface MarkingsPanelProps {
  markings: PlayerMarkingsConfig;
  onUpdateMarkings: (update: Partial<PlayerMarkingsConfig>) => void;
  library: AssetLibrary;
  /** config.txt text: the name / number placement values live there */
  kitConfig: string;
  onKitConfigChange: (text: string) => void;
}

export const MarkingsPanel: React.FC<MarkingsPanelProps> = ({
  markings,
  onUpdateMarkings,
  library,
  kitConfig,
  onKitConfigChange,
}) => {
  const cfg = useMemo(() => parseKitConfig(kitConfig), [kitConfig]);
  const setValue = (key: string, value: string) => onKitConfigChange(setKitConfigValue(kitConfig, key, value));
  return (
    <div className="flex flex-col h-full select-none overflow-y-auto text-slate-300 p-4 space-y-5">
      {/* 1. Master Toggle & Info Card */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold text-white">
              Preview Nama & Nomor
            </span>
          </div>

          <button
            onClick={() =>
              onUpdateMarkings({ showPreview: !markings.showPreview })
            }
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              markings.showPreview
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {markings.showPreview ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Aktif</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Mati</span>
              </>
            )}
          </button>
        </div>

        {/* PES reads names / numbers from its own fonts: here they are only a placement preview */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markings.includeInExport}
              onChange={(e) =>
                onUpdateMarkings({ includeInExport: e.target.checked })
              }
              className="accent-sky-500 rounded cursor-pointer"
            />
            <span className="text-[11px] text-slate-300">
              Sertakan nama/nomor saat Export PNG
            </span>
          </label>
          <InfoTip
            text="Game PES membaca nomor dan nama dari font internal game, terpisah dari tekstur kit. Di sini nama dan nomor hanya pratinjau penempatan. Biarkan mati agar PNG kit tetap bersih (standar PES)."
          />
        </div>
      </div>

      {/* 2. Text Inputs */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <span className="text-xs font-semibold text-slate-200">
          Data Pemain
        </span>

        <div className="space-y-2">
          {/* Player Name */}
          <div>
            <label className="text-[11px] text-slate-400 font-medium">
              Nama Punggung (Player Name)
            </label>
            <input
              type="text"
              value={markings.playerName}
              onChange={(e) =>
                onUpdateMarkings({ playerName: e.target.value.toUpperCase() })
              }
              placeholder="RONALDO"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase font-bold tracking-wider mt-1 focus:border-sky-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Squad Number */}
            <div>
              <label className="text-[11px] text-slate-400 font-medium">
                Nomor Punggung
              </label>
              <input
                type="text"
                value={markings.playerNumber}
                onChange={(e) =>
                  onUpdateMarkings({ playerNumber: e.target.value })
                }
                placeholder="7"
                maxLength={3}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold tracking-wider mt-1 focus:border-sky-500 outline-none text-center"
              />
            </div>

            {/* Shorts Number */}
            <div>
              <label className="text-[11px] text-slate-400 font-medium">
                Nomor Celana
              </label>
              <input
                type="text"
                value={markings.shortsNumber}
                onChange={(e) =>
                  onUpdateMarkings({ shortsNumber: e.target.value })
                }
                placeholder="7"
                maxLength={3}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold tracking-wider mt-1 focus:border-sky-500 outline-none text-center"
              />
            </div>
          </div>

          {/* some kits have no chest or shorts number: each one can be switched off */}
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Tampilkan</span>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
              {(
                [
                  // the name's switch is the config value the game reads (Name: 0 = On, 1 = Off)
                  ['Nama', cfg.Name !== '1', (on: boolean) => setValue('Name', on ? '0' : '1')],
                  ['Nomor punggung', markings.showBackNumber !== false, (on: boolean) => onUpdateMarkings({ showBackNumber: on })],
                  ['Nomor dada', markings.showChestNumber !== false, (on: boolean) => onUpdateMarkings({ showChestNumber: on })],
                  ['Nomor celana', markings.showShortsNumber !== false, (on: boolean) => onUpdateMarkings({ showShortsNumber: on })],
                  // a placement aid only: the game draws the competition badge, the kit texture has none
                  ['Badge lengan', markings.showBadges === true, (on: boolean) => onUpdateMarkings({ showBadges: on })],
                ] as [string, boolean, (on: boolean) => void][]
              ).map(([label, on, set]) => (
                <label key={label} className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="accent-sky-500 cursor-pointer" />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Font & Colors */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <span className="text-xs font-semibold text-slate-200">
          Tipografi & Warna
        </span>

        <div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="markings-fontset" className="text-[11px] text-slate-400">Font PES</label>
            <InfoTip text="Font yang dibuat di Fontset Generator lalu disimpan dengan Simpan ke library (library/fonts/font_pes). Warna, outline, dan efeknya ikut font itu; karakter yang tidak ada di font memakai Gaya Font di bawah." />
          </div>
          <select
            id="markings-fontset"
            value={markings.fontset ?? ''}
            onChange={(e) => onUpdateMarkings({ fontset: e.target.value || undefined })}
            className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
          >
            <option value="">Tidak dipakai (pakai Gaya Font)</option>
            {library.fontsets.map((f) => (
              <option key={f.name} value={f.name}>{f.name}</option>
            ))}
            {markings.fontset && !library.fontsets.some((f) => f.name === markings.fontset) && (
              <option value={markings.fontset}>{markings.fontset} (tidak ditemukan)</option>
            )}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-400">Gaya Font</label>
          <div className="mt-1">
            <FontPicker
              value={markings.fontFamily}
              onChange={(f) => onUpdateMarkings({ fontFamily: f })}
              library={library}
            />
          </div>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[11px] text-slate-400">Warna Nomor</span>
            <div className="flex items-center gap-1.5 mt-1">
              <input
                type="color"
                value={markings.numberColor}
                onChange={(e) =>
                  onUpdateMarkings({ numberColor: e.target.value })
                }
                className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5"
              />
              <span className="font-mono text-[11px] uppercase">
                {markings.numberColor}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[11px] text-slate-400">Warna Nama</span>
            <div className="flex items-center gap-1.5 mt-1">
              <input
                type="color"
                value={markings.nameColor}
                onChange={(e) => onUpdateMarkings({ nameColor: e.target.value })}
                className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5"
              />
              <span className="font-mono text-[11px] uppercase">
                {markings.nameColor}
              </span>
            </div>
          </div>
        </div>

        {/* Stroke / Outline */}
        <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Warna Outline (Border)</span>
            <div className="flex items-center gap-1">
              <input
                type="color"
                value={markings.numberStrokeColor}
                onChange={(e) =>
                  onUpdateMarkings({ numberStrokeColor: e.target.value })
                }
                className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Ketebalan Outline</span>
              <span className="font-mono">{markings.numberStrokeWidth}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="8"
              step="1"
              value={markings.numberStrokeWidth}
              onChange={(e) =>
                onUpdateMarkings({ numberStrokeWidth: parseInt(e.target.value) })
              }
              className="w-full accent-sky-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 4. Position & size: the kitserver config values (the same ones Kit Config writes to config.txt) */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-200">Ukuran & Posisi</span>
          <InfoTip text="Nilai config kitserver (config.txt), sama dengan di menu Kit Config. Preview memakai ukuran yang diukur di game, jadi posisinya perkiraan." />
        </div>
        {CONFIG_SECTIONS.map(([title, keys]) => (
          <div key={title} className="space-y-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-300">{title}</span>
            {keys.map((key) => {
              const f = FIELD[key];
              const raw = cfg[key];
              const v = raw === undefined || raw === '' || !Number.isFinite(Number(raw)) ? (f.def ?? f.min ?? 0) : Number(raw);
              const note = NOTES[key];
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] text-slate-400 gap-2">
                    <span>{f.label}</span>
                    {f.options ? (
                      <select
                        value={v}
                        onChange={(e) => setValue(key, e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-200"
                      >
                        {f.options.map(([o, label]) => (
                          <option key={o} value={o}>{label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-mono">{v}</span>
                    )}
                  </div>
                  {!f.options && (
                    <input
                      type="range"
                      min={f.min}
                      max={f.max}
                      step={1}
                      value={v}
                      onChange={(e) => setValue(key, e.target.value)}
                      aria-label={f.label}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                  )}
                  {note && <p className="text-[10px] text-slate-500">{note}</p>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MarkingsPanel;
