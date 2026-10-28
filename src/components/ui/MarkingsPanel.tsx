'use client';

import React from 'react';
import {
  Type,
  Hash,
  Eye,
  EyeOff,
  AlertTriangle,
  Sliders,
  Palette,
  CheckCircle2,
  Download,
} from 'lucide-react';
import { PlayerMarkingsConfig } from '@/types/kit';
import { AssetLibrary } from '@/hooks/useAssetLibrary';
import FontPicker from '@/components/ui/FontPicker';

interface MarkingsPanelProps {
  markings: PlayerMarkingsConfig;
  onUpdateMarkings: (update: Partial<PlayerMarkingsConfig>) => void;
  library: AssetLibrary;
}

export const MarkingsPanel: React.FC<MarkingsPanelProps> = ({
  markings,
  onUpdateMarkings,
  library,
}) => {
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

        {/* PES 2021 Important Note */}
        <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-600/30 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-sky-300 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Format PES 2021: Font Terpisah</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Game PES membaca nomor dan nama dari sistem font internal game (terpisah dari tekstur kit PNG). Fitur ini difokuskan untuk <strong>visualisasi penempatan (preview)</strong>.
          </p>

          <label className="flex items-center gap-2 pt-2 border-t border-sky-800/40 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={markings.includeInExport}
              onChange={(e) =>
                onUpdateMarkings({ includeInExport: e.target.checked })
              }
              className="accent-rose-500 rounded cursor-pointer"
            />
            <span className="text-[11px] text-slate-300">
              Sertakan nama/nomor saat Export PNG
            </span>
          </label>
          <p className="text-[10px] text-slate-500 italic">
            *Default nonaktif agar PNG kit game kamu tetap bersih standar PES.
          </p>
        </div>
      </div>

      {/* 2. Text Inputs */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
        </div>
      </div>

      {/* 3. Font & Colors */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Tipografi & Warna
        </span>

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

      {/* 4. Position & Sizing Adjustments */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Ukuran & Posisi
        </span>

        {/* Number Size */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Ukuran Nomor Punggung</span>
            <span className="font-mono">{markings.numberSize}px</span>
          </div>
          <input
            type="range"
            min="50"
            max="130"
            value={markings.numberSize}
            onChange={(e) =>
              onUpdateMarkings({ numberSize: parseInt(e.target.value) })
            }
            className="w-full accent-sky-500 cursor-pointer"
          />
        </div>

        {/* Name Size */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Ukuran Nama Pemain</span>
            <span className="font-mono">{markings.nameSize}px</span>
          </div>
          <input
            type="range"
            min="18"
            max="42"
            value={markings.nameSize}
            onChange={(e) =>
              onUpdateMarkings({ nameSize: parseInt(e.target.value) })
            }
            className="w-full accent-sky-500 cursor-pointer"
          />
        </div>

        {/* Name Vertical Position */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Posisi Vertikal Nama (Y)</span>
            <span className="font-mono">{markings.nameY}px</span>
          </div>
          <input
            type="range"
            min="60"
            max="200"
            value={markings.nameY}
            onChange={(e) =>
              onUpdateMarkings({ nameY: parseInt(e.target.value) })
            }
            className="w-full accent-sky-500 cursor-pointer"
          />
        </div>

        {/* Number Vertical Position */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Posisi Vertikal Nomor (Y)</span>
            <span className="font-mono">{markings.numberY}px</span>
          </div>
          <input
            type="range"
            min="160"
            max="340"
            value={markings.numberY}
            onChange={(e) =>
              onUpdateMarkings({ numberY: parseInt(e.target.value) })
            }
            className="w-full accent-sky-500 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

export default MarkingsPanel;
