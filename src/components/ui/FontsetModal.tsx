'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Type, FolderDown, ImageDown, AlertCircle } from 'lucide-react';
import { FontPicker } from '@/components/ui/FontPicker';
import { AssetLibrary } from '@/hooks/useAssetLibrary';
import {
  FontsetLayout,
  NUMBER_LAYOUT,
  BACK_NUMBER_LAYOUT,
  NAME_LAYOUT,
  NAME_EX_LAYOUT,
} from '@/constants/fontsetSlots';
import { FontsetStyle, renderFontset, fontsetImageData, missingGlyphs } from '@/utils/fontsetGenerator';
import { encodeDDS } from '@/utils/ddsEncoder';
import { encodeFtex } from '@/utils/ftexEncoder';
import { parseKitConfig, setKitConfigValue, kitConfigToFile } from '@/utils/kitConfig';
import { downloadFile, saveFilesToFolder, OutFile } from '@/utils/folderSave';

type FileKind = 'back' | 'chest' | 'leg' | 'name' | 'name_ex';

const FILES: { kind: FileKind; label: string; layout: FontsetLayout; group: 'number' | 'name'; configKey?: string }[] = [
  { kind: 'back', label: 'Nomor punggung', layout: BACK_NUMBER_LAYOUT, group: 'number', configKey: 'BackNumbersFile' },
  { kind: 'chest', label: 'Nomor dada', layout: NUMBER_LAYOUT, group: 'number', configKey: 'ChestNumbersFile' },
  { kind: 'leg', label: 'Nomor celana', layout: NUMBER_LAYOUT, group: 'number', configKey: 'LegNumbersFile' },
  { kind: 'name', label: 'Font nama', layout: NAME_LAYOUT, group: 'name', configKey: 'NameFontFile' },
  // kserv derives <NameFontFile>_ex itself, so it has no key of its own
  { kind: 'name_ex', label: 'Font nama (_ex, huruf beraksen)', layout: NAME_EX_LAYOUT, group: 'name' },
];

const DEFAULT_STYLE: FontsetStyle = {
  fontFamily: "'Impact', 'Arial Black', sans-serif",
  fontWeight: 'normal',
  fill: '#FFFFFF',
  outline: '#000000',
  outlineWidth: 0,
};

const render = (kind: FileKind, styles: Record<'number' | 'name', FontsetStyle>) => {
  const f = FILES.find((x) => x.kind === kind)!;
  return renderFontset(f.layout, styles[f.group], f.group === 'number' ? '0' : 'H');
};

interface FontsetModalProps {
  isOpen: boolean;
  onClose: () => void;
  library: AssetLibrary;
  configText: string;
  onConfigChange: (text: string) => void;
}

