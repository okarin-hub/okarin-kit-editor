'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ImagePlus, Loader2, AlertTriangle, Check, Layers, Palette } from 'lucide-react';
import { InfoTip } from '@/components/ui/InfoTip';
import { KitTemplate } from '@/types/kit';
import {
  analyzeColors,
  clusterPartShares,
  ColorAnalysis,
  clusterHex,
  median3,
  blendColours,
  PngPsdRequest,
  analyzeColorways,
  ColourVector,
  convertPngFile,
  imageToData,
  type ImageFit,
} from '@/utils/pngImport';
import { ConvertedZone } from '@/utils/psdImport';
import type { PngPsdReply } from '@/workers/pngPsd.worker';
import { saveConvertedTemplate } from '@/utils/templateSave';
import { PES_2021_PARTS } from '@/constants/pes2021Parts';

interface ImportPngModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (template: KitTemplate) => void;
  /** The colour split is saved as a layered PSD and handed to "Tambah PSD" (read from library/templates). */
  onAddPsd: (file: File) => Promise<void> | void;
  /** a picture to start the colour split with (e.g. the pattern made from a jersey photo) */
  initialFile?: File | null;
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
  /** Typed by the user; empty = the default name (auto). */
  name: string;
  /** Default name ("Warna 3"), shown as a placeholder so it is translated with the interface. */
  auto: string;
  on: boolean;
  /** Merged into this colour (its pixels become that colour's layer). */
  merge?: number;
}

