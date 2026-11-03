'use client';

import React, { useEffect, useState } from 'react';
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
  ArrowRightLeft,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Sparkles,
  Search,
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
import { PatternLayerEditor, groupPartIds, newPatternLayer } from '@/components/ui/PatternLayersPanel';
import { PanelSection } from '@/components/ui/PanelSection';
import { InfoTip } from '@/components/ui/InfoTip';
import { LayerSidePanel } from '@/components/ui/LayerSidePanel';
import { useLayerEditorMode } from '@/hooks/useLayerEditorMode';
import { AccentRow } from '@/components/ui/AccentLayersPanel';
import { BUILTIN_TEMPLATES } from '@/constants/templates';
import { COLOR_PALETTES } from '@/constants/presets';
import { PES_2021_PARTS, DEFAULT_BACKGROUND_COLOR } from '@/constants/pes2021Parts';
import { zoneBox, zoneParts } from '@/utils/zoneGeometry';
import { helperName } from '@/utils/psdImport';

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
  onMoveZone: (zoneId: string, part: KitPartId, copy: boolean) => void;
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
  /** Copies a .psd into library/templates, where it is read as a template. */
  onAddPsd: (file: File) => void;
  /** Which tab shows the panel: the template tab (choice, kit base, save) or the layer tab. */
  view: 'template' | 'layers';
  onOpenPngImport: () => void;
  editPoints: boolean;
  onToggleEditPoints: (zoneId: string) => void;
  onUpdateSeams: (update: Partial<SeamConfig>) => void;
  onResetZones: () => void;
  onRefreshBuiltin: (apply: boolean) => void;
  onFocusPart: (partId: KitPartId) => void;
  onSyncRelatedParts: (partId: KitPartId) => void;
}

/** Parts that have a pair to copy their colour and trims to. */
const SYNC_LABEL: Partial<Record<KitPartId, string>> = {
  front: 'Samakan Depan & Belakang',
  back: 'Samakan Depan & Belakang',
  leftSleeve: 'Samakan Kedua Lengan',
  rightSleeve: 'Samakan Kedua Lengan',
  leftShorts: 'Samakan Kedua Celana',
  rightShorts: 'Samakan Kedua Celana',
  leftSock: 'Samakan Kedua Kaus Kaki',
  rightSock: 'Samakan Kedua Kaus Kaki',
};

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

/** One flat list row (layers, parts): highlighted when selected, dimmed when hidden. */
const rowClass = (selected: boolean, visible = true) =>
  `group flex items-center gap-2 px-1.5 py-1 rounded-md text-xs transition-colors ${
    selected ? 'bg-sky-500/15 text-white' : visible ? 'hover:bg-slate-800/70' : 'text-slate-500 hover:bg-slate-800/50'
  }`;
/** Secondary row buttons show on hover / keyboard focus, and always on the selected row. */
const rowExtra = (selected: boolean) =>
  selected ? '' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100';
