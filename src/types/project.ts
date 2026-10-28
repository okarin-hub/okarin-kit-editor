import {
  KitPartId,
  KitPartConfig,
  KitGraphicItem,
  PlayerMarkingsConfig,
  BaseTexture,
  TemplateState,
  KitTemplate,
} from './kit';

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
}
