'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ImagePlus, Loader2, AlertTriangle, Check, Layers, Palette } from 'lucide-react';
import { KitTemplate } from '@/types/kit';
import {
  analyzeColors,
  ColorAnalysis,
  clusterHex,
  clusterMask,
  convertPieceMask,
  convertPngFile,
  imageToData,
  splitComponents,
} from '@/utils/pngImport';
import { ConvertedZone } from '@/utils/psdImport';
import { saveConvertedTemplate } from '@/utils/templateSave';
import { PES_2021_PARTS } from '@/constants/pes2021Parts';

interface ImportPngModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (template: KitTemplate) => void;
}

type Tab = 'files' | 'colors';
const MAX_ZONES = 80;
const SIZE = 1024;

const partName = (id: string) => PES_2021_PARTS.find((p) => p.id === id)?.name ?? id;

interface FileItem {
  key: string;
  file: File;
  name: string;
  on: boolean;
}

interface ClusterItem {
  id: number;
  name: string;
  on: boolean;
}

export const ImportPngModal: React.FC<ImportPngModalProps> = ({ isOpen, onClose, onImported }) => {
  const [tab, setTab] = useState<Tab>('colors');
  const [templateName, setTemplateName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ name: string; parts: string[] }[] | null>(null);

  // files tab
  const [files, setFiles] = useState<FileItem[]>([]);
  const [fileMode, setFileMode] = useState<'auto' | 'tint' | 'keep'>('auto');
  const filesRef = useRef<HTMLInputElement | null>(null);

  // colours tab
  const colorRef = useRef<HTMLInputElement | null>(null);
  const [colorFile, setColorFile] = useState<{ name: string; width: number; height: number } | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [tolerance, setTolerance] = useState(22);
  const [splitPieces, setSplitPieces] = useState(false);
  const [minArea, setMinArea] = useState(300);
  const [analysis, setAnalysis] = useState<ColorAnalysis | null>(null);
  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  // re-analyse when the tolerance changes
  useEffect(() => {
    if (!imageData) return;
    const timer = setTimeout(() => {
      const a = analyzeColors(imageData, tolerance);
      setAnalysis(a);
      const opaque = a.clusters.reduce((n, c) => n + c.count, 0) || 1;
      setClusters(
        a.clusters.map((c, i) => ({
          id: c.id,
          name: `Warna ${i + 1}`,
          // the biggest colour is usually the background; tiny noise colours are off by default
          on: !(i === 0 && c.count / opaque > 0.45) && c.count / opaque >= 0.003,
        }))
      );
    }, 150);
    return () => clearTimeout(timer);
  }, [imageData, tolerance]);

  // preview of the selected clusters
  useEffect(() => {
    const cv = previewRef.current;
    if (!cv || !analysis) return;
    const S = 256;
    cv.width = S;
    cv.height = S;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const out = ctx.createImageData(S, S);
    const on = new Set(clusters.filter((c) => c.on).map((c) => c.id));
    const step = SIZE / S;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const lab = analysis.labels[Math.floor(y * step) * SIZE + Math.floor(x * step)];
        const o = (y * S + x) * 4;
        if (lab === 65535) {
          out.data[o] = out.data[o + 1] = out.data[o + 2] = 22;
          out.data[o + 3] = 255;
        } else if (on.has(lab)) {
          const c = analysis.clusters[lab].color;
          out.data[o] = c[0]; out.data[o + 1] = c[1]; out.data[o + 2] = c[2]; out.data[o + 3] = 255;
        } else {
          out.data[o] = out.data[o + 1] = out.data[o + 2] = 50;
          out.data[o + 3] = 255;
        }
      }
    }
    ctx.putImageData(out, 0, 0);
  }, [analysis, clusters]);

  const opaqueTotal = useMemo(() => (analysis ? analysis.clusters.reduce((n, c) => n + c.count, 0) || 1 : 1), [analysis]);

  if (!isOpen) return null;

  const reset = () => {
    setError(null);
    setReport(null);
    setProgress(null);
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    reset();
    const items: FileItem[] = Array.from(list)
      .filter((f) => /\.(png|webp|jpe?g)$/i.test(f.name))
      .map((f, i) => ({
        key: `${f.name}-${f.size}-${i}-${Date.now()}`,
        file: f,
        name: f.name.replace(/\.[^.]+$/, ''),
        on: true,
      }));
    if (!items.length) {
      setError('Pilih file PNG (atau WebP / JPG).');
      return;
    }
    setFiles((prev) => [...prev, ...items]);
    if (!templateName) setTemplateName('Template PNG');
    if (filesRef.current) filesRef.current.value = '';
  };

  const loadColorFile = async (file: File | undefined) => {
    if (!file) return;
    reset();
    setBusy('Membaca gambar...');
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('Tidak bisa membuka gambar.'));
        i.src = url;
      });
      URL.revokeObjectURL(url);
      const { data } = imageToData(img);
      setColorFile({ name: file.name, width: img.naturalWidth, height: img.naturalHeight });
      setImageData(data);
      setTemplateName(file.name.replace(/\.[^.]+$/, ''));
    } catch (e: any) {
      setError(e?.message || 'Gagal membaca gambar.');
    } finally {
      setBusy(null);
      if (colorRef.current) colorRef.current.value = '';
    }
  };

  const runFiles = async () => {
    const chosen = files.filter((f) => f.on);
    if (!chosen.length) return setError('Pilih minimal satu file.');
    const items: ConvertedZone[] = [];
    const rep: { name: string; parts: string[] }[] = [];
    setBusy('Mengonversi...');
    setProgress({ done: 0, total: chosen.length * 2 });
    try {
      let idx = 0;
      for (const f of chosen) {
        await new Promise((r) => setTimeout(r, 0));
        const out = await convertPngFile({ name: f.name, file: f.file }, idx, fileMode);
        if (out) {
          items.push(out);
          rep.push({ name: f.name, parts: out.parts.map(partName) });
          idx++;
        } else {
          rep.push({ name: `${f.name} (dilewati: kosong)`, parts: [] });
        }
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
      await save(items, rep, `Diimpor dari ${chosen.length} file PNG.`);
    } catch (e: any) {
      setError(e?.message || 'Konversi gagal.');
    } finally {
      setBusy(null);
    }
  };

  const runColors = async () => {
    if (!analysis) return;
    const chosen = clusters.filter((c) => c.on);
    if (!chosen.length) return setError('Pilih minimal satu warna.');
    setBusy('Mengonversi...');
    setProgress({ done: 0, total: chosen.length * 2 });
    try {
      const items: ConvertedZone[] = [];
      const rep: { name: string; parts: string[] }[] = [];
      let idx = 0;
      for (const cl of chosen) {
        await new Promise((r) => setTimeout(r, 0));
        const color = analysis.clusters[cl.id].color;
        const masks = splitPieces
          ? splitComponents(analysis.labels, cl.id, minArea)
          : [clusterMask(analysis.labels, cl.id)];
        let piece = 1;
        for (const m of masks) {
          if (items.length >= MAX_ZONES) break;
          const nm = splitPieces && masks.length > 1 ? `${cl.name} ${piece}` : cl.name;
          const out = convertPieceMask(m, color, nm, idx);
          if (out) {
            items.push(out);
            rep.push({ name: nm, parts: out.parts.map(partName) });
            idx++;
            piece++;
          }
        }
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
      if (items.length >= MAX_ZONES) rep.push({ name: `Dibatasi ${MAX_ZONES} zona. Naikkan "luas minimal" atau matikan pemisahan.`, parts: [] });
      await save(items, rep, `Dipisah per warna dari ${colorFile?.name ?? 'gambar'} (${items.length} zona).`);
    } catch (e: any) {
      setError(e?.message || 'Konversi gagal.');
    } finally {
      setBusy(null);
    }
  };

  const save = async (items: ConvertedZone[], rep: { name: string; parts: string[] }[], description: string) => {
    if (!items.length) throw new Error('Semua hasil kosong, tidak ada yang bisa disimpan.');
    setBusy('Menyimpan...');
    const tpl = await saveConvertedTemplate(templateName.trim() || 'Template PNG', description, items, (done, total) =>
      setProgress({ done: Math.ceil(total) + done, total: total * 2 })
    );
    setReport(rep);
    onImported(tpl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#0f131c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-600/20 text-sky-400 border border-sky-500/30">
              <ImagePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Import template dari PNG
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">Eksperimental</span>
              </h3>
              <p className="text-[11px] text-slate-400">PNG tidak punya layer, jadi dipisah per file atau per warna</p>
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
          {!report && (
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['colors', 'Satu PNG, pisah per warna', Palette],
                  ['files', 'Banyak PNG (1 file = 1 layer)', Layers],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => {
                    setTab(id);
                    reset();
                  }}
                  className={`flex items-center justify-center gap-1.5 text-[11px] font-semibold py-2 rounded-lg border transition-colors ${
                    tab === id
                      ? 'bg-sky-600/25 border-sky-500 text-sky-100'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {!report && (
            <label className="block">
              <span className="text-[10px] text-slate-500">Nama template</span>
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template PNG"
                className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500"
              />
            </label>
          )}

          {/* -------- colours tab -------- */}
          {!report && tab === 'colors' && (
            <>
              {!imageData ? (
                <div
                  onClick={() => colorRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    loadColorFile(e.dataTransfer.files?.[0]);
                  }}
                  className="cursor-pointer rounded-xl border-2 border-dashed border-slate-700 hover:border-slate-500 bg-slate-900/40 p-7 text-center"
                >
                  <ImagePlus className="w-6 h-6 mx-auto mb-2 text-sky-400" />
                  <div className="text-xs font-semibold text-slate-200">Klik atau seret satu gambar PNG</div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-snug">
                    Cocok untuk peta warna (tiap bagian beda warna) atau desain jadi. Gambar diregangkan ke 1024×1024,
                    jadi pakai ukuran persegi seperti template PES.
                  </div>
                  <input ref={colorRef} type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={(e) => loadColorFile(e.target.files?.[0])} />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="truncate">
                      {colorFile?.name} — {colorFile?.width}×{colorFile?.height}px
                    </span>
                    {colorFile && colorFile.width !== colorFile.height && (
                      <span className="text-amber-300">tidak persegi, akan diregangkan</span>
                    )}
                    <button
                      onClick={() => {
                        setImageData(null);
                        setAnalysis(null);
                        setClusters([]);
                        setColorFile(null);
                      }}
                      className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Ganti gambar
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <canvas ref={previewRef} className="w-40 h-40 rounded-lg border border-slate-800 bg-black shrink-0" />
                    <div className="flex-1 space-y-2.5 min-w-0">
                      <label className="block space-y-0.5">
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Toleransi warna</span>
                          <span className="font-mono">{tolerance}</span>
                        </div>
                        <input type="range" min={4} max={80} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} className="w-full accent-sky-500" />
                        <p className="text-[10px] text-slate-500 leading-snug">
                          Kecil = banyak warna terpisah (peta warna rapi). Besar = warna mirip digabung (desain berbayangan).
                        </p>
                      </label>
                      <label className="flex items-start gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={splitPieces} onChange={(e) => setSplitPieces(e.target.checked)} className="mt-0.5 accent-sky-500" />
                        <span>
                          Pisah tiap bagian yang tidak tersambung
                          <span className="block text-[10px] text-slate-500">Misalnya garis kiri dan kanan jadi dua layer.</span>
                        </span>
                      </label>
                      {splitPieces && (
                        <label className="block space-y-0.5">
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>Luas minimal</span>
                            <span className="font-mono">{minArea}px</span>
                          </div>
                          <input type="range" min={20} max={3000} step={20} value={minArea} onChange={(e) => setMinArea(Number(e.target.value))} className="w-full accent-sky-500" />
                        </label>
                      )}
                    </div>
                  </div>

                  {analysis && (
                    <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/70">
                      {analysis.clusters.map((c) => {
                        const item = clusters.find((x) => x.id === c.id);
                        if (!item) return null;
                        return (
                          <div key={c.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                            <input type="checkbox" checked={item.on} onChange={(e) => setClusters((prev) => prev.map((x) => (x.id === c.id ? { ...x, on: e.target.checked } : x)))} className="accent-sky-500" />
                            <span className="w-5 h-5 rounded border border-slate-600 shrink-0" style={{ background: clusterHex(c.color) }} />
                            <input
                              value={item.name}
                              onChange={(e) => setClusters((prev) => prev.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
                              className="flex-1 min-w-0 bg-transparent border-b border-transparent focus:border-sky-500 text-slate-200 outline-none"
                            />
                            <span className="text-[10px] font-mono text-slate-500 shrink-0">{clusterHex(c.color)}</span>
                            <span className="text-[10px] font-mono text-slate-500 w-10 text-right shrink-0">{((c.count / opaqueTotal) * 100).toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* -------- files tab -------- */}
          {!report && tab === 'files' && (
            <>
              <div
                onClick={() => filesRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(e.dataTransfer.files);
                }}
                className="cursor-pointer rounded-xl border-2 border-dashed border-slate-700 hover:border-slate-500 bg-slate-900/40 p-6 text-center"
              >
                <ImagePlus className="w-6 h-6 mx-auto mb-2 text-sky-400" />
                <div className="text-xs font-semibold text-slate-200">Klik atau seret banyak file PNG</div>
                <div className="text-[10px] text-slate-500 mt-1 leading-snug">
                  Satu file = satu layer, berukuran sama dengan template (persegi). Latar transparan dipakai sebagai
                  bentuk; gambar tanpa transparansi memakai perbedaan dari warna latar.
                </div>
                <input ref={filesRef} type="file" multiple accept="image/png,image/webp,image/jpeg" className="hidden" onChange={(e) => addFiles(e.target.files)} />
              </div>

              {files.length > 0 && (
                <>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>Warna layer:</span>
                    <select value={fileMode} onChange={(e) => setFileMode(e.target.value as any)} className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-white outline-none">
                      <option value="auto">Otomatis</option>
                      <option value="tint">Bisa diwarnai ulang (satu warna)</option>
                      <option value="keep">Pakai warna asli gambar</option>
                    </select>
                    <button onClick={() => setFiles([])} className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800">
                      Kosongkan
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/70">
                    {files.map((f) => (
                      <div key={f.key} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                        <input type="checkbox" checked={f.on} onChange={(e) => setFiles((prev) => prev.map((x) => (x.key === f.key ? { ...x, on: e.target.checked } : x)))} className="accent-sky-500" />
                        <input
                          value={f.name}
                          onChange={(e) => setFiles((prev) => prev.map((x) => (x.key === f.key ? { ...x, name: e.target.value } : x)))}
                          className="flex-1 min-w-0 bg-transparent border-b border-transparent focus:border-sky-500 text-slate-200 outline-none"
                        />
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">{Math.round(f.file.size / 1024)} KB</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {busy && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                {busy}
                {progress ? ` (${Math.min(progress.done, progress.total)} / ${progress.total})` : ''}
              </div>
              {progress && (
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 transition-all" style={{ width: `${(Math.min(progress.done, progress.total) / progress.total) * 100}%` }} />
                </div>
              )}
            </div>
          )}

          {report && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
                <Check className="w-4 h-4" />
                Template tersimpan dan sudah dipilih ({report.filter((r) => r.parts.length).length} layer).
              </div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/70 text-[11px]">
                {report.map((r, i) => (
                  <div key={`${r.name}-${i}`} className="px-2.5 py-1.5 flex gap-2">
                    <span className="flex-1 truncate text-slate-300" title={r.name}>
                      {r.name}
                    </span>
                    <span className="text-slate-500 truncate max-w-[45%]">{r.parts.join(', ') || '-'}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 leading-snug">
                Bagian ditentukan otomatis dari posisi. Kalau ada yang meleset, buka layernya di tab Template dan ubah
                &quot;Menempel di bagian&quot;.
              </p>
            </div>
          )}

          {error && (
            <div className="flex gap-2 p-2.5 rounded-lg text-[11px] leading-relaxed border bg-rose-950/40 border-rose-900/60 text-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!report && (
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Hasil pemisahan otomatis adalah perkiraan: tepi antar warna bisa kurang halus, dan bayangan atau gradasi
              bisa terpecah. Untuk hasil paling bersih, siapkan peta warna datar (tiap area satu warna tanpa
              gradasi) atau pakai file PNG terpisah per layer.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-800 bg-[#0f131c]">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800">
            {report ? 'Tutup' : 'Batal'}
          </button>
          {!report && (
            <button
              onClick={tab === 'colors' ? runColors : runFiles}
              disabled={busy !== null || (tab === 'colors' ? !analysis || !clusters.some((c) => c.on) : !files.some((f) => f.on))}
              className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Memproses...' : 'Konversi & simpan'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportPngModal;