/** Groups with more layers than this start closed. */
const OPEN_GROUP_MAX = 8;

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
  onMoveZone,
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
  onAddPsd,
  view,
  onOpenPngImport,
  editPoints,
  onToggleEditPoints,
  onUpdateSeams,
  onResetZones,
  onRefreshBuiltin,
  onFocusPart,
  onSyncRelatedParts,
}) => {
  const [saveName, setSaveName] = useState('');
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lockRatio, setLockRatio] = useState(false);
  // the part whose colour editor is open under its row (one at a time)
  const [editPart, setEditPart] = useState<KitPartId | null>(null);

  const all: KitTemplate[] = [...BUILTIN_TEMPLATES, ...library.templates];
  const groups = (['shirt', 'shorts', 'socks', 'details'] as KitCategory[]).map((g) => ({
    g,
    zones: template.zones.filter((z) => z.group === g),
  }));
  const [openBase, setOpenBase] = useState<Set<string>>(new Set());
  // layer list: which groups were opened / closed by hand, which groups show their helper layers, and the search text
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const [helpersOpen, setHelpersOpen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  // Pattern layers sit in the groups of the layer list: drag a row to another group to move it there (Ctrl / Alt = copy)
  const patterns = state.patterns ?? [];
  const [openPattern, setOpenPattern] = useState<{ id: string; g: KitCategory } | null>(null);
  // one layer editor at a time: opening a pattern closes the selected layer's editor, and the other way round
  const openPatternEditor = (next: { id: string; g: KitCategory }) => {
    if (selectedZoneId) onSelectZone(null);
    setOpenPattern(next);
  };
  useEffect(() => {
    if (selectedZoneId) setOpenPattern(null);
  }, [selectedZoneId]);
  const [drag, setDrag] = useState<{ kind: 'pattern' | 'zone'; id: string; from: KitCategory } | null>(null);
  const [dropAt, setDropAt] = useState<{ g: KitCategory; before: string | null } | null>(null);
  const inGroup = (l: PatternLayer, g: KitCategory) => l.parts.some((p) => groupPartIds(g).includes(p));
  const updatePattern = (id: string, patch: Partial<PatternLayer>) =>
    onChangePatterns(patterns.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const addPattern = (g: KitCategory) => {
    const l = newPatternLayer(groupPartIds(g));
    onChangePatterns([...patterns, l]);
    setGroupOpen((prev) => ({ ...prev, [g]: true }));
    openPatternEditor({ id: l.id, g });
  };

  // a pattern on several groups is only taken off this one; otherwise it is deleted
  const removePattern = (l: PatternLayer, g: KitCategory) => {
    const rest = l.parts.filter((p) => !groupPartIds(g).includes(p));
    onChangePatterns(rest.length ? patterns.map((x) => (x.id === l.id ? { ...x, parts: rest } : x)) : patterns.filter((x) => x.id !== l.id));
    if (openPattern?.id === l.id) setOpenPattern(null);
  };

  const copyOf = (l: PatternLayer, parts: KitPartId[]): PatternLayer => ({
    ...l,
    id: `pattern-${Date.now().toString(36)}`,
    name: `${l.name ?? 'Pola'} (salinan)`,
    parts,
  });

  const duplicatePattern = (l: PatternLayer, g: KitCategory) => {
    const copy = copyOf(l, l.parts.filter((p) => groupPartIds(g).includes(p)));
    const next = [...patterns];
    next.splice(next.indexOf(l) + 1, 0, copy);
    onChangePatterns(next);
    openPatternEditor({ id: copy.id, g });
  };

  // the list shows the top layer first: "up" swaps with the next layer of the same group, further back in the array
  const movePattern = (l: PatternLayer, g: KitCategory, dir: 'up' | 'down') => {
    const same = patterns.filter((x) => inGroup(x, g));
    const other = same[same.indexOf(l) + (dir === 'up' ? 1 : -1)];
    if (!other) return;
    const next = [...patterns];
    const i = next.indexOf(l);
    const j = next.indexOf(other);
    [next[i], next[j]] = [next[j], next[i]];
    onChangePatterns(next);
  };

  // Drop the dragged pattern on a group (or above one of its rows): it moves there, or with copy a copy goes there
  const dropPattern = (g: KitCategory, before: string | null, copy: boolean) => {
    const d = drag;
    setDrag(null);
    setDropAt(null);
    const l = d ? patterns.find((x) => x.id === d.id) : undefined;
    if (!d || !l) return;
    const fromIds = groupPartIds(d.from);
    const toIds = groupPartIds(g);
    let moved: PatternLayer = l;
    if (copy) moved = { ...copyOf(l, d.from === g ? l.parts.filter((p) => fromIds.includes(p)) : toIds), name: l.name };
    else if (d.from !== g) {
      const kept = l.parts.filter((p) => !fromIds.includes(p));
      moved = { ...l, parts: kept.some((p) => toIds.includes(p)) ? kept : [...kept, ...toIds] };
    }
    const next = copy ? [...patterns] : patterns.filter((x) => x.id !== l.id);
    // above a row = later in the array; dropped on the group itself a moved layer keeps its place, a copy goes over the original
    const at =
      before && before !== l.id
        ? next.findIndex((x) => x.id === before) + 1
        : copy
          ? next.indexOf(l) + 1
          : patterns.indexOf(l);
    next.splice(at, 0, moved);
    onChangePatterns(next);
    setGroupOpen((prev) => ({ ...prev, [g]: true }));
    if (copy || openPattern?.id === l.id) openPatternEditor({ id: moved.id, g });
  };
  // shape layers keep their order; dragged onto another group they move to its part
  const dropOn = (g: KitCategory, before: string | null, copy: boolean) => {
    if (drag?.kind !== 'zone') return dropPattern(g, before, copy);
    const d = drag;
    setDrag(null);
    setDropAt(null);
    if (d.from !== g) onMoveZone(d.id, objectPart(g), copy);
    else if (copy) onDuplicateZone(d.id);
    setGroupOpen((prev) => ({ ...prev, [g]: true }));
  };
  const dropEffect = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = e.ctrlKey || e.altKey ? 'copy' : 'move';
  };
  const toggleBase = (id: string) =>
    setOpenBase((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const seams = state.seams;
  // a new or dragged-in object goes on the active part when it is in the group, else on the group's first part
  const objectPart = (g: KitCategory): KitPartId =>
    activePartId !== 'all' && PES_2021_PARTS.find((p) => p.id === activePartId)?.category === g
      ? activePartId
      : (PES_2021_PARTS.find((p) => p.category === g)?.id ?? 'front');
  const [addObject, setAddObject] = useState<KitCategory | null>(null);
  // Settings: layer settings open under the row or in a side panel left of the list
  const [editorMode] = useLayerEditorMode();
  // a layer selected here or on the canvas is scrolled into view (a new object lands at the end of a long group)
  useEffect(() => {
    if (selectedZoneId) document.querySelector(`[data-zone-row="${selectedZoneId}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedZoneId]);

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
        <div className={rowClass(active || editPart === id, cfg.visible)}>
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
            onClick={() => {
              onEditPart(id);
              setEditPart(editPart === id ? null : id);
            }}
            className="flex-1 min-w-0 text-left truncate hover:text-white"
            title="Buka warna dan pengaturan bagian ini"
          >
            {def.name}
          </button>
          <button
            type="button"
            onClick={() => onFocusPart(id)}
            className={`text-slate-500 hover:text-sky-300 ${rowExtra(active || editPart === id)}`}
            title="Fokus ke bagian ini di canvas"
            aria-label="Fokus ke bagian ini di canvas"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              onEditPart(id);
              setEditPart(editPart === id ? null : id);
            }}
            className={editPart === id ? 'text-sky-300' : `text-slate-500 hover:text-white ${rowExtra(active)}`}
            title="Buka warna dan pengaturan bagian ini"
            aria-label="Buka warna dan pengaturan bagian ini"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
        {editPart === id && (
          <div className="mt-1 ml-3 border-l border-slate-800 pl-2 space-y-1.5">
            <input
              type="text"
              value={cfg.color}
              onChange={(e) => onUpdatePartConfig(id, { color: e.target.value, visible: true })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono uppercase text-slate-200 outline-none focus:border-sky-500"
              title="Kode warna (hex)"
            />
            <div className="grid grid-cols-6 gap-1">
              {COLOR_PALETTES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onUpdatePartConfig(id, { color: c, visible: true })}
                  className={`aspect-square rounded border ${cfg.color.toLowerCase() === c.toLowerCase() ? 'border-white' : 'border-black/40 hover:border-slate-400'}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            {SYNC_LABEL[id] && (
              <button
                type="button"
                onClick={() => onSyncRelatedParts(id)}
                className="w-full flex items-center justify-center gap-1.5 text-[11px] py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <ArrowRightLeft className="w-3 h-3 text-rose-400" />
                {SYNC_LABEL[id]}
              </button>
            )}
          </div>
        )}
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

  const renderZoneRow = (z: KitZoneDef) => {
    const zs = state.zones[z.id] ?? { color: z.defaultColor, visible: z.defaultVisible };
    const selected = selectedZoneId === z.id;
    // shape layers (not PSD image layers) can be dragged to another group
    const movable = !!(z.rects?.length || z.ellipses?.length || z.polygons?.length);
    return (
      <div key={z.id} data-zone-row={z.id} data-layer-anchor={z.id}>
        <div
          draggable={movable}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'copyMove';
            e.dataTransfer.setData('text/plain', z.id);
            setDrag({ kind: 'zone', id: z.id, from: z.group });
          }}
          onDragEnd={() => {
            setDrag(null);
            setDropAt(null);
          }}
          className={`${rowClass(selected, zs.visible)} ${movable ? 'cursor-grab active:cursor-grabbing' : ''} ${drag?.id === z.id ? 'opacity-40' : ''}`}
        >
          {movable && <GripVertical className="w-3 h-3 -mx-1 shrink-0 text-slate-600" aria-hidden />}
          <button
            type="button"
            onClick={() => onUpdateZone(z.id, { visible: !zs.visible })}
            className="text-slate-400 hover:text-white"
            title={zs.visible ? 'Sembunyikan layer' : 'Tampilkan layer'}
            aria-label={zs.visible ? 'Sembunyikan layer' : 'Tampilkan layer'}
          >
            {zs.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <input
            type="color"
            value={zs.color}
            onChange={(e) => onUpdateZone(z.id, { color: e.target.value, visible: true })}
            className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5 shrink-0"
            title="Warna layer"
            aria-label={`Warna ${z.name}`}
          />
          <button
            type="button"
            onClick={() => onSelectZone(selected ? null : z.id)}
            aria-expanded={selected}
            className="flex-1 min-w-0 text-left truncate hover:text-white"
            title="Klik untuk mengubah posisi, ukuran, bentuk, dan jahitan layer ini"
          >
            {z.name}
          </button>
          <button
            type="button"
            onClick={() => onFocusPart(z.part)}
            className={`text-slate-500 hover:text-sky-300 ${rowExtra(selected)}`}
            title="Fokus ke bagian ini di canvas"
            aria-label="Fokus ke bagian ini di canvas"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDuplicateZone(z.id)}
            className={`text-slate-500 hover:text-white ${rowExtra(selected)}`}
            title="Gandakan layer ini"
            aria-label="Gandakan layer ini"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteZone(z.id)}
            className={`text-slate-500 hover:text-rose-400 ${rowExtra(selected)}`}
            title="Hapus layer"
            aria-label="Hapus layer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <span className="text-slate-500" aria-hidden>
            {selected ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className={`w-3.5 h-3.5 ${rowExtra(false)}`} />}
          </span>
        </div>
        {selected &&
          (editorMode === 'side' ? (
            <LayerSidePanel anchor={z.id} title={z.name} onClose={() => onSelectZone(null)}>
              {renderEditor(z, true)}
            </LayerSidePanel>
          ) : (
            renderEditor(z)
          ))}
      </div>
    );
  };

  const renderPatternRow = (l: PatternLayer, g: KitCategory) => {
    const open = openPattern?.id === l.id && openPattern.g === g;
    const same = patterns.filter((x) => inGroup(x, g));
    const k = same.indexOf(l);
    const others = (['shirt', 'shorts', 'socks', 'details'] as KitCategory[]).filter((x) => x !== g && inGroup(l, x));
    const dropHere = dropAt?.g === g && dropAt.before === l.id;
    const name = l.name ?? 'Pola';
    return (
      <div
        key={l.id}
        data-layer-anchor={`${l.id}-${g}`}
        onDragOver={(e) => {
          if (drag?.kind !== 'pattern') return;
          dropEffect(e);
          e.stopPropagation();
          if (!dropHere) setDropAt({ g, before: l.id });
        }}
        onDrop={(e) => {
          if (drag?.kind !== 'pattern') return;
          e.preventDefault();
          e.stopPropagation();
          dropPattern(g, l.id, e.ctrlKey || e.altKey);
        }}
        className={`border-t-2 ${dropHere ? 'border-sky-400' : 'border-transparent'}`}
      >
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'copyMove';
            e.dataTransfer.setData('text/plain', l.id);
            setDrag({ kind: 'pattern', id: l.id, from: g });
          }}
          onDragEnd={() => {
            setDrag(null);
            setDropAt(null);
          }}
          className={`${rowClass(open, l.visible)} cursor-grab active:cursor-grabbing ${drag?.id === l.id && drag.from === g ? 'opacity-40' : ''}`}
        >
          <GripVertical className="w-3 h-3 -mx-1 shrink-0 text-slate-600" aria-hidden />
          <button
            type="button"
            onClick={() => updatePattern(l.id, { visible: !l.visible })}
            className="text-slate-400 hover:text-white"
            title={l.visible ? 'Sembunyikan pola' : 'Tampilkan pola'}
            aria-label={l.visible ? 'Sembunyikan pola' : 'Tampilkan pola'}
          >
            {l.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <input
            type="color"
            value={l.patternColor}
            onChange={(e) => updatePattern(l.id, { patternColor: e.target.value, visible: true })}
            className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5 shrink-0"
            title="Warna pola"
            aria-label={`Warna ${name}`}
          />
          <button
            type="button"
            onClick={() => (open ? setOpenPattern(null) : openPatternEditor({ id: l.id, g }))}
            aria-expanded={open}
            className="flex-1 min-w-0 flex items-center gap-1.5 text-left hover:text-white"
            title="Klik untuk mengatur pola ini; seret untuk memindahkannya ke grup lain"
          >
            <Sparkles className="w-3 h-3 shrink-0 text-slate-500" aria-hidden />
            <span className="truncate">{name}</span>
            {others.length > 0 && (
              <span className="shrink-0 text-[11px] text-slate-500" title="Pola yang sama juga dipakai di grup ini">
                <span>+</span>
                {others.map((x, i) => (
                  <span key={x}>
                    {i > 0 && ', '}
                    <span>{GROUP_LABEL[x]}</span>
                  </span>
                ))}
              </span>
            )}
          </button>
          <span className={`flex items-center gap-1 ${rowExtra(open)}`}>
            <button
              type="button"
              disabled={k === same.length - 1}
              onClick={() => movePattern(l, g, 'up')}
              className="text-slate-500 hover:text-white disabled:opacity-30"
              title="Naikkan (lebih depan)"
              aria-label="Naikkan (lebih depan)"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={k === 0}
              onClick={() => movePattern(l, g, 'down')}
              className="text-slate-500 hover:text-white disabled:opacity-30"
              title="Turunkan"
              aria-label="Turunkan"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => duplicatePattern(l, g)}
              className="text-slate-500 hover:text-white"
              title="Gandakan"
              aria-label="Gandakan"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => removePattern(l, g)}
              className="text-slate-500 hover:text-rose-400"
              title={others.length ? 'Hapus dari grup ini' : 'Hapus pola'}
              aria-label={others.length ? 'Hapus dari grup ini' : 'Hapus pola'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </span>
        </div>
        {open &&
          (editorMode === 'side' ? (
            <LayerSidePanel anchor={`${l.id}-${g}`} title={name} onClose={() => setOpenPattern(null)}>
              <PatternLayerEditor bare layer={l} group={g} library={library} onUpdate={(patch) => updatePattern(l.id, patch)} />
            </LayerSidePanel>
          ) : (
            <PatternLayerEditor layer={l} group={g} library={library} onUpdate={(patch) => updatePattern(l.id, patch)} />
          ))}
      </div>
    );
  };

  const renderEditor = (z: KitZoneDef, side = false) => {
    const zs: TemplateZoneState = state.zones[z.id] ?? { color: z.defaultColor, visible: z.defaultVisible };
    const sx = zs.sx ?? 1;
    const sy = zs.sy ?? 1;
    const edge = zs.edge ?? 'sharp';
    const isMask = !!z.mask && !z.rects?.length && !z.polygons?.length && !z.ellipses?.length;

    return (
      <div className={side ? 'p-3 space-y-3' : 'mt-1 mb-2 p-3 rounded-lg bg-slate-950/60 border border-sky-900/60 space-y-3'}>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <div className="flex items-center justify-between">
              <label htmlFor={`zone-name-${z.id}`} className="text-[10px] text-slate-500">
                Nama layer
              </label>
              <button
                type="button"
                onClick={() => onResetZone(z.id)}
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                title="Kembalikan posisi, ukuran, dan bentuk ke awal"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>
            <input
              id={`zone-name-${z.id}`}
              value={z.name}
              onChange={(e) => onUpdateZoneDef(z.id, { name: e.target.value })}
              className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500"
            />
          </div>
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <span className="flex-1 min-w-0 flex items-center gap-1 text-[11px] text-slate-400">
                Menempel di bagian
                <InfoTip text="Bentuk yang sama digambar di semua bagian terpilih (dipotong mengikuti tiap bagian). Geser atau lebarkan layer agar menyilang ke bagian lain, misalnya strip melintasi depan, belakang, dan lengan." />
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoneParts(z, ['front', 'back', 'leftSleeve', 'rightSleeve'])}
                  className="text-[11px] whitespace-nowrap px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                  title="Baju depan, belakang, dan kedua lengan"
                >
                  Semua baju
                </button>
                <button
                  type="button"
                  onClick={() => setZoneParts(z, PES_2021_PARTS.map((p) => p.id))}
                  className="text-[11px] whitespace-nowrap px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
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
          </div>
        </div>

        <Slider label="Transparansi" value={Math.round((zs.opacity ?? 1) * 100)} min={10} max={100} step={5} unit="%" onChange={(v) => onUpdateZone(z.id, { opacity: v / 100 })} />

        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="text-[11px] font-semibold text-slate-300">Posisi</div>
          <Slider label="Geser kiri / kanan (X)" value={zs.dx ?? 0} min={-400} max={400} unit="px" onChange={(v) => onUpdateZone(z.id, { dx: v })} />
          <Slider label="Geser atas / bawah (Y)" value={zs.dy ?? 0} min={-400} max={400} unit="px" onChange={(v) => onUpdateZone(z.id, { dy: v })} />
          <Slider label="Putar" value={zs.rot ?? 0} min={-180} max={180} unit="°" onChange={(v) => onUpdateZone(z.id, { rot: v })} />
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold text-slate-300">Ukuran</div>
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

        {!isMask && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
              Kembar
              <InfoTip text="Gambar bentuk ini beberapa kali berjajar dalam satu layer, misalnya 3 strip di dada. Lebar dan tinggi tiap salinan ikut Ukuran di atas." />
            </div>
            <Slider label="Jumlah" value={zs.repeat ?? 1} min={1} max={12} onChange={(v) => onUpdateZone(z.id, { repeat: v })} />
            {(zs.repeat ?? 1) > 1 && (
              <>
                <Slider label="Jarak" value={zs.repeatGap ?? 12} min={0} max={300} unit="px" onChange={(v) => onUpdateZone(z.id, { repeatGap: v })} />
                <div className="grid grid-cols-2 gap-1">
                  {(
                    [
                      ['y', 'Ke bawah'],
                      ['x', 'Ke samping'],
                    ] as const
                  ).map(([id, label]) => {
                    const w = sx * zoneBox(z).w;
                    const h = sy * zoneBox(z).h;
                    const active = (zs.repeatDir ?? (w >= h ? 'y' : 'x')) === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onUpdateZone(z.id, { repeatDir: id })}
                        className={`text-[11px] py-1 rounded-md border transition-colors ${
                          active ? 'bg-sky-600/25 border-sky-500 text-sky-100' : 'bg-slate-800/70 border-slate-700/60 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

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
            <div className="text-[11px] font-semibold text-slate-300">Titik &amp; lengkung</div>
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
            <div className="text-[11px] font-semibold text-slate-300">Bentuk sisi</div>
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

      </div>
    );
  };

  return (
    <div className="flex flex-col h-full select-none overflow-y-auto text-slate-300 p-3 space-y-2.5">
      {view === 'template' && (<>
      {/* Template selector */}
      <PanelSection
        id="template"
        title="Template"
        icon={<LayoutGrid className="w-3.5 h-3.5 text-slate-400" />}
        badge={library.psdBusy ? 'Membaca PSD…' : template.name}
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
          {(
            [
              ['library', 'Template saya (library/templates)'],
              ['psd', 'Baca PSD (file .psd di library/templates)'],
            ] as const
          ).map(([source, label]) => {
            const list = library.templates.filter((t) => (t.source === 'psd') === (source === 'psd'));
            return list.length > 0 ? (
              <optgroup key={source} label={label}>
                {list.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
          {!all.some((t) => t.id === template.id) && <option value={template.id}>{template.name} (dari proyek)</option>}
        </select>

        <div className="grid grid-cols-2 gap-1.5">
          <label
            className="flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-lg border border-sky-700/70 bg-sky-900/30 text-sky-100 hover:bg-sky-800/40 cursor-pointer focus-within:ring-2 focus-within:ring-sky-500"
            title="Salin file PSD ke library/templates. PSD itu langsung dibaca menjadi template (grup Baca PSD) dan ikut diperbarui saat file-nya disimpan ulang."
          >
            <FileUp className="w-3.5 h-3.5" />
            Tambah PSD
            <input
              type="file"
              accept=".psd"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onAddPsd(file);
              }}
            />
          </label>
          <button
            type="button"
            onClick={onOpenPngImport}
            className="flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-lg border border-sky-700/70 bg-sky-900/30 text-sky-100 hover:bg-sky-800/40"
            title="EKSPERIMENTAL: ubah PNG menjadi template (dipisah per warna, atau 1 file = 1 layer). Hasil bisa kurang tepat."
          >
            <ImagePlus className="w-3.5 h-3.5" />
            Import PNG
            <span className="text-[10px] font-bold uppercase px-1 py-px rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">Eksp.</span>
          </button>
        </div>

        {template.modified && (
          <p className="text-[10px] text-amber-300/90">Template ini sudah kamu ubah. Memilih ulang template akan mengembalikannya ke awal.</p>
        )}
        {template.modified &&
          template.source === 'builtin' &&
          BUILTIN_TEMPLATES.some((t) => t.id === template.id && t.rev !== template.rev) && (
            <div className="text-[10px] text-sky-200 bg-sky-950/40 border border-sky-800/60 rounded p-2 space-y-1.5">
              <p>
                Template bawaan ini sudah diperbarui. <strong>Pakai versi baru</strong> mengganti zona bawaannya
                (perubahan bentuknya hilang); warna, serta layer dan jahitan yang kamu tambahkan sendiri tetap ada.
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onRefreshBuiltin(true)}
                  className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                >
                  Pakai versi baru
                </button>
                <button
                  type="button"
                  onClick={() => onRefreshBuiltin(false)}
                  className="px-2 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Abaikan
                </button>
              </div>
            </div>
          )}
        {template.description && <p className="text-[11px] text-slate-500 leading-snug">{template.description}</p>}

        {library.psdBusy && (
          <div className="flex items-center gap-1.5 text-[10px] text-sky-200" role="status">
            <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
            <span className="truncate">
              Membaca PSD {library.psdBusy.name}
              {library.psdBusy.total > 0 ? ` (${library.psdBusy.done}/${library.psdBusy.total})` : ''}…
            </span>
          </div>
        )}

        {library.templateErrors.length + library.psdErrors.length > 0 && (
          <div className="text-[10px] text-amber-300 bg-amber-950/30 border border-amber-900/50 rounded p-2 space-y-0.5">
            {[...library.templateErrors, ...library.psdErrors].map((e) => (
              <div key={e.file}>
                <strong>{e.file}</strong>: {e.error}
              </div>
            ))}
          </div>
        )}
      </PanelSection>

      {/* Base: base layer choice, sleeve shape and background colour */}
      <PanelSection id="base" title="Dasar kit" icon={<Layers className="w-3.5 h-3.5 text-slate-400" />}>
      {/* Base layer: part colours or an imported design */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
          Layer dasar
          <InfoTip text="Warna: dasar kit dari warna tiap bagian. Desain impor: gambar kit yang sudah jadi menjadi dasarnya; pola, lis, dan logo tetap bisa ditambah di atasnya." />
        </div>
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
            </>
          );
        })()}
      </div>

      {/* Sleeve shape: with the shoulder yoke, or the shorter shape */}
      <div className="space-y-2 pt-2.5 border-t border-slate-800/70">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
          Bentuk lengan
          <InfoTip text="Sampai pundak mengikuti template PES: lengan menyambung ke area leher. Tanpa pundak memakai lengan yang lebih pendek dan berhenti di lubang lengan, sisanya ikut warna baju." />
        </div>
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
      </div>

      {/* Background colour */}
      <div className="space-y-2 pt-2.5 border-t border-slate-800/70">
        <div className="text-[11px] font-semibold text-slate-300">Warna latar</div>
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
      </>)}
      {view === 'layers' && (<>

      {/* Layers */}
      <PanelSection
        id="layers"
        title="Layer"
        icon={<Layers className="w-3.5 h-3.5 text-slate-400" />}
        info="Pola selalu di bawah layer template dan di atas warna dasar; pola yang lebih atas tampil lebih depan. Klik + Pola atau + Objek di grup untuk menambah. Seret pola atau objek ke grup lain untuk memindahkannya, tahan Ctrl saat melepas untuk menyalinnya."
        badge={template.zones.length + patterns.length || undefined}
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

        {(() => {
          // colour slots and variant choices that came with the template (e.g. from a grey-coded PSD)
          const slots = new Map<string, KitZoneDef[]>();
          const sets = new Map<string, Map<string, KitZoneDef[]>>();
          for (const z of template.zones) {
            if (z.slot) slots.set(z.slot, [...(slots.get(z.slot) ?? []), z]);
            if (z.variant) {
              const opts = sets.get(z.variant.set) ?? new Map<string, KitZoneDef[]>();
              opts.set(z.variant.option, [...(opts.get(z.variant.option) ?? []), z]);
              sets.set(z.variant.set, opts);
            }
          }
          if (!slots.size && !sets.size) return null;
          const zoneState = (z: KitZoneDef) => state.zones[z.id] ?? { color: z.defaultColor, visible: z.defaultVisible };
          return (
            <div className="space-y-1.5 pb-2 mb-1 border-b border-slate-800/70">
              {slots.size > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
                    Slot warna
                    <InfoTip text="Layer dengan abu-abu yang sama di file aslinya memakai satu warna. Ubah di sini atau di salah satu layernya, semua ikut berubah." />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {[...slots].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([name, zs]) => (
                      <label
                        key={name}
                        className="flex items-center gap-1.5 px-1.5 py-1 rounded-md border border-slate-700/70 bg-slate-900/60 text-[11px] text-slate-200 cursor-pointer"
                        title={zs.map((z) => z.name).join('\n')}
                      >
                        <input
                          type="color"
                          value={zoneState(zs[0]).color}
                          onChange={(e) => onUpdateZone(zs[0].id, { color: e.target.value })}
                          className="w-5 h-5 rounded border border-slate-700 bg-transparent cursor-pointer p-0 shrink-0"
                        />
                        <span className="flex-1 min-w-0 truncate">{name}</span>
                        <span className="text-[10px] text-slate-500">{zs.length}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {[...sets].map(([set, opts]) => {
                const current = [...opts].find(([, zs]) => zs.some((z) => zoneState(z).visible))?.[0] ?? '';
                return (
                  <label key={set} className="flex items-center gap-2 text-[11px] text-slate-300">
                    <span className="flex-1 min-w-0 truncate font-semibold">{set}</span>
                    <select
                      value={current}
                      onChange={(e) => {
                        const zs = opts.get(e.target.value);
                        if (zs) onUpdateZone(zs[0].id, { visible: true });
                        else for (const z of [...opts.values()].flat()) onUpdateZone(z.id, { visible: false });
                      }}
                      className="bg-slate-900 border border-slate-700 rounded-md px-1.5 py-0.5 text-[11px] text-white outline-none focus:border-sky-500"
                    >
                      <option value="">Tidak ada</option>
                      {[...opts.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          );
        })()}

        {template.zones.length > OPEN_GROUP_MAX && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari layer…"
              aria-label="Cari layer"
              className="w-full bg-slate-900 border border-slate-700 rounded-md pl-7 pr-2 py-1 text-xs text-white placeholder:text-slate-500 outline-none focus:border-sky-500"
            />
          </div>
        )}

        {groups.map(({ g, zones }) => {
          // PSD helper layers (mesh, guides, stitch lines, shadows, background) go in their own closed sub-list
          const isHelper = (z: KitZoneDef) => !!z.mask && !!helperName(z.name);
          const matches = q ? zones.filter((z) => z.name.toLowerCase().includes(q)) : zones;
          // top layer first, like the zones
          const groupPatterns = patterns
            .filter((l) => inGroup(l, g) && (!q || (l.name ?? '').toLowerCase().includes(q)))
            .reverse();
          if (q && matches.length + groupPatterns.length === 0) return null;
          const main = q ? matches : matches.filter((z) => !isHelper(z));
          const helpers = q ? [] : matches.filter(isHelper);
          const count = zones.length + groupPatterns.length + BASE_ROWS[g].length + (g === 'details' ? DETAIL_PARTS.length : 0);
          const open = q ? true : groupOpen[g] ?? zones.length <= OPEN_GROUP_MAX;
          const helpersShown = helpersOpen.has(g);
          return (
            <div
              key={g}
              onDragOver={(e) => {
                if (!drag) return;
                dropEffect(e);
                if (dropAt?.g !== g || dropAt.before !== null) setDropAt({ g, before: null });
              }}
              onDrop={(e) => {
                e.preventDefault();
                dropOn(g, null, e.ctrlKey || e.altKey);
              }}
              className={`space-y-0.5 rounded-md ${dropAt?.g === g && dropAt.before === null ? 'bg-sky-500/10 ring-1 ring-sky-500/60' : ''}`}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setGroupOpen((prev) => ({ ...prev, [g]: !open }))}
                  aria-expanded={open}
                  className="flex-1 min-w-0 flex items-center gap-1.5 px-1 py-1 rounded-md text-[11px] font-semibold text-slate-300 hover:text-white"
                >
                  {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                  {GROUP_LABEL[g]}
                  <span className="font-normal text-slate-400">{q ? matches.length + groupPatterns.length : count}</span>
                </button>
                <button
                  type="button"
                  onClick={() => addPattern(g)}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-slate-400 hover:text-white hover:bg-slate-800"
                  title="Tambah pola di grup ini"
                >
                  <Plus className="w-3 h-3" />
                  Pola
                </button>
                <button
                  type="button"
                  onClick={() => setAddObject(addObject === g ? null : g)}
                  aria-expanded={addObject === g}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:text-white hover:bg-slate-800 ${addObject === g ? 'text-sky-200 bg-slate-800' : 'text-slate-400'}`}
                  title="Tambah objek (strip, panel, elips, segitiga) di grup ini"
                >
                  <Plus className="w-3 h-3" />
                  Objek
                </button>
              </div>
              {addObject === g && (
                <div className="grid grid-cols-4 gap-1 pb-1">
                  {NEW_ZONES.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        onAddZone(n.id, objectPart(g));
                        setAddObject(null);
                        setGroupOpen((prev) => ({ ...prev, [g]: true }));
                      }}
                      className="text-[11px] py-1 rounded-md border border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-700"
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              )}

              {open && (
                <>
                  {/* Patterns first so they are easy to find; they are drawn over the base colour and under the template layers */}
                  {groupPatterns.map((l) => renderPatternRow(l, g))}
                  {main.map(renderZoneRow)}

                  {helpers.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setHelpersOpen((prev) => {
                            const next = new Set(prev);
                            if (next.has(g)) next.delete(g);
                            else next.add(g);
                            return next;
                          })
                        }
                        aria-expanded={helpersShown}
                        className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[11px] text-slate-400 hover:text-white hover:bg-slate-800/50"
                        title="Layer dari PSD yang hanya membantu desainer: mesh, panduan, jahitan, bayangan, latar"
                      >
                        {helpersShown ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        Layer bantuan PSD
                        <span className="text-slate-500">{helpers.length}</span>
                      </button>
                      {helpersShown && <div className="ml-3 border-l border-slate-800 pl-1.5 space-y-0.5">{helpers.map(renderZoneRow)}</div>}
                    </>
                  )}

                  {/* Base rows: the main colour of a garment. They cannot be deleted. */}
                  {!q &&
                    BASE_ROWS[g].map((base) => {
                      const baseOpen = openBase.has(base.id);
                      const first = partsConfig[base.parts[0]];
                      const same = base.parts.every((id) => partsConfig[id]?.color === first?.color);
                      // with an imported design as the base, the colour can be stacked on top of it
                      const stacked = designBase && base.parts.some((id) => partsConfig[id]?.overDesign);
                      const setStacked = (on: boolean) => base.parts.forEach((id) => onUpdatePartConfig(id, { overDesign: on }));
                      return (
                        <div key={base.id}>
                          <div className={rowClass(false)}>
                            {designBase ? (
                              <button
                                type="button"
                                onClick={() => setStacked(!stacked)}
                                className={stacked ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-300'}
                                title={stacked ? 'Sembunyikan warna di atas desain impor' : 'Tampilkan warna ini di atas desain impor'}
                                aria-label={stacked ? 'Sembunyikan warna di atas desain impor' : 'Tampilkan warna ini di atas desain impor'}
                              >
                                {stacked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              </button>
                            ) : (
                              <span className="text-slate-500" title="Layer utama: tidak bisa disembunyikan atau dihapus">
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
                              aria-label={`Warna ${base.label}`}
                            />
                            <button
                              type="button"
                              onClick={() => toggleBase(base.id)}
                              aria-expanded={baseOpen}
                              className="flex-1 min-w-0 flex items-center gap-1.5 text-left font-semibold text-slate-200 hover:text-white"
                              title="Klik untuk melihat bagian-bagiannya"
                            >
                              <span className="truncate">{base.label}</span>
                              {!same && <span className="shrink-0 text-[11px] font-normal text-slate-400">warna campur</span>}
                              <span className="ml-auto text-slate-500">
                                {baseOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              </span>
                            </button>
                          </div>
                          {baseOpen && <div className="mt-0.5 ml-3 space-y-0.5 border-l border-slate-800 pl-1.5">{base.parts.map((id) => renderPartRow(id))}</div>}
                        </div>
                      );
                    })}

                  {/* Collar, captain's armband and the credit box are ordinary layers */}
                  {!q && g === 'details' && DETAIL_PARTS.map((id) => renderPartRow(id, true))}
                </>
              )}
            </div>
          );
        })}

      </PanelSection>


      {/* Seams */}
      <PanelSection
        id="seams"
        title="Garis Jahitan"
        icon={<Spline className="w-3.5 h-3.5 text-slate-400" />}
        info='Canvas bersih secara bawaan: garis jahit hanya yang kamu gambar sendiri dan tepi layer. Nyalakan "Jahitan di tepi tiap bagian" bila ingin garis di sekeliling setiap potongan.'
        defaultOpen={false}
        action={
          <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
            <input type="checkbox" checked={seams.enabled} onChange={(e) => onUpdateSeams({ enabled: e.target.checked })} className="accent-sky-500" />
            Tampilkan
          </label>
        }
      >

        <div className="space-y-1.5">
          {(template.seams ?? []).length === 0 && (
            <p className="text-[11px] text-slate-400">Belum ada garis jahit. Gambar dengan alat jahit di bar kiri canvas.</p>
          )}
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
      </PanelSection>
      </>)}

      {view === 'template' && (<>
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
      </>)}
    </div>
  );
};

export default TemplatePanel;
