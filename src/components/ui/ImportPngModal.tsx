'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ImagePlus, Loader2, AlertTriangle, Check, Layers, Palette, ChevronRight } from 'lucide-react';
import { InfoTip } from '@/components/ui/InfoTip';
import { KitTemplate } from '@/types/kit';
import {
  clusterPartShares,
  clusterHex,
  backdropClusters,
  predictResult,
  blendColours,
  groupMainColours,
  clusterGroups,
  groupMap,
  PngPsdRequest,
  convertPngFile,
  imageToData,
  type ImageFit,
} from '@/utils/pngImport';
import { ConvertedZone, LAYER_GROUPS } from '@/utils/psdImport';
import type { PngPsdReply } from '@/workers/pngPsd.worker';
import type { PngAnalysis, PngAnalyzeReply, PngAnalyzeRequest } from '@/workers/pngAnalyze.worker';
import { saveConvertedTemplate } from '@/utils/templateSave';
import { logActivity } from '@/utils/activityLog';
import { PES_2021_PARTS } from '@/constants/pes2021Parts';

interface ImportPngModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (template: KitTemplate) => void;
  /** The colour split is saved as a layered PSD and handed to "Tambah PSD" (read from library/templates); false = failed. */
  onAddPsd: (file: File) => Promise<boolean>;
  /** a picture to start the colour split with (e.g. the pattern made from a jersey photo) */
  initialFile?: File | null;
}

type Tab = 'files' | 'colors';
const MAX_ZONES = 80;
const SIZE = 1024;
// part group colours of the "Bagian" preview, in LAYER_GROUPS order (shirt, shorts, socks, details)
const GROUP_RGB: [number, number, number][] = [
  [56, 189, 248],
  [251, 191, 36],
  [52, 211, 153],
  [244, 114, 182],
];

const partName = (id: string) => PES_2021_PARTS.find((p) => p.id === id)?.name ?? id;
// each item its own text node, so every part name is translated by itself
const joined = (items: string[], sep: string) =>
  items.map((x, i) => (
    <React.Fragment key={x}>
      {i > 0 && sep}
      {x}
    </React.Fragment>
  ));

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

const check = 'flex items-start gap-1.5 text-[11px] text-slate-300 cursor-pointer';
const smallBtn = 'text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40';
const fitSelect = (fit: ImageFit, onChange: (f: ImageFit) => void, className: string) => (
  <select value={fit} onChange={(e) => onChange(e.target.value as ImageFit)} className={className} title="Gambar tidak persegi: cara memasukkannya ke tekstur 1024 × 1024">
    <option value="stretch">Regangkan</option>
    <option value="fit">Pas (sisa kosong)</option>
    <option value="crop">Potong ke persegi</option>
  </select>
);

