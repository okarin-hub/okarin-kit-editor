'use client';

import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  LayoutGrid,
  RefreshCw,
  Crosshair,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Copy,
  Trash2,
  Save,
  Plus,
  Lock,
  Settings2,
  Pencil,
  PenLine,
  Spline,
  Layers,
  FileUp,
  ImagePlus,
} from 'lucide-react';
import {
  BaseTexture,
  KitCategory,
  KitPartConfig,
  KitPartId,
  KitTemplate,
  PatternLayer,
  KitZoneDef,
  SeamConfig,
  TemplateState,
  TemplateZoneState,
  ZoneEdge,
} from '@/types/kit';
import { AssetLibrary } from '@/hooks/useAssetLibrary';
import { PatternLayersPanel } from '@/components/ui/PatternLayersPanel';
import { PanelSection } from '@/components/ui/PanelSection';
import { AccentRow } from '@/components/ui/AccentLayersPanel';
import { BUILTIN_TEMPLATES } from '@/constants/templates';
import { PES_2021_PARTS, DEFAULT_BACKGROUND_COLOR } from '@/constants/pes2021Parts';
import { zoneParts } from '@/utils/zoneGeometry';

export type NewZoneKind = 'strip' | 'panel' | 'ellipse' | 'triangle';

interface TemplatePanelProps {
  template: KitTemplate;
  state: TemplateState;
  library: AssetLibrary;
  partsConfig: Record<KitPartId, KitPartConfig>;
  onUpdatePartConfig: (partId: KitPartId, update: Partial<KitPartConfig>) => void;
  onTogglePartVisibility: (partId: KitPartId) => void;
  onSetBaseColor: (partIds: KitPartId[], color: string) => void;
  /** Selects a part and opens its colour / pattern settings. */
  onEditPart: (partId: KitPartId) => void;
  activePartId: KitPartId | 'all';
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string | null) => void;
  onSelectTemplate: (template: KitTemplate) => void;
  onUpdateZone: (zoneId: string, update: Partial<TemplateZoneState>) => void;
  onResetZone: (zoneId: string) => void;
  onUpdateZoneDef: (zoneId: string, patch: Partial<KitZoneDef>) => void;
  onAddZone: (kind: NewZoneKind, part: KitPartId) => void;
  onDuplicateZone: (zoneId: string) => void;
  onDeleteZone: (zoneId: string) => void;
  onSaveTemplate: (name: string) => Promise<{ ok: boolean; message: string }>;
  onStartDraw: (kind: 'free' | 'poly' | 'stitch' | 'stitchFree') => void;
  onChangePatterns: (layers: PatternLayer[]) => void;
  /** Imported design (used as the base layer when its mode is replace and it is enabled). */
  baseTexture: BaseTexture | null;
  onChooseBase: (source: 'colour' | 'import') => void;
  onEditBase: () => void;
  onChangeBackground: (color: string | undefined) => void;
  onChangeSleeveShape: (shape: 'yoke' | 'short') => void;
  onDeleteSeam: (key: string) => void;
  onToggleSeamCurve: (key: string) => void;
  onOpenPsdImport: () => void;
  onOpenPngImport: () => void;
  editPoints: boolean;
  onToggleEditPoints: (zoneId: string) => void;
  onUpdateSeams: (update: Partial<SeamConfig>) => void;
  onResetZones: () => void;
  onFocusPart: (partId: KitPartId) => void;
}

const GROUP_LABEL: Record<KitCategory, string> = {
  shirt: 'Baju',
  shorts: 'Celana',
  socks: 'Kaus Kaki',
  details: 'Aksesoris',
};

const BASE_ROWS: Record<KitCategory, { id: string; label: string; parts: KitPartId[] }[]> = {
  shirt: [{ id: 'base-shirt', label: 'Base baju', parts: ['front', 'back', 'leftSleeve', 'rightSleeve'] }],
  shorts: [{ id: 'base-shorts', label: 'Base celana', parts: ['leftShorts', 'rightShorts'] }],
  socks: [{ id: 'base-socks', label: 'Base kaus kaki', parts: ['leftSock', 'rightSock'] }],
  details: [],
};
const DETAIL_PARTS: KitPartId[] = ['collar', 'armband', 'credit'];

