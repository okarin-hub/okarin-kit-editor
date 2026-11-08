import { useCallback, useEffect, useRef, useState } from 'react';
import { notifyAssetsChanged } from '@/utils/imageCache';
import { KitTemplate } from '@/types/kit';
import type { PsdSyncRequest, PsdSyncReply } from '@/workers/psdTemplate.worker';

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

/** A PES fontset the generator saved in library/fonts/font_pes: PNG sheet URL by kind (back, chest, leg, name, name_ex). */
export interface LibraryFontset {
  name: string;
  files: Record<string, string>;
}

export type SystemFontStatus = 'idle' | 'loading' | 'ready' | 'unsupported' | 'denied';

export interface AssetLibrary {
  logos: LibraryEntry[];
  patterns: LibraryEntry[];
  textures: LibraryEntry[];
  fonts: LibraryFont[];
  fontsets: LibraryFontset[];
  templates: KitTemplate[];
  templateErrors: { file: string; error: string }[];
  root: string;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** The PSD in library/templates being read now (it becomes a template when done). */
  psdBusy: { name: string; done: number; total: number } | null;
  /** PSDs that could not be read (they are tried again once the file changes). */
  psdErrors: { file: string; error: string }[];
  systemFonts: string[];
  systemFontStatus: SystemFontStatus;
  loadSystemFonts: () => Promise<void>;
}

type PsdItem = PsdSyncRequest;

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
  const [fontsets, setFontsets] = useState<LibraryFontset[]>([]);
  const [templates, setTemplates] = useState<KitTemplate[]>([]);
  const [templateErrors, setTemplateErrors] = useState<{ file: string; error: string }[]>([]);
  const [root, setRoot] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [systemFontStatus, setSystemFontStatus] = useState<SystemFontStatus>('idle');
  const loadedFonts = useRef<Set<string>>(new Set());
  const [psdQueue, setPsdQueue] = useState<PsdItem[]>([]);
  const [psdBusy, setPsdBusy] = useState<AssetLibrary['psdBusy']>(null);
  const [psdErrors, setPsdErrors] = useState<{ file: string; error: string }[]>([]);
  // path + revision of every PSD already queued or failed, so a reload does not start it again
  const psdSeen = useRef<Set<string>>(new Set());
  // one PSD at a time (a ref: React may run the effect twice before the state update lands)
  const psdRunning = useRef(false);

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
      setFontsets(data.fontsets ?? []);
      setTemplates(data.templates ?? []);
      setTemplateErrors(data.templateErrors ?? []);
      const fresh = ((data.psd ?? []) as (PsdItem & { ready: boolean })[]).filter(
        (p) => !p.ready && !psdSeen.current.has(`${p.path}@${p.rev}`)
      );
      fresh.forEach((p) => psdSeen.current.add(`${p.path}@${p.rev}`));
      if (fresh.length) setPsdQueue((q) => [...q, ...fresh.map(({ path, name, rev }) => ({ path, name, rev }))]);
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

  // PSDs dropped in library/templates are read one at a time in a worker, then the library is read again
  useEffect(() => {
    if (psdRunning.current || !psdQueue.length) return;
    psdRunning.current = true;
    const item = psdQueue[0];
    setPsdBusy({ name: item.name, done: 0, total: 0 });
    const w = new Worker(new URL('../workers/psdTemplate.worker.ts', import.meta.url));
    const finish = (error?: string) => {
      w.terminate();
      psdRunning.current = false;
      if (error) setPsdErrors((e) => [...e.filter((x) => x.file !== item.path), { file: item.path, error }]);
      else setPsdErrors((e) => e.filter((x) => x.file !== item.path));
      setPsdQueue((q) => q.slice(1));
      setPsdBusy(null);
      if (!error) reload();
    };
    w.onmessage = (e: MessageEvent<PsdSyncReply>) => {
      const r = e.data;
      if (r.type === 'progress') setPsdBusy({ name: item.name, done: r.done, total: r.total });
      else finish(r.type === 'error' ? r.error : undefined);
    };
    w.onerror = (e) => finish(e.message || 'Worker gagal');
    w.postMessage(item satisfies PsdSyncRequest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [psdQueue]);

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
    fontsets,
    templates,
    templateErrors,
    root,
    loading,
    error,
    reload,
    psdBusy,
    psdErrors,
    systemFonts,
    systemFontStatus,
    loadSystemFonts,
  };
}