export const ImportPngModal: React.FC<ImportPngModalProps> = ({ isOpen, onClose, onImported, onAddPsd, initialFile }) => {
  const [tab, setTab] = useState<Tab>('colors');
  const [templateName, setTemplateName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ name: string; parts: string[] }[] | null>(null);

  // files tab
  const [files, setFiles] = useState<FileItem[]>([]);
  const [fileMode, setFileMode] = useState<'auto' | 'tint' | 'keep'>('auto');
  // a non-square picture: stretch it (as before), fit it whole, or crop it to the square
  const [fit, setFit] = useState<ImageFit>('stretch');
  const colorImg = useRef<HTMLImageElement | null>(null);
  const filesRef = useRef<HTMLInputElement | null>(null);

  // colours tab
  const colorRef = useRef<HTMLInputElement | null>(null);
  const [colorFile, setColorFile] = useState<{ name: string; width: number; height: number } | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [tolerance, setTolerance] = useState(22);
  const [splitPieces, setSplitPieces] = useState(false);
  const [minArea, setMinArea] = useState(300);
  const [analysis, setAnalysis] = useState<(ColorAnalysis & { vectors: ColourVector[] }) | null>(null);
  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  // the same template in other colours (up to 2): areas are told apart by how they change between versions
  const [extras, setExtras] = useState<{ name: string; img: HTMLImageElement; data: ImageData }[]>([]);
  const extraRef = useRef<HTMLInputElement | null>(null);
  // smooth gradients: the shades between the chosen colours become a blend of them instead of their own layers
  const [gradient, setGradient] = useState(false);
  // compressed pictures (WebP / JPG from template sites) are cleaned of speckles before the colours are grouped
  const [denoise, setDenoise] = useState(false);
  // the colour picked in the preview (or in the list): shown bright, the rest dimmed
  const [highlight, setHighlight] = useState<number | null>(null);
  const [bigPreview, setBigPreview] = useState(false);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const worker = useRef<Worker | null>(null);

  // colour -> the colour it was merged into (one step: a colour that others joined cannot be merged itself)
  const alias = useMemo(() => {
    const a = Int32Array.from(analysis?.clusters ?? [], (c) => c.id);
    clusters.forEach((c) => {
      if (c.merge !== undefined && c.merge !== c.id) a[c.id] = c.merge;
    });
    return a;
  }, [analysis, clusters]);

  useEffect(() => () => worker.current?.terminate(), []);

  // re-analyse when the tolerance, the cleaning or the set of pictures changes
  useEffect(() => {
    if (!imageData) return;
    const timer = setTimeout(() => {
      const clean = (d: ImageData) => (denoise ? median3(d) : d);
      const main = clean(imageData);
      const a = extras.length
        ? analyzeColorways([main, ...extras.map((e) => clean(e.data))], tolerance)
        : (() => {
            const one = analyzeColors(main, tolerance);
            return { ...one, vectors: one.clusters.map((c) => [...c.color]) };
          })();
      setHighlight(null);
      setAnalysis(a);
      const opaque = a.clusters.reduce((n, c) => n + c.count, 0) || 1;
      const onParts = clusterPartShares(a.labels, a.clusters.length);
      // template sites put their watermark / credit boxes in the armband and credit areas
      const onBadges = clusterPartShares(a.labels, a.clusters.length, ['armband', 'credit']);
      setClusters(
        a.clusters.map((c, i) => ({
          id: c.id,
          // the default name is shown as a placeholder, so it follows the interface language; name = typed by the user
          name: '',
          auto: `Warna ${i + 1}`,
          // the empty background (almost no pixels on a kit part) and tiny noise colours start off
          on: onParts[i] >= 0.3 && c.count / opaque >= 0.003 && onBadges[i] < 0.8 * onParts[i],
        }))
      );
    }, 150);
    return () => clearTimeout(timer);
  }, [imageData, tolerance, extras, denoise]);

  // preview of the selected clusters (merged colours drawn as the colour they joined)
  useEffect(() => {
    const cv = previewRef.current;
    if (!cv || !analysis) return;
    const S = 512;
    cv.width = S;
    cv.height = S;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const out = ctx.createImageData(S, S);
    const on = new Set(clusters.filter((c) => c.on && c.merge === undefined).map((c) => c.id));
    // a picked colour that was merged shows as the colour it joined
    const hl = highlight === null || highlight >= alias.length ? null : alias[highlight];
    const step = SIZE / S;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const raw = analysis.labels[Math.floor(y * step) * SIZE + Math.floor(x * step)];
        const lab = raw === 65535 ? raw : alias[raw];
        const o = (y * S + x) * 4;
        out.data[o + 3] = 255;
        if (lab === 65535) {
          out.data[o] = out.data[o + 1] = out.data[o + 2] = 22;
        } else if (on.has(lab)) {
          const c = analysis.clusters[lab].color;
          // with a colour picked, the others are dimmed so its area stands out
          const k = hl === null || hl === lab ? 1 : 0.25;
          out.data[o] = c[0] * k; out.data[o + 1] = c[1] * k; out.data[o + 2] = c[2] * k;
        } else {
          out.data[o] = out.data[o + 1] = out.data[o + 2] = hl === lab ? 140 : 50;
        }
      }
    }
    ctx.putImageData(out, 0, 0);
    // bigPreview: the canvas is a new element after resizing, draw it again
  }, [analysis, clusters, alias, highlight, bigPreview]);

  /** A click on the preview picks the colour under it and scrolls its row into view. */
  const pickFromPreview = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!analysis) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * SIZE);
    const y = Math.floor(((e.clientY - r.top) / r.height) * SIZE);
    const raw = analysis.labels[Math.min(SIZE - 1, Math.max(0, y)) * SIZE + Math.min(SIZE - 1, Math.max(0, x))];
    if (raw === 65535) return setHighlight(null);
    const lab = alias[raw];
    setHighlight((h) => (h === lab ? null : lab));
    rowRefs.current.get(lab)?.scrollIntoView({ block: 'nearest' });
  };

  useEffect(() => {
    if (!isOpen || !initialFile) return;
    setTab('colors');
    loadColorFile(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialFile]);

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
      colorImg.current = img;
      const { data } = imageToData(img, fit);
      setColorFile({ name: file.name, width: img.naturalWidth, height: img.naturalHeight });
      // compressed formats carry speckles and blocks: clean them by default
      setDenoise(/\.(webp|jpe?g)$/i.test(file.name));
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
        const out = await convertPngFile({ name: f.name, file: f.file }, idx, fileMode, fit);
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

  const addExtra = async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('Tidak bisa membuka gambar.'));
        i.src = url;
      });
      URL.revokeObjectURL(url);
      setExtras((prev) => [...prev, { name: file.name, img, data: imageToData(img, fit).data }].slice(0, 2));
    } catch (e: any) {
      setError(e?.message || 'Gagal membaca gambar.');
    }
  };

  const runColors = async () => {
    if (!analysis) return;
    // merged colours become part of the colour they joined
    const chosen = clusters.filter((c) => c.on && c.merge === undefined);
    if (!chosen.length) return setError('Pilih minimal satu warna.');
    if (!colorImg.current) return setError('Gambar belum dibaca.');
    setBusy('Mengonversi...');
    setProgress({ done: 0, total: chosen.length + 1 });
    try {
      const images = await Promise.all([colorImg.current, ...extras.map((e) => e.img)].map((img) => createImageBitmap(img)));
      const request: PngPsdRequest = {
        images,
        fit,
        denoise,
        labels: analysis.labels,
        counts: analysis.clusters.map((c) => c.count),
        vectors: analysis.vectors,
        colors: analysis.clusters.map((c) => c.color),
        chosen: chosen.map((c) => ({ id: c.id, name: c.name.trim() || c.auto })),
        alias,
        gradient,
        splitPieces,
        minArea,
        maxZones: MAX_ZONES,
      };
      // the cutting and the PSD writing run in a worker, so the app stays usable meanwhile
      worker.current?.terminate();
      const w = new Worker(new URL('../../workers/pngPsd.worker.ts', import.meta.url));
      worker.current = w;
      const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
        w.onmessage = (e: MessageEvent<PngPsdReply>) => {
          const r = e.data;
          if (r.type === 'progress') setProgress({ done: r.done, total: r.total });
          else if (r.type === 'done') resolve(r.buf);
          else reject(new Error(r.error));
        };
        w.onerror = (e) => reject(new Error(e.message || 'Worker gagal'));
        w.postMessage(request, images);
      });
      w.terminate();
      worker.current = null;
      setBusy('Menyimpan PSD...');
      await onAddPsd(new File([buf], `${(templateName.trim() || 'Template PNG').replace(/[\\/:*?"<>|]+/g, '_')}.psd`));
      onClose();
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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#0f131c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-600/20 text-sky-400 border border-sky-500/30">
              <ImagePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Import template dari PNG
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">Eksperimental</span>
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
              yang diketahui ada di <code>docs/en/KNOWN-ISSUES.md</code>.
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
                      <select
                        value={fit}
                        onChange={(e) => {
                          const next = e.target.value as ImageFit;
                          setFit(next);
                          if (colorImg.current) setImageData(imageToData(colorImg.current, next).data);
                          setExtras((prev) => prev.map((x) => ({ ...x, data: imageToData(x.img, next).data })));
                        }}
                        className="bg-slate-900 border border-amber-500/50 rounded px-1.5 py-0.5 text-[11px] text-amber-200 outline-none"
                        title="Gambar tidak persegi: cara memasukkannya ke tekstur 1024 × 1024"
                      >
                        <option value="stretch">Regangkan</option>
                        <option value="fit">Pas (sisa kosong)</option>
                        <option value="crop">Potong ke persegi</option>
                      </select>
                    )}
                    <button
                      onClick={() => {
                        setImageData(null);
                        setAnalysis(null);
                        setClusters([]);
                        setColorFile(null);
                        setExtras([]);
                      }}
                      className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Ganti gambar
                    </button>
                  </div>

                  {bigPreview && (
                    <canvas
                      ref={previewRef}
                      onClick={pickFromPreview}
                      className="w-full aspect-square rounded-lg border border-slate-800 bg-black cursor-crosshair"
                      title="Klik sebuah area untuk menyorot warnanya di daftar"
                    />
                  )}
                  <div className="flex gap-3">
                    <div className="shrink-0 space-y-1">
                      {!bigPreview && (
                        <canvas
                          ref={previewRef}
                          onClick={pickFromPreview}
                          className="w-40 h-40 rounded-lg border border-slate-800 bg-black cursor-crosshair"
                          title="Klik sebuah area untuk menyorot warnanya di daftar"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setBigPreview((v) => !v)}
                        className="w-40 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                      >
                        {bigPreview ? 'Perkecil pratinjau' : 'Perbesar pratinjau'}
                      </button>
                    </div>
                    <div className="flex-1 space-y-2.5 min-w-0">
                      <label className="block space-y-0.5">
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            Toleransi warna
                            <InfoTip text="Kecil = banyak warna terpisah (peta warna rapi). Besar = warna mirip digabung (desain berbayangan)." />
                          </span>
                          <span className="font-mono">{tolerance}</span>
                        </div>
                        <input type="range" min={4} max={80} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} className="w-full accent-sky-500" />
                      </label>
                      <label className="flex items-start gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={splitPieces} onChange={(e) => setSplitPieces(e.target.checked)} className="mt-0.5 accent-sky-500" />
                        <span className="flex items-center gap-1">
                          Pisah tiap bagian yang tidak tersambung
                          <InfoTip text="Misalnya garis kiri dan kanan jadi dua layer." />
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
                      <label className="flex items-start gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={denoise} onChange={(e) => setDenoise(e.target.checked)} className="mt-0.5 accent-sky-500" />
                        <span className="flex items-center gap-1">
                          Bersihkan noise
                          <InfoTip text="Untuk WebP / JPG dari situs: bintik dan kotak kompresi dihaluskan dulu, tepi tetap tajam." />
                        </span>
                      </label>
                      <label className="flex items-start gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={gradient}
                          onChange={(e) => {
                            setGradient(e.target.checked);
                            // a gradient needs only its end colours: untick the ones that are a blend of two others
                            if (e.target.checked && analysis) {
                              const blends = blendColours(clusters.filter((c) => c.on && c.merge === undefined).map((c) => c.id), analysis.vectors);
                              setClusters((prev) => prev.map((x) => (blends.has(x.id) ? { ...x, on: false } : x)));
                            }
                          }}
                          className="mt-0.5 accent-sky-500"
                        />
                        <span className="flex items-center gap-1">
                          Gradasi halus
                          <InfoTip text="Untuk desain bergradasi atau blur: centang hanya warna ujungnya, warna di antaranya menjadi campuran keduanya dan gradasinya tetap ada saat warnanya diganti." />
                        </span>
                      </label>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-[11px] text-slate-300">
                          Versi warna lain <span className="text-slate-500">(opsional, maks. 2)</span>
                          <InfoTip text="Template yang sama dalam warna lain. Bagian yang berubah warna bersama menjadi satu layer, jadi area yang kebetulan sewarna tetap terpisah." />
                        </div>
                        {extras.map((x, i) => (
                          <div key={`${x.name}-${i}`} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                            <span className="truncate flex-1">{x.name}</span>
                            <button
                              type="button"
                              onClick={() => setExtras((prev) => prev.filter((_, k) => k !== i))}
                              className="px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                        {extras.length < 2 && (
                          <button
                            type="button"
                            onClick={() => extraRef.current?.click()}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                          >
                            + Tambah versi warna
                          </button>
                        )}
                        <input
                          ref={extraRef}
                          type="file"
                          accept="image/png,image/webp,image/jpeg"
                          className="hidden"
                          onChange={(e) => {
                            addExtra(e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {analysis && (
                    <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/70">
                      {analysis.clusters.map((c) => {
                        const item = clusters.find((x) => x.id === c.id);
                        if (!item) return null;
                        // a colour others joined cannot itself be merged, and only into a colour that is not merged
                        const joined = clusters.some((x) => x.merge === c.id);
                        const targets = clusters.filter((x) => x.id !== c.id && x.merge === undefined);
                        return (
                          <div
                            key={c.id}
                            ref={(el) => {
                              if (el) rowRefs.current.set(c.id, el);
                              else rowRefs.current.delete(c.id);
                            }}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest('input,select')) return;
                              setHighlight((h) => (h === c.id ? null : c.id));
                            }}
                            className={`flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer ${highlight === c.id ? 'bg-sky-900/40' : ''} ${item.merge !== undefined ? 'opacity-60' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={item.on}
                              disabled={item.merge !== undefined}
                              onChange={(e) => setClusters((prev) => prev.map((x) => (x.id === c.id ? { ...x, on: e.target.checked } : x)))}
                              className="accent-sky-500"
                            />
                            <span className="w-5 h-5 rounded border border-slate-600 shrink-0" style={{ background: clusterHex(c.color) }} />
                            <input
                              value={item.name}
                              placeholder={item.auto}
                              aria-label={item.auto}
                              onChange={(e) => setClusters((prev) => prev.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
                              className="flex-1 min-w-0 bg-transparent border-b border-transparent focus:border-sky-500 text-slate-200 placeholder:text-slate-200 outline-none"
                            />
                            <select
                              value={item.merge ?? ''}
                              disabled={joined}
                              onChange={(e) => {
                                const v = e.target.value === '' ? undefined : Number(e.target.value);
                                setClusters((prev) => prev.map((x) => (x.id === c.id ? { ...x, merge: v } : x)));
                              }}
                              title={joined ? 'Warna lain sudah digabung ke warna ini' : 'Gabungkan warna ini ke warna lain (misalnya bayangan yang terpisah)'}
                              aria-label={`Gabungkan ${item.name || item.auto} ke warna lain`}
                              className="w-24 shrink-0 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-slate-300 outline-none focus:border-sky-500 disabled:opacity-40"
                            >
                              <option value="">Tidak digabung</option>
                              {targets.map((x) => (
                                <option key={x.id} value={x.id}>
                                  → {x.name || x.auto}
                                </option>
                              ))}
                            </select>
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
                    <span title="Untuk file yang tidak persegi">Tidak persegi:</span>
                    <select value={fit} onChange={(e) => setFit(e.target.value as ImageFit)} className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-white outline-none">
                      <option value="stretch">Regangkan</option>
                      <option value="fit">Pas (sisa kosong)</option>
                      <option value="crop">Potong ke persegi</option>
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