const SEAM_STYLES: { id: SeamConfig['style']; label: string; hint: string }[] = [
  { id: 'natural', label: 'Alami', hint: 'Bayangan lembut, garis jahit halus, dan top-stitch tipis' },
  { id: 'soft', label: 'Halus', hint: 'Hanya bayangan dan garis sambungan' },
  { id: 'stitch', label: 'Terlihat', hint: 'Jahitan putus-putus berkontras' },
  { id: 'double', label: 'Ganda', hint: 'Dua baris jahitan berkontras' },
];

const EDGES: { id: ZoneEdge; label: string; hint: string }[] = [
  { id: 'sharp', label: 'Lurus', hint: 'Ujung dan sudut lurus' },
  { id: 'rounded', label: 'Tumpul', hint: 'Sudut membulat' },
  { id: 'pointed', label: 'Runcing', hint: 'Ujung meruncing seperti anak panah' },
  { id: 'slant', label: 'Miring', hint: 'Ujung dipotong miring' },
];

const NEW_ZONES: { id: NewZoneKind; label: string }[] = [
  { id: 'strip', label: 'Strip' },
  { id: 'panel', label: 'Panel' },
  { id: 'ellipse', label: 'Elips' },
  { id: 'triangle', label: 'Segitiga' },
];

/** Labelled slider with its value shown on the right. */
const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step = 1, unit = '', onChange }) => (
  <label className="block space-y-0.5">
    <div className="flex items-center justify-between text-[11px] text-slate-400">
      <span>{label}</span>
      <span className="font-mono">
        {Math.round(value * 100) / 100}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-sky-500 cursor-pointer"
    />
  </label>
);

