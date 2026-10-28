'use client';

import React, { useRef, useState } from 'react';
import { X, FileUp, Loader2, AlertTriangle, Check, Layers, EyeOff } from 'lucide-react';
import { KitTemplate } from '@/types/kit';
import { parsePsd, convertLayer, ParsedPsd } from '@/utils/psdImport';
import { PES_2021_PARTS } from '@/constants/pes2021Parts';

interface ImportPsdModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the saved template (already validated by the server). */
  onImported: (template: KitTemplate) => void;
}

const MAX_LAYERS = 150;

async function post(body: unknown) {
  const res = await fetch('/api/library/template-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Permintaan gagal.');
  return data;
}

const partName = (id: string) => PES_2021_PARTS.find((p) => p.id === id)?.name ?? id;

export const ImportPsdModal: React.FC<ImportPsdModalProps> = ({ isOpen, onClose, onImported }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState<ParsedPsd | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<'parse' | 'convert' | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ name: string; parts: string[]; pixels: number }[] | null>(null);
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setParsed(null);
    setSelected(new Set());
    setName('');
    setError(null);
    setReport(null);
    setProgress(null);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    reset();
    if (!/\.psd$/i.test(file.name)) {
      setError('Pilih file berformat .psd.');
      return;
    }
    setBusy('parse');
    try {
      const result = await parsePsd(file);
      if (result.layers.length === 0) {
        throw new Error(
          'Tidak ada layer piksel yang bisa dibaca. Rasterize layer teks/bentuk di Photoshop lalu simpan ulang.'
        );
      }
      setParsed(result);
      setName(file.name.replace(/\.psd$/i, ''));
      setSelected(new Set(result.layers.slice(0, MAX_LAYERS).map((l) => l.key)));
    } catch (e: any) {
      setError(e?.message || 'Gagal membaca PSD.');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const convert = async () => {
    if (!parsed) return;
    const chosen = parsed.layers.filter((l) => selected.has(l.key));
    if (chosen.length === 0) {
      setError('Pilih minimal satu layer.');
      return;
    }
    setBusy('convert');
    setError(null);
    setReport(null);
    setProgress({ done: 0, total: chosen.length });
    try {
      const { folder } = await post({ action: 'init', name: name.trim() || 'template-psd' });
      const zones: Record<string, unknown>[] = [];
      const rep: { name: string; parts: string[]; pixels: number }[] = [];
      let idx = 0;
      for (const info of chosen) {
        // let the progress bar paint between heavy layers
        await new Promise((r) => setTimeout(r, 0));
        const out = convertLayer(info, parsed.width, parsed.height, idx);
        if (out) {
          await post({ action: 'mask', folder, file: out.maskFile, dataUrl: out.maskDataUrl });
          zones.push(out.zone);
          rep.push({ name: info.name, parts: out.parts.map(partName), pixels: out.pixels });
          idx++;
        } else {
          rep.push({ name: `${info.name} (dilewati: kosong)`, parts: [], pixels: 0 });
        }
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
      if (zones.length === 0) throw new Error('Semua layer kosong, tidak ada yang bisa dikonversi.');
      const finalName = name.trim() || 'Template PSD';
      const res = await post({
        action: 'finish',
        folder,
        template: {
          id: `lib-${folder}`,
          name: finalName,
          description: `Diimpor dari ${parsed.fileName} (${zones.length} layer).`,
          zones,
        },
      });
      setReport(rep);
      onImported(res.template as KitTemplate);
    } catch (e: any) {
      setError(e?.message || 'Konversi gagal.');
    } finally {
      setBusy(null);
    }
  };

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#0f131c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-600/20 text-sky-400 border border-sky-500/30">
              <FileUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Import template dari PSD
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">Eksperimental</span>
              </h3>
              <p className="text-[11px] text-slate-400">Setiap layer piksel menjadi zona yang bisa diwarnai dan diedit</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="flex gap-2 p-2.5 rounded-lg text-[11px] leading-relaxed border bg-amber-950/25 border-amber-900/50 text-amber-200">
            <span className="shrink-0">⚠</span>
            <span>
              Fitur ini masih eksperimental: pemetaan bagian bisa meleset, konversi bisa lambat, dan sebagian efek tidak
              terbawa. Hasilnya aman dicoba karena disimpan sebagai template baru (tidak menimpa apa pun). Daftar masalah
              yang diketahui ada di <code>docs/CATATAN-BUG.md</code>.
            </span>
          </div>
          {!parsed && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                dragOver ? 'border-sky-400 bg-sky-950/30' : 'border-slate-700 hover:border-slate-500 bg-slate-900/40'
              }`}
            >
              {busy === 'parse' ? (
                <Loader2 className="w-6 h-6 mx-auto mb-2 text-sky-400 animate-spin" />
              ) : (
                <FileUp className="w-6 h-6 mx-auto mb-2 text-sky-400" />
              )}
              <div className="text-xs font-semibold text-slate-200">
                {busy === 'parse' ? 'Membaca PSD...' : 'Klik atau seret file .psd ke sini'}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                File dibaca di browser dan tidak diunggah ke luar. PSD besar bisa butuh beberapa detik.
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".psd"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          )}

          {parsed && !report && (
            <>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span className="truncate">
                  {parsed.fileName} — {parsed.width}×{parsed.height}px, {parsed.layers.length} layer piksel
                </span>
                <button
                  onClick={reset}
                  className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Ganti file
                </button>
              </div>

              <label className="block">
                <span className="text-[10px] text-slate-500">Nama template</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500"
                />
              </label>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  {selected.size} dari {parsed.layers.length} layer dipilih
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setSelected(new Set(parsed.layers.map((l) => l.key)))}
                    className="px-1.5 py-0.5 rounded border border-slate-700 hover:bg-slate-800 text-slate-300"
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setSelected(new Set(parsed.layers.filter((l) => !l.hidden).map((l) => l.key)))}
                    className="px-1.5 py-0.5 rounded border border-slate-700 hover:bg-slate-800 text-slate-300"
                  >
                    Hanya yang terlihat
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="px-1.5 py-0.5 rounded border border-slate-700 hover:bg-slate-800 text-slate-300"
                  >
                    Kosongkan
                  </button>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/70">
                {parsed.layers.map((l) => (
                  <label
                    key={l.key}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-slate-800/40"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(l.key)}
                      onChange={() => toggle(l.key)}
                      className="accent-sky-500"
                    />
                    <span className={`flex-1 truncate ${l.hidden ? 'text-slate-500' : 'text-slate-200'}`} title={l.name}>
                      {l.name}
                    </span>
                    {l.hidden && <EyeOff className="w-3 h-3 text-slate-500 shrink-0" />}
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {l.right - l.left}×{l.bottom - l.top}
                    </span>
                  </label>
                ))}
              </div>

              {parsed.skipped.length > 0 && (
                <details className="text-[10px] text-amber-300/90 bg-amber-950/20 border border-amber-900/40 rounded p-2">
                  <summary className="cursor-pointer">{parsed.skipped.length} layer dilewati (tidak ada piksel)</summary>
                  <ul className="mt-1 space-y-0.5 text-slate-400">
                    {parsed.skipped.slice(0, 40).map((s) => (
                      <li key={s.name} className="truncate">
                        {s.name} — {s.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {parsed.layers.length > MAX_LAYERS && (
                <p className="text-[10px] text-amber-300">
                  PSD punya lebih dari {MAX_LAYERS} layer; hanya {MAX_LAYERS} pertama yang dipilih otomatis.
                </p>
              )}
            </>
          )}

          {busy === 'convert' && progress && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                Mengonversi layer {progress.done} / {progress.total}...
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {report && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
                <Check className="w-4 h-4" />
                Template tersimpan dan sudah dipilih. {report.filter((r) => r.pixels > 0).length} layer dikonversi.
              </div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/70 text-[11px]">
                {report.map((r) => (
                  <div key={r.name} className="px-2.5 py-1.5 flex gap-2">
                    <span className="flex-1 truncate text-slate-300" title={r.name}>
                      {r.name}
                    </span>
                    <span className="text-slate-500 truncate max-w-[45%]" title={r.parts.join(', ')}>
                      {r.parts.join(', ') || '-'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 leading-snug">
                Bagian ditentukan otomatis dari posisi layer. Kalau ada yang meleset, buka layernya di tab Template,
                ubah daftar &quot;Menempel di bagian&quot;, lalu klik Simpan.
              </p>
            </div>
          )}

          {error && (
            <div className="flex gap-2 p-2.5 rounded-lg text-[11px] leading-relaxed border bg-rose-950/40 border-rose-900/60 text-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-[10px] text-slate-500 leading-relaxed">
            Dibawa: bentuk layer, topeng (mask) layer, opasitas, dan tampil/sembunyi. Tidak dibawa: mode blend, efek
            layer (bayangan, stroke), dan clipping mask. Layer teks, bentuk vektor, dan smart object perlu di-rasterize
            dulu. Layer berwarna-warni mempertahankan warna aslinya; layer satu warna bisa diwarnai ulang.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-800 bg-[#0f131c]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800"
          >
            {report ? 'Tutup' : 'Batal'}
          </button>
          {parsed && !report && (
            <button
              onClick={convert}
              disabled={busy !== null || selected.size === 0}
              className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === 'convert' ? 'Mengonversi...' : `Konversi & simpan (${selected.size})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportPsdModal;
