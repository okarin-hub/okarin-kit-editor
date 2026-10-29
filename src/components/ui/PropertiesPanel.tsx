'use client';

import React from 'react';
import { Shirt } from 'lucide-react';
import { FabricLayersPanel, DEFAULT_FABRIC_CONFIG } from '@/components/ui/FabricLayersPanel';
import { FabricConfig } from '@/types/kit';
import { AssetLibrary } from '@/hooks/useAssetLibrary';

interface PropertiesPanelProps {
  library: AssetLibrary;
  fabricConfig?: FabricConfig;
  onUpdateFabricConfig?: (config: FabricConfig) => void;
}

/** The Fabric tab: fabric texture layers for the whole kit. Part colours, trims and patterns live in the Layer tab. */
export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  library,
  fabricConfig = DEFAULT_FABRIC_CONFIG,
  onUpdateFabricConfig,
}) => (
  <aside className="w-80 bg-[#121622] border-l border-slate-800 p-4 flex flex-col h-full select-none text-slate-400 overflow-y-auto space-y-4">
    <div className="flex items-center gap-2 text-slate-200 font-bold text-xs uppercase tracking-wider pb-3 border-b border-slate-800">
      <Shirt className="w-4 h-4 text-amber-400" />
      <span>Tekstur Kain</span>
    </div>

    <FabricLayersPanel config={fabricConfig} library={library} onChange={(cfg) => onUpdateFabricConfig?.(cfg)} />

    <p className="text-[11px] text-slate-500 leading-snug">Warna, lis, dan pola tiap bagian diatur di tab Layer.</p>
  </aside>
);

export default PropertiesPanel;
