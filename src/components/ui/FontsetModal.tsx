'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Type, FolderDown, ImageDown, AlertCircle, ImagePlus, Trash2 } from 'lucide-react';
import { FontPicker } from '@/components/ui/FontPicker';
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
  GlyphSource,
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

const thumbOf = (c: HTMLCanvasElement) => {
  const h = 36;
  const t = document.createElement('canvas');
  t.height = h;
  t.width = Math.max(4, Math.round((c.width / c.height) * h));
  t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height);
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
};

interface FontsetModalProps {
  isOpen: boolean;
  onClose: () => void;
  library: AssetLibrary;
  configText: string;
  onConfigChange: (text: string) => void;
}

/** Number and name font textures for kitserver, generated from a font or a font sheet image into the PES slots. */
export const FontsetModal: React.FC<FontsetModalProps> = ({ isOpen, onClose, library, configText, onConfigChange }) => {
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
  const [busy, setBusy] = useState(false);
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

  const config = useMemo(() => parseKitConfig(configText), [configText]);
  const filePrefix = (prefix || config.KitFile || 'kit').replace(/[^\w-]/g, '_');
  const fileName = (kind: FileKind) => `${filePrefix}_${kind}`;

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

  const sheetCovers = (group: Group) => groupChars(group).some((ch) => sheetMap.has(ch));

  const render = (kind: FileKind) => {
    const f = fileOf(kind);
    const style = styles[f.group];
    const sources: GlyphSource[] = [];
    if (useSheet[f.group] && sheetCovers(f.group)) sources.push(sheetGlyphSource(sheetMap, style, recolor[f.group]));
    sources.push(fontGlyphSource(style, f.group === 'number' ? '0' : 'H'));
    const withLogo = f.group === 'number' && logo.image && logo.files[kind as 'back' | 'chest' | 'leg'];
    const numberLogo: NumberLogo | null = withLogo
      ? { image: logo.image!, size: logo.size, y: logo.y, x: logo.x, opacity: logo.opacity, clip: logo.clip, offsets: logo.offsets }
      : null;
    const pt = patterns[f.group];
    const fontPattern: FontPattern | null =
      pt.image && pt.url ? { image: pt.image, src: pt.url, color: pt.tint ? pt.color : null, scale: pt.scale, opacity: pt.opacity } : null;
    return renderFontset(f.layout, sources, style.outlineWidth, numberLogo, fontPattern);
  };

  // preview of the selected texture, redrawn shortly after the last change
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const style = styles[fileOf(view).group];
      await document.fonts.load(`${style.fontWeight} 40px ${style.fontFamily}`).catch(() => undefined);
      if (cancelled) return;
      const atlas = render(view);
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
          ctx.strokeStyle = 'rgba(56,189,248,0.8)';
          row.forEach((s) => ctx.strokeRect(s.x0, y + 1, s.x1 - s.x0, layout.rowHeight - 2));
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

  if (!isOpen) return null;

  const setStyle = (group: Group, patch: Partial<FontsetStyle>) =>
    setStyles((prev) => ({ ...prev, [group]: { ...prev[group], ...patch } }));

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
        thumbs: rows.map((r) => r.glyphs.map((g) => thumbOf(g.canvas))),
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
    setBusy(true);
    setStatus('Membuat file font…');
    try {
      let text = configText;
      for (const f of kinds) if (f.configKey) text = setKitConfigValue(text, f.configKey, fileName(f.kind));
      const withConfig = writeConfig && format === 'ftex';
      const msg = await saveFilesToFolder(async () => {
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
        if (withConfig) files.push({ name: 'config.txt', data: kitConfigToFile(text) });
        return files;
      });
      if (withConfig && msg && !msg.startsWith('Dibatalkan')) onConfigChange(text);
      setStatus(msg);
    } catch (err) {
      setStatus(`Gagal menyimpan: ${(err as Error)?.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const savePng = () => render(view).toBlob((b) => b && downloadFile(b, `${fileName(view)}.png`), 'image/png');

  const input = 'bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-sky-500';
  const h4 = 'text-[11px] font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-1';
  const slider = (label: string, value: number, min: number, max: number, step: number, on: (v: number) => void) => (
    <label className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
      <span>{`${label} ${value}`}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => on(Number(e.target.value))} className="w-24 accent-sky-500" />
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
          {slider('Tebal outline', st.outlineWidth, 0, 20, 1, (v) => setStyle(group, { outlineWidth: v }))}
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
                    <span className={`text-[9px] font-mono leading-none pb-0.5 ${ch === '_' ? 'text-rose-700' : 'text-slate-900'}`}>{ch}</span>
                  </div>
                );
              })}
            </div>
            {sheet.missing[i].length > 0 && (
              <div className="text-[10px] text-slate-500">{`Tidak ada di gambar: ${sheet.missing[i].join(' ')}`}</div>
            )}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0f131c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-600/20 text-sky-400 border border-sky-500/30">
              <Type className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Generator Fontset
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Eksperimental
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Nomor dan nama untuk kitserver, ditaruh di slot karakter template PES 2021.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

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
            <div
              className="rounded-lg border border-slate-800 overflow-hidden"
              style={{ backgroundImage: 'repeating-conic-gradient(#64748b 0% 25%, #475569 0% 50%)', backgroundSize: '16px 16px' }}
            >
              <canvas ref={previewRef} className="w-full h-auto block" />
            </div>
            <p className="text-[10px] text-slate-500">
              {`${fileOf(view).layout.width}×${fileOf(view).layout.height} px · ${fileName(view)}.ftex · `}
              <span>kotak biru = slot karakter, garis merah = atas huruf dan garis dasar</span>
            </p>
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
