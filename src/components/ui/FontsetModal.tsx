'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Type, FolderDown, ImageDown, AlertCircle, ImagePlus, Trash2, Library } from 'lucide-react';
import { FontPicker } from '@/components/ui/FontPicker';
import { KitserverHeader } from '@/components/ui/KitserverHeader';
import { useI18n } from '@/i18n/I18nProvider';
import { AssetLibrary } from '@/hooks/useAssetLibrary';
import {
  FontsetLayout,
  NUMBER_LAYOUT,
  BACK_NUMBER_LAYOUT,
  NAME_LAYOUT,
  NAME_EX_LAYOUT,
} from '@/constants/fontsetSlots';
import {
  FontsetStyle,
  OutlineAlign,
  GlyphSource,
  Glyph,
  NumberLogo,
  FontPattern,
  SheetGlyph,
  SheetRow,
  renderFontset,
  fontsetImageData,
  missingGlyphs,
  fontGlyphSource,
  sheetGlyphSource,
  analyzeFontSheet,
  sheetInkColor,
} from '@/utils/fontsetGenerator';
import { readSheetRows } from '@/utils/glyphRecognition';
import { LogoMonoMode, oneColourLogo } from '@/utils/logoMono';
import { zoomFactor } from '@/utils/uiPrefs';
import { FontSheetCropDialog } from '@/components/ui/FontSheetCropDialog';
import { encodeDDS } from '@/utils/ddsEncoder';
import { encodeFtex } from '@/utils/ftexEncoder';
import { parseKitConfig, setKitConfigValue, kitConfigToFile } from '@/utils/kitConfig';
import { downloadFile, saveFilesToFolder, OutFile } from '@/utils/folderSave';

type FileKind = 'back' | 'chest' | 'leg' | 'name' | 'name_ex';
type Group = 'number' | 'name';

const FILES: { kind: FileKind; label: string; layout: FontsetLayout; group: Group; configKey?: string }[] = [
  { kind: 'back', label: 'Nomor punggung', layout: BACK_NUMBER_LAYOUT, group: 'number', configKey: 'BackNumbersFile' },
  { kind: 'chest', label: 'Nomor dada', layout: NUMBER_LAYOUT, group: 'number', configKey: 'ChestNumbersFile' },
  { kind: 'leg', label: 'Nomor celana', layout: NUMBER_LAYOUT, group: 'number', configKey: 'LegNumbersFile' },
  { kind: 'name', label: 'Font nama', layout: NAME_LAYOUT, group: 'name', configKey: 'NameFontFile' },
  // kserv derives <NameFontFile>_ex itself, so it has no key of its own
  { kind: 'name_ex', label: 'Font nama (_ex, huruf beraksen)', layout: NAME_EX_LAYOUT, group: 'name' },
];
const fileOf = (kind: FileKind) => FILES.find((f) => f.kind === kind)!;
const groupChars = (group: Group) =>
  [...new Set(FILES.filter((f) => f.group === group).flatMap((f) => f.layout.rows.flat().map((s) => s.ch)))];

const DEFAULT_STYLE: FontsetStyle = {
  fontFamily: "'Impact', 'Arial Black', sans-serif",
  fontWeight: 'normal',
  fill: '#FFFFFF',
  outline: '#000000',
  outlineWidth: 0,
};

interface LogoState {
  url: string | null;
  image: HTMLImageElement | null;
  size: number;
  y: number;
  x: number;
  opacity: number;
  clip: boolean;
  files: Record<'back' | 'chest' | 'leg', boolean>;
  /** per-digit shift on top of x / y */
  offsets: Record<string, { x: number; y: number }>;
  /** one-colour logo (traced): off, the whole shape, or its dark (or light) parts */
  mono: LogoMonoMode;
  monoColor: string;
  /** brightness cut for 'detail', 0..100 */
  monoCut: number;
  monoInvert: boolean;
}

interface PatternState {
  url: string | null;
  image: HTMLImageElement | null;
  /** recolour single-colour tiles */
  tint: boolean;
  color: string;
  scale: number;
  opacity: number;
}

const DEFAULT_PATTERN: PatternState = { url: null, image: null, tint: true, color: '#FFFFFF', scale: 64, opacity: 0.5 };

interface SheetState {
  name: string;
  rows: SheetRow[];
  chars: string[];
  /** small previews of every glyph, and how sure the reading is */
  thumbs: string[][];
  confidence: number[][];
  missing: string[][];
}

/**
 * The characters of a PES font texture made earlier (one sheet file, laid out in the PES slots), cut out per slot and
 * trimmed to their ink, as one sheet row each. Null when the picture is not there.
 */