export const TemplatePanel: React.FC<TemplatePanelProps> = ({
  template,
  state,
  library,
  partsConfig,
  onUpdatePartConfig,
  onTogglePartVisibility,
  onSetBaseColor,
  onEditPart,
  activePartId,
  selectedZoneId,
  onSelectZone,
  onSelectTemplate,
  onUpdateZone,
  onResetZone,
  onUpdateZoneDef,
  onAddZone,
  onDuplicateZone,
  onDeleteZone,
  onSaveTemplate,
  onStartDraw,
  onChangePatterns,
  baseTexture,
  onChooseBase,
  onEditBase,
  onChangeBackground,
  onChangeSleeveShape,
  onDeleteSeam,
  onToggleSeamCurve,
  onOpenPsdImport,
  onOpenPngImport,
  editPoints,
  onToggleEditPoints,
  onUpdateSeams,
  onResetZones,
  onFocusPart,
}) => {
  const [newPart, setNewPart] = useState<KitPartId | ''>('');
  const [saveName, setSaveName] = useState('');
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lockRatio, setLockRatio] = useState(false);

  const all: KitTemplate[] = [...BUILTIN_TEMPLATES, ...library.templates];
  const groups = (['shirt', 'shorts', 'socks', 'details'] as KitCategory[]).map((g) => ({
    g,
    zones: template.zones.filter((z) => z.group === g),
  }));
  const [openBase, setOpenBase] = useState<Set<string>>(new Set());
  const toggleBase = (id: string) =>
    setOpenBase((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const seams = state.seams;
  const targetPart: KitPartId = newPart || (activePartId !== 'all' ? activePartId : 'front');

  // Keep the PES part order; the first selected part becomes the main part of the zone
  const setZoneParts = (z: KitZoneDef, parts: KitPartId[]) => {
    const ordered = PES_2021_PARTS.map((p) => p.id).filter((id) => parts.includes(id));
    onUpdateZoneDef(z.id, { part: ordered[0], parts: ordered.slice(1) });
  };

  // with an imported design as the base, part colours can be stacked on top of it (each with its own opacity)
  const designBase = !!baseTexture && baseTexture.enabled !== false && baseTexture.mode === 'replace';

  const renderPartRow = (id: KitPartId, withCredit = false) => {
    const def = PES_2021_PARTS.find((p) => p.id === id);
    const cfg = partsConfig[id];
    if (!def || !cfg) return null;
    const active = activePartId === id;
    return (
      <div key={id}>
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs transition-colors ${
            active
              ? 'bg-sky-950/40 border-sky-700'
              : cfg.visible
              ? 'bg-slate-900/60 border-slate-800'
              : 'bg-slate-900/20 border-slate-800/60 text-slate-500'
          }`}
        >
          <button
            type="button"
            onClick={() => onTogglePartVisibility(id)}
            className="text-slate-400 hover:text-white"
            title={cfg.visible ? 'Sembunyikan bagian' : 'Tampilkan bagian'}
          >
            {cfg.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <input
            type="color"
            value={cfg.color}
            onChange={(e) => onUpdatePartConfig(id, { color: e.target.value, visible: true })}
            className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5 shrink-0"
            title="Warna bagian"
          />
          <button
            type="button"
            onClick={() => onEditPart(id)}
            className="flex-1 min-w-0 text-left truncate hover:text-white"
            title="Buka pengaturan warna dan pola bagian ini"
          >
            {def.name}
          </button>
          <button type="button" onClick={() => onFocusPart(id)} className="text-slate-500 hover:text-sky-300" title="Fokus ke bagian ini di canvas">
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => onEditPart(id)} className="text-slate-500 hover:text-white" title="Pola dan pengaturan lain">
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <AccentRow partId={id} config={cfg} onUpdatePartConfig={onUpdatePartConfig} />
        {designBase && cfg.overDesign && (
          <div className="mt-1 ml-3 border-l border-slate-800 pl-2 space-y-0.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Opasitas di atas desain</span>
              <span className="font-mono">{Math.round((cfg.overDesignOpacity ?? 1) * 100)}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={Math.round((cfg.overDesignOpacity ?? 1) * 100)}
              onChange={(e) => onUpdatePartConfig(id, { overDesignOpacity: Number(e.target.value) / 100 })}
              className="w-full accent-sky-500 cursor-pointer"
            />
          </div>
        )}
        {withCredit && id === 'credit' && (
          <div className="mt-1 ml-3 flex items-center gap-2 border-l border-slate-800 pl-2">
            <input
              value={cfg.label ?? ''}
              onChange={(e) => onUpdatePartConfig('credit', { label: e.target.value })}
              placeholder="Nama pembuat / kredit"
              className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500"
            />
            <input
              type="color"
              value={cfg.labelColor ?? '#ffffff'}
              onChange={(e) => onUpdatePartConfig('credit', { labelColor: e.target.value })}
              className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5 shrink-0"
              title="Warna teks"
            />
          </div>
        )}
      </div>
    );
  };

  const renderEditor = (z: KitZoneDef) => {
    const zs: TemplateZoneState = state.zones[z.id] ?? { color: z.defaultColor, visible: z.defaultVisible };
    const sx = zs.sx ?? 1;
    const sy = zs.sy ?? 1;
    const edge = zs.edge ?? 'sharp';
    const isMask = !!z.mask && !z.rects?.length && !z.polygons?.length && !z.ellipses?.length;

    return (
      <div className="mt-1 mb-2 p-3 rounded-lg bg-slate-950/60 border border-sky-900/60 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 block">
            <span className="text-[10px] text-slate-500">Nama layer</span>
            <input
              value={z.name}
              onChange={(e) => onUpdateZoneDef(z.id, { name: e.target.value })}
              className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500"
            />
          </label>
          <div className="col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Menempel di bagian (boleh lebih dari satu)</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoneParts(z, ['front', 'back', 'leftSleeve', 'rightSleeve'])}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                  title="Baju depan, belakang, dan kedua lengan"
                >
                  Semua baju
                </button>
                <button
                  type="button"
                  onClick={() => setZoneParts(z, PES_2021_PARTS.map((p) => p.id))}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Semua
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1 max-h-40 overflow-y-auto pr-1">
              {PES_2021_PARTS.map((p) => {
                const on = zoneParts(z).includes(p.id);
                return (
                  <label key={p.id} className={`flex items-center gap-1.5 text-[11px] cursor-pointer ${on ? 'text-sky-200' : 'text-slate-400'}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => {
                        const current = zoneParts(z);
                        const next = e.target.checked ? [...current, p.id] : current.filter((x) => x !== p.id);
                        if (next.length > 0) setZoneParts(z, next);
                      }}
                      className="accent-sky-500"
                    />
                    <span className="truncate">{p.name}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
              Bentuk yang sama digambar di semua bagian terpilih (dipotong mengikuti tiap bagian). Geser atau lebarkan
              layer agar menyilang ke bagian lain, misalnya strip melintasi depan, belakang, dan lengan.
            </p>
          </div>
        </div>

        <Slider label="Transparansi" value={Math.round((zs.opacity ?? 1) * 100)} min={10} max={100} step={5} unit="%" onChange={(v) => onUpdateZone(z.id, { opacity: v / 100 })} />

        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Posisi</div>
          <Slider label="Geser kiri / kanan (X)" value={zs.dx ?? 0} min={-400} max={400} unit="px" onChange={(v) => onUpdateZone(z.id, { dx: v })} />
          <Slider label="Geser atas / bawah (Y)" value={zs.dy ?? 0} min={-400} max={400} unit="px" onChange={(v) => onUpdateZone(z.id, { dy: v })} />
          <Slider label="Putar" value={zs.rot ?? 0} min={-180} max={180} unit="°" onChange={(v) => onUpdateZone(z.id, { rot: v })} />
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ukuran</div>
            <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
              <input type="checkbox" checked={lockRatio} onChange={(e) => setLockRatio(e.target.checked)} className="accent-sky-500" />
              Kunci proporsi
            </label>
          </div>
          <Slider
            label="Lebar"
            value={Math.round(sx * 100)}
            min={10}
            max={400}
            unit="%"
            onChange={(v) => onUpdateZone(z.id, lockRatio ? { sx: v / 100, sy: v / 100 } : { sx: v / 100 })}
          />
          <Slider
            label="Tinggi"
            value={Math.round(sy * 100)}
            min={10}
            max={400}
            unit="%"
            onChange={(v) => onUpdateZone(z.id, lockRatio ? { sx: v / 100, sy: v / 100 } : { sy: v / 100 })}
          />
        </div>

        {isMask && (
          <label className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer pt-2 border-t border-slate-800">
            <input
              type="checkbox"
              checked={z.keepColor === true}
              onChange={(e) => onUpdateZoneDef(z.id, { keepColor: e.target.checked || undefined })}
              className="mt-0.5 accent-sky-500"
            />
            <span>
              Pakai warna asli gambar
              <span className="block text-[10px] text-slate-500">
                Matikan agar layer diwarnai dengan warna zona (cocok untuk layer satu warna).
              </span>
            </span>
          </label>
        )}

        {!isMask && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Titik &amp; lengkung</div>
            <button
              type="button"
              onClick={() => onToggleEditPoints(z.id)}
              className={`w-full flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-md border transition-colors ${
                editPoints
                  ? 'bg-sky-600/25 border-sky-500 text-sky-100'
                  : 'bg-slate-800/70 border-slate-700/60 text-slate-200 hover:bg-slate-700'
              }`}
              title="Ubah bentuk dengan menyeret titik di canvas 2D"
            >
              <Spline className="w-3.5 h-3.5" />
              {editPoints ? 'Selesai edit titik' : 'Edit titik bentuk'}
            </button>
            {editPoints && (
              <p className="text-[10px] text-slate-500 leading-snug">
                Seret titik biru untuk mengubah bentuk. Klik lingkaran kecil di tengah sisi untuk menambah titik. Klik
                kanan pada titik untuk menghapusnya.
              </p>
            )}
            {(z.polygons?.length ?? 0) > 0 && (
              <Slider
                label="Halus (lengkung)"
                value={Math.round((zs.smooth ?? 0) * 100)}
                min={0}
                max={100}
                step={5}
                unit="%"
                onChange={(v) => onUpdateZone(z.id, { smooth: v / 100 })}
              />
            )}
          </div>
        )}

        {!isMask && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bentuk sisi</div>
            <div className="grid grid-cols-4 gap-1">
              {EDGES.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  title={e.hint}
                  onClick={() => onUpdateZone(z.id, { edge: e.id })}
                  className={`text-[11px] py-1 rounded-md border transition-colors ${
                    edge === e.id
                      ? 'bg-sky-600/25 border-sky-500 text-sky-100'
                      : 'bg-slate-800/70 border-slate-700/60 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
            {edge !== 'sharp' && (
              <Slider label="Tingkat" value={Math.round((zs.edgeAmount ?? 0.5) * 100)} min={0} max={100} unit="%" onChange={(v) => onUpdateZone(z.id, { edgeAmount: v / 100 })} />
            )}
          </div>
        )}

        <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer pt-2 border-t border-slate-800">
          <input
            type="checkbox"
            checked={zs.seam !== false}
            onChange={(e) => onUpdateZone(z.id, { seam: e.target.checked })}
            className="accent-sky-500"
          />
          Garis jahitan di sisi layer ini
        </label>

        <div className="flex items-center gap-1.5 pt-1">
          <button type="button" onClick={() => onResetZone(z.id)} className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800" title="Kembalikan posisi, ukuran, dan bentuk ke awal">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
          <button type="button" onClick={() => onDuplicateZone(z.id)} className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800" title="Gandakan layer ini">
            <Copy className="w-3 h-3" /> Duplikat
          </button>
          <button type="button" onClick={() => onDeleteZone(z.id)} className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-md border border-rose-900/70 text-rose-300 hover:bg-rose-950/50" title="Hapus layer">
            <Trash2 className="w-3 h-3" /> Hapus
          </button>
        </div>
        <p className="text-[10px] text-slate-500 leading-snug">
          Layer yang dipilih juga muncul di canvas 2D dengan kotak biru: seret untuk menggeser, tarik sudut untuk
          mengubah ukuran, dan tarik pegangan atas untuk memutar.
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full select-none overflow-y-auto text-slate-300 p-3 space-y-2.5">
      {/* Template selector */}
      <PanelSection
        id="template"
        title="Template"
        icon={<LayoutGrid className="w-3.5 h-3.5 text-sky-400" />}
        badge={template.name}
        defaultOpen={false}
        action={
          <button
            type="button"
            onClick={() => library.reload()}
            className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center gap-1"
            title="Baca ulang folder library/templates"
          >
            <RefreshCw className={`w-3 h-3 ${library.loading ? 'animate-spin' : ''}`} />
            Muat ulang
          </button>
        }
      >

        <select
          value={template.id}
          onChange={(e) => {
            const next = all.find((t) => t.id === e.target.value);
            if (next) onSelectTemplate(next);
          }}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-sky-500"
        >
          <optgroup label="Bawaan">
            {BUILTIN_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </optgroup>
          {library.templates.length > 0 && (
            <optgroup label="Template saya (library/templates)">
              {library.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )}
          {!all.some((t) => t.id === template.id) && <option value={template.id}>{template.name} (dari proyek)</option>}
        </select>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onOpenPsdImport}
            className="flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-lg border border-sky-700/70 bg-sky-900/30 text-sky-100 hover:bg-sky-800/40"
            title="EKSPERIMENTAL: ubah file PSD menjadi template (setiap layer jadi zona). Hasil bisa kurang tepat."
          >
            <FileUp className="w-3.5 h-3.5" />
            Import PSD
            <span className="text-[8px] font-bold uppercase px-1 py-px rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">Eksp.</span>
          </button>
          <button
            type="button"
            onClick={onOpenPngImport}
            className="flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-lg border border-sky-700/70 bg-sky-900/30 text-sky-100 hover:bg-sky-800/40"
            title="EKSPERIMENTAL: ubah PNG menjadi template (dipisah per warna, atau 1 file = 1 layer). Hasil bisa kurang tepat."
          >
            <ImagePlus className="w-3.5 h-3.5" />
            Import PNG
            <span className="text-[8px] font-bold uppercase px-1 py-px rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">Eksp.</span>
          </button>
        </div>

        {template.modified && (
          <p className="text-[10px] text-amber-300/90">Template ini sudah kamu ubah. Memilih ulang template akan mengembalikannya ke awal.</p>
        )}
        {template.description && <p className="text-[11px] text-slate-500 leading-snug">{template.description}</p>}

        {library.templateErrors.length > 0 && (
          <div className="text-[10px] text-amber-300 bg-amber-950/30 border border-amber-900/50 rounded p-2 space-y-0.5">
            {library.templateErrors.map((e) => (
              <div key={e.file}>
                <strong>{e.file}</strong>: {e.error}
              </div>
            ))}
          </div>
        )}
      </PanelSection>

      {/* Base: base layer choice, sleeve shape and background colour */}
      <PanelSection id="base" title="Dasar kit" icon={<Layers className="w-3.5 h-3.5 text-sky-400" />}>
      {/* Base layer: part colours or an imported design */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Layer dasar</div>
        {(() => {
          const useImport = !!baseTexture && baseTexture.enabled !== false && baseTexture.mode === 'replace';
          return (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ['colour', 'Warna'],
                    ['import', 'Desain impor'],
                  ] as const
                ).map(([id, label]) => {
                  const active = (id === 'import') === useImport;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onChooseBase(id)}
                      className={`text-[11px] font-medium py-1.5 rounded-lg border transition-colors ${
                        active
                          ? 'bg-sky-600/30 border-sky-500 text-sky-100'
                          : 'bg-slate-800/70 border-slate-700/60 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {baseTexture && (
                <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-800 rounded-lg px-2 py-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={baseTexture.src} alt="" className="w-8 h-8 rounded object-cover border border-slate-700 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-slate-200 truncate">{baseTexture.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {baseTexture.mode === 'overlay'
                        ? 'Overlay di atas bagian kit'
                        : useImport
                        ? 'Dipakai sebagai dasar kit'
                        : 'Tidak dipakai (dasar memakai warna)'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onEditBase}
                    className="text-[10px] px-2 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 shrink-0"
                  >
                    Ganti
                  </button>
                </div>
              )}
              <p className="text-[10px] text-slate-500 leading-snug">
                {useImport
                  ? 'Gambar yang kamu import menjadi dasar kit. Pola, lis, dan logo tetap bisa ditambah di atasnya.'
                  : 'Dasar kit dari warna tiap bagian. Pilih Desain impor untuk memakai gambar kit yang sudah jadi.'}
              </p>
            </>
          );
        })()}
      </div>

      {/* Sleeve shape: with the shoulder yoke, or the shorter shape */}
      <div className="space-y-2 pt-2.5 border-t border-slate-800/70">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bentuk lengan</div>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ['yoke', 'Sampai pundak'],
              ['short', 'Tanpa pundak'],
            ] as const
          ).map(([id, label]) => {
            const active = (state.sleeveShape ?? 'yoke') === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChangeSleeveShape(id)}
                className={`text-[11px] font-medium py-1.5 rounded-lg border transition-colors ${
                  active
                    ? 'bg-sky-600/30 border-sky-500 text-sky-100'
                    : 'bg-slate-800/70 border-slate-700/60 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-500 leading-snug">
          Sampai pundak mengikuti template PES: lengan menyambung ke area leher. Tanpa pundak memakai lengan yang lebih
          pendek dan berhenti di lubang lengan, sisanya ikut warna baju.
        </p>
      </div>

      {/* Background colour */}
      <div className="space-y-2 pt-2.5 border-t border-slate-800/70">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Warna latar</div>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs bg-slate-900/70 border-slate-700">
          <span className="text-slate-600" title="Layer paling bawah: tidak bisa disembunyikan atau dihapus">
            <Lock className="w-3.5 h-3.5" />
          </span>
          <input
            type="color"
            value={state.background || DEFAULT_BACKGROUND_COLOR}
            onChange={(e) => onChangeBackground(e.target.value)}
            className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5 shrink-0"
            title="Warna latar (ruang kosong di luar bagian kit)"
          />
          <span className="flex-1 min-w-0 truncate font-semibold text-slate-200">Warna Latar (Base)</span>
          {state.background && state.background !== DEFAULT_BACKGROUND_COLOR && (
            <button
              type="button"
              onClick={() => onChangeBackground(undefined)}
              className="text-[10px] px-2 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
              title="Kembalikan ke warna gelap bawaan"
            >
              Reset
            </button>
          )}
        </div>

      </div>
      </PanelSection>

      {/* Layers */}
      <PanelSection
        id="layers"
        title="Layer"
        icon={<Layers className="w-3.5 h-3.5 text-sky-400" />}
        badge={template.zones.length || undefined}
        action={
          template.zones.length > 0 ? (
            <button
              type="button"
              onClick={onResetZones}
              className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center gap-1"
              title="Kembalikan warna, tampilan, posisi, dan bentuk semua layer ke bawaan template"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          ) : undefined
        }
      >

        {groups.map(({ g, zones }) => (
          <div key={g} className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{GROUP_LABEL[g]}</div>

            {zones.map((z: KitZoneDef) => {
              const zs = state.zones[z.id] ?? { color: z.defaultColor, visible: z.defaultVisible };
              const selected = selectedZoneId === z.id;
              return (
                <div key={z.id}>
                  <div
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs transition-colors ${
                      selected
                        ? 'bg-sky-950/50 border-sky-600'
                        : zs.visible
                        ? 'bg-slate-900/60 border-slate-800'
                        : 'bg-slate-900/20 border-slate-800/60 text-slate-500'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onUpdateZone(z.id, { visible: !zs.visible })}
                      className="text-slate-400 hover:text-white"
                      title={zs.visible ? 'Sembunyikan layer' : 'Tampilkan layer'}
                    >
                      {zs.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <input
                      type="color"
                      value={zs.color}
                      onChange={(e) => onUpdateZone(z.id, { color: e.target.value, visible: true })}
                      className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5 shrink-0"
                      title="Warna layer"
                    />
                    <button
                      type="button"
                      onClick={() => onSelectZone(selected ? null : z.id)}
                      className="flex-1 min-w-0 text-left truncate hover:text-white"
                      title="Klik untuk mengubah posisi, ukuran, bentuk, dan jahitan layer ini"
                    >
                      {z.name}
                    </button>
                    <button type="button" onClick={() => onFocusPart(z.part)} className="text-slate-500 hover:text-sky-300" title="Fokus ke bagian ini di canvas">
                      <Crosshair className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectZone(selected ? null : z.id)}
                      className="text-slate-400 hover:text-white"
                      title={selected ? 'Tutup pengaturan' : 'Buka pengaturan'}
                    >
                      {selected ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {selected && renderEditor(z)}
                </div>
              );
            })}

            {/* Base rows: the main colour of a garment. They cannot be deleted. */}
            {BASE_ROWS[g].map((base) => {
              const open = openBase.has(base.id);
              const first = partsConfig[base.parts[0]];
              const same = base.parts.every((id) => partsConfig[id]?.color === first?.color);
              // with an imported design as the base, the colour can be stacked on top of it
              const stacked = designBase && base.parts.some((id) => partsConfig[id]?.overDesign);
              const setStacked = (on: boolean) => base.parts.forEach((id) => onUpdatePartConfig(id, { overDesign: on }));
              return (
                <div key={base.id}>
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs bg-slate-900/70 border-slate-700">
                    {designBase ? (
                      <button
                        type="button"
                        onClick={() => setStacked(!stacked)}
                        className={stacked ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-400'}
                        title={stacked ? 'Sembunyikan warna di atas desain impor' : 'Tampilkan warna ini di atas desain impor'}
                      >
                        {stacked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                    ) : (
                      <span className="text-slate-600" title="Layer utama: tidak bisa disembunyikan atau dihapus">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <input
                      type="color"
                      value={first?.color ?? '#ffffff'}
                      onChange={(e) => {
                        onSetBaseColor(base.parts, e.target.value);
                        if (designBase) setStacked(true);
                      }}
                      className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5 shrink-0"
                      title="Warna dasar semua bagian"
                    />
                    <button
                      type="button"
                      onClick={() => toggleBase(base.id)}
                      className="flex-1 min-w-0 text-left truncate font-semibold text-slate-200 hover:text-white"
                      title="Klik untuk melihat bagian-bagiannya"
                    >
                      {base.label}
                      {!same && <span className="ml-1.5 text-[10px] font-normal text-slate-500">(warna bervariasi)</span>}
                    </button>
                    <button type="button" onClick={() => toggleBase(base.id)} className="text-slate-400 hover:text-white">
                      {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {open && (
                    <div className="mt-1 ml-3 space-y-1 border-l border-slate-800 pl-2">
                      {base.parts.map((id) => renderPartRow(id))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Collar, captain's armband and the credit box are ordinary layers */}
            {g === 'details' && DETAIL_PARTS.map((id) => renderPartRow(id, true))}
          </div>
        ))}

        {/* Add a layer */}
        <div className="space-y-1.5 bg-slate-900/40 border border-slate-800 rounded-lg p-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tambah layer</div>
          <select
            value={newPart}
            onChange={(e) => setNewPart(e.target.value as KitPartId | '')}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none"
          >
            <option value="">Bagian aktif ({PES_2021_PARTS.find((p) => p.id === targetPart)?.name})</option>
            {PES_2021_PARTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-4 gap-1">
            {NEW_ZONES.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onAddZone(n.id, targetPart)}
                className="flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-md border border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-700"
              >
                <Plus className="w-3 h-3" />
                {n.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 leading-snug">Alat gambar ada di bar alat di sisi kiri canvas.</p>
        </div>
      </PanelSection>

      {/* Pattern layers (drawn over the base colours above) */}
        <PatternLayersPanel
          layers={state.patterns ?? []}
          library={library}
          activePartId={activePartId}
          onChange={onChangePatterns}
        />


      {/* Seams */}
      <PanelSection
        id="seams"
        title="Garis Jahitan"
        icon={<Spline className="w-3.5 h-3.5 text-sky-400" />}
        defaultOpen={false}
        action={
          <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
            <input type="checkbox" checked={seams.enabled} onChange={(e) => onUpdateSeams({ enabled: e.target.checked })} className="accent-sky-500" />
            Tampilkan
          </label>
        }
      >

        <div className="space-y-1.5">
          <p className="text-[10px] text-slate-500 leading-snug">Buat garis jahit baru dengan alat di sisi kiri canvas.</p>
          {(template.seams ?? []).map((s, i) => {
            const key = s.id ?? `seam-${i}`;
            const part = PES_2021_PARTS.find((p) => p.id === s.part);
            return (
              <div key={key} className="flex items-center gap-2 bg-slate-900/50 border border-slate-800 rounded-md px-2 py-1">
                <Spline className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="flex-1 min-w-0 truncate text-[11px] text-slate-200">{s.name ?? `Garis jahit ${i + 1}`}</span>
                <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{part?.name}</span>
                {s.points.length >= 3 && (
                  <button
                    type="button"
                    onClick={() => onToggleSeamCurve(key)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      s.smooth
                        ? 'bg-sky-600/30 border-sky-500 text-sky-100'
                        : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                    title={s.smooth ? 'Ubah jadi garis lurus' : 'Ubah jadi garis melengkung'}
                  >
                    Lengkung
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDeleteSeam(key)}
                  className="text-slate-500 hover:text-rose-400"
                  title="Hapus garis jahit"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {seams.enabled && (
          <div className="space-y-2.5 bg-slate-900/50 border border-slate-800 rounded-lg p-3">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
              <input type="checkbox" checked={!!seams.outline} onChange={(e) => onUpdateSeams({ outline: e.target.checked })} className="accent-sky-500" />
              Jahitan di tepi tiap bagian
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {SEAM_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  title={s.hint}
                  onClick={() => onUpdateSeams({ style: s.id })}
                  className={`text-[11px] py-1 rounded-md border transition-colors ${
                    (seams.style === 'flat' ? 'soft' : seams.style) === s.id
                      ? 'bg-sky-600/25 border-sky-500 text-sky-100'
                      : 'bg-slate-800/70 border-slate-700/60 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <Slider label="Kekuatan" value={Math.round(seams.opacity * 100)} min={10} max={100} step={5} unit="%" onChange={(v) => onUpdateSeams({ opacity: v / 100 })} />
            <Slider label="Tebal garis" value={seams.width} min={0.8} max={4} step={0.2} unit="px" onChange={(v) => onUpdateSeams({ width: v })} />

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Warna benang</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={seams.color ?? '#ffffff'}
                  onChange={(e) => onUpdateSeams({ color: e.target.value })}
                  className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5"
                />
                <button
                  type="button"
                  onClick={() => onUpdateSeams({ color: undefined })}
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    seams.color ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-sky-500 text-sky-200 bg-sky-600/20'
                  }`}
                >
                  Otomatis
                </button>
              </div>
            </div>
          </div>
        )}
        <p className="text-[10px] text-slate-500 leading-snug">
          Canvas bersih secara bawaan: garis jahit hanya yang kamu gambar sendiri (daftar di atas) dan tepi layer.
          Nyalakan "Jahitan di tepi tiap bagian" bila ingin garis di sekeliling setiap potongan.
        </p>
      </PanelSection>

      {/* Save as library template */}
      <PanelSection id="save" title="Simpan sebagai template" defaultOpen={false}>
        <div className="flex gap-1.5">
          <input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder={`${template.name} (saya)`}
            className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500"
          />
          <button
            type="button"
            onClick={async () => {
              const res = await onSaveTemplate(saveName.trim() || `${template.name} (saya)`);
              setSaveMsg({ ok: res.ok, text: res.message });
            }}
            className="flex items-center gap-1 text-[11px] px-2.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-semibold"
            title="Simpan layer beserta posisi, ukuran, bentuk, dan warnanya ke folder library/templates"
          >
            <Save className="w-3.5 h-3.5" />
            Simpan
          </button>
        </div>
        {saveMsg && <p className={`text-[10px] ${saveMsg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{saveMsg.text}</p>}
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Template tersimpan di <code>library/templates</code> dan muncul di daftar &quot;Template saya&quot;. Bisa
          juga ditulis manual (JSON); lihat <code>library/templates/README.txt</code>.
        </p>
      </PanelSection>
    </div>
  );
};

export default TemplatePanel;
