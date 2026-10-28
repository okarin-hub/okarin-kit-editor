import { KitProject, SavedProjectMeta } from '@/types/project';
import {
  KitPartId,
  KitPartConfig,
  KitGraphicItem,
  PlayerMarkingsConfig,
  BaseTexture,
  TemplateBundle,
} from '@/types/kit';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const STORAGE_KEYS = {
  PROJECTS_LIST: 'pes_kit_creator_saved_projects',
  AUTOSAVE: 'pes_kit_creator_autosave',
  BASE_TEXTURE: 'pes_kit_creator_base_texture',
  PATTERN_MASK: 'pes_kit_creator_pattern_mask',
  TEMPLATE: 'pes_kit_creator_template',
};

// 1. Get list of saved projects metadata
export function getLocalProjectsList(): SavedProjectMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROJECTS_LIST);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load local projects list:', e);
    return [];
  }
}

// 2. Load single project by ID
export function getLocalProjectById(id: string): KitProject | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`pes_kit_proj_${id}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load project:', e);
    return null;
  }
}

// 3. Save project locally
export function saveProjectLocally(project: KitProject): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const projectWithDate = {
      ...project,
      updatedAt: new Date().toISOString(),
    };

    // Save full payload
    localStorage.setItem(`pes_kit_proj_${project.id}`, JSON.stringify(projectWithDate));

    // Update metadata list
    const currentList = getLocalProjectsList().filter((p) => p.id !== project.id);
    const meta: SavedProjectMeta = {
      id: project.id,
      name: project.name,
      teamName: project.teamName,
      season: project.season,
      updatedAt: projectWithDate.updatedAt,
      thumbnail: project.thumbnail,
    };

    localStorage.setItem(
      STORAGE_KEYS.PROJECTS_LIST,
      JSON.stringify([meta, ...currentList])
    );
    return true;
  } catch (e) {
    console.error('Failed to save project locally:', e);
    return false;
  }
}

// 4. Delete project locally
export function deleteProjectLocally(id: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.removeItem(`pes_kit_proj_${id}`);
    const updatedList = getLocalProjectsList().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PROJECTS_LIST, JSON.stringify(updatedList));
    return true;
  } catch (e) {
    console.error('Failed to delete project:', e);
    return false;
  }
}

// 5. Download project file (.peskit / .json)
export function downloadPeskitFile(project: KitProject): void {
  const exportPayload = {
    ...project,
    version: '1.0',
    exportedAt: new Date().toISOString(),
  };

  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(exportPayload, null, 2)
  )}`;
  const downloadAnchor = document.createElement('a');
  const safeFilename = (project.name || 'kit_project')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');

  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', `${safeFilename}.peskit`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// 6. Parse uploaded .peskit / .json file
export function parsePeskitFile(file: File): Promise<KitProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        // Basic structural validation
        if (!parsed.partsConfig) {
          throw new Error('Format file kit tidak valid: partsConfig tidak ditemukan.');
        }

        const project: KitProject = {
          id: parsed.id || `imported_${Date.now()}`,
          name: parsed.name || file.name.replace(/\.[^/.]+$/, ''),
          teamName: parsed.teamName || '',
          season: parsed.season || '',
          author: parsed.author || '',
          version: parsed.version || '1.0',
          createdAt: parsed.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          thumbnail: parsed.thumbnail,
          partsConfig: parsed.partsConfig,
          graphicItems: parsed.graphicItems || [],
          baseTexture: parsed.baseTexture || null,
          patternMask: parsed.patternMask || null,
          template: parsed.template || null,
          templateDef: parsed.templateDef || null,
          markings: parsed.markings || {
            showPreview: true,
            includeInExport: false,
            playerName: 'RONALDO',
            playerNumber: '7',
            shortsNumber: '7',
            fontFamily: "'Impact', 'Arial Black', sans-serif",
            numberColor: '#ffffff',
            numberStrokeColor: '#1e293b',
            numberStrokeWidth: 2,
            nameColor: '#ffffff',
            nameSize: 28,
            numberSize: 84,
            shortsNumberSize: 42,
            nameY: 105,
            numberY: 195,
            shortsNumberX: 120,
            shortsNumberY: 760,
          },
        };

        resolve(project);
      } catch (err: any) {
        reject(new Error(err.message || 'Gagal membaca file proyek kit.'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membuka file.'));
    reader.readAsText(file);
  });
}

// 7. Autosave helpers
export function saveAutosaveState(state: {
  partsConfig: Record<KitPartId, KitPartConfig>;
  graphicItems: KitGraphicItem[];
  markings: PlayerMarkingsConfig;
}): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.AUTOSAVE, JSON.stringify(state));
  } catch (e) {
    // Silently ignore quota exceeded
  }
}

export function loadAutosaveState(): {
  partsConfig: Record<KitPartId, KitPartConfig>;
  graphicItems: KitGraphicItem[];
  markings: PlayerMarkingsConfig;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTOSAVE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Imported design is stored under its own key: it can be several MB and must never
// make the main autosave fail on the localStorage quota.
export function saveBaseTextureState(baseTexture: BaseTexture | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!baseTexture) {
      localStorage.removeItem(STORAGE_KEYS.BASE_TEXTURE);
    } else {
      localStorage.setItem(STORAGE_KEYS.BASE_TEXTURE, JSON.stringify(baseTexture));
    }
  } catch (e) {
    // Too large for the browser quota: the design stays usable this session, just not restored
  }
}

export function saveTemplateState(bundle: TemplateBundle): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.TEMPLATE, JSON.stringify(bundle));
  } catch (e) {
    // ignore quota errors
  }
}

export function loadTemplateState(): TemplateBundle | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TEMPLATE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.def && parsed?.state ? (parsed as TemplateBundle) : null;
  } catch (e) {
    return null;
  }
}

export function savePatternMaskState(mask: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!mask) localStorage.removeItem(STORAGE_KEYS.PATTERN_MASK);
    else localStorage.setItem(STORAGE_KEYS.PATTERN_MASK, mask);
  } catch (e) {
    // quota exceeded: mask stays usable for this session only
  }
}

export function loadPatternMaskState(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEYS.PATTERN_MASK);
  } catch (e) {
    return null;
  }
}

export function loadBaseTextureState(): BaseTexture | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BASE_TEXTURE);
    return raw ? (JSON.parse(raw) as BaseTexture) : null;
  } catch (e) {
    return null;
  }
}

// 8. Supabase Cloud Sync (Optional)
export async function saveProjectToSupabase(project: KitProject): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      message: 'Supabase belum dikonfigurasi di file .env.local.',
    };
  }

  try {
    const { error } = await supabase.from('kits').upsert({
      id: project.id,
      name: project.name,
      team_name: project.teamName,
      season: project.season,
      data: project,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
    return { success: true, message: 'Kit berhasil disimpan ke cloud database Supabase!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal menyimpan ke Supabase.' };
  }
}