/** Number and name font textures for kitserver, generated from a font into the fixed PES slots. */
export const FontsetModal: React.FC<FontsetModalProps> = ({ isOpen, onClose, library, configText, onConfigChange }) => {
  const [styles, setStyles] = useState<Record<'number' | 'name', FontsetStyle>>({ number: DEFAULT_STYLE, name: DEFAULT_STYLE });
  const [prefix, setPrefix] = useState('');
  const [view, setView] = useState<FileKind>('back');
  const [selected, setSelected] = useState<Record<FileKind, boolean>>({ back: true, chest: true, leg: true, name: true, name_ex: true });
  const [writeConfig, setWriteConfig] = useState(true);
  const [guides, setGuides] = useState(true);
  const [missing, setMissing] = useState<Record<'number' | 'name', string[]>>({ number: [], name: [] });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  const config = useMemo(() => parseKitConfig(configText), [configText]);
  const filePrefix = (prefix || config.KitFile || 'kit').replace(/[^\w-]/g, '_');
  const fileName = (kind: FileKind) => `${filePrefix}_${kind}`;

  // preview of the selected texture, redrawn shortly after the last change
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const style = styles[FILES.find((x) => x.kind === view)!.group];
      await document.fonts.load(`${style.fontWeight} 40px ${style.fontFamily}`).catch(() => undefined);
      if (cancelled) return;
      const atlas = render(view, styles);
      const c = previewRef.current;
      if (!c) return;
      c.width = atlas.width;
      c.height = atlas.height;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(atlas, 0, 0);
      if (guides) {
        const layout = FILES.find((x) => x.kind === view)!.layout;
        const k = layout.width / 2048;
        ctx.lineWidth = 2 * k;
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
  }, [isOpen, styles, view, guides]);

  // characters the chosen fonts do not have
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const next = { number: [] as string[], name: [] as string[] };
      for (const group of ['number', 'name'] as const) {
        const style = styles[group];
        await document.fonts.load(`${style.fontWeight} 40px ${style.fontFamily}`).catch(() => undefined);
        const chars = FILES.filter((f) => f.group === group && f.kind !== 'chest' && f.kind !== 'leg')
          .flatMap((f) => f.layout.rows.flat().map((s) => s.ch));
        next[group] = missingGlyphs(chars, style);
      }
      if (!cancelled) setMissing(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, styles.number.fontFamily, styles.number.fontWeight, styles.name.fontFamily, styles.name.fontWeight]);

  if (!isOpen) return null;

  const setStyle = (group: 'number' | 'name', patch: Partial<FontsetStyle>) =>
    setStyles((prev) => ({ ...prev, [group]: { ...prev[group], ...patch } }));

  const save = async () => {
    const kinds = FILES.filter((f) => selected[f.kind]);
    if (!kinds.length) return setStatus('Pilih minimal satu file.');
    setBusy(true);
    setStatus('Membuat file font…');
    try {
      const files: OutFile[] = [];
      for (const f of kinds) {
        const canvas = render(f.kind, styles);
        const dds = encodeDDS(fontsetImageData(canvas, styles[f.group]), 'dxt5', true);
        files.push({ name: `${fileName(f.kind)}.ftex`, data: (await encodeFtex(dds)) as BlobPart });
      }
      let text = configText;
      for (const f of kinds) if (f.configKey) text = setKitConfigValue(text, f.configKey, fileName(f.kind));
      if (writeConfig) files.push({ name: 'config.txt', data: kitConfigToFile(text) });
      const msg = await saveFilesToFolder(files);
      if (msg && !msg.startsWith('Dibatalkan')) onConfigChange(text);
      setStatus(msg);
    } catch (err) {
      setStatus(`Gagal menyimpan: ${(err as Error)?.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const savePng = () => {
    render(view, styles).toBlob((b) => b && downloadFile(b, `${fileName(view)}.png`), 'image/png');
  };

  const input = 'bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-sky-500';

  const styleBlock = (group: 'number' | 'name', title: string) => {
    const st = styles[group];
    const miss = missing[group];
    return (
      <section className="space-y-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-1">{title}</h4>
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
            <span>Tebal outline {st.outlineWidth}</span>
            <input type="range" min={0} max={20} value={st.outlineWidth} onChange={(e) => setStyle(group, { outlineWidth: Number(e.target.value) })} className="w-20 accent-sky-500" />
          </label>
        </div>
        {miss.length > 0 && (
          <p className="flex items-start gap-1.5 text-[10px] text-amber-300 leading-snug">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            <span>Font ini tidak punya {miss.length} karakter (diganti font cadangan): {miss.slice(0, 16).join(' ')}</span>
          </p>
        )}
      </section>
    );
  };

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

        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[18rem_1fr]">
          <div className="p-5 space-y-5 border-r border-slate-800">
            {styleBlock('number', 'Nomor')}
            {styleBlock('name', 'Nama')}
          </div>

          <div className="p-5 space-y-3 min-w-0">
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
              style={{ backgroundImage: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%)', backgroundSize: '16px 16px' }}
            >
              <canvas ref={previewRef} className="w-full h-auto block" />
            </div>
            <p className="text-[10px] text-slate-500">
              {FILES.find((f) => f.kind === view)!.layout.width}×{FILES.find((f) => f.kind === view)!.layout.height} px · {fileName(view)}.ftex ·
              kotak biru = slot karakter, garis merah = atas huruf dan garis dasar
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
            <label className="flex items-center gap-1 cursor-pointer" title="Nama file font diisi ke config.txt dan config ditulis ke folder yang sama">
              <input type="checkbox" checked={writeConfig} onChange={(e) => setWriteConfig(e.target.checked)} className="accent-sky-500" />
              Tulis config.txt juga
            </label>
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
    </div>
  );
};

export default FontsetModal;