export const ImportPngModal: React.FC<ImportPngModalProps> = ({ isOpen, onClose, onImported, onAddPsd, initialFile }) => {
  const [tab, setTab] = useState<Tab>('colors');
  const [templateName, setTemplateName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ name: string; parts: string[] }[] | null>(null);
  // the colour split is saved as a PSD that the app reads next; the report says so instead of "selected"
  const [reportPsd, setReportPsd] = useState(false);

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
  const [analysis, setAnalysis] = useState<PngAnalysis | null>(null);
  // logos and sponsors become their own layers (their colours leave the colour list)
  const [separateLogos, setSeparateLogos] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  // the same template in other colours (up to 2): areas are told apart by how they change between versions
  const [extras, setExtras] = useState<{ name: string; img: HTMLImageElement; data: ImageData }[]>([]);
  const extraRef = useRef<HTMLInputElement | null>(null);
  // smooth gradients: the shades between the chosen colours become a blend of them instead of their own layers
  const [gradient, setGradient] = useState(false);
  // compressed pictures (WebP / JPG from template sites) are cleaned of speckles before the colours are grouped
  const [denoise, setDenoise] = useState(false);
  // the picture's mesh lines and shading as two layers over the colours, so they stay after a colour change
  const [fabricDetail, setFabricDetail] = useState(true);
  // ...as colour layers (a tonal motif that can be recoloured) instead of fixed black / white shading
  const [motif, setMotif] = useState(false);
  // one colour slot per colour for the shirt, shorts and socks together (off: a slot per part group, as before)
  const [sharedSlots, setSharedSlots] = useState(true);
  // the colour picked in the preview (or in the list): shown bright, the rest dimmed
  const [highlight, setHighlight] = useState<number | null>(null);
  // the preview shows the colours, or which part group each chosen colour lands on
  // result = what the template will look like, original = the picture, diff = where they differ (red)
  const [view, setView] = useState<'result' | 'original' | 'diff' | 'colors' | 'parts'>('result');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // the settings start folded: the summary, the preview and the colour list are enough for most pictures
  const [settingsOpen, setSettingsOpen] = useState(false);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const worker = useRef<Worker | null>(null);
  const analyzer = useRef<Worker | null>(null);
  const analyzeId = useRef(0);

  // colour -> the colour it was merged into (one step: a colour that others joined cannot be merged itself)
  const alias = useMemo(() => {
    const a = Int32Array.from(analysis?.clusters ?? [], (c) => c.id);
    clusters.forEach((c) => {
      if (c.merge !== undefined && c.merge !== c.id) a[c.id] = c.merge;
    });
    return a;
  }, [analysis, clusters]);

  // the part groups each colour is cut into (merged colours count for the colour they joined)
  const groups = useMemo(
    () => (analysis && alias.length === analysis.clusters.length ? clusterGroups(analysis.labels, analysis.clusters.length, alias) : []),
    [analysis, alias]
  );
  const chosen = clusters.filter((c) => c.on && c.merge === undefined);
  // the largest chosen colour becomes the Base of every group (see buildPngPsd)
  const baseId = useMemo(() => {
    if (!analysis) return -1;
    const counts = new Array(analysis.clusters.length).fill(0);
    analysis.clusters.forEach((c) => (counts[alias[c.id]] += c.count));
    return chosen.reduce((best, c) => (best < 0 || counts[c.id] > counts[best] ? c.id : best), -1);
  }, [analysis, alias, chosen]);
  const allGroups = LAYER_GROUPS.map(([g]) => g);
  const groupsOf = (id: number) => (gradient || id === baseId ? allGroups : groups[id] ?? []);

  useEffect(
    () => () => {
      worker.current?.terminate();
      analyzer.current?.terminate();
    },
    []
  );

  // re-analyse (in a worker) when the tolerance, the cleaning or the set of pictures changes
  useEffect(() => {
    if (!imageData) return;
    const timer = setTimeout(() => {
      const id = ++analyzeId.current;
      if (!analyzer.current) analyzer.current = new Worker(new URL('../../workers/pngAnalyze.worker.ts', import.meta.url));
      const w = analyzer.current;
      setAnalyzing(true);
      w.onmessage = (e: MessageEvent<PngAnalyzeReply>) => {
        const r = e.data;
        // an older run finishing late is dropped
        if (r.id !== analyzeId.current) return;
        setAnalyzing(false);
        if (r.type === 'error') return setError(r.error);
        const a = r.analysis;
        setHighlight(null);
        setAnalysis(a);
        const opaque = a.clusters.reduce((n, c) => n + c.count, 0) || 1;
        const onParts = clusterPartShares(a.labels, a.clusters.length);
        // template sites put their watermark / credit boxes in the armband and credit areas
        const onBadges = clusterPartShares(a.labels, a.clusters.length, ['armband', 'credit']);
        // the empty background (almost no pixels on a kit part) and tiny noise colours start off
        // ...and so does the texture's own backdrop (the black around the parts), which never shows on the kit
        const backdrop = backdropClusters(a.labels, a.clusters.length);
        const onOf = (i: number) =>
          onParts[i] >= 0.3 && a.clusters[i].count / opaque >= 0.003 && onBadges[i] < 0.8 * onParts[i] && !backdrop[i];
        setClusters(
          a.clusters.map((c, i) => {
            // a shade of another colour (mesh, folds, shadow) starts merged into it; the fabric detail keeps the shading
            const to = a.shades?.[i] ?? i;
            const merge = to !== i && onOf(to) ? a.clusters[to].id : undefined;
            return {
              id: c.id,
              // the default name is shown as a placeholder, so it follows the interface language; name = typed by the user
              name: '',
              auto: `Warna ${i + 1}`,
              on: onOf(i) || merge !== undefined,
              merge,
            };
          })
        );
      };
      w.onerror = (e) => {
        setAnalyzing(false);
        setError(e.message || 'Analisis warna gagal.');
      };
      w.postMessage({ id, datas: [imageData, ...extras.map((x) => x.data)], tolerance, denoise, logos: separateLogos } satisfies PngAnalyzeRequest);
    }, 150);
    return () => clearTimeout(timer);
  }, [imageData, tolerance, extras, denoise, separateLogos]);

  // the template as it will come out, and how close it stays to the picture
  const predicted = useMemo(() => {
    if (!analysis || !imageData || alias.length !== analysis.clusters.length) return null;
    const on = new Set(chosen.map((c) => c.id));
    const base = baseId >= 0 ? analysis.clusters[baseId].color : ([128, 128, 128] as [number, number, number]);
    return predictResult(
      imageData,
      analysis.labels,
      (l) => (on.has(alias[l]) ? analysis.clusters[alias[l]].color : null),
      base,
      fabricDetail,
      analysis.logos?.map
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, imageData, alias, clusters, baseId, fabricDetail]);

  // preview of the selected clusters (merged colours drawn as the colour they joined), or of their part groups
  useEffect(() => {
    const cv = previewRef.current;
    if (!cv || !analysis) return;
    cv.width = SIZE;
    cv.height = SIZE;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    if (view === 'result' || view === 'original' || view === 'diff') {
      if (!imageData || !predicted) return;
      if (view === 'result') return ctx.putImageData(predicted.image, 0, 0);
      if (view === 'original') return ctx.putImageData(imageData, 0, 0);
      // the picture dimmed, the pixels the template will not match in red
      const img = ctx.createImageData(SIZE, SIZE);
      for (let p = 0, i = 0; p < SIZE * SIZE; p++, i += 4) {
        const off = predicted.off[p];
        img.data[i] = off ? 239 : imageData.data[i] * 0.3;
        img.data[i + 1] = off ? 68 : imageData.data[i + 1] * 0.3;
        img.data[i + 2] = off ? 68 : imageData.data[i + 2] * 0.3;
        img.data[i + 3] = 255;
      }
      return ctx.putImageData(img, 0, 0);
    }
    const out = ctx.createImageData(SIZE, SIZE);
    const on = new Set(chosen.map((c) => c.id));
    const gm = view === 'parts' ? groupMap() : null;
    // a picked colour that was merged shows as the colour it joined
    const hl = highlight === null || highlight >= alias.length ? null : alias[highlight];
    for (let p = 0; p < SIZE * SIZE; p++) {
      const raw = analysis.labels[p];
      const lab = raw === 65535 ? raw : alias[raw];
      const o = p * 4;
      out.data[o + 3] = 255;
      if (lab === 65535) {
        out.data[o] = out.data[o + 1] = out.data[o + 2] = 22;
      } else if (on.has(lab)) {
        const c = analysis.clusters[lab].color;
        // with a colour picked, the others are dimmed so its area stands out
        const k = hl === null || hl === lab ? 1 : 0.25;
        // parts view: half the colour, half its group's tint (no part = grey: that piece is left out)
        const g = gm ? (gm[p] ? GROUP_RGB[gm[p] - 1] : [90, 90, 90]) : null;
        for (let ch = 0; ch < 3; ch++) out.data[o + ch] = (g ? c[ch] * 0.35 + g[ch] * 0.65 : c[ch]) * k;
      } else {
        out.data[o] = out.data[o + 1] = out.data[o + 2] = hl === lab ? 140 : 50;
      }
    }
    // logos in their own colours (they are kept as they are), each with a box
    const logos = analysis.logos;
    if (logos && imageData && view === 'colors') {
      for (let p = 0; p < SIZE * SIZE; p++) {
        if (!logos.map[p]) continue;
        const o = p * 4;
        out.data[o] = imageData.data[o];
        out.data[o + 1] = imageData.data[o + 1];
        out.data[o + 2] = imageData.data[o + 2];
      }
    }
    ctx.putImageData(out, 0, 0);
    if (logos && view === 'colors') {
      ctx.strokeStyle = 'rgba(251,191,36,0.9)';
      ctx.lineWidth = 2;
      for (const l of logos.logos) ctx.strokeRect(l.box[0] - 3, l.box[1] - 3, l.box[2] + 6, l.box[3] + 6);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, clusters, alias, highlight, view, imageData, predicted]);

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
    // the highlight shows in the colour view
    if (view !== 'colors' && view !== 'parts') setView('colors');
    rowRefs.current.get(lab)?.scrollIntoView({ block: 'nearest' });
  };

  // opened again after an import: start a new one instead of showing the old report
  useEffect(() => {
    if (!isOpen || !report) return;
    setReport(null);
    setReportPsd(false);
    setProgress(null);
    setImageData(null);
    setAnalysis(null);
    setClusters([]);
    setColorFile(null);
    setExtras([]);
    setFiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
    setReportPsd(false);
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

  const readImage = async (file: File) => {
    const url = URL.createObjectURL(file);
    try {
      return await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('Tidak bisa membuka gambar.'));
        i.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const loadColorFile = async (file: File | undefined) => {
    if (!file) return;
    reset();
    setBusy('Membaca gambar...');
    try {
      const img = await readImage(file);
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

  const changeFit = (next: ImageFit) => {
    setFit(next);
    if (colorImg.current) setImageData(imageToData(colorImg.current, next).data);
    setExtras((prev) => prev.map((x) => ({ ...x, data: imageToData(x.img, next).data })));
  };

  const clearImage = () => {
    reset();
    setImageData(null);
    setAnalysis(null);
    setClusters([]);
    setColorFile(null);
    setExtras([]);
  };

  const runFiles = async () => {
    const picked = files.filter((f) => f.on);
    if (!picked.length) return setError('Pilih minimal satu file.');
    const items: ConvertedZone[] = [];
    const rep: { name: string; parts: string[] }[] = [];
    setError(null);
    setBusy('Mengonversi...');
    setProgress({ done: 0, total: picked.length * 2 });
    try {
      let idx = 0;
      for (const f of picked) {
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
      if (!items.length) throw new Error('Semua hasil kosong, tidak ada yang bisa disimpan.');
      setBusy('Menyimpan...');
      const tpl = await saveConvertedTemplate(templateName.trim() || 'Template PNG', `Diimpor dari ${picked.length} file PNG.`, items, (done, total) =>
        setProgress({ done: Math.ceil(total) + done, total: total * 2 })
      );
      setReport(rep);
      onImported(tpl);
    } catch (e: any) {
      setError(e?.message || 'Konversi gagal.');
    } finally {
      setBusy(null);
    }
  };

  const addExtra = async (file: File | undefined) => {
    if (!file) return;
    try {
      const img = await readImage(file);
      setExtras((prev) => [...prev, { name: file.name, img, data: imageToData(img, fit).data }].slice(0, 2));
    } catch (e: any) {
      setError(e?.message || 'Gagal membaca gambar.');
    }
  };

  const runColors = async () => {
    if (!analysis) return;
    // merged colours become part of the colour they joined
    if (!chosen.length) return setError('Pilih minimal satu warna.');
    if (!colorImg.current) return setError('Gambar belum dibaca.');
    setError(null);
    setBusy('Mengonversi...');
    setProgress({ done: 0, total: chosen.length + 1 });
    logActivity(
      'png',
      `konversi "${colorFile?.name}" toleransi ${tolerance}, noise ${denoise}, logo ${analysis.logos?.logos.length ?? 'off'}, detail ${fabricDetail}, motif ${fabricDetail && motif}, gradasi ${gradient}, pisah ${splitPieces}, versi lain ${extras.length}; ` +
        `dipakai: ${chosen.map((c) => `${c.name.trim() || c.auto} ${clusterHex(analysis.clusters[c.id].color)}`).join(', ')}; ` +
        `tidak: ${clusters.filter((c) => !c.on && c.merge === undefined).map((c) => clusterHex(analysis.clusters[c.id].color)).join(', ') || '-'}; ` +
        `digabung: ${clusters.filter((c) => c.merge !== undefined).length}`
    );
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
        detail: fabricDetail,
        motif: fabricDetail && motif,
        splitPieces,
        minArea,
        maxZones: MAX_ZONES,
        logos: analysis.logos ? { map: analysis.logos.map, list: analysis.logos.logos.map((l) => ({ bg: l.bg, group: l.group })) } : undefined,
        sharedSlots,
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
      const ok = await onAddPsd(new File([buf], `${(templateName.trim() || 'Template PNG').replace(/[\\/:*?"<>|]+/g, '_')}.psd`));
      if (!ok) throw new Error('PSD gagal disimpan ke library/templates.');
      // the report lists the layers the PSD holds, base first, each with its part groups
      const sorted = [...chosen].sort((a, b) => (a.id === baseId ? -1 : b.id === baseId ? 1 : 0));
      const logoCount = analysis.logos?.logos.length ?? 0;
      setReport([
        ...sorted.map((c) => ({ name: c.id === baseId ? 'Base' : c.name.trim() || c.auto, parts: groupsOf(c.id) })),
        ...(logoCount ? [{ name: `Logo & sponsor: ${logoCount} layer`, parts: [...new Set(analysis.logos!.logos.map((l) => l.group))] }] : []),
      ]);
      setReportPsd(true);
      logActivity('png', `PSD tersimpan: ${templateName.trim() || 'Template PNG'}`);
    } catch (e: any) {
      logActivity('error', `Import PNG: ${e?.message || e}`);
      setError(e?.message || 'Konversi gagal.');
    } finally {
      setBusy(null);
    }
  };

  const wide = tab === 'colors' && !!imageData && !report;
  const advancedCount = [gradient, splitPieces, extras.length > 0].filter(Boolean).length;
  const setAllOn = (on: boolean) => setClusters((prev) => prev.map((x) => (x.merge === undefined ? { ...x, on } : x)));
  const canRun = busy === null && !analyzing && (tab === 'colors' ? !!analysis && chosen.length > 0 : files.some((f) => f.on));

  const dropZone = (multiple: boolean) => (
    <div
      onClick={() => (multiple ? filesRef : colorRef).current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (multiple) addFiles(e.dataTransfer.files);
        else loadColorFile(e.dataTransfer.files?.[0]);
      }}
      className="cursor-pointer rounded-xl border-2 border-dashed border-slate-700 hover:border-slate-500 bg-slate-900/40 p-7 text-center"
    >
      <ImagePlus className="w-6 h-6 mx-auto mb-2 text-sky-400" />
      <div className="text-xs font-semibold text-slate-200">{multiple ? 'Klik atau seret banyak file PNG' : 'Klik atau seret satu gambar PNG'}</div>
      <div className="text-[10px] text-slate-500 mt-1 leading-snug">
        {multiple
          ? 'Satu file = satu layer, berukuran sama dengan template (persegi). Latar transparan dipakai sebagai bentuk; gambar tanpa transparansi memakai perbedaan dari warna latar.'
          : 'Peta warna (tiap bagian beda warna) atau desain jadi, sebaiknya persegi seperti template PES (2048 × 2048).'}
      </div>
      {multiple ? (
        <input ref={filesRef} type="file" multiple accept="image/png,image/webp,image/jpeg" className="hidden" onChange={(e) => addFiles(e.target.files)} />
      ) : (
        <input ref={colorRef} type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={(e) => loadColorFile(e.target.files?.[0])} />
      )}
    </div>
  );

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div
        className={`bg-[#121622] border border-slate-800 rounded-2xl w-full shadow-2xl overflow-hidden flex flex-col ${
          wide ? 'max-w-6xl h-[92vh]' : 'max-w-3xl max-h-[90vh]'
        }`}
      >
        {/* header: title, the two ways, close */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-800 bg-[#0f131c]">
          <div className="p-2 rounded-lg bg-sky-600/20 text-sky-400 border border-sky-500/30">
            <ImagePlus className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 whitespace-nowrap">
              Import template dari PNG
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40" title="Eksperimental">
                Eksp.
              </span>
              <InfoTip text="Hasil pemisahan otomatis adalah perkiraan: tepi antar warna bisa kurang halus, dan bayangan atau gradasi bisa terpecah. Untuk hasil paling bersih, siapkan peta warna datar (tiap area satu warna tanpa gradasi) atau pakai file PNG terpisah per layer." />
            </h3>
            <p className="text-[11px] text-slate-400 truncate">Hasilnya template baru, tidak menimpa apa pun</p>
          </div>
          {!report && (
            <div className="ml-auto flex items-center bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg" role="tablist" aria-label="Cara import">
              {(
                [
                  ['colors', 'Satu PNG, pisah per warna', Palette],
                  ['files', 'Banyak PNG (1 file = 1 layer)', Layers],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => {
                    setTab(id);
                    reset();
                  }}
                  className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    tab === id ? 'bg-sky-500/25 text-sky-100' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          )}
          <button onClick={onClose} className={`${report ? 'ml-auto' : ''} p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800`} aria-label="Tutup" title="Tutup">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* -------- colours, with a picture: preview left, settings and colours right -------- */}
        {wide && (
          <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-h-0 flex flex-col p-4 gap-2 border-r border-slate-800">
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="truncate" title={colorFile?.name}>
                  {colorFile?.name}
                </span>
                <span className="font-mono text-slate-500 shrink-0">
                  {colorFile?.width}×{colorFile?.height}
                </span>
                {colorFile &&
                  colorFile.width !== colorFile.height &&
                  fitSelect(fit, changeFit, 'bg-slate-900 border border-amber-500/50 rounded px-1.5 py-0.5 text-[11px] text-amber-200 outline-none')}
                <div className="ml-auto flex items-center bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg shrink-0" role="group" aria-label="Pratinjau">
                  {(
                    [
                      ['result', 'Hasil'],
                      ['original', 'Asli'],
                      ['diff', 'Beda'],
                      ['colors', 'Warna'],
                      ['parts', 'Bagian'],
                    ] as const
                  ).map(([id, text]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={view === id}
                      onClick={() => setView(id)}
                      className={`h-6 px-2.5 rounded-md text-[11px] font-semibold transition-colors ${view === id ? 'bg-sky-500/25 text-sky-100' : 'text-slate-400 hover:text-white'}`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <button onClick={clearImage} className={`${smallBtn} shrink-0`}>
                  Ganti gambar
                </button>
              </div>
              <div className="relative flex-1 min-h-0 flex items-center justify-center [container-type:size]">
                <canvas
                  ref={previewRef}
                  onClick={pickFromPreview}
                  className="w-[min(100cqw,100cqh)] h-[min(100cqw,100cqh)] rounded-lg border border-slate-800 bg-black cursor-crosshair"
                  title="Klik sebuah area untuk menyorot warnanya di daftar"
                />
                {analyzing && (
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[11px] text-slate-200 bg-black/70 rounded-md px-2 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    Menganalisis warna…
                  </div>
                )}
              </div>
              <div className="min-h-5 flex items-center gap-3 text-[10px] text-slate-500">
                {view === 'parts' ? (
                  <>
                    {LAYER_GROUPS.map(([g], i) => (
                      <span key={g} className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: `rgb(${GROUP_RGB[i].join(',')})` }} />
                        {g}
                      </span>
                    ))}
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#5a5a5a]" />
                      Di luar bagian (tidak dipakai)
                    </span>
                  </>
                ) : view === 'result' ? (
                  <span>Perkiraan hasil: warna yang dipilih, logo, dan detail kain</span>
                ) : view === 'diff' ? (
                  <span>Merah = area yang hasilnya berbeda dari gambar asli</span>
                ) : view === 'original' ? (
                  <span>Gambar asli</span>
                ) : (
                  <span>Klik sebuah area untuk menyorot warnanya di daftar</span>
                )}
              </div>
            </div>

            <div className="min-h-0 flex flex-col">
              {/* summary: how close the result stays, and what it is made of */}
              <div className="px-4 pt-4 pb-3 space-y-2 border-b border-slate-800">
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-bold tabular-nums ${
                      !predicted ? 'text-slate-500' : predicted.likeness >= 0.95 ? 'text-emerald-300' : predicted.likeness >= 0.85 ? 'text-amber-300' : 'text-rose-300'
                    }`}
                  >
                    {predicted ? `${Math.floor(predicted.likeness * 100)}%` : '–'}
                  </span>
                  <span className="text-[11px] text-slate-400">mirip gambar asli</span>
                  <InfoTip text="Perkiraan: bagian kit yang warnanya tetap dekat dengan gambar asli setelah dipisah. Lihat Beda untuk area yang berubah; biasanya karena warna yang tidak dicentang atau gradasi." />
                  {predicted && predicted.likeness < 0.95 && (
                    <button type="button" onClick={() => setView('diff')} className={`ml-auto ${smallBtn}`}>
                      Lihat beda
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-slate-300">{`${chosen.length} warna · ${analysis?.logos?.logos.length ?? 0} logo`}</div>
                <div className="flex flex-wrap gap-1">
                  {chosen.map((c) => {
                    const cl = analysis?.clusters.find((x) => x.id === c.id);
                    if (!cl) return null;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setHighlight((h) => (h === c.id ? null : c.id));
                          setView('colors');
                          rowRefs.current.get(c.id)?.scrollIntoView({ block: 'nearest' });
                        }}
                        title={`${c.name.trim() || c.auto}${c.id === baseId ? ' (Base)' : ''}`}
                        className={`w-6 h-6 rounded-md border ${highlight === c.id ? 'border-sky-400 ring-1 ring-sky-400' : 'border-slate-600'}`}
                        style={{ background: clusterHex(cl.color) }}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => setSettingsOpen((o) => !o)}
                  aria-expanded={settingsOpen}
                  className="w-full flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold text-slate-300 hover:text-white"
                >
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${settingsOpen ? 'rotate-90' : ''}`} aria-hidden />
                  Pengaturan
                  {!settingsOpen && <span className="ml-auto font-normal text-[10px] text-slate-500">{`toleransi ${tolerance}`}</span>}
                </button>
              {settingsOpen && (
              <div className="px-4 pb-3 space-y-2.5">
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
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                  <label className={`${check} col-span-2`}>
                    <input type="checkbox" checked={separateLogos} onChange={(e) => setSeparateLogos(e.target.checked)} className="mt-0.5 accent-sky-500" />
                    <span className="flex items-center gap-1">
                      Pisahkan logo & sponsor
                      <InfoTip text="Logo, sponsor, dan lambang klub jadi layer sendiri dengan warna aslinya (kotak kuning di pratinjau), jadi bisa disembunyikan atau diganti. Di bawahnya diisi warna dasar. Garis, strip, dan panel tetap jadi warna." />
                    </span>
                    {analysis?.logos && <span className="ml-auto text-[10px] text-amber-300 tabular-nums">{`${analysis.logos.logos.length} ditemukan`}</span>}
                  </label>
                  <label className={`${check} col-span-2`}>
                    <input type="checkbox" checked={sharedSlots} onChange={(e) => setSharedSlots(e.target.checked)} className="mt-0.5 accent-sky-500" />
                    <span className="flex items-center gap-1">
                      Satu slot per warna untuk semua bagian
                      <InfoTip text="Biru di baju, celana, dan kaus kaki jadi satu slot warna: ganti sekali, semua ikut. Matikan untuk slot terpisah per bagian (baju, celana, kaus kaki)." />
                    </span>
                  </label>
                  <label className={check}>
                    <input type="checkbox" checked={denoise} onChange={(e) => setDenoise(e.target.checked)} className="mt-0.5 accent-sky-500" />
                    <span className="flex items-center gap-1">
                      Bersihkan noise
                      <InfoTip text="Untuk WebP / JPG dari situs: bintik dan kotak kompresi dihaluskan dulu, tepi tetap tajam." />
                    </span>
                  </label>
                  <label className={check}>
                    <input type="checkbox" checked={fabricDetail} onChange={(e) => setFabricDetail(e.target.checked)} className="mt-0.5 accent-sky-500" />
                    <span className="flex items-center gap-1">
                      Simpan detail kain
                      <InfoTip text="Garis mesh, lipatan, dan bayangan dari gambar jadi dua layer di atas warna (gelap: multiply, terang: screen), jadi tetap ada saat warnanya diganti. Matikan untuk template yang warnanya rata." />
                    </span>
                  </label>
                  <label className={`${check} col-start-2 pl-5 ${fabricDetail ? '' : 'opacity-40 pointer-events-none'}`}>
                    <input type="checkbox" checked={motif} disabled={!fabricDetail} onChange={(e) => setMotif(e.target.checked)} className="mt-0.5 accent-sky-500" />
                    <span className="flex items-center gap-1">
                      Motif bisa diganti warnanya
                      <InfoTip text="Untuk motif samar yang hanya sedikit lebih gelap atau terang dari warna dasar (loreng, pola timbul): detailnya jadi layer Motif gelap / Motif terang per bagian, masing-masing dengan slot warna sendiri. Bayangan dan mesh ikut di layer itu, jadi matikan untuk kit polos." />
                    </span>
                  </label>
                </div>

                <div className="rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((o) => !o)}
                    aria-expanded={advancedOpen}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white"
                  >
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? 'rotate-90' : ''}`} aria-hidden />
                    Lanjutan
                    {advancedCount > 0 && <span className="ml-auto text-[10px] font-normal text-sky-300">{advancedCount} aktif</span>}
                  </button>
                  {advancedOpen && (
                    <div className="px-2.5 pb-2.5 space-y-2">
                      <label className={check}>
                        <input
                          type="checkbox"
                          checked={gradient}
                          onChange={(e) => {
                            setGradient(e.target.checked);
                            // a gradient needs only its end colours: untick the ones that are a blend of two others
                            if (e.target.checked && analysis) {
                              const blends = blendColours(chosen.map((c) => c.id), analysis.vectors);
                              // the main colour of the shirt, shorts or socks stays, even between two others (light grey)
                              groupMainColours(analysis.labels).forEach((c) => blends.delete(c));
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
                      <label className={check}>
                        <input type="checkbox" checked={splitPieces} onChange={(e) => setSplitPieces(e.target.checked)} className="mt-0.5 accent-sky-500" />
                        <span className="flex items-center gap-1">
                          Pisah tiap bagian yang tidak tersambung
                          <InfoTip text="Misalnya garis kiri dan kanan jadi dua layer." />
                        </span>
                      </label>
                      {splitPieces && (
                        <label className="block space-y-0.5 pl-5">
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>Luas minimal</span>
                            <span className="font-mono">{minArea}px</span>
                          </div>
                          <input type="range" min={20} max={3000} step={20} value={minArea} onChange={(e) => setMinArea(Number(e.target.value))} className="w-full accent-sky-500" />
                        </label>
                      )}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-[11px] text-slate-300">
                          Versi warna lain <span className="text-slate-500">(opsional, maks. 2)</span>
                          <InfoTip text="Template yang sama dalam warna lain. Bagian yang berubah warna bersama menjadi satu layer, jadi area yang kebetulan sewarna tetap terpisah." />
                        </div>
                        {extras.map((x, i) => (
                          <div key={`${x.name}-${i}`} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                            <span className="truncate flex-1">{x.name}</span>
                            <button type="button" onClick={() => setExtras((prev) => prev.filter((_, k) => k !== i))} className={smallBtn}>
                              Hapus
                            </button>
                          </div>
                        ))}
                        {extras.length < 2 && (
                          <button type="button" onClick={() => extraRef.current?.click()} className={smallBtn}>
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
                  )}
                </div>
              </div>
              )}
              </div>

              {/* colour list */}
              <div className="flex items-center gap-2 px-4 pt-3 pb-1.5 text-[11px]">
                <span className="font-semibold text-slate-200">Warna</span>
                {analysis && (
                  <span className="text-slate-500">
                    {chosen.length} / {clusters.filter((c) => c.merge === undefined).length}
                  </span>
                )}
                <InfoTip text="Tiap warna yang dicentang menjadi layer, dipotong per bagian (Baju, Celana, Kaos kaki, Detail). Warna terbesar menjadi Base tiap bagian. Gabungkan bayangan yang terpisah ke warnanya." />
                <div className="ml-auto flex gap-1">
                  <button type="button" onClick={() => setAllOn(true)} disabled={!analysis} className={smallBtn}>
                    Semua
                  </button>
                  <button type="button" onClick={() => setAllOn(false)} disabled={!analysis} className={smallBtn}>
                    Kosongkan
                  </button>
                </div>
              </div>
              <div className={`flex-1 min-h-0 overflow-y-auto mx-4 mb-4 rounded-lg border border-slate-800 divide-y divide-slate-800/70 ${analyzing ? 'opacity-60' : ''}`}>
                {analysis?.clusters.map((c) => {
                  const item = clusters.find((x) => x.id === c.id);
                  if (!item) return null;
                  const merged = item.merge !== undefined;
                  // a colour others joined cannot itself be merged, and only into a colour that is not merged
                  const isTarget = clusters.some((x) => x.merge === c.id);
                  const targets = clusters.filter((x) => x.id !== c.id && x.merge === undefined);
                  const g = groupsOf(c.id);
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
                      className={`px-2.5 py-1.5 text-xs cursor-pointer space-y-1 ${highlight === c.id ? 'bg-sky-900/40' : ''} ${merged ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.on}
                          disabled={merged}
                          onChange={(e) => setClusters((prev) => prev.map((x) => (x.id === c.id ? { ...x, on: e.target.checked } : x)))}
                          className="accent-sky-500"
                          aria-label={item.name || item.auto}
                        />
                        <span className="w-5 h-5 rounded border border-slate-600 shrink-0" style={{ background: clusterHex(c.color) }} title={clusterHex(c.color)} />
                        <input
                          value={item.name}
                          placeholder={item.auto}
                          aria-label={item.auto}
                          onChange={(e) => setClusters((prev) => prev.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
                          className="flex-1 min-w-0 bg-transparent border-b border-transparent focus:border-sky-500 text-slate-200 placeholder:text-slate-200 outline-none"
                        />
                        {item.on && !merged && c.id === baseId && (
                          <span className="text-[9px] font-bold uppercase px-1 rounded bg-sky-500/20 text-sky-200" title="Warna terbesar: dasar tiap bagian">
                            Base
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-500 w-10 text-right shrink-0">{((c.count / opaqueTotal) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-2 pl-[3.25rem]">
                        <span className="flex-1 min-w-0 truncate text-[10px] text-slate-500">
                          {merged ? '' : g.length ? joined(g, ' · ') : 'Di luar bagian (tidak dipakai)'}
                        </span>
                        <select
                          value={item.merge ?? ''}
                          disabled={isTarget}
                          onChange={(e) => {
                            const v = e.target.value === '' ? undefined : Number(e.target.value);
                            setClusters((prev) => prev.map((x) => (x.id === c.id ? { ...x, merge: v } : x)));
                          }}
                          title={isTarget ? 'Warna lain sudah digabung ke warna ini' : 'Gabungkan warna ini ke warna lain (misalnya bayangan yang terpisah)'}
                          aria-label={`Gabungkan ${item.name || item.auto} ke warna lain`}
                          className="w-28 shrink-0 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-slate-300 outline-none focus:border-sky-500 disabled:opacity-40"
                        >
                          <option value="">Tidak digabung</option>
                          {targets.map((x) => (
                            <option key={x.id} value={x.id}>
                              → {x.name || x.auto}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* -------- narrow: no picture yet, the files way, or the report -------- */}
        {!wide && (
          <div className="p-4 space-y-3 overflow-y-auto">
            {!report && tab === 'colors' && dropZone(false)}

            {!report && tab === 'files' && (
              <>
                {dropZone(true)}
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
                      {fitSelect(fit, setFit, 'bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-white outline-none')}
                      <button onClick={() => setFiles([])} className={`ml-auto ${smallBtn}`}>
                        Kosongkan
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/70">
                      {files.map((f) => (
                        <div key={f.key} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={f.on}
                            onChange={(e) => setFiles((prev) => prev.map((x) => (x.key === f.key ? { ...x, on: e.target.checked } : x)))}
                            className="accent-sky-500"
                          />
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

            {report && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
                  <Check className="w-4 h-4" />
                  {reportPsd ? (
                    <span>PSD tersimpan di library/templates. Template-nya sedang dibaca dan langsung dipilih setelah selesai.</span>
                  ) : (
                    <span>
                      Template tersimpan dan sudah dipilih ({report.filter((r) => r.parts.length).length} layer).
                    </span>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/70 text-[11px]">
                  {report.map((r, i) => (
                    <div key={`${r.name}-${i}`} className="px-2.5 py-1.5 flex gap-2">
                      <span className="flex-1 truncate text-slate-300" title={r.name}>
                        {r.name}
                      </span>
                      <span className="text-slate-500 truncate max-w-[55%]">{r.parts.length ? joined(r.parts, ', ') : '-'}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 leading-snug">
                  Bagian ditentukan otomatis dari posisi. Kalau ada yang meleset, buka layernya di tab Template dan ubah
                  &quot;Menempel di bagian&quot;.
                </p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mx-4 mb-3 flex gap-2 p-2.5 rounded-lg text-[11px] leading-relaxed border bg-rose-950/40 border-rose-900/60 text-rose-200">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* footer: template name or progress, then the buttons */}
        <div className="flex items-center gap-3 px-5 py-3 border-t border-slate-800 bg-[#0f131c]">
          {busy ? (
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                {busy}
                {progress && <span className="font-mono text-slate-500">{`${Math.min(progress.done, progress.total)} / ${progress.total}`}</span>}
              </div>
              {progress && (
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 transition-all" style={{ width: `${(Math.min(progress.done, progress.total) / progress.total) * 100}%` }} />
                </div>
              )}
            </div>
          ) : !report ? (
            <label className="flex-1 min-w-0 flex items-center gap-2">
              <span className="text-[11px] text-slate-400 whitespace-nowrap">Nama template</span>
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template PNG"
                className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500"
              />
            </label>
          ) : (
            <div className="flex-1" />
          )}
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800">
            {report ? 'Tutup' : 'Batal'}
          </button>
          {!report && (
            <button
              onClick={tab === 'colors' ? runColors : runFiles}
              disabled={!canRun}
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
