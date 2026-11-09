'use client';

import { ImportButton } from '@/components/ui/ImportMenu';
import React, { useEffect, useRef, useState } from 'react';
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
  Folder,
  FolderOpen,
  Group,
  Ungroup,
  CopyPlus,
  Merge,
  X,
} from 'lucide-react';
import {
  BaseTexture,
  KitCategory,
  KitPartConfig,
  KitPartId,
  KitSeamDef,
  KitTemplate,
  PatternLayer,
  KitZoneDef,
  SeamConfig,
  TemplateState,
  TemplateZoneState,
  ZoneEdge,
} from '@/types/kit';
import { AssetLibrary } from '@/hooks/useAssetLibrary';
import { AlignRow, PatternLayerEditor, groupPartIds, newPatternLayer } from '@/components/ui/PatternLayersPanel';
import { partPolygons, polygonsBox } from '@/utils/partShape';
import { PanelSection } from '@/components/ui/PanelSection';
import { useI18n } from '@/i18n/I18nProvider';
import { InfoTip } from '@/components/ui/InfoTip';
import { LayerSidePanel } from '@/components/ui/LayerSidePanel';
import { useLayerEditorMode } from '@/hooks/useLayerEditorMode';
import { AccentRow } from '@/components/ui/AccentLayersPanel';
import { BUILTIN_TEMPLATES } from '@/constants/templates';
import { COLOR_PALETTES } from '@/constants/presets';
import { PES_2021_PARTS, PART_MAP, DEFAULT_BACKGROUND_COLOR } from '@/constants/pes2021Parts';
import { bakeZone, zoneBox, zoneParts } from '@/utils/zoneGeometry';
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
  /** Every selected layer, the main one last (Ctrl / Shift click in the list picks more). */
  selectedZoneIds: string[];
  onSelectZones: (ids: string[]) => void;
  onGroupZones: (ids: string[]) => void;
  onUngroup: (groupId: string) => void;
  onMergeZones: (ids: string[]) => void;
  onSelectTemplate: (template: KitTemplate) => void;
  onUpdateZone: (zoneId: string, update: Partial<TemplateZoneState>) => void;
  onResetZone: (zoneId: string) => void;
  onUpdateZoneDef: (zoneId: string, patch: Partial<KitZoneDef>) => void;
  onAddZone: (kind: NewZoneKind, part: KitPartId) => void;
  onDuplicateZone: (zoneId: string) => void;
  onMoveZone: (zoneId: string, part: KitPartId, copy: boolean) => void;
  /** New order (bottom first) of these layers; they take the array slots they hold now. */
  onSetZoneOrder: (ids: string[]) => void;
  onDeleteZone: (zoneId: string) => void;
  onSaveTemplate: (name: string) => Promise<{ ok: boolean; message: string }>;
  onStartDraw: (kind: 'free' | 'poly' | 'stitch' | 'stitchFree' | 'gradient') => void;
  onChangePatterns: (layers: PatternLayer[]) => void;
  /** Imported design (used as the base layer when its mode is replace and it is enabled). */
  baseTexture: BaseTexture | null;
  onChooseBase: (source: 'colour' | 'import') => void;
  onEditBase: () => void;
  onChangeBackground: (color: string | undefined) => void;
  onDeleteSeam: (key: string) => void;
  onToggleSeamCurve: (key: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onDuplicateGroup: (groupId: string) => void;
  onSetSeamStyle: (key: string, style: KitSeamDef['style']) => void;
  /** Stitch line whose points are edited on the canvas, and the switch for it. */
  editSeam: string | null;
  onToggleEditSeam: (key: string) => void;
  /** Copies a .psd into library/templates, where it is read as a template. */
  onPickPsd: () => void;
  onOpenImportDesign: () => void;
  hasImportedDesign?: boolean;
  /** Renames / deletes a template of library/templates (JSON or PSD); resolves to an error message or null. */
  onRenameLibraryTemplate: (template: KitTemplate, name: string) => Promise<string | null>;
  onDeleteLibraryTemplate: (template: KitTemplate) => Promise<string | null>;
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

const SEAM_STYLES: { id: Exclude<SeamConfig['style'], 'flat'>; label: string; hint: string }[] = [
  { id: 'natural', label: 'Alami', hint: 'Bayangan lembut, garis jahit halus, dan top-stitch tipis' },
  { id: 'soft', label: 'Halus', hint: 'Hanya bayangan dan garis sambungan' },
  { id: 'stitch', label: 'Terlihat', hint: 'Jahitan putus-putus berkontras' },
  { id: 'double', label: 'Ganda', hint: 'Dua baris jahitan berkontras' },
  { id: 'join', label: 'Sambung', hint: 'Garis utuh tanpa putus dengan bayangan di perbatasan dua kain' },
];

const EDGES: { id: ZoneEdge; label: string; hint: string }[] = [
  { id: 'sharp', label: 'Lurus', hint: 'Ujung dan sudut lurus' },
  { id: 'rounded', label: 'Tumpul', hint: 'Sudut membulat' },
  { id: 'pointed', label: 'Runcing', hint: 'Ujung meruncing seperti anak panah' },
  { id: 'slant', label: 'Miring', hint: 'Ujung dipotong miring' },
];

// order of TemplateZoneState.edgeCorners laid out as a 2×2 grid: each cell draws its own corner (rounded on one side)
const CORNERS = [
  { label: 'Kiri atas', cls: 'border-r-0 border-b-0 rounded-tl-lg' },
  { label: 'Kanan atas', cls: 'border-l-0 border-b-0 rounded-tr-lg' },
  { label: 'Kanan bawah', cls: 'border-l-0 border-t-0 rounded-br-lg' },
  { label: 'Kiri bawah', cls: 'border-r-0 border-t-0 rounded-bl-lg' },
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
  selectedZoneIds,
  onSelectZones,
  onGroupZones,
  onUngroup,
  onMergeZones,
  onSelectTemplate,
  onUpdateZone,
  onResetZone,
  onUpdateZoneDef,
  onAddZone,
  onDuplicateZone,
  onMoveZone,
  onSetZoneOrder,
  onDeleteZone,
  onSaveTemplate,
  onStartDraw,
  onChangePatterns,
  baseTexture,
  onChooseBase,
  onEditBase,
  onChangeBackground,
  onDeleteSeam,
  onToggleSeamCurve,
  onRenameGroup,
  onDuplicateGroup,
  onSetSeamStyle,
  editSeam,
  onToggleEditSeam,
  onPickPsd,
  onOpenImportDesign,
  hasImportedDesign,
  onRenameLibraryTemplate,
  onDeleteLibraryTemplate,
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
  // renaming the chosen library template: the name being typed (null = not renaming); last error
  const [renameTo, setRenameTo] = useState<string | null>(null);
  const [libMsg, setLibMsg] = useState<string | null>(null);
  const [libBusy, setLibBusy] = useState(false);

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
  const { t } = useI18n();
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
  const [drag, setDrag] = useState<{ kind: 'pattern' | 'zone' | 'folder'; id: string; from: KitCategory } | null>(null);
  // layer-list folders that are folded shut
  const [closedFolders, setClosedFolders] = useState<Set<string>>(new Set());
  const [renameFolder, setRenameFolder] = useState<string | null>(null);
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

  // ---- A group of the layer list is one stack, top first: objects / template layers, each with the patterns placed
  // right above it, then the patterns under all layers. Moving a row moves it in that stack; the stack is then turned
  // back into the layer order and each pattern's place (`above`).
  type StackEntry = { kind: 'zone' | 'pattern'; id: string };
  const mainZonesOf = (g: KitCategory) => template.zones.filter((z) => z.group === g && !(z.mask && helperName(z.name)));
  // Base layers (a PSD's "Base", the colour layer of Import PNG) are the group's background, like Photoshop's: always at
  // the bottom, under the patterns; the renderer draws them first. Top to bottom: layers with the patterns placed
  // above them, the patterns under all layers, then the base layers (with the patterns placed above them).
  const stackOf = (g: KitCategory): StackEntry[] => {
    const zones = mainZonesOf(g);
    const ids = new Set(zones.map((z) => z.id));
    const pats = patterns.filter((l) => inGroup(l, g));
    const out: StackEntry[] = [];
    const push = (z: KitZoneDef) => {
      pats.filter((l) => l.above === z.id).reverse().forEach((l) => out.push({ kind: 'pattern', id: l.id }));
      out.push({ kind: 'zone', id: z.id });
    };
    zones.filter((z) => !z.base).reverse().forEach(push);
    pats.filter((l) => !l.above || !ids.has(l.above)).reverse().forEach((l) => out.push({ kind: 'pattern', id: l.id }));
    zones.filter((z) => z.base).reverse().forEach(push);
    return out;
  };
  const applyStack = (stack: StackEntry[]) => {
    const bottomFirst = [...stack].reverse();
    let anchor: string | undefined;
    const place = new Map<string, string | undefined>();
    const patternOrder: string[] = [];
    bottomFirst.forEach((e) => {
      if (e.kind === 'zone') anchor = e.id;
      else {
        place.set(e.id, anchor);
        patternOrder.push(e.id);
      }
    });
    // the group's patterns take, in their new order, the array slots they hold now (other patterns keep theirs)
    const slots = patterns.flatMap((l, i) => (place.has(l.id) ? [i] : []));
    const next = [...patterns];
    let changed = false;
    slots.forEach((slot, k) => {
      const src = patterns.find((x) => x.id === patternOrder[k])!;
      const above = place.get(src.id);
      if (src !== patterns[slot] || src.above !== above) changed = true;
      const moved: PatternLayer = { ...src };
      if (above) moved.above = above;
      else delete moved.above;
      next[slot] = moved;
    });
    if (changed) onChangePatterns(next);
    // base layers stay under the others (a layer dropped below one goes back up, as it is drawn there)
    const isBase = (id: string) => !!template.zones.find((z) => z.id === id)?.base;
    const zoneOrder = bottomFirst.filter((e) => e.kind === 'zone').map((e) => e.id);
    onSetZoneOrder([...zoneOrder.filter(isBase), ...zoneOrder.filter((id) => !isBase(id))]);
  };
  // ---- Folders (layer groups): a run of layers sharing KitZoneDef.layerGroup; a pattern placed above a member is in it too
  const zoneById = (id: string) => template.zones.find((z) => z.id === id);
  const folderOf = (e: StackEntry): string | undefined => {
    if (e.kind === 'zone') return zoneById(e.id)?.layerGroup;
    const above = patterns.find((x) => x.id === e.id)?.above;
    return above ? zoneById(above)?.layerGroup : undefined;
  };
  /**
   * Moves a row of group g right above row `target`. A layer joins the folder it lands in (or leaves it when it lands
   * outside); `folder` overrides that (null = outside, e.g. dropped on a folder's own row).
   */
  const moveInStack = (g: KitCategory, id: string, target: string, folder?: string | null) => {
    const stack = stackOf(g);
    const from = stack.findIndex((e) => e.id === id);
    if (from < 0 || id === target) return;
    const targetEntry = stack.find((e) => e.id === target);
    if (!targetEntry) return;
    const [entry] = stack.splice(from, 1);
    stack.splice(stack.indexOf(targetEntry), 0, entry);
    applyStack(stack);
    if (entry.kind === 'zone') {
      const want = folder === undefined ? folderOf(targetEntry) : folder ?? undefined;
      if (zoneById(entry.id)?.layerGroup !== want) onUpdateZoneDef(entry.id, { layerGroup: want });
    }
  };
  /** Moves a whole folder (its layers and the patterns placed above them) right above row `target`. */
  const moveFolder = (g: KitCategory, folderId: string, target: string) => {
    const stack = stackOf(g);
    const block = stack.filter((e) => folderOf(e) === folderId);
    const rest = stack.filter((e) => folderOf(e) !== folderId);
    let at = rest.findIndex((e) => e.id === target);
    if (!block.length || at < 0) return;
    // landing inside another folder: go above that whole folder (no folders in folders)
    const other = folderOf(rest[at]);
    if (other) at = rest.findIndex((e) => folderOf(e) === other);
    rest.splice(at, 0, ...block);
    applyStack(rest);
  };
  /** The selected layers that can form a group / be merged: not a base layer, all in one group of the list. */
  const pickedLayers = () => {
    const picked = template.zones.filter((z) => selectedZoneIds.includes(z.id) && !z.base);
    return new Set(picked.map((z) => z.group)).size === 1 ? picked : [];
  };
  const groupSelected = () => {
    const members = pickedLayers();
    if (!members.length) return;
    const g = members[0].group;
    const ids = new Set(members.map((z) => z.id));
    // each member with the patterns placed above it (listed right before it), gathered where the top member is
    const stack = stackOf(g);
    const inBlock = (e: StackEntry) =>
      e.kind === 'zone' ? ids.has(e.id) : ids.has(patterns.find((x) => x.id === e.id)?.above ?? '');
    const first = stack.findIndex(inBlock);
    const rest = stack.filter((e) => !inBlock(e));
    rest.splice(stack.slice(0, first).filter((e) => !inBlock(e)).length, 0, ...stack.filter(inBlock));
    applyStack(rest);
    onGroupZones([...ids]);
    setGroupOpen((prev) => ({ ...prev, [g]: true }));
  };
  const mergeSelected = () => {
    const members = pickedLayers();
    if (members.length >= 2) onMergeZones(members.map((z) => z.id));
  };
  /** Click on a layer name: select it; Ctrl adds / removes it, Shift picks the run from the main selection to it. */
  const clickZone = (z: KitZoneDef, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      onSelectZones(selectedZoneIds.includes(z.id) ? selectedZoneIds.filter((id) => id !== z.id) : [...selectedZoneIds, z.id]);
    } else if (e.shiftKey && selectedZoneId) {
      const order = stackOf(z.group).filter((x) => x.kind === 'zone').map((x) => x.id);
      const a = order.indexOf(selectedZoneId);
      const b = order.indexOf(z.id);
      if (a < 0 || b < 0) return onSelectZones([z.id]);
      const run = order.slice(Math.min(a, b), Math.max(a, b) + 1);
      onSelectZones([...run.filter((id) => id !== z.id), z.id]);
    } else onSelectZone(selectedZoneId === z.id && selectedZoneIds.length === 1 ? null : z.id);
  };
  // Delete removes the picked layers (a whole group when its header is clicked) or the open pattern; Ctrl+G group, Ctrl+Shift+G ungroup, Ctrl+E merge (Photoshop's keys), while this panel is open. Ctrl+E is also
  // Export kit: it merges only while two or more layers that can merge are picked (then Export does not open).
  const deleteOpenPattern = () => {
    const l = openPattern && patterns.find((x) => x.id === openPattern.id);
    if (!l || !openPattern) return false;
    removePattern(l, openPattern.g);
    return true;
  };
  const shortcutRef = useRef({ groupSelected, mergeSelected, pickedLayers, selectedZoneId, selectedZoneIds, onDeleteZone, deleteOpenPattern, onUngroup, zoneById, onDuplicateZone });
  shortcutRef.current = { groupSelected, mergeSelected, pickedLayers, selectedZoneId, selectedZoneIds, onDeleteZone, deleteOpenPattern, onUngroup, zoneById, onDuplicateZone };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const k = e.key.toLowerCase();
      const s = shortcutRef.current;
      if (e.key === 'Delete' && !(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) {
        const ids = s.selectedZoneIds.length ? s.selectedZoneIds : s.selectedZoneId ? [s.selectedZoneId] : [];
        if (ids.length) {
          e.preventDefault();
          ids.forEach((id) => s.onDeleteZone(id));
        } else if (s.deleteOpenPattern()) e.preventDefault();
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (k === 'g' && !e.shiftKey) {
        if (!s.pickedLayers().length) return;
        e.preventDefault();
        s.groupSelected();
      } else if (k === 'g' && e.shiftKey) {
        const lg = s.selectedZoneId ? s.zoneById(s.selectedZoneId)?.layerGroup : undefined;
        if (lg) {
          e.preventDefault();
          s.onUngroup(lg);
        }
      } else if (k === 'j' && !e.shiftKey) {
        // Ctrl+J: duplicate the selected layer(s), like Photoshop
        const ids = s.selectedZoneIds.length ? s.selectedZoneIds : s.selectedZoneId ? [s.selectedZoneId] : [];
        if (!ids.length) return;
        e.preventDefault();
        ids.forEach((id) => s.onDuplicateZone(id));
      } else if (k === 'e' && !e.shiftKey && s.pickedLayers().length >= 2) {
        e.preventDefault();
        e.stopPropagation(); // not Export this time
        s.mergeSelected();
      }
    };
    // capture: runs before the app's own Ctrl+E (Export) handler on window
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  /** One step up (towards the front) or down in the group's stack; patterns can pass objects. */
  const stepInStack = (g: KitCategory, id: string, dir: 'up' | 'down') => {
    const stack = stackOf(g);
    const i = stack.findIndex((e) => e.id === id);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= stack.length) return;
    [stack[i], stack[j]] = [stack[j], stack[i]];
    applyStack(stack);
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
    // in another group the layer it sat above is not in the list: it goes under the layers there
    if (d.from !== g && moved.above) {
      moved = { ...moved };
      delete moved.above;
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
    if (drag?.kind === 'folder') {
      setDrag(null);
      setDropAt(null);
      return;
    }
    if (drag?.kind !== 'zone') return dropPattern(g, before, copy);
    const d = drag;
    setDrag(null);
    setDropAt(null);
    const z = template.zones.find((x) => x.id === d.id);
    const movable = !!(z && (z.rects?.length || z.ellipses?.length || z.polygons?.length));
    if (d.from !== g) {
      if (movable) onMoveZone(d.id, objectPart(g), copy);
    }
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

  /** New colour for a layer. A layer made by Merge starts in its own colours, so picking one switches it to that colour. */
  const recolorZone = (z: KitZoneDef, color: string) => {
    onUpdateZone(z.id, { color, visible: true });
    if (z.keepColor && z.mask?.startsWith('data:')) onUpdateZoneDef(z.id, { keepColor: undefined });
  };

  /** A folder of the layer list: fold, show / hide all, pick all (then move / scale / turn them together), ungroup, drag. */
  const renderFolderRow = (fid: string, g: KitCategory, members: KitZoneDef[], firstEntry: string) => {
    const name = template.layerGroups?.find((x) => x.id === fid)?.name ?? 'Grup';
    const renaming = renameFolder === fid;
    const finishRename = (value: string) => {
      if (value.trim() && value.trim() !== name) onRenameGroup(fid, value.trim());
      setRenameFolder(null);
    };
    const recolorAll = (color: string) => {
      members.forEach((z) => recolorZone(z, color));
      const ids = new Set(members.map((z) => z.id));
      if (patterns.some((l) => l.above && ids.has(l.above)))
        onChangePatterns(patterns.map((l) => (l.above && ids.has(l.above) ? { ...l, patternColor: color } : l)));
    };
    const open = !closedFolders.has(fid);
    const shown = members.some((z) => state.zones[z.id]?.visible ?? z.defaultVisible);
    const allPicked = members.length > 0 && members.every((z) => selectedZoneIds.includes(z.id));
    const dropHere = dropAt?.g === g && dropAt.before === `folder:${fid}`;
    // a layer or folder dropped on the folder row goes above the folder, outside it
    const acceptsDrop = () => !!drag && drag.from === g && drag.id !== fid && drag.kind !== 'pattern';
    return (
      <div
        key={`folder-${fid}`}
        onDragOver={(e) => {
          if (!acceptsDrop()) return;
          dropEffect(e);
          e.stopPropagation();
          if (!dropHere) setDropAt({ g, before: `folder:${fid}` });
        }}
        onDrop={(e) => {
          if (!acceptsDrop() || !drag) return;
          e.preventDefault();
          e.stopPropagation();
          if (drag.kind === 'folder') moveFolder(g, drag.id, firstEntry);
          else moveInStack(g, drag.id, firstEntry, null);
          setDrag(null);
          setDropAt(null);
        }}
        className={`border-t-2 ${dropHere ? 'border-sky-400' : 'border-transparent'}`}
      >
        <div
          draggable={!renaming}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', fid);
            setDrag({ kind: 'folder', id: fid, from: g });
          }}
          onDragEnd={() => {
            setDrag(null);
            setDropAt(null);
          }}
          className={`${rowClass(allPicked, shown)} cursor-grab active:cursor-grabbing ${drag?.id === fid ? 'opacity-40' : ''}`}
        >
          <GripVertical className="w-3 h-3 -mx-1 shrink-0 text-slate-600" aria-hidden />
          <button
            type="button"
            onClick={() => members.forEach((z) => onUpdateZone(z.id, { visible: !shown }))}
            className="text-slate-400 hover:text-white"
            title={shown ? 'Sembunyikan semua isi grup' : 'Tampilkan semua isi grup'}
            aria-label={shown ? 'Sembunyikan semua isi grup' : 'Tampilkan semua isi grup'}
          >
            {shown ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() =>
              setClosedFolders((prev) => {
                const next = new Set(prev);
                if (next.has(fid)) next.delete(fid);
                else next.add(fid);
                return next;
              })
            }
            className="text-amber-300/80 hover:text-amber-200"
            aria-expanded={open}
            title={open ? 'Tutup grup' : 'Buka grup'}
            aria-label={open ? 'Tutup grup' : 'Buka grup'}
          >
            {open ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
          </button>
          <input
            type="color"
            value={members[0] ? (state.zones[members[0].id]?.color ?? members[0].defaultColor) : '#ffffff'}
            onChange={(e) => recolorAll(e.target.value)}
            className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5 shrink-0"
            title="Warna semua isi grup"
            aria-label="Warna semua isi grup"
          />
          {renaming ? (
            <input
              type="text"
              autoFocus
              defaultValue={name}
              maxLength={60}
              onFocus={(e) => e.target.select()}
              onBlur={(e) => finishRename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') finishRename(e.currentTarget.value);
                else if (e.key === 'Escape') setRenameFolder(null);
              }}
              aria-label="Nama grup"
              className="flex-1 min-w-0 bg-slate-900 border border-sky-500 rounded px-1 py-0.5 text-[11px] text-white outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => onSelectZones(members.map((z) => z.id))}
              onDoubleClick={() => setRenameFolder(fid)}
              aria-pressed={allPicked}
              className="flex-1 min-w-0 text-left truncate font-semibold hover:text-white"
              title="Klik untuk memilih semua isi grup (lalu geser, ubah ukuran, atau putar bersama). Klik dua kali untuk mengganti nama"
            >
              {name} <span className="font-normal text-slate-500">{members.length}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setRenameFolder(fid)}
            className="text-slate-500 hover:text-white"
            title="Ganti nama grup"
            aria-label="Ganti nama grup"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDuplicateGroup(fid)}
            className="text-slate-500 hover:text-white"
            title="Gandakan grup"
            aria-label="Gandakan grup"
          >
            <CopyPlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onUngroup(fid)}
            className="text-slate-500 hover:text-white"
            title="Lepas grup (Ctrl+Shift+G)"
            aria-label="Lepas grup"
          >
            <Ungroup className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderZoneRow = (z: KitZoneDef) => {
    const zs = state.zones[z.id] ?? { color: z.defaultColor, visible: z.defaultVisible };
    // with several layers picked each is highlighted, and none opens its settings
    const picked = selectedZoneIds.includes(z.id);
    const selected = selectedZoneId === z.id && selectedZoneIds.length <= 1;
    // shape layers (not PSD image layers) can be dragged to another group; any layer not clipped to another one can
    // be dragged up or down in its group (a clipped layer stays with its base)
    const movable = !!(z.rects?.length || z.ellipses?.length || z.polygons?.length);
    // a base layer is the group's background (always at the bottom), like Photoshop's Background layer
    const draggable = (movable || !z.clipTo) && !z.base;
    const dropHere = dropAt?.g === z.group && dropAt.before === z.id;
    // a layer or a pattern of this group dropped here goes right above this layer
    const acceptsDrop = () => !!drag && drag.from === z.group && drag.id !== z.id;
    return (
      <div
        key={z.id}
        data-zone-row={z.id}
        data-layer-anchor={z.id}
        onDragOver={(e) => {
          if (!acceptsDrop()) return;
          dropEffect(e);
          e.stopPropagation();
          if (!dropHere) setDropAt({ g: z.group, before: z.id });
        }}
        onDrop={(e) => {
          if (!acceptsDrop() || !drag) return;
          e.preventDefault();
          e.stopPropagation();
          // a copied pattern (Ctrl / Alt) goes the usual way: over the original
          if (drag.kind === 'pattern' && (e.ctrlKey || e.altKey)) return dropPattern(z.group, drag.id, true);
          if (drag.kind === 'folder') moveFolder(z.group, drag.id, z.id);
          else moveInStack(z.group, drag.id, z.id);
          setDrag(null);
          setDropAt(null);
        }}
        className={`border-t-2 ${dropHere ? 'border-sky-400' : 'border-transparent'}`}
      >
        <div
          draggable={draggable}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'copyMove';
            e.dataTransfer.setData('text/plain', z.id);
            setDrag({ kind: 'zone', id: z.id, from: z.group });
          }}
          onDragEnd={() => {
            setDrag(null);
            setDropAt(null);
          }}
          className={`${rowClass(selected || picked, zs.visible)} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${drag?.id === z.id ? 'opacity-40' : ''}`}
        >
          {draggable && <GripVertical className="w-3 h-3 -mx-1 shrink-0 text-slate-600" aria-hidden />}
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
            onChange={(e) => recolorZone(z, e.target.value)}
            className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5 shrink-0"
            title="Warna layer"
            aria-label={`Warna ${z.name}`}
          />
          <button
            type="button"
            onClick={(e) => clickZone(z, e)}
            aria-expanded={selected}
            aria-pressed={picked}
            className="flex-1 min-w-0 text-left truncate hover:text-white"
            title="Klik untuk mengubah posisi, ukuran, bentuk, dan jahitan layer ini. Ctrl+klik / Shift+klik memilih beberapa layer"
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
    // place in the group's stack (objects and patterns together): the arrows can pass objects
    const stack = stackOf(g);
    const k = stack.findIndex((e) => e.id === l.id);
    const others = (['shirt', 'shorts', 'socks', 'details'] as KitCategory[]).filter((x) => x !== g && inGroup(l, x));
    const dropHere = dropAt?.g === g && dropAt.before === l.id;
    const name = l.name ?? 'Pola';
    // patterns from anywhere (moved / copied over this one), and layers of this group (they go right above it)
    const acceptsDrop = () => !!drag && drag.id !== l.id && (drag.kind === 'pattern' || drag.from === g);
    return (
      <div
        key={l.id}
        data-layer-anchor={`${l.id}-${g}`}
        onDragOver={(e) => {
          if (!acceptsDrop()) return;
          dropEffect(e);
          e.stopPropagation();
          if (!dropHere) setDropAt({ g, before: l.id });
        }}
        onDrop={(e) => {
          if (!acceptsDrop() || !drag) return;
          e.preventDefault();
          e.stopPropagation();
          const copy = e.ctrlKey || e.altKey;
          if (drag.kind === 'pattern' && (copy || drag.from !== g)) return dropPattern(g, l.id, copy);
          if (drag.kind === 'folder') moveFolder(g, drag.id, l.id);
          else moveInStack(g, drag.id, l.id);
          setDrag(null);
          setDropAt(null);
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
              disabled={k <= 0}
              onClick={() => stepInStack(g, l.id, 'up')}
              className="text-slate-500 hover:text-white disabled:opacity-30"
              title="Naikkan (lebih depan)"
              aria-label="Naikkan (lebih depan)"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={k < 0 || k >= stack.length - 1}
              onClick={() => stepInStack(g, l.id, 'down')}
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

        {!isMask && (
          <div className="space-y-1.5 text-[11px] text-slate-400">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer" title="Warna layer memudar ke warna akhir (atau transparan) di dalam bentuknya; ikut ditirus, diulang, dan digeser bersama bentuknya">
              <input
                type="checkbox"
                checked={!!zs.gradient}
                onChange={(e) => onUpdateZone(z.id, { gradient: e.target.checked ? { angle: 0 } : undefined })}
                className="accent-sky-500"
              />
              Isi gradasi
            </label>
            {zs.gradient && (
              <div className="space-y-1.5 pl-5">
                <div className="flex items-center gap-2">
                  <span className="w-20">Warna akhir</span>
                  <input
                    type="color"
                    value={(zs.gradient.color2 ?? zs.color).slice(0, 7)}
                    disabled={zs.gradient.color2 === undefined}
                    onChange={(e) => onUpdateZone(z.id, { gradient: { ...zs.gradient!, color2: e.target.value } })}
                    className="w-8 h-7 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5 disabled:opacity-40"
                    aria-label="Warna akhir gradasi"
                  />
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={zs.gradient.color2 === undefined}
                      onChange={(e) => onUpdateZone(z.id, { gradient: { ...zs.gradient!, color2: e.target.checked ? undefined : '#000000' } })}
                      className="accent-sky-500"
                    />
                    Pudar ke transparan
                  </label>
                </div>
                <div className="flex gap-1">
                  {([false, true] as const).map((radial) => (
                    <button
                      key={String(radial)}
                      type="button"
                      onClick={() => onUpdateZone(z.id, { gradient: { ...zs.gradient!, radial } })}
                      aria-pressed={!!zs.gradient!.radial === radial}
                      className={`flex-1 py-1 rounded-md border ${!!zs.gradient!.radial === radial ? 'bg-sky-600/30 border-sky-500 text-white' : 'border-slate-700 hover:text-white'}`}
                    >
                      {radial ? 'Melingkar' : 'Lurus'}
                    </button>
                  ))}
                </div>
                {!zs.gradient.radial && (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Slider label="Arah gradasi" value={zs.gradient.angle} min={-180} max={180} unit="°" onChange={(v) => onUpdateZone(z.id, { gradient: { ...zs.gradient!, angle: v } })} />
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateZone(z.id, { gradient: { ...zs.gradient!, angle: zs.gradient!.angle > 0 ? zs.gradient!.angle - 180 : zs.gradient!.angle + 180 } })}
                      className="text-[10px] px-2 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Balik arah
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="text-[11px] font-semibold text-slate-300">Posisi</div>
          <AlignRow
            onAlign={(where) => {
              const drawn = bakeZone(z, zs, true).polygons;
              const part = PART_MAP[z.part];
              if (!drawn?.length || !part) return;
              const o = polygonsBox(drawn);
              const p = polygonsBox(partPolygons(part));
              const shift =
                where === 'left' ? p.x - o.x : where === 'right' ? p.x + p.width - (o.x + o.width) : p.x + p.width / 2 - (o.x + o.width / 2);
              onUpdateZone(z.id, { dx: Math.round((zs.dx ?? 0) + shift) });
            }}
          />
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
            <span className="flex items-center gap-1">
              Pakai warna asli gambar
              <InfoTip text="Matikan agar layer diwarnai dengan warna zona (cocok untuk layer satu warna)." />
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
            {(edge === 'rounded' || edge === 'pointed') && (
              <div className="flex items-center gap-2">
                {edge === 'rounded' ? (
                  <span className="text-[11px] text-slate-400" title="Sudut yang dibulatkan, dilihat dari bentuk aslinya (sebelum diputar)">Sudut tumpul</span>
                ) : (
                  <span className="text-[11px] text-slate-400" title="Sudut yang dipotong ke arah ujung runcing, dilihat dari bentuk aslinya (sebelum diputar)">Sudut runcing</span>
                )}
                <div className="grid grid-cols-2 gap-0.5 p-0.5 rounded-md border border-slate-700/60">
                  {[0, 1, 3, 2].map((i) => {
                    const c = CORNERS[i];
                    const on = (zs.edgeCorners ?? [true, true, true, true])[i];
                    return (
                      <button
                        key={c.label}
                        type="button"
                        title={c.label}
                        aria-label={c.label}
                        aria-pressed={on}
                        onClick={() => {
                          const next = [...(zs.edgeCorners ?? [true, true, true, true])] as [boolean, boolean, boolean, boolean];
                          next[i] = !next[i];
                          onUpdateZone(z.id, { edgeCorners: next });
                        }}
                        className={`w-5 h-5 border-2 transition-colors ${c.cls} ${
                          on ? 'border-sky-400 bg-sky-600/25' : 'border-slate-600 bg-slate-800/70 hover:border-slate-400'
                        }`}
                      />
                    );
                  })}
                </div>
                <span className="text-[10px] text-slate-500">klik sudut untuk on/off</span>
              </div>
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
        {zoneParts(z).some((p) => p === 'leftSleeve' || p === 'rightSleeve') && (
          <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer" title="Di lengan: layer ditekuk mengikuti potongan lengan dan bahu, jadi garis lurus ikut melengkung dan menyempit ke leher">
            <input
              type="checkbox"
              checked={zs.followShoulder === true}
              onChange={(e) => onUpdateZone(z.id, { followShoulder: e.target.checked })}
              className="accent-sky-500"
            />
            Ikuti bentuk bahu
          </label>
        )}

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

        {(() => {
          // the chosen template is a file of library/templates: it can be renamed or deleted here
          const entry = library.templates.find((x) => x.id === template.id && (x.libFile || x.psdFile));
          if (!entry) return null;
          const run = async (job: () => Promise<string | null>) => {
            setLibBusy(true);
            setLibMsg(null);
            const err = await job();
            setLibBusy(false);
            if (err) setLibMsg(err);
            else setRenameTo(null);
          };
          if (renameTo !== null) {
            return (
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (renameTo.trim()) run(() => onRenameLibraryTemplate(entry, renameTo.trim()));
                }}
              >
                <input
                  autoFocus
                  value={renameTo}
                  onChange={(e) => setRenameTo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setRenameTo(null)}
                  maxLength={80}
                  aria-label="Nama baru template"
                  className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  disabled={libBusy || !renameTo.trim()}
                  className="text-[11px] px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold disabled:opacity-50"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setRenameTo(null)}
                  className="text-[11px] px-2 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Batal
                </button>
              </form>
            );
          }
          return (
            <div className="flex items-center gap-1.5">
              <span className="flex-1 min-w-0 truncate text-[10px] text-slate-500" title={entry.psdFile ?? `templates/${entry.libFile}`}>
                {entry.psdFile ?? `templates/${entry.libFile}`}
              </span>
              <button
                type="button"
                disabled={libBusy}
                onClick={() => {
                  setLibMsg(null);
                  setRenameTo(entry.name);
                }}
                className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center gap-1 disabled:opacity-50"
                title={entry.psdFile ? 'Ganti nama file PSD ini' : 'Ganti nama template ini'}
              >
                <Pencil className="w-3 h-3" />
                Ganti nama
              </button>
              <button
                type="button"
                disabled={libBusy}
                onClick={() => {
                  const ask = t(`Hapus template "${entry.name}" dari library? File-nya ikut terhapus dan tidak bisa dikembalikan.`);
                  // the open kit draws its layers from the template's files
                  const inUse = entry.zones.some((z) => z.mask)
                    ? '\n\n' + t('Kit yang sedang terbuka memakai gambar layer dari template ini: setelah aplikasi dibuka ulang, layer itu kosong.')
                    : '';
                  if (window.confirm(ask + inUse)) {
                    run(() => onDeleteLibraryTemplate(entry));
                  }
                }}
                className="text-[10px] px-1.5 py-0.5 rounded border border-rose-800/70 text-rose-300 hover:bg-rose-950/50 flex items-center gap-1 disabled:opacity-50"
                title="Hapus file template ini dari library"
              >
                <Trash2 className="w-3 h-3" />
                Hapus file
              </button>
            </div>
          );
        })()}
        {libMsg && <p className="text-[10px] text-rose-300">{libMsg}</p>}

        <ImportButton onImportDesign={onOpenImportDesign} onPickPsd={onPickPsd} onImportPng={onOpenPngImport} hasImportedDesign={hasImportedDesign} />

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
        info="Yang paling atas di daftar tampil paling depan. Klik + Pola atau + Objek di grup untuk menambah. Seret pola atau objek ke atas atau ke bawah untuk mengubah urutannya (pola juga bisa dinaikkan ke atas objek), atau ke grup lain untuk memindahkannya; tahan Ctrl saat melepas untuk menyalinnya."
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
                        // one layer name per line: translated one by one (the page translator sees the whole title)
                        title={zs.map((z) => t(z.name)).join('\n')}
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

        {/* Several layers picked (Ctrl / Shift click): group them or merge them */}
        {selectedZoneIds.length > 1 &&
          (() => {
            const usable = pickedLayers();
            const why = usable.length ? '' : 'Pilih layer dari satu grup saja (Baju, Celana, Kaus kaki, atau Aksesoris), bukan layer Base';
            return (
              <div className="sticky top-0 z-10 flex items-center gap-1.5 rounded-lg border border-sky-600/50 bg-sky-950/80 backdrop-blur px-2 py-1.5">
                <span className="flex-1 min-w-0 truncate text-[11px] font-semibold text-sky-100">
                  {selectedZoneIds.length} dipilih
                </span>
                <button
                  type="button"
                  onClick={groupSelected}
                  disabled={!usable.length}
                  title={why || 'Masukkan ke satu grup (Ctrl+G)'}
                  className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                >
                  <Group className="w-3.5 h-3.5" />
                  Group
                </button>
                <button
                  type="button"
                  onClick={mergeSelected}
                  disabled={usable.length < 2}
                  title={why || 'Gabungkan jadi satu layer (Ctrl+E). Warna sama: tetap bentuk yang bisa diedit; warna beda: jadi layer gambar'}
                  className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                >
                  <Merge className="w-3.5 h-3.5" />
                  Merge
                </button>
                <button
                  type="button"
                  onClick={() => onSelectZone(null)}
                  title="Batalkan pilihan"
                  aria-label="Batalkan pilihan"
                  className="h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })()}

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
                  {/* Top of the list = top of the stack: objects / template layers with the patterns placed above
                      them, then the patterns under all of them (while searching: the matches, objects first) */}
                  {q ? (
                    <>
                      {[...main].reverse().map(renderZoneRow)}
                      {groupPatterns.map((l) => renderPatternRow(l, g))}
                    </>
                  ) : (
                    (() => {
                      // a folder's row comes right above its first member; the members are indented under it
                      const stack = stackOf(g);
                      let prev: string | undefined;
                      return stack.map((e) => {
                        const fid = folderOf(e);
                        const head =
                          fid && fid !== prev
                            ? renderFolderRow(
                                fid,
                                g,
                                stack.filter((x) => x.kind === 'zone' && folderOf(x) === fid).map((x) => zoneById(x.id)!),
                                stack.find((x) => folderOf(x) === fid)!.id
                              )
                            : null;
                        prev = fid;
                        if (fid && closedFolders.has(fid)) return head;
                        const z = e.kind === 'zone' ? main.find((x) => x.id === e.id) : undefined;
                        const l = e.kind === 'pattern' ? patterns.find((x) => x.id === e.id) : undefined;
                        const row = z ? renderZoneRow(z) : l ? renderPatternRow(l, g) : null;
                        return (
                          <React.Fragment key={`${e.kind}-${e.id}`}>
                            {head}
                            {fid ? <div className="ml-2 pl-1.5 border-l border-slate-700/70">{row}</div> : row}
                          </React.Fragment>
                        );
                      });
                    })()
                  )}

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
              <div key={key} className="bg-slate-900/50 border border-slate-800 rounded-md px-2 py-1.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Spline className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-[11px] text-slate-200">{s.name ?? `Garis jahit ${i + 1}`}</span>
                  <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{part?.name}</span>
                  <button
                    type="button"
                    onClick={() => onDeleteSeam(key)}
                    className="text-slate-500 hover:text-rose-400"
                    title="Hapus garis jahit"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 pl-5">
                  <select
                    value={s.style ?? ''}
                    onChange={(e) => onSetSeamStyle(key, (e.target.value || undefined) as KitSeamDef['style'])}
                    className="text-[10px] bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-300 max-w-[76px]"
                    title="Gaya jahitan garis ini. Umum = ikut gaya di bawah."
                  >
                    <option value="">Umum</option>
                    {SEAM_STYLES.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
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
                    onClick={() => onToggleEditSeam(key)}
                    aria-pressed={editSeam === key}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      editSeam === key ? 'bg-pink-600/30 border-pink-500 text-pink-100' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                    title="Ubah bentuk di canvas 2D: seret titik, klik + di tengah sisi untuk menambah titik, klik kanan titik untuk menghapusnya"
                  >
                    {editSeam === key ? 'Selesai' : 'Edit titik'}
                  </button>
                </div>
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
            <div className="grid grid-cols-3 gap-1.5">
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
