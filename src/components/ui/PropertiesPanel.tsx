'use client';

import React from 'react';
import { FabricLayersPanel, DEFAULT_FABRIC_CONFIG } from '@/components/ui/FabricLayersPanel';
import {
  Palette,
  Sliders,
  Sparkles,
  Copy,
  Info,
  Layers,
  ArrowRightLeft,
  Shirt,
  Sparkle,
  FlipHorizontal2,
  FlipVertical2,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import { KitPartId, KitPartConfig, FabricConfig } from '@/types/kit';
import { PART_MAP } from '@/constants/pes2021Parts';
import { AssetLibrary } from '@/hooks/useAssetLibrary';
import { COLOR_PALETTES } from '@/constants/presets';

interface PropertiesPanelProps {
  activePartId: KitPartId | 'all';
  partsConfig: Record<KitPartId, KitPartConfig>;
  onUpdatePartConfig: (partId: KitPartId, config: Partial<KitPartConfig>) => void;
  onSyncRelatedParts: (partId: KitPartId) => void;
  library: AssetLibrary;
  fabricConfig?: FabricConfig;
  onUpdateFabricConfig?: (config: FabricConfig) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  activePartId,
  partsConfig,
  onUpdatePartConfig,
  onSyncRelatedParts,
  library,
  fabricConfig = DEFAULT_FABRIC_CONFIG,
  onUpdateFabricConfig,
}) => {
  if (activePartId === 'all') {
    return (
      <aside className="w-80 bg-[#121622] border-l border-slate-800 p-4 flex flex-col h-full select-none text-slate-400 overflow-y-auto space-y-5">
        <div className="flex items-center gap-2 text-slate-200 font-bold text-xs uppercase tracking-wider pb-3 border-b border-slate-800">
          <Info className="w-4 h-4 text-sky-400" />
          <span>Editor Bagian &amp; Tekstur Kain</span>
        </div>

        <FabricLayersPanel config={fabricConfig} library={library} onChange={(cfg) => onUpdateFabricConfig?.(cfg)} />

        <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/60 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mx-auto">
            <Palette className="w-5 h-5 text-rose-400" />
          </div>
          <p className="text-xs font-semibold text-slate-300">
            Pilih Bagian untuk Kustomisasi Warna
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Klik salah satu bagian kit pada kanvas (Baju Depan, Lengan, atau Celana) untuk memilih dari 14 pola jersey dan aksen kerah/manset.
          </p>
        </div>
      </aside>
    );
  }

  const partDef = PART_MAP[activePartId];
  const config = partsConfig[activePartId];

  // Helper check for related sync button
  const getSyncLabel = (id: KitPartId) => {
    if (id === 'leftSleeve' || id === 'rightSleeve') return 'Samakan Kedua Lengan';
    if (id === 'leftShorts' || id === 'rightShorts') return 'Samakan Kedua Celana';
    if (id === 'leftSock' || id === 'rightSock') return 'Samakan Kedua Kaus Kaki';
    if (id === 'front' || id === 'back') return 'Samakan Depan & Belakang';
    return null;
  };
  const syncLabel = getSyncLabel(activePartId);

  const isSleeve = activePartId === 'leftSleeve' || activePartId === 'rightSleeve';
  const isCollar = activePartId === 'collar';
  const isShorts = activePartId === 'leftShorts' || activePartId === 'rightShorts';
  const isSocks = activePartId === 'leftSock' || activePartId === 'rightSock';

  return (
    <aside className="w-80 bg-[#121622] border-l border-slate-800 flex flex-col h-full select-none overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-[#151926]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-900/60">
            {partDef.category}
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            {partDef.bounds.width}×{partDef.bounds.height} px
          </span>
        </div>
        <h2 className="text-sm font-bold text-white mt-1.5">{partDef.name}</h2>
        <p className="text-xs text-slate-400">{partDef.indoName}</p>
      </div>

      <div className="p-4 space-y-5">
        {/* Section 1: Warna Dasar */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-rose-400" />
              <span>Warna Dasar (Base Color)</span>
            </label>
            <span className="text-[11px] font-mono text-slate-400 uppercase">
              {config.color}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="color"
              value={config.color}
              onChange={(e) =>
                onUpdatePartConfig(activePartId, { color: e.target.value })
              }
              className="w-9 h-9 rounded-lg border border-slate-700 bg-transparent cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={config.color}
              onChange={(e) =>
                onUpdatePartConfig(activePartId, { color: e.target.value })
              }
              className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 uppercase focus:border-rose-500 outline-none"
            />
          </div>

          {/* Quick Palette Swatches */}
          <div className="grid grid-cols-6 gap-1.5 pt-1">
            {COLOR_PALETTES.map((color) => (
              <button
                key={color}
                onClick={() =>
                  onUpdatePartConfig(activePartId, { color })
                }
                className={`w-full aspect-square rounded-md border transition-transform hover:scale-110 ${
                  config.color.toLowerCase() === color.toLowerCase()
                    ? 'border-white scale-105 shadow-md'
                    : 'border-black/40'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* Section 2: patterns now live in the Layer tab */}
        <div className="space-y-1.5 pt-3 border-t border-slate-800">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Pola Desain</span>
          </label>
          <p className="text-[11px] text-slate-500 leading-snug bg-slate-900/40 border border-slate-800 rounded-lg p-2.5">
            Pola sekarang diatur sebagai layer di tab <strong className="text-slate-300">Layer</strong> (bagian
            &quot;Layer Pola&quot;): boleh lebih dari satu, dan tiap pola punya ukuran, posisi, rotasi, mirror, dan
            bagian sendiri.
          </p>
        </div>

        {/* Section 3: Accent Cuffs & Collar Striping */}
        {(isSleeve || isCollar || isShorts || isSocks) && (
          <div className="space-y-2.5 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span>
                  {isSleeve
                    ? 'Aksen Manset Lengan (Cuff)'
                    : isCollar
                    ? 'Garis Tengah Kerah (Rib)'
                    : isShorts
                    ? 'Lis Bawah Celana'
                    : 'Karet Kaus Kaki (Top Cuff)'}
                </span>
              </label>
              <input
                type="checkbox"
                checked={config.cuffStripeEnabled || false}
                onChange={(e) =>
                  onUpdatePartConfig(activePartId, {
                    cuffStripeEnabled: e.target.checked,
                    cuffStripeColor: config.cuffStripeColor || '#ffffff',
                    cuffStripeWidth: config.cuffStripeWidth || 14,
                  })
                }
                className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
              />
            </div>

            {config.cuffStripeEnabled && (
              <div className="space-y-2.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Warna Lis Aksen</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.cuffStripeColor || '#ffffff'}
                      onChange={(e) =>
                        onUpdatePartConfig(activePartId, {
                          cuffStripeColor: e.target.value,
                        })
                      }
                      className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5"
                    />
                    <span className="font-mono uppercase text-slate-300">
                      {config.cuffStripeColor || '#ffffff'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Ketebalan Lis</span>
                    <span className="font-mono">{config.cuffStripeWidth || 14}px</span>
                  </div>
                  <input
                    type="range"
                    min="6"
                    max="30"
                    step="2"
                    value={config.cuffStripeWidth || 14}
                    onChange={(e) =>
                      onUpdatePartConfig(activePartId, {
                        cuffStripeWidth: parseInt(e.target.value),
                      })
                    }
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 4: Sync Actions */}
        {syncLabel && (
          <div className="pt-2">
            <button
              onClick={() => onSyncRelatedParts(activePartId)}
              className="w-full flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium py-2 px-3 rounded-lg border border-slate-700/60 transition-colors"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-rose-400" />
              <span>{syncLabel}</span>
            </button>
          </div>
        )}

        {/* Section 5: Technical Coordinates info */}
        <div className="pt-3 border-t border-slate-800 text-[11px] space-y-1.5 text-slate-500">
          <p className="font-semibold text-slate-400">Info UV Map PES 2021:</p>
          <div className="grid grid-cols-2 gap-1 font-mono text-[10px] bg-slate-900/50 p-2 rounded border border-slate-800/60">
            <div>X: {partDef.bounds.x} px</div>
            <div>Y: {partDef.bounds.y} px</div>
            <div>W: {partDef.bounds.width} px</div>
            <div>H: {partDef.bounds.height} px</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default PropertiesPanel;
