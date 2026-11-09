import {
  KitPartId,
  KitPartConfig,
  KitGraphicItem,
  PlayerMarkingsConfig,
  BaseTexture,
  TemplateState,
  KitTemplate,
  FabricConfig,
} from './kit';
import type { FontsetSettings } from '@/components/ui/FontsetModal';

export interface KitProject {
  id: string;
  name: string;
  teamName?: string;
  season?: string;
  author?: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string; // Base64 data URL preview
  partsConfig: Record<KitPartId, KitPartConfig>;
  graphicItems: KitGraphicItem[];
  markings: PlayerMarkingsConfig;
  baseTexture?: BaseTexture | null;
  /** PNG data URL: painted pixels hide the part patterns (pattern eraser brush). */
  patternMask?: string | null;
  /** Zone colours / seams of the active template. */
  template?: TemplateState | null;
  /** The template definition itself, so a project made with a custom template still opens elsewhere. */
  templateDef?: KitTemplate | null;
  /** Fabric texture layers (Fabric tab). */
  fabricConfig?: FabricConfig;
  /** Kitserver config.txt of this kit (as text). */
  kitConfig?: string;
  /** Fontset generator settings (fonts, colours, logo, pattern; not the imported font sheet picture). */
  fontset?: FontsetSettings | null;
}

export interface SavedProjectMeta {
  id: string;
  name: string;
  teamName?: string;
  season?: string;
  updatedAt: string;
  thumbnail?: string;
}

export type ExportTextureResolution = 1024 | 2048;

export type ExportFileFormat = 'png' | 'dds' | 'ftex';
export type ExportDdsFormat = 'dxt5' | 'dxt1' | 'bgra';

export interface ExportSettings {
  filename: string;
  resolution: ExportTextureResolution;
  includeMarkings: boolean;
  fileFormat: ExportFileFormat;
  ddsFormat: ExportDdsFormat;
  ddsMipmaps: boolean;
  exportType: 'game-texture' | 'project-file' | 'showcase-card';
  /** Game texture: also write the kitserver config.txt / the number and name fonts, all into one folder. */
  withConfig?: boolean;
  withFonts?: boolean;
}