async function slotRows(url: string | undefined, layout: FontsetLayout): Promise<{ row: SheetRow; chars: string }[] | null> {
  if (!url) return null;
  const im = new Image();
  im.src = url;
  if (!(await im.decode().then(() => true, () => false))) return null;
  const k = im.width / layout.width;
  const src = document.createElement('canvas');
  src.width = im.width;
  src.height = im.height;
  const sctx = src.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(im, 0, 0);
  return layout.rows.map((slots, r) => {
    const glyphs: SheetGlyph[] = [];
    let chars = '';
    for (const sl of slots) {
      const x0 = Math.round(sl.x0 * k), x1 = Math.round(sl.x1 * k), y0 = Math.round(r * layout.rowHeight * k), h = Math.round(layout.rowHeight * k);
      const d = sctx.getImageData(x0, y0, Math.max(1, x1 - x0), h).data;
      const w = Math.max(1, x1 - x0);
      let minX = w, maxX = -1, minY = h, maxY = -1;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (d[(y * w + x) * 4 + 3] > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
      if (maxX < 0) continue; // an empty slot: the font fills that character in
      const c = document.createElement('canvas');
      c.width = maxX - minX + 1;
      c.height = maxY - minY + 1;
      c.getContext('2d')!.drawImage(src, x0 + minX, y0 + minY, c.width, c.height, 0, 0, c.width, c.height);
      glyphs.push({ canvas: c, base: layout.baseline * k - minY, capH: (layout.baseline - layout.top) * k });
      chars += sl.ch;
    }
    return { row: { glyphs }, chars };
  });
}

/** Preview of a sheet glyph at its row's scale (capitals 28 of 40 px, on a shared baseline): a dash stays a small dash. */
const thumbOf = (g: SheetGlyph) => {
  const c = g.canvas;
  const H = 40, BASE = 34;
  const s = Math.min(28 / g.capH, H / c.height); // a glyph taller than the row (an accent) is shrunk to fit
  const t = document.createElement('canvas');
  t.height = H;
  t.width = Math.max(4, Math.round(c.width * s));
  const y = Math.max(0, Math.min(BASE - g.base * s, H - c.height * s));
  t.getContext('2d')!.drawImage(c, 0, y, c.width * s, c.height * s);
  return t.toDataURL();
};

const DEFAULT_LOGO: LogoState = {
  url: null,
  image: null,
  size: 14,
  y: 86,
  x: 0,
  opacity: 1,
  clip: false,
  files: { back: true, chest: false, leg: false },
  offsets: {},
  mono: 'none',
  monoColor: '#FFFFFF',
  monoCut: 50,
  monoInvert: false,
};

/** What is kept of the generator between sessions and in project files (images are reloaded from their URL). */
export interface FontsetSettings {
  styles: Record<Group, FontsetStyle>;
  prefix: string;
  selected: Record<FileKind, boolean>;
  writeConfig: boolean;
  format: 'ftex' | 'dds' | 'png';
  useSheet: Record<Group, boolean>;
  recolor: Record<Group, boolean>;
  patterns: Record<Group, Omit<PatternState, 'image'>>;
  logo: Omit<LogoState, 'image'>;
}

interface FontsetModalProps {
  isOpen: boolean;
  onClose: () => void;
  library: AssetLibrary;
  configText: string;
  onConfigChange: (text: string) => void;
  /** saved settings to start from (autosave or an opened project) */
  settings?: FontsetSettings | null;
  onSettingsChange?: (settings: FontsetSettings) => void;
  /** filled with the font file builder, so Export can save the fonts next to the kit (the files, and the config with their names) */
  exportRef?: React.MutableRefObject<FontExport | null>;
  /** the Kitserver dialog's other tab */
  onSwitchToConfig?: () => void;
}

export type FontExport = (configText: string) => Promise<{ files: OutFile[]; configText: string }>;

/** Number and name font textures for kitserver, generated from a font or a font sheet image into the PES slots. */
export const FontsetModal: React.FC<FontsetModalProps> = ({
  isOpen,
  onClose,
  library,
  configText,
  onConfigChange,
  settings,
  onSettingsChange,
  exportRef,
  onSwitchToConfig,
}) => {
  const [styles, setStyles] = useState<Record<Group, FontsetStyle>>({ number: DEFAULT_STYLE, name: DEFAULT_STYLE });
  const [prefix, setPrefix] = useState('');
  const [view, setView] = useState<FileKind>('back');
  const [selected, setSelected] = useState<Record<FileKind, boolean>>({ back: true, chest: true, leg: true, name: true, name_ex: true });
  const [writeConfig, setWriteConfig] = useState(true);
  // kitserver reads .ftex; PNG / DDS are for editing the textures elsewhere
  const [format, setFormat] = useState<'ftex' | 'dds' | 'png'>('ftex');
  const [guides, setGuides] = useState(true);
  const [missing, setMissing] = useState<Record<Group, string[]>>({ number: [], name: [] });
  const [status, setStatus] = useState<string | null>(null);
  const [fitting, setFitting] = useState<Group | null>(null);
  const [busy, setBusy] = useState(false);
  // characters of the shown texture that cross their slot box
  const [overflow, setOverflow] = useState<string[]>([]);
  const { t } = useI18n();
  // font sheet image
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [patterns, setPatterns] = useState<Record<Group, PatternState>>({ number: DEFAULT_PATTERN, name: DEFAULT_PATTERN });
  const [useSheet, setUseSheet] = useState<Record<Group, boolean>>({ number: true, name: true });
  const [recolor, setRecolor] = useState<Record<Group, boolean>>({ number: false, name: false });
  const [logo, setLogo] = useState<LogoState>(DEFAULT_LOGO);
  const [logoDigit, setLogoDigit] = useState('0');
  const [cropping, setCropping] = useState<{ image: HTMLImageElement; name: string; url: string } | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const sheetInput = useRef<HTMLInputElement | null>(null);
  const logoInput = useRef<HTMLInputElement | null>(null);
  // every settings object this dialog sent out: when one comes back (sent a moment later) it is not new input
  const emitted = useRef(new WeakSet<FontsetSettings>());

  // settings out (autosave / project): a picked file's blob URL does not survive a reload, so it is not kept
  useEffect(() => {
    const keepUrl = (url: string | null) => (url && !url.startsWith('blob:') ? url : null);
    const strip = <T extends { image: HTMLImageElement | null; url: string | null }>({ image: _i, ...rest }: T) => ({
      ...rest,
      url: keepUrl(rest.url),
    });
    const s: FontsetSettings = {
      styles,
      prefix,
      selected,
      writeConfig,
      format,
      useSheet,
      recolor,
      patterns: { number: strip(patterns.number), name: strip(patterns.name) },
      logo: strip(logo),
    };
    emitted.current.add(s);
    // a moment after the last change: dragging a slider does not re-render the whole editor on every step
    const t = setTimeout(() => onSettingsChange?.(s), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styles, prefix, selected, writeConfig, format, useSheet, recolor, patterns, logo]);

  // settings in (autosave on start, or an opened project); our own echo is ignored
  useEffect(() => {
    if (!settings || emitted.current.has(settings)) return;
    let cancelled = false;
    const img = async (url: string | null) => {
      if (!url) return null;
      const im = new Image();
      im.src = url;
      return im.decode().then(() => im, () => null);
    };
    setStyles(settings.styles);
    setPrefix(settings.prefix);
    setSelected(settings.selected);
    setWriteConfig(settings.writeConfig);
    setFormat(settings.format);
    setUseSheet(settings.useSheet);
    setRecolor(settings.recolor);
    setPatterns({ number: { ...settings.patterns.number, image: null }, name: { ...settings.patterns.name, image: null } });
    setLogo({ ...DEFAULT_LOGO, ...settings.logo, image: null });
    (async () => {
      const [pn, pm, lg] = await Promise.all([img(settings.patterns.number.url), img(settings.patterns.name.url), img(settings.logo.url)]);
      if (cancelled) return;
      setPatterns((p) => ({ number: { ...p.number, image: pn }, name: { ...p.name, image: pm } }));
      setLogo((l) => ({ ...l, image: lg }));
    })();
    return () => {
      cancelled = true;
    };
  }, [settings]);

  const config = useMemo(() => parseKitConfig(configText), [configText]);
  const filePrefix = (prefix || config.KitFile || 'kit').replace(/[^\w-]/g, '_');
  const fileName = (kind: FileKind) => `${filePrefix}_${kind}`;

  // the config's font file names follow the generator: a new prefix (or KitFile, when the prefix is empty) or another
  // file choice is written into the config right away (an unticked file is cleared); only on a change, so opening the app keeps the config as saved
  const namesKey = writeConfig ? FILES.map((f) => (f.configKey && selected[f.kind] ? `${f.configKey}=${fileName(f.kind)}` : '')).join('|') : '';
  const lastNames = useRef<string | null>(null);
  useEffect(() => {
    const prev = lastNames.current;
    lastNames.current = namesKey;
    if (prev === null || prev === namesKey || !namesKey) return;
    let text = configText;
    for (const f of FILES) if (f.configKey) text = setKitConfigValue(text, f.configKey, selected[f.kind] ? fileName(f.kind) : '');
    if (text !== configText) onConfigChange(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey]);

  // character -> glyph cut from the sheet ('_' in a row's text skips that glyph)
  const sheetMap = useMemo(() => {
    const map = new Map<string, SheetGlyph>();
    sheet?.rows.forEach((row, i) => {
      Array.from(sheet.chars[i] ?? '').forEach((ch, k) => {
        if (ch !== '_' && ch !== ' ' && row.glyphs[k]) map.set(ch.toUpperCase(), row.glyphs[k]);
      });
    });
    return map;
  }, [sheet]);

  // the logo as drawn on the digits: its own colours, or one colour traced as a vector shape
  const logoImage = useMemo(() => {
    if (!logo.image || logo.mono === 'none') return logo.image;
    try {
      return oneColourLogo(logo.image, logo.mono, logo.monoColor, logo.monoCut, logo.monoInvert);
    } catch {
      return logo.image;
    }
  }, [logo.image, logo.mono, logo.monoColor, logo.monoCut, logo.monoInvert]);

  const sheetCovers = (group: Group) => groupChars(group).some((ch) => sheetMap.has(ch));

  // preview zoom: 1 = fitted to the panel width; the wheel zooms towards the cursor
  const [previewZoom, setPreviewZoom] = useState(1);
  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const zoomPreview = (k: number, at?: { x: number; y: number }) => {
    const box = previewBoxRef.current;
    setPreviewZoom((z) => {
      const next = Math.min(8, Math.max(1, z * k));
      if (box) {
        // keep the point under the cursor (or the centre) where it is
        const px = at?.x ?? box.clientWidth / 2, py = at?.y ?? box.clientHeight / 2;
        const f = next / z;
        requestAnimationFrame(() => {
          box.scrollLeft = (box.scrollLeft + px) * f - px;
          box.scrollTop = (box.scrollTop + py) * f - py;
        });
      }
      return next;
    });
  };
  useEffect(() => {
    const box = previewBoxRef.current;
    if (!isOpen || !box) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = box.getBoundingClientRect();
      zoomPreview(Math.exp(-e.deltaY * 0.0015 * zoomFactor()), { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => box.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, view]);

  // finished letters by source + style + size; emptied when the font sheet changes (its letters are new)
  const glyphCache = useRef<{ sheet: unknown; map: Map<string, Glyph | null> }>({ sheet: null, map: new Map() });
  const cachedGlyphs = (src: GlyphSource, key: string): GlyphSource => {
    const c = glyphCache.current;
    if (c.sheet !== sheetMap || c.map.size > 3000) {
      c.sheet = sheetMap;
      c.map = new Map();
    }
    return (ch, outer, inner, letterH) => {
      const k = `${key}|${ch}|${outer}|${inner}|${letterH}`;
      if (c.map.has(k)) return c.map.get(k)!;
      const g = src(ch, outer, inner, letterH);
      c.map.set(k, g);
      return g;
    };
  };

  const render = (kind: FileKind, overflow?: Set<string>, styleOverride?: FontsetStyle) => {
    const f = fileOf(kind);
    const style = styleOverride ?? styles[f.group];
    const sources: GlyphSource[] = [];
    // the letters only depend on the style: kept between redraws, so moving the logo or a pattern is quick
    const styleKey = `${f.group}|${JSON.stringify(style)}|${recolor[f.group]}`;
    if (useSheet[f.group] && sheetCovers(f.group)) sources.push(cachedGlyphs(sheetGlyphSource(sheetMap, style, recolor[f.group]), `sheet|${styleKey}`));
    sources.push(cachedGlyphs(fontGlyphSource(style, f.group === 'number' ? '0' : 'H'), `font|${styleKey}`));
    const withLogo = f.group === 'number' && logo.image && logo.files[kind as 'back' | 'chest' | 'leg'];
    const numberLogo: NumberLogo | null = withLogo
      ? { image: logoImage!, size: logo.size, y: logo.y, x: logo.x, opacity: logo.opacity, clip: logo.clip, offsets: logo.offsets }
      : null;
    const pt = patterns[f.group];
    const fontPattern: FontPattern | null =
      pt.image && pt.url ? { image: pt.image, src: pt.url, color: pt.tint ? pt.color : null, scale: pt.scale, opacity: pt.opacity } : null;
    return renderFontset(f.layout, sources, style, numberLogo, fontPattern, overflow);
  };

  // preview of the selected texture, redrawn shortly after the last change
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const style = styles[fileOf(view).group];
      await document.fonts.load(`${style.fontWeight} 40px ${style.fontFamily}`).catch(() => undefined);
      if (cancelled) return;
      const over = new Set<string>();
      const atlas = render(view, over);
      setOverflow([...over]);
      const c = previewRef.current;
      if (!c) return;
      c.width = atlas.width;
      c.height = atlas.height;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(atlas, 0, 0);
      if (guides) {
        const layout = fileOf(view).layout;
        ctx.lineWidth = (2 * layout.width) / 2048;
        layout.rows.forEach((row, r) => {
          const y = r * layout.rowHeight;
          row.forEach((s) => {
            ctx.strokeStyle = over.has(s.ch) ? 'rgba(251,191,36,0.95)' : 'rgba(56,189,248,0.8)';
            ctx.strokeRect(s.x0, y + 1, s.x1 - s.x0, layout.rowHeight - 2);
          });
          ctx.strokeStyle = 'rgba(244,63,94,0.7)';
          ctx.beginPath();
          ctx.moveTo(0, y + layout.top);
          ctx.lineTo(layout.width, y + layout.top);
          ctx.moveTo(0, y + layout.baseline);
          ctx.lineTo(layout.width, y + layout.baseline);
          ctx.stroke();
        });
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, styles, view, guides, sheetMap, useSheet, recolor, logo, patterns]);

  // characters neither the sheet nor the chosen font has
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const next: Record<Group, string[]> = { number: [], name: [] };
      for (const group of ['number', 'name'] as const) {
        const style = styles[group];
        await document.fonts.load(`${style.fontWeight} 40px ${style.fontFamily}`).catch(() => undefined);
        const fromSheet = useSheet[group] && sheetCovers(group);
        next[group] = missingGlyphs(groupChars(group).filter((ch) => !(fromSheet && sheetMap.has(ch))), style);
      }
      if (!cancelled) setMissing(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, styles.number.fontFamily, styles.number.fontWeight, styles.name.fontFamily, styles.name.fontWeight, sheetMap, useSheet]);

  /** The font files of `kinds` in the chosen format, and `text` with their names set in the config keys. */
  const buildFiles = async (kinds: typeof FILES, text: string) => {
    // a file that is not made is cleared in the config (empty = the game's own font), so no name points at nothing
    for (const f of FILES) if (f.configKey) text = setKitConfigValue(text, f.configKey, kinds.includes(f) ? fileName(f.kind) : '');
    const files: OutFile[] = [];
    for (const f of kinds) {
      const canvas = render(f.kind);
      let data: BlobPart;
      if (format === 'png') {
        data = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('PNG'))), 'image/png'));
      } else {
        const dds = encodeDDS(fontsetImageData(canvas), 'dxt5', true);
        data = (format === 'dds' ? dds : await encodeFtex(dds)) as BlobPart;
      }
      files.push({ name: `${fileName(f.kind)}.${format}`, data });
    }
    return { files, configText: text };
  };
  if (exportRef) exportRef.current = (text) => buildFiles(FILES.filter((f) => selected[f.kind]), text);

  if (!isOpen) return null;

  const setStyle = (group: Group, patch: Partial<FontsetStyle>) =>
    setStyles((prev) => ({ ...prev, [group]: { ...prev[group], ...patch } }));

  // "Pas otomatis": the largest letter size up to 100 % at which no number, or no A–Z of the name font, touches its
  // slot box. The _ex letters are left out of the search: a rare Ø or the cedilla of Ţ (often from the fallback font)
  // would shrink every name letter; the ones still touching are named in the status line instead.
  const autoFit = async (group: Group) => {
    setFitting(group);
    const style = styles[group];
    await document.fonts.load(`${style.fontWeight} 40px ${style.fontFamily}`).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 0)); // let the busy button show first
    const overAt = (size: number, kind: FileKind) => {
      const over = new Set<string>();
      render(kind, over, { ...style, size });
      over.delete('´'); // the lone accent has a 33 px box: a slightly squeezed ´ is not worth reporting
      return [...over];
    };
    const fits = (size: number, kinds: FileKind[]) => kinds.every((k) => overAt(size, k).length === 0);
    const all: FileKind[] = group === 'number' ? ['back', 'chest', 'leg'] : ['name'];
    // the back numbers are the chest layout at twice the size: search on the smaller one, check all at the end
    const quick: FileKind[] = group === 'number' ? ['chest'] : all;
    let lo = 50, hi = 100;
    if (fits(hi, quick)) lo = hi;
    else
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (fits(mid, quick)) lo = mid;
        else hi = mid;
      }
    while (lo > 50 && !fits(lo, all)) lo--;
    setStyle(group, { size: lo });
    const ex = group === 'name' ? overAt(lo, 'name_ex') : [];
    setStatus(
      !fits(lo, all)
        ? 'Di 50 % masih ada huruf yang menyentuh slot.'
        : ex.length
          ? `Ukuran huruf ${lo} %: terbesar yang muat di slot. Di _ex masih menyentuh slot: ${ex.join(' ')}`
          : `Ukuran huruf ${lo} %: terbesar yang muat di slot.`
    );
    setFitting(null);
  };

  const loadImage = async (url: string) => {
    const im = new Image();
    im.src = url;
    await im.decode();
    return im;
  };

  // a picked file first goes through the crop / background dialog
  const importSheet = async (file: File) => {
    try {
      const url = URL.createObjectURL(file);
      const image = await loadImage(url);
      setCropping({ image, name: file.name, url });
    } catch (err) {
      setStatus(`Gambar gagal dibaca: ${(err as Error)?.message || err}`);
    }
  };

  const readSheet = (canvas: HTMLCanvasElement, name: string) => {
    try {
      const rows = analyzeFontSheet(canvas);
      const readings = readSheetRows(rows);
      setSheet({
        name,
        rows,
        chars: readings.map((r) => r.text),
        thumbs: rows.map((r) => r.glyphs.map(thumbOf)),
        confidence: readings.map((r) => r.confidence),
        missing: readings.map((r) => r.missing),
      });
      // characters missing from the sheet come from the font: give them the sheet's colour
      const ink = sheetInkColor(rows);
      if (ink) setStyles((p) => ({ number: { ...p.number, fill: ink }, name: { ...p.name, fill: ink } }));
      const all = readings.flatMap((r) => Array.from(r.text));
      const skipped = all.filter((ch) => ch === '_').length;
      setStatus(
        `${rows.length} baris terdeteksi di ${name}: ${rows.map((r) => r.glyphs.length).join(' + ')} karakter.` +
          // many skipped pieces, or a row read with little certainty (misread letters are not skipped)
          (!all.length ||
          skipped > all.length * 0.2 ||
          readings.some((r) => r.confidence.length && r.confidence.reduce((x, y) => x + y, 0) / r.confidence.length < 0.75)
            ? ' Banyak potongan tidak dikenali: import ulang gambar dan klik Pilih huruf pada warna hurufnya.'
            : '')
      );
    } catch (err) {
      setStatus(`Gambar gagal dibaca: ${(err as Error)?.message || err}`);
    }
  };

  // a PES font saved to the library before: its five textures become the font image again (numbers from the back
  // number file, else chest / leg; letters from name + name_ex), so it can be changed and saved under a new name
  const loadLibraryFontset = async (name: string) => {
    const fs = library.fontsets.find((f) => f.name === name);
    if (!fs) return;
    setStatus(`Memuat ${name}…`);
    const parts = (
      await Promise.all([
        slotRows(fs.files.back, BACK_NUMBER_LAYOUT).then((r) => r ?? slotRows(fs.files.chest, NUMBER_LAYOUT)).then((r) => r ?? slotRows(fs.files.leg, NUMBER_LAYOUT)),
        slotRows(fs.files.name, NAME_LAYOUT),
        slotRows(fs.files.name_ex, NAME_EX_LAYOUT),
      ])
    ).flatMap((p) => p ?? []).filter((p) => p.row.glyphs.length);
    if (!parts.length) return setStatus(`${name}: file font tidak bisa dibaca.`);
    const rows = parts.map((p) => p.row);
    setSheet({
      name: `${name} (library)`,
      rows,
      chars: parts.map((p) => p.chars),
      thumbs: rows.map((r) => r.glyphs.map(thumbOf)),
      confidence: parts.map((p) => Array.from(p.chars).map(() => 1)),
      missing: parts.map(() => []),
    });
    setUseSheet({ number: true, name: true });
    setRecolor({ number: false, name: false });
    setStatus(`${name} dimuat dari library: ${parts.map((p) => p.chars.length).join(' + ')} karakter.`);
  };

  const setLogoUrl = async (url: string | null) => {
    if (!url) return setLogo((l) => ({ ...l, url: null, image: null }));
    try {
      const image = await loadImage(url);
      setLogo((l) => ({ ...l, url, image }));
    } catch {
      setStatus('Logo gagal dimuat.');
    }
  };

  const setPatternUrl = async (group: Group, url: string | null) => {
    if (!url) return setPatterns((p) => ({ ...p, [group]: { ...p[group], url: null, image: null } }));
    try {
      const image = await loadImage(url);
      setPatterns((p) => ({ ...p, [group]: { ...p[group], url, image } }));
    } catch {
      setStatus('Pola gagal dimuat.');
    }
  };

  const save = async () => {
    const kinds = FILES.filter((f) => selected[f.kind]);
    if (!kinds.length) return setStatus('Pilih minimal satu file.');
    const over = kinds.flatMap((f) => {
      const set = new Set<string>();
      render(f.kind, set);
      return set.size ? [`${f.kind}: ${[...set].join(' ')}`] : [];
    });
    if (
      over.length &&
      !window.confirm(
        t(`Beberapa karakter menyentuh garis slot dan akan dipadatkan atau terpotong di game (${over.join('; ')}). Tetap simpan?`)
      )
    )
      return;
    setBusy(true);
    setStatus('Membuat file font…');
    try {
      const withConfig = writeConfig && format === 'ftex';
      let text = configText;
      const msg = await saveFilesToFolder(async () => {
        const built = await buildFiles(kinds, configText);
        text = built.configText;
        return withConfig ? [...built.files, { name: 'config.txt', data: kitConfigToFile(text) }] : built.files;
      });
      if (withConfig && msg && !msg.startsWith('Dibatalkan')) onConfigChange(text);
      setStatus(msg);
    } catch (err) {
      setStatus(`Gagal menyimpan: ${(err as Error)?.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  // all five sheets as PNG into library/fonts/font_pes/<name>: the Name tab previews the kit with them
  const saveToLibrary = async () => {
    setBusy(true);
    setStatus('Menyimpan font ke library…');
    try {
      const files: Record<string, string> = {};
      for (const f of FILES) files[f.kind] = render(f.kind).toDataURL('image/png').split(',')[1];
      const res = await fetch('/api/library/fontset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: filePrefix, files }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Server menjawab ${res.status}`);
      await library.reload();
      setStatus(t(`Tersimpan di library/fonts/font_pes/${data.name}. Pilih di tab Nama untuk melihatnya di kit.`));
    } catch (err) {
      setStatus(`Gagal menyimpan: ${(err as Error)?.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const savePng = () => render(view).toBlob((b) => b && downloadFile(b, `${fileName(view)}.png`), 'image/png');

  const input = 'bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-sky-500';
  const h4 = 'text-xs font-semibold text-slate-200 border-b border-slate-800 pb-1';
  const slider = (label: string, value: number, min: number, max: number, step: number, on: (v: number) => void) => (
    <label className="col-span-2 block space-y-0.5 text-[11px] text-slate-400">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-slate-300">{value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => on(Number(e.target.value))} className="w-full accent-sky-500" />
    </label>
  );

  const patternBlock = (group: Group) => {
    const pt = patterns[group];
    const setPt = (patch: Partial<PatternState>) => setPatterns((p) => ({ ...p, [group]: { ...p[group], ...patch } }));
    return (
      <div className="space-y-1.5">
        <label className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
          Pola
          <select value={pt.url ?? ''} onChange={(e) => setPatternUrl(group, e.target.value || null)} className={`${input} w-40`}>
            <option value="">(tanpa pola)</option>
            {library.patterns.map((l) => (
              <option key={l.id} value={l.url}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        {!library.patterns.length && <p className="text-[10px] text-slate-500">Taruh gambar pola di library/patterns.</p>}
        {pt.image && (
          <>
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <label className="flex items-center gap-1.5 cursor-pointer" title="Pola satu warna diwarnai ulang">
                <input type="checkbox" checked={pt.tint} onChange={(e) => setPt({ tint: e.target.checked })} className="accent-sky-500" />
                Warnai pola
              </label>
              {pt.tint && (
                <input type="color" value={pt.color} onChange={(e) => setPt({ color: e.target.value.toUpperCase() })} className="w-8 h-6 bg-transparent cursor-pointer" />
              )}
            </div>
            {slider('Ukuran pola', pt.scale, 8, 400, 4, (v) => setPt({ scale: v }))}
            {slider('Opasitas pola', pt.opacity, 0.05, 1, 0.05, (v) => setPt({ opacity: v }))}
          </>
        )}
      </div>
    );
  };

  const styleBlock = (group: Group, title: string) => {
    const st = styles[group];
    const fromSheet = useSheet[group] && sheetCovers(group);
    return (
      <section className="space-y-2">
        <h4 className={h4}>{title}</h4>
        {sheet && sheetCovers(group) && (
          <div className="space-y-1 text-[11px] text-slate-400">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={useSheet[group]} onChange={(e) => setUseSheet((p) => ({ ...p, [group]: e.target.checked }))} className="accent-sky-500" />
              Pakai huruf dari gambar
            </label>
            {fromSheet && (
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={recolor[group]} onChange={(e) => setRecolor((p) => ({ ...p, [group]: e.target.checked }))} className="accent-sky-500" />
                Ganti warna gambar dengan warna isi
              </label>
            )}
          </div>
        )}
        {fromSheet && <p className="text-[10px] text-slate-500">Font di bawah dipakai untuk karakter yang tidak ada di gambar.</p>}
        <FontPicker value={st.fontFamily} onChange={(v) => setStyle(group, { fontFamily: v })} library={library} compact />
        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
          <label className="flex items-center justify-between gap-2">
            Tebal
            <select value={st.fontWeight} onChange={(e) => setStyle(group, { fontWeight: e.target.value })} className={input}>
              <option value="normal">Normal</option>
              <option value="bold">Bold</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-2">
            Warna isi
            <input type="color" value={st.fill} onChange={(e) => setStyle(group, { fill: e.target.value.toUpperCase() })} className="w-8 h-6 bg-transparent cursor-pointer" />
          </label>
          <label className="flex items-center justify-between gap-2">
            Outline
            <input type="color" value={st.outline} onChange={(e) => setStyle(group, { outline: e.target.value.toUpperCase() })} className="w-8 h-6 bg-transparent cursor-pointer" />
          </label>
          <label className="flex items-center justify-between gap-2">
            Posisi outline
            <select
              value={st.outlineAlign ?? 'outside'}
              onChange={(e) => setStyle(group, { outlineAlign: e.target.value as OutlineAlign })}
              className={input}
              title="Luar: di luar tepi huruf. Tengah: separuh di luar, separuh di dalam. Dalam: di dalam tepi huruf (inline)."
            >
              <option value="outside">Luar</option>
              <option value="center">Tengah</option>
              <option value="inside">Dalam</option>
            </select>
          </label>
          {slider('Tebal outline', st.outlineWidth, 0, 20, 1, (v) => setStyle(group, { outlineWidth: v }))}
          {slider('Ukuran huruf %', st.size ?? 100, 50, 150, 1, (v) => setStyle(group, { size: v }))}
          <button
            type="button"
            onClick={() => autoFit(group)}
            disabled={fitting !== null}
            className="col-span-2 justify-self-end -mt-1 px-2 py-0.5 rounded border border-slate-700 text-[10px] text-slate-300 hover:bg-slate-800 disabled:opacity-60"
            title="Ukuran huruf terbesar (paling besar 100 %) yang semua hurufnya muat di slot tanpa dipadatkan"
          >
            {fitting === group ? 'Menghitung…' : 'Pas otomatis'}
          </button>
        </div>
        {patternBlock(group)}
        {missing[group].length > 0 && (
          <p className="flex items-start gap-1.5 text-[10px] text-amber-300 leading-snug">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            <span>{`Font ini tidak punya ${missing[group].length} karakter (diganti font cadangan): ${missing[group].slice(0, 16).join(' ')}`}</span>
          </p>
        )}
      </section>
    );
  };

  const logoBlock = (
    <section className="space-y-2">
      <h4 className={h4}>Logo di nomor</h4>
      <div className="flex gap-1.5">
        <select
          value={logo.url && !logo.url.startsWith('blob:') ? logo.url : ''}
          onChange={(e) => setLogoUrl(e.target.value || null)}
          className={`${input} flex-1 min-w-0`}
        >
          <option value="">{logo.url?.startsWith('blob:') ? '(file sendiri)' : '(tanpa logo)'}</option>
          {library.logos.map((l) => (
            <option key={l.id} value={l.url}>
              {l.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => logoInput.current?.click()} className="px-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800" title="Pakai file logo dari komputer">
          <ImagePlus className="w-3.5 h-3.5" />
        </button>
        <input
          ref={logoInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setLogoUrl(URL.createObjectURL(f));
            e.target.value = '';
          }}
        />
      </div>
      {logo.image && (
        <>
          {slider('Ukuran %', logo.size, 4, 60, 1, (v) => setLogo((l) => ({ ...l, size: v })))}
          {slider('Posisi Y %', logo.y, 0, 100, 1, (v) => setLogo((l) => ({ ...l, y: v })))}
          {slider('Geser X %', logo.x, -50, 50, 1, (v) => setLogo((l) => ({ ...l, x: v })))}
          {slider('Opasitas', logo.opacity, 0.1, 1, 0.05, (v) => setLogo((l) => ({ ...l, opacity: v })))}
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <label className="flex items-center gap-2" title="Satu warna: logo dijadikan satu warna dan digambar ulang sebagai bentuk vektor yang tajam">
              Warna logo
              <select value={logo.mono} onChange={(e) => setLogo((l) => ({ ...l, mono: e.target.value as LogoMonoMode }))} className={input}>
                <option value="none">Asli</option>
                <option value="shape">Satu warna – siluet</option>
                <option value="detail">Satu warna – detail</option>
              </select>
            </label>
            {logo.mono !== 'none' && (
              <input
                type="color"
                value={logo.monoColor}
                onChange={(e) => setLogo((l) => ({ ...l, monoColor: e.target.value.toUpperCase() }))}
                className="w-8 h-6 bg-transparent cursor-pointer"
                title="Warna logo"
              />
            )}
          </div>
          {logo.mono === 'detail' && (
            <>
              {slider('Batas terang', logo.monoCut, 5, 95, 1, (v) => setLogo((l) => ({ ...l, monoCut: v })))}
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer" title="Bagian terang logo yang diberi warna, bagian gelap jadi bolong">
                <input type="checkbox" checked={logo.monoInvert} onChange={(e) => setLogo((l) => ({ ...l, monoInvert: e.target.checked }))} className="accent-sky-500" />
                Balik: bagian terang yang diwarnai
              </label>
            </>
          )}
          <div className="space-y-1.5 rounded border border-slate-800 p-2">
            <div className="text-[11px] text-slate-400">Atur per angka</div>
            <div className="flex flex-wrap gap-1">
              {'0123456789'.split('').map((d) => {
                const o = logo.offsets[d];
                const moved = !!o && (o.x !== 0 || o.y !== 0);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setLogoDigit(d)}
                    className={`w-6 h-6 rounded border text-[11px] font-mono ${
                      logoDigit === d ? 'border-sky-500 bg-sky-600/20 text-white' : moved ? 'border-amber-400/70 text-amber-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                    title={moved ? `X ${o!.x}, Y ${o!.y}` : undefined}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            {(['x', 'y'] as const).map((axis) => (
              <React.Fragment key={axis}>
                {slider(
                axis === 'x' ? `Geser X angka ${logoDigit} %` : `Geser Y angka ${logoDigit} %`,
                logo.offsets[logoDigit]?.[axis] ?? 0,
                -40,
                40,
                1,
                (v) =>
                  setLogo((l) => ({
                    ...l,
                    offsets: { ...l.offsets, [logoDigit]: { ...(l.offsets[logoDigit] ?? { x: 0, y: 0 }), [axis]: v } },
                  }))
                )}
              </React.Fragment>
            ))}
            <div className="flex gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => setLogo((l) => ({ ...l, offsets: { ...l.offsets, [logoDigit]: { x: 0, y: 0 } } }))}
                className="px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Reset angka ini
              </button>
              <button
                type="button"
                onClick={() => setLogo((l) => ({ ...l, offsets: {} }))}
                className="px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Reset semua
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
            <label className="flex items-center gap-1 cursor-pointer" title="Logo hanya terlihat di bagian angka">
              <input type="checkbox" checked={logo.clip} onChange={(e) => setLogo((l) => ({ ...l, clip: e.target.checked }))} className="accent-sky-500" />
              Potong ke bentuk angka
            </label>
            {(['back', 'chest', 'leg'] as const).map((k) => (
              <label key={k} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={logo.files[k]}
                  onChange={(e) => setLogo((l) => ({ ...l, files: { ...l.files, [k]: e.target.checked } }))}
                  className="accent-sky-500"
                />
                {k}
              </label>
            ))}
          </div>
        </>
      )}
    </section>
  );

  const sheetBlock = (
    <section className="space-y-2">
      <h4 className={h4}>Gambar font</h4>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => sheetInput.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-slate-700 text-[11px] text-slate-300 hover:bg-slate-800"
          title="Gambar berisi huruf dan/atau angka, latar transparan atau polos"
        >
          <ImagePlus className="w-3.5 h-3.5" />
          <span>{sheet ? sheet.name : 'Import gambar font…'}</span>
        </button>
        {sheet && (
          <button type="button" onClick={() => setSheet(null)} className="px-2 rounded border border-slate-700 text-slate-400 hover:bg-slate-800" title="Hapus gambar">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        <input
          ref={sheetInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importSheet(f);
            e.target.value = '';
          }}
        />
      </div>
      {library.fontsets.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && loadLibraryFontset(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-300 outline-none focus:border-sky-500"
          aria-label="Ambil font PES dari library"
          title="Font PES yang pernah disimpan ke library (library/fonts/font_pes), dipakai lagi sebagai gambar font"
        >
          <option value="">Ambil font PES dari library…</option>
          {library.fontsets.map((f) => (
            <option key={f.name} value={f.name}>{f.name}</option>
          ))}
        </select>
      )}
      {sheet?.rows.map((row, i) => {
        const n = Array.from(sheet.chars[i] ?? '').length;
        const bad = n !== row.glyphs.length;
        return (
          <div key={i} className="space-y-0.5">
            <div className={`text-[10px] ${bad ? 'text-amber-300' : 'text-slate-500'}`}>
              {`Baris ${i + 1}: ${row.glyphs.length} karakter${bad ? `, teks berisi ${n}` : ''}`}
            </div>
            <div className="flex flex-wrap gap-0.5">
              {sheet.thumbs[i].map((src, k) => {
                const ch = Array.from(sheet.chars[i] ?? '')[k] ?? '?';
                const unsure = ch === '_' || ch === '?' || (sheet.confidence[i][k] ?? 1) < 0.8;
                return (
                  <div
                    key={k}
                    className={`flex flex-col items-center rounded border px-0.5 bg-slate-400/70 ${unsure ? 'border-amber-400' : 'border-transparent'}`}
                    title={ch === '_' ? 'dilewati' : ch}
                  >
                    <img src={src} alt="" className="h-5 w-auto" />
                    <span className={`text-[10px] font-mono leading-none pb-0.5 ${ch === '_' ? 'text-rose-700' : 'text-slate-900'}`}>{ch}</span>
                  </div>
                );
              })}
            </div>
            {(() => {
              // from the rows as they read now: a letter typed in by hand is no longer missing
              const present = new Set(sheet.chars.flatMap((c) => Array.from(c)));
              const gone = sheet.missing[i].filter((ch) => !present.has(ch));
              return gone.length > 0 && <div className="text-[10px] text-slate-500">{`Tidak ada di gambar: ${gone.join(' ')}`}</div>;
            })()}
            <input
              value={sheet.chars[i] ?? ''}
              onChange={(e) => setSheet((s) => s && { ...s, chars: s.chars.map((c, k) => (k === i ? e.target.value : c)) })}
              placeholder="isi karakter berurutan, _ untuk lewati"
              spellCheck={false}
              className={`${input} w-full font-mono`}
            />
          </div>
        );
      })}
      {sheet && (
        <p className="text-[10px] text-slate-500 leading-snug">
          Huruf dikenali otomatis; kotak kuning = kurang yakin atau dilewati (_). Koreksi lewat teks baris: satu karakter per huruf, _ untuk melewati.
        </p>
      )}
    </section>
  );

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-6xl h-[92vh] shadow-2xl overflow-hidden flex flex-col">
        <KitserverHeader tab="font" onTab={(t) => t === 'config' && onSwitchToConfig?.()} onClose={onClose} />

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain lg:overflow-hidden grid grid-cols-1 lg:grid-cols-[20rem_1fr]">
          <div className="p-5 space-y-5 border-r border-slate-800 lg:overflow-y-auto lg:overscroll-contain">
            {sheetBlock}
            {styleBlock('number', 'Nomor')}
            {logoBlock}
            {styleBlock('name', 'Nama')}
          </div>

          <div className="p-5 space-y-3 min-w-0 lg:overflow-y-auto lg:overscroll-contain">
            <div className="flex flex-wrap items-center gap-1.5">
              {FILES.map((f) => (
                <button
                  key={f.kind}
                  type="button"
                  onClick={() => setView(f.kind)}
                  className={`px-2.5 py-1 rounded border text-[11px] ${
                    view === f.kind ? 'border-sky-500 bg-sky-600/20 text-white' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} className="accent-sky-500" />
                Garis slot
              </label>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <span>Zoom</span>
              <button type="button" onClick={() => zoomPreview(1 / 1.25)} className="px-1.5 rounded border border-slate-700 hover:bg-slate-800" aria-label="Perkecil pratinjau">
                −
              </button>
              <span className="font-mono w-11 text-center">{Math.round(previewZoom * 100)}%</span>
              <button type="button" onClick={() => zoomPreview(1.25)} className="px-1.5 rounded border border-slate-700 hover:bg-slate-800" aria-label="Perbesar pratinjau">
                +
              </button>
              <button type="button" onClick={() => setPreviewZoom(1)} className="px-1.5 rounded border border-slate-700 hover:bg-slate-800" title="Pas selebar panel">
                Pas
              </button>
              <span className="text-slate-500">· scroll di pratinjau untuk zoom</span>
            </div>
            <div
              ref={previewBoxRef}
              className="rounded-lg border border-slate-800 overflow-auto max-h-[60vh]"
              style={{ backgroundImage: 'repeating-conic-gradient(#64748b 0% 25%, #475569 0% 50%)', backgroundSize: '16px 16px' }}
            >
              <canvas ref={previewRef} className="h-auto block" style={{ width: `${previewZoom * 100}%`, maxWidth: 'none' }} />
            </div>
            <p className="text-[10px] text-slate-500">
              {`${fileOf(view).layout.width}×${fileOf(view).layout.height} px · ${fileName(view)}.ftex · `}
              <span>kotak biru = slot karakter, garis merah = atas huruf dan garis dasar</span>
            </p>
            {overflow.length > 0 && (
              <p className="flex items-start gap-1.5 text-[11px] text-amber-300 leading-snug">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{`Huruf terlalu besar, menyentuh garis slot (kotak kuning): ${overflow.join(' ')}. Kecilkan Ukuran huruf % (atau Pas otomatis) agar tidak dipadatkan atau terpotong.`}</span>
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-800 bg-[#0f131c] space-y-2">
          {status && <p className="text-[11px] text-sky-300">{status}</p>}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <label className="flex items-center gap-1.5">
              Awalan nama file
              <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder={config.KitFile || 'kit'} className={`${input} w-28 font-mono`} />
            </label>
            {FILES.map((f) => (
              <label key={f.kind} className="flex items-center gap-1 cursor-pointer" title={`${fileName(f.kind)}.ftex`}>
                <input
                  type="checkbox"
                  checked={selected[f.kind]}
                  onChange={(e) => setSelected((p) => ({ ...p, [f.kind]: e.target.checked }))}
                  className="accent-sky-500"
                />
                {f.kind}
              </label>
            ))}
            <label className="flex items-center gap-1.5">
              Format
              <select value={format} onChange={(e) => setFormat(e.target.value as 'ftex' | 'dds' | 'png')} className={input}>
                <option value="ftex">FTEX (kitserver)</option>
                <option value="dds">DDS (DXT5)</option>
                <option value="png">PNG</option>
              </select>
            </label>
            {format === 'ftex' && (
              <label className="flex items-center gap-1 cursor-pointer" title="Nama file font diisi ke config.txt dan config ditulis ke folder yang sama">
                <input type="checkbox" checked={writeConfig} onChange={(e) => setWriteConfig(e.target.checked)} className="accent-sky-500" />
                Tulis config.txt juga
              </label>
            )}
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={savePng} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800">
                <ImageDown className="w-3.5 h-3.5" /> PNG pratinjau
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={saveToLibrary}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800 disabled:opacity-50"
                title={`Kelima tekstur font disimpan sebagai PNG di library/fonts/font_pes/${filePrefix}, untuk preview di tab Nama`}
              >
                <Library className="w-3.5 h-3.5" /> Simpan ke library
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={save}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50"
                title="Pilih folder kit; file .ftex font (dan config.txt) ditulis ke sana"
              >
                <FolderDown className="w-3.5 h-3.5" /> Simpan ke folder kit…
              </button>
            </div>
          </div>
        </div>
      </div>
      {cropping && (
        <FontSheetCropDialog
          image={cropping.image}
          name={cropping.name}
          onCancel={() => {
            URL.revokeObjectURL(cropping.url);
            setCropping(null);
          }}
          onApply={(canvas) => {
            URL.revokeObjectURL(cropping.url);
            setCropping(null);
            readSheet(canvas, cropping.name);
          }}
        />
      )}
    </div>
  );
};

export default FontsetModal;
