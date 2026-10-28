import { useCallback, useEffect, useRef, useState } from 'react';
import { notifyAssetsChanged } from '@/utils/imageCache';
import { KitTemplate } from '@/types/kit';

export interface LibraryEntry {
  id: string;
  name: string;
  category: string;
  path: string;
  url: string;
}

export interface LibraryFont extends LibraryEntry {
  family: string;
}

export type SystemFontStatus = 'idle' | 'loading' | 'ready' | 'unsupported' | 'denied';

export interface AssetLibrary {
  logos: LibraryEntry[];
  patterns: LibraryEntry[];
  textures: LibraryEntry[];
  fonts: LibraryFont[];
  templates: KitTemplate[];
  templateErrors: { file: string; error: string }[];
  root: string;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  systemFonts: string[];
  systemFontStatus: SystemFontStatus;
  loadSystemFonts: () => Promise<void>;
}

const SYSTEM_FONTS_KEY = 'pes_kit_creator_system_fonts';

/** Registers a font file from the library with the browser so canvas text can use it. */
async function registerLibraryFont(font: LibraryFont, loaded: Set<string>): Promise<boolean> {
  if (loaded.has(font.url)) return false;
  try {
    const face = new FontFace(font.family, `url(${font.url})`);
    await face.load();
    document.fonts.add(face);
    loaded.add(font.url);
    return true;
  } catch (e) {
    console.warn('Gagal memuat font library:', font.family, e);
    return false;
  }
}

/**
 * Reads the project library folders (logos / patterns / textures / fonts) through /api/library and the fonts
 * installed on this PC (Local Font Access API, Chromium/Edge only, asks the user for permission).
 */
export function useAssetLibrary(): AssetLibrary {
  const [logos, setLogos] = useState<LibraryEntry[]>([]);
  const [patterns, setPatterns] = useState<LibraryEntry[]>([]);
  const [textures, setTextures] = useState<LibraryEntry[]>([]);
  const [fonts, setFonts] = useState<LibraryFont[]>([]);
  const [templates, setTemplates] = useState<KitTemplate[]>([]);
  const [templateErrors, setTemplateErrors] = useState<{ file: string; error: string }[]>([]);
  const [root, setRoot] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [systemFontStatus, setSystemFontStatus] = useState<SystemFontStatus>('idle');
  const loadedFonts = useRef<Set<string>>(new Set());

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/library', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Server menjawab ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLogos(data.logos ?? []);
      setPatterns(data.patterns ?? []);
      setTextures(data.textures ?? []);
      setTemplates(data.templates ?? []);
      setTemplateErrors(data.templateErrors ?? []);
      setRoot(data.root ?? '');
      const fontList: LibraryFont[] = data.fonts ?? [];
      setFonts(fontList);

      const results = await Promise.all(fontList.map((f) => registerLibraryFont(f, loadedFonts.current)));
      if (results.some(Boolean)) notifyAssetsChanged();
    } catch (e: any) {
      setError(e?.message || 'Gagal membaca folder library.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSystemFonts = useCallback(async () => {
    const api = (window as any).queryLocalFonts;
    if (typeof api !== 'function') {
      setSystemFontStatus('unsupported');
      return;
    }
    setSystemFontStatus('loading');
    try {
      const faces: { family: string }[] = await api.call(window);
      const families = Array.from(new Set(faces.map((f) => f.family))).sort((a, b) =>
        a.localeCompare(b)
      );
      setSystemFonts(families);
      setSystemFontStatus('ready');
      try {
        localStorage.setItem(SYSTEM_FONTS_KEY, JSON.stringify(families));
      } catch {
        // list too large for the quota: it just has to be reloaded next session
      }
    } catch (e: any) {
      setSystemFontStatus(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'unsupported');
    }
  }, []);

  useEffect(() => {
    reload();
    // Reuse the font list from a previous session (the fonts themselves work without permission)
    try {
      const cached = localStorage.getItem(SYSTEM_FONTS_KEY);
      if (cached) {
        const families = JSON.parse(cached) as string[];
        if (families.length) {
          setSystemFonts(families);
          setSystemFontStatus('ready');
        }
      }
    } catch {
      // ignore
    }
  }, [reload]);

  return {
    logos,
    patterns,
    textures,
    fonts,
    templates,
    templateErrors,
    root,
    loading,
    error,
    reload,
    systemFonts,
    systemFontStatus,
    loadSystemFonts,
  };
}
