'use client';

import React from 'react';
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
  <div className="flex flex-col h-full select-none text-slate-400 overflow-y-auto p-3">
    <FabricLayersPanel config={fabricConfig} library={library} onChange={(cfg) => onUpdateFabricConfig?.(cfg)} />
  </div>
);

export default PropertiesPanel;
