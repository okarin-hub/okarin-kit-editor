'use client';

import { DEFAULT_FABRIC_CONFIG } from '@/components/ui/FabricLayersPanel';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type Konva from 'konva';
import Navbar from '@/components/ui/Navbar';
import { ToolRail, ToolId } from '@/components/ui/ToolRail';
import { useI18n } from '@/i18n/I18nProvider';
import { HelpDialog, HelpKind } from '@/components/ui/HelpDialogs';
import Toolbar, { WorkspaceViewMode } from '@/components/ui/Toolbar';
import PropertiesPanel from '@/components/ui/PropertiesPanel';
import LogosPanel from '@/components/ui/LogosPanel';
import MarkingsPanel from '@/components/ui/MarkingsPanel';
import ExportModal from '@/components/ui/ExportModal';
import SaveProjectsModal from '@/components/ui/SaveProjectsModal';
import ImportDesignModal from '@/components/ui/ImportDesignModal';
import PatternBrushPanel from '@/components/ui/PatternBrushPanel';
import TemplatePanel, { NewZoneKind } from '@/components/ui/TemplatePanel';
import KitCanvasWrapper from '@/components/canvas/KitCanvasWrapper';
import Kit3DViewerWrapper from '@/components/preview3d/Kit3DViewerWrapper';
import {
  KitPartId,
  KitPartConfig,
  CanvasViewState,
  KitGraphicItem,
  PlayerMarkingsConfig,
  FabricConfig,
  PatternLayer,
  BaseTexture,
  PatternBrushState,
  TemplateBundle,
  KitTemplate,
  KitSeamDef,
  TemplateZoneState,
  SeamConfig,
  KitZoneDef,
  Pt,
} from '@/types/kit';
import { KitProject, ExportSettings, ExportTextureResolution, ExportDdsFormat } from '@/types/project';
import { DEFAULT_PART_CONFIG, DEFAULT_CREDIT_CONFIG, PRESET_KITS, KitPreset } from '@/constants/presets';
import { PES_2021_PARTS, PART_MAP, CANVAS_TEXTURE_SIZE, partsForSleeveShape } from '@/constants/pes2021Parts';
import { mergeZones } from '@/utils/layerMerge';
import { bakeZone, moveZoneToPart, simplifyPath, zoneBox, zoneHitTest, zoneMatrix } from '@/utils/zoneGeometry';
import { remapErase } from '@/utils/templateRenderer';
import DrawBar from '@/components/ui/DrawBar';
import ImportPngModal from '@/components/ui/ImportPngModal';
import KitConfigModal from '@/components/ui/KitConfigModal';
import FontsetModal from '@/components/ui/FontsetModal';
import PhotoPatternModal from '@/components/ui/PhotoPatternModal';
import { newPatternLayer } from '@/components/ui/PatternLayersPanel';
import { PATTERN_LABEL } from '@/constants/patterns';
import { DEFAULT_KIT_CONFIG, parseKitConfig } from '@/utils/kitConfig';
import {
  saveAutosaveState,
  loadAutosaveState,
  saveBaseTextureState,
  loadBaseTextureState,
  savePatternMaskState,
  loadPatternMaskState,
  saveTemplateState,
  loadTemplateState,
  getLocalProjectsList,
  downloadPeskitFile,
  saveKitConfigText,
  loadKitConfigText,
  saveFontsetSettings,
  loadFontsetSettings,
} from '@/services/storageService';
import type { FontsetSettings } from '@/components/ui/FontsetModal';
import { ColorPopover } from '@/components/ui/ColorPopover';
import { generateKitTexture, generateShowcaseCard, renderKitCanvas, preloadImage } from '@/utils/textureGenerator';
import { encodeDDS } from '@/utils/ddsEncoder';
import { encodeFtex } from '@/utils/ftexEncoder';
import { migrateLegacyPatterns } from '@/utils/patternRenderer';
import { useKitHistory, KitSnapshot } from '@/hooks/useKitHistory';
import { useAssetLibrary } from '@/hooks/useAssetLibrary';
import { subscribeAssets } from '@/utils/imageCache';
import {
  BUILTIN_TEMPLATES,
  DEFAULT_TEMPLATE_STATE,
  buildTemplateState,
} from '@/constants/templates';
import { Shirt, Shield, Hash, Type, LayoutGrid, LayoutTemplate } from 'lucide-react';

/** Shortest time between two rebuilds of the 3D texture while something keeps changing. */
const TEXTURE_3D_MIN_MS = 150;

export default function Home() {
  const [partsConfig, setPartsConfig] = useState<
    Record<KitPartId, KitPartConfig>
  >(DEFAULT_PART_CONFIG);

  const [selectedPresetId, setSelectedPresetId] = useState<string>('classic-red');

  const [viewState, setViewState] = useState<CanvasViewState>({
    zoom: 1,
    panX: 0,
    panY: 0,
    activePartId: 'all',
    showWireframe: true,
    showPartLabels: true,
    showOriginalTemplate: false,
    templateOpacity: 0.75,
    wireframeOpacity: 0.65,
    wireframeColor: '#ffffff',
  });

  const [hoveredPartId, setHoveredPartId] = useState<KitPartId | null>(null);

  // Active workspace view mode: '2d' | '3d' | 'split'
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('split');

  // Real-time texture data URL for 3D model
  const [texture3D, setTexture3D] = useState<HTMLCanvasElement | null>(null);

  // Realistic athletic fabric texture configuration
  const [fabricConfig, setFabricConfig] = useState<FabricConfig>(DEFAULT_FABRIC_CONFIG);
  const [fontsetSettings, setFontsetSettings] = useState<FontsetSettings | null>(null);

  // Active tab on right sidebar: 'properties' | 'logos' | 'markings'
  const [rightTab, setRightTab] = useState<'properties' | 'kitTemplate' | 'template' | 'logos' | 'markings'>('template');

  // Selected graphic item for transform/delete
  const [selectedGraphicId, setSelectedGraphicId] = useState<string | null>(null);

  // Modals state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isKitConfigOpen, setIsKitConfigOpen] = useState(false);
  const [isFontsetOpen, setIsFontsetOpen] = useState(false);
  const [kitConfigText, setKitConfigText] = useState<string>(DEFAULT_KIT_CONFIG);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [helpKind, setHelpKind] = useState<HelpKind | null>(null);

  // Imported finished design (texture PNG/JPG/DDS) shown on the canvas
  const [baseTexture, setBaseTexture] = useState<BaseTexture | null>(null);
  // the imported design only counts while it is switched on in the base layer choice
  const activeBase = baseTexture && baseTexture.enabled !== false ? baseTexture : null;

  // Library folders (logos / patterns / fonts) + installed fonts
  const library = useAssetLibrary();
  const [assetTick, setAssetTick] = useState(0);
  useEffect(() => subscribeAssets(() => setAssetTick((t) => t + 1)), []);

  // Pattern eraser mask (PNG data URL) + brush tool state
  const [patternMask, setPatternMask] = useState<string | null>(null);
  const [brush, setBrush] = useState<PatternBrushState>({ active: false, size: 40, mode: 'erase' });

  // Active template (colourable zones + seams) and the colour / visibility of each zone
  const [tplBundle, setTplBundle] = useState<TemplateBundle>({
    def: BUILTIN_TEMPLATES[0],
    state: DEFAULT_TEMPLATE_STATE,
  });
  const [savedCount, setSavedCount] = useState(0);

  // Graphic items (Logos, badges, sponsors)
  const [graphicItems, setGraphicItems] = useState<KitGraphicItem[]>([]);

  // Player markings state (Nama dan Nomor Punggung)
  const [markings, setMarkings] = useState<PlayerMarkingsConfig>({
    showPreview: true,
    includeInExport: false, // Default: false (PES 2021 reads font from separate game file)
    playerName: 'RONALDO',
    playerNumber: '7',
    shortsNumber: '7',
    fontFamily: "'Impact', 'Arial Black', sans-serif",
    numberColor: '#ffffff',
    numberStrokeColor: '#1e293b',
    numberStrokeWidth: 2,
    nameColor: '#ffffff',
  });

  // the markings with the config values that place them (NameY, BackNumberSize ...)
  const markingsView = useMemo(
    () => ({
      ...markings,
      config: parseKitConfig(kitConfigText),
      fontsetFiles: markings.fontset ? library.fontsets.find((f) => f.name === markings.fontset)?.files : undefined,
    }),
    [markings, kitConfigText, library.fontsets]
  );
  // the editor's own views also show the sleeve badge markers; exports use markingsView
  const markingsPreview = useMemo(() => ({ ...markingsView, preview: true }), [markingsView]);

  const [isExportingClean, setIsExportingClean] = useState<boolean>(false);

  // Undo / Redo over parts, graphics and markings
  const applySnapshot = useCallback((snap: KitSnapshot) => {
    // the snapshot's own object: a copy would look like a new edit to the history and wipe the redo steps
    setPartsConfig(snap.partsConfig);
    setGraphicItems(snap.graphicItems);
    setMarkings(snap.markings);
    setBaseTexture(snap.baseTexture);
    setPatternMask(snap.patternMask);
    setTplBundle(snap.template);
    setKitConfigText(snap.kitConfig);
    setSelectedGraphicId((prev) =>
      prev && snap.graphicItems.some((g) => g.id === prev) ? prev : null
    );
  }, []);

  const { undo, redo, canUndo, canRedo } = useKitHistory(
    { partsConfig, graphicItems, markings, baseTexture, patternMask, template: tplBundle, kitConfig: kitConfigText },
    applySnapshot
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasDisplaySize, setCanvasDisplaySize] = useState<number>(600);

  // Initial load: restore autosaved progress, count saved kits, preload images
  useEffect(() => {
    const autosaved = loadAutosaveState();
    if (autosaved) {
      if (autosaved.partsConfig) setPartsConfig({ ...DEFAULT_PART_CONFIG, ...autosaved.partsConfig });
      if (autosaved.graphicItems) setGraphicItems(autosaved.graphicItems);
      if (autosaved.markings) setMarkings(autosaved.markings);
      if (autosaved.fabricConfig) setFabricConfig(autosaved.fabricConfig);
    }
    const savedFontset = loadFontsetSettings();
    if (savedFontset) setFontsetSettings(savedFontset);
    const savedTpl = loadTemplateState();
    if (savedTpl) {
      // Built-in templates are refreshed from the current definitions (zone positions get
      // improved over time); the user's zone colours / visibility are kept where ids still match.
      const fresh =
        savedTpl.def.source === 'builtin' && !savedTpl.def.modified
          ? BUILTIN_TEMPLATES.find((t) => t.id === savedTpl.def.id)
          : undefined;
      const def = fresh ?? savedTpl.def;
      const zones: TemplateBundle['state']['zones'] = {};
      def.zones.forEach((z) => {
        zones[z.id] = savedTpl.state.zones[z.id] ?? { color: z.defaultColor, visible: z.defaultVisible };
      });
      const oldSeams = savedTpl.state.seams;
      const isOldDefault =
        (oldSeams?.style as string) !== 'natural' && oldSeams?.opacity === 0.4 && oldSeams?.width === 1.4;
      setTplBundle({
        def,
        state: {
          ...savedTpl.state,
          zones,
          seams: !oldSeams || isOldDefault ? { ...DEFAULT_TEMPLATE_STATE.seams } : oldSeams,
        },
      });
    }
    const savedMask = loadPatternMaskState();
    if (savedMask) {
      preloadImage(savedMask).then(() => setPatternMask(savedMask));
    }
    const savedBase = loadBaseTextureState();
    if (savedBase) {
      preloadImage(savedBase.src).then(() => setBaseTexture(savedBase));
    }
    setSavedCount(getLocalProjectsList().length);

  }, []);

  // Autosave periodically
  useEffect(() => {
    const timer = setTimeout(() => {
      saveAutosaveState({
        partsConfig,
        graphicItems,
        markings,
        fabricConfig,
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [partsConfig, graphicItems, markings, fabricConfig]);

  useEffect(() => {
    const timer = setTimeout(() => saveFontsetSettings(fontsetSettings), 800);
    return () => clearTimeout(timer);
  }, [fontsetSettings]);

  // Persist the imported design separately (it can be large)
  useEffect(() => {
    const timer = setTimeout(() => saveBaseTextureState(baseTexture), 800);
    return () => clearTimeout(timer);
  }, [baseTexture]);

  useEffect(() => {
    const timer = setTimeout(() => savePatternMaskState(patternMask), 800);
    return () => clearTimeout(timer);
  }, [patternMask]);

  useEffect(() => {
    const timer = setTimeout(() => saveTemplateState(tplBundle), 600);
    return () => clearTimeout(timer);
  }, [tplBundle]);

  // Patterns used to live in each part's own settings (presets, older autosaves and projects still do):
  // move them into pattern layers as soon as they show up.
  useEffect(() => {
    const migrated = migrateLegacyPatterns(partsConfig, tplBundle.state.patterns);
    if (!migrated) return;
    setPartsConfig(migrated.partsConfig);
    setTplBundle((prev) => ({ ...prev, state: { ...prev.state, patterns: migrated.patterns } }));
  }, [partsConfig, tplBundle.state.patterns]);

  const handleChangeSleeveShape = useCallback((sleeveShape: 'yoke' | 'short') => {
    setTplBundle((prev) => ({ ...prev, state: { ...prev.state, sleeveShape } }));
  }, []);

  const handleChangeBackground = useCallback((background: string | undefined) => {
    setTplBundle((prev) => ({ ...prev, state: { ...prev.state, background } }));
  }, []);

  const handleChangePatterns = useCallback((patterns: PatternLayer[]) => {
    setTplBundle((prev) => ({ ...prev, state: { ...prev.state, patterns } }));
  }, []);

  // Template handlers
  const [selectedZoneId, setSelectedZoneIdRaw] = useState<string | null>(null);
  // more layers picked with Ctrl / Shift in the layer list (the main one stays selectedZoneId)
  const [extraZoneIds, setExtraZoneIds] = useState<string[]>([]);
  const [editPoints, setEditPoints] = useState(false);
  const setSelectedZoneId = useCallback((id: string | null) => {
    setSelectedZoneIdRaw(id);
    setExtraZoneIds([]);
    setEditPoints(false);
  }, []);
  /** Several layers at once; the last one is the main selection. */
  const handleSelectZones = useCallback((ids: string[]) => {
    setSelectedZoneIdRaw(ids.length ? ids[ids.length - 1] : null);
    setExtraZoneIds(ids.slice(0, -1));
    setEditPoints(false);
  }, []);

  // template id of a PSD just added with "Tambah PSD": selected as soon as it has been read
  const [pendingPsdId, setPendingPsdId] = useState<string | null>(null);
  const [isPngImportOpen, setIsPngImportOpen] = useState(false);
  const [isPhotoPatternOpen, setIsPhotoPatternOpen] = useState(false);
  const [pngImportFile, setPngImportFile] = useState<File | null>(null);

  // Drawing a new layer on the 2D canvas
  const [drawTool, setDrawTool] = useState<'free' | 'poly' | 'stitch' | 'stitchFree' | null>(null);
  const [drawCurve, setDrawCurve] = useState(false);
  const [drawPts, setDrawPts] = useState<Pt[]>([]);
  const preloadTemplateMasks = useCallback((t: KitTemplate) => {
    t.zones.forEach((z) => z.mask && preloadImage(z.mask));
  }, []);

  const handleSelectTemplate = useCallback(
    (t: KitTemplate) => {
      preloadTemplateMasks(t);
      setSelectedZoneId(null);
      setEditSeam(null);
      setTplBundle((prev) => ({ def: t, state: { ...buildTemplateState(t, prev.state.seams), patterns: prev.state.patterns, background: prev.state.background, sleeveShape: prev.state.sleeveShape } }));
    },
    [preloadTemplateMasks]
  );

  const handleUpdateZone = useCallback((zoneId: string, update: Partial<TemplateZoneState>) => {
    setTplBundle((prev) => {
      const zones = { ...prev.state.zones };
      const set = (id: string, patch: Partial<TemplateZoneState>) => {
        zones[id] = { ...(zones[id] ?? { color: '#ffffff', visible: true }), ...patch };
      };
      set(zoneId, update);
      const def = prev.def.zones.find((z) => z.id === zoneId);
      // a colour slot shares its colour; showing a variant option shows its zones and hides the other options
      if (def?.slot && update.color) {
        for (const z of prev.def.zones) if (z.slot === def.slot && z.id !== zoneId) set(z.id, { color: update.color });
      }
      if (def?.variant && update.visible === true) {
        for (const z of prev.def.zones) {
          if (z.id === zoneId || z.variant?.set !== def.variant.set) continue;
          set(z.id, { visible: z.variant.option === def.variant.option });
        }
      }
      return { ...prev, state: { ...prev.state, zones } };
    });
  }, []);

  const handleUpdateSeams = useCallback((update: Partial<SeamConfig>) => {
    setTplBundle((prev) => ({
      ...prev,
      state: { ...prev.state, seams: { ...prev.state.seams, ...update } },
    }));
  }, []);

  const handleResetZone = useCallback((zoneId: string) => {
    setTplBundle((prev) => {
      const z = prev.def.zones.find((x) => x.id === zoneId);
      if (!z) return prev;
      const cur = prev.state.zones[zoneId];
      return {
        ...prev,
        state: {
          ...prev.state,
          zones: {
            ...prev.state.zones,
            [zoneId]: { color: cur?.color ?? z.defaultColor, visible: cur?.visible ?? true, ...(z.initial ?? {}) },
          },
        },
      };
    });
  }, []);

  const handleUpdateZoneDef = useCallback((zoneId: string, patch: Partial<KitZoneDef>) => {
    setTplBundle((prev) => ({
      ...prev,
      def: {
        ...prev.def,
        modified: true,
        zones: prev.def.zones.map((z) =>
          z.id === zoneId
            ? { ...z, ...patch, ...(patch.part ? { group: PART_MAP[patch.part].category } : {}) }
            : z
        ),
      },
    }));
  }, []);

  // Layer groups (folders of the layer list): the members carry the group's id
  const handleGroupZones = useCallback((ids: string[]) => {
    const id = `lg-${Date.now().toString(36)}`;
    setTplBundle((prev) => {
      const used = new Set(prev.def.zones.map((z) => z.layerGroup).filter(Boolean));
      const groups = (prev.def.layerGroups ?? []).filter((g) => used.has(g.id));
      const name = `Grup ${groups.length + 1}`;
      return {
        ...prev,
        def: {
          ...prev.def,
          modified: true,
          layerGroups: [...groups, { id, name }],
          zones: prev.def.zones.map((z) => (ids.includes(z.id) ? { ...z, layerGroup: id } : z)),
        },
      };
    });
  }, []);

  const handleUngroup = useCallback((groupId: string) => {
    setTplBundle((prev) => ({
      ...prev,
      def: {
        ...prev.def,
        modified: true,
        layerGroups: (prev.def.layerGroups ?? []).filter((g) => g.id !== groupId),
        zones: prev.def.zones.map((z) => {
          if (z.layerGroup !== groupId) return z;
          const out = { ...z };
          delete out.layerGroup;
          return out;
        }),
      },
    }));
  }, []);

  const handleRenameGroup = useCallback((groupId: string, name: string) => {
    setTplBundle((prev) => ({
      ...prev,
      def: {
        ...prev.def,
        modified: true,
        layerGroups: (prev.def.layerGroups ?? []).map((g) => (g.id === groupId ? { ...g, name: name.slice(0, 60) } : g)),
      },
    }));
  }, []);

  // A copy of the folder and its layers (with the patterns placed above them), shifted like a duplicated layer and picked
  const handleDuplicateGroup = useCallback((groupId: string) => {
    const stamp = Date.now().toString(36);
    const newGroup = `lg-${stamp}`;
    const members = tplBundle.def.zones.filter((z) => z.layerGroup === groupId);
    if (!members.length) return;
    const newIds = new Map(members.map((z, i) => [z.id, `custom-${stamp}-${i}`]));
    setTplBundle((prev) => {
      const zones = { ...prev.state.zones };
      const copies = members.map((z) => {
        const id = newIds.get(z.id)!;
        const st = prev.state.zones[z.id] ?? { color: z.defaultColor, visible: true };
        zones[id] = { ...st, dx: (st.dx ?? 0) + 24, dy: (st.dy ?? 0) + 24 };
        return { ...z, id, layerGroup: newGroup };
      });
      const name = prev.def.layerGroups?.find((g) => g.id === groupId)?.name ?? 'Grup';
      const patterns = prev.state.patterns?.flatMap((l, i) =>
        l.above && newIds.has(l.above) ? [l, { ...l, id: `${l.id}-${stamp}-${i}`, above: newIds.get(l.above) }] : [l]
      );
      return {
        def: {
          ...prev.def,
          modified: true,
          layerGroups: [...(prev.def.layerGroups ?? []), { id: newGroup, name: `${name} (salinan)`.slice(0, 60) }],
          zones: [...prev.def.zones, ...copies],
        },
        state: { ...prev.state, zones, patterns },
      };
    });
    handleSelectZones([...newIds.values()]);
  }, [tplBundle, handleSelectZones]);

  // Merge layers into one (shape when they share colour / parts, else an image layer), in the top one's place
  const handleMergeZones = useCallback((ids: string[]) => {
    const newId = `custom-${Date.now().toString(36)}`;
    const res = mergeZones(tplBundle.def, tplBundle.state, ids, newId, partsForSleeveShape(tplBundle.state.sleeveShape).map);
    if (!res) return;
    if (res.zone.mask) preloadImage(res.zone.mask);
    setTplBundle((prev) => {
      const pick = new Set(ids);
      if (!prev.def.zones.some((z) => pick.has(z.id))) return prev;
      const topId = [...prev.def.zones].reverse().find((z) => pick.has(z.id))!.id;
      const zones = prev.def.zones.flatMap((z) => (z.id === topId ? [res.zone] : pick.has(z.id) ? [] : [z]));
      const zoneStates = { ...prev.state.zones };
      ids.forEach((id) => delete zoneStates[id]);
      zoneStates[newId] = res.zs;
      // patterns that sat above one of the merged layers sit above the merged one
      const patterns = prev.state.patterns?.map((l) => (l.above && pick.has(l.above) ? { ...l, above: newId } : l));
      return { def: { ...prev.def, modified: true, zones }, state: { ...prev.state, zones: zoneStates, patterns } };
    });
    handleSelectZones([newId]);
  }, [tplBundle, handleSelectZones]);

  const handleAddZone = useCallback((kind: NewZoneKind, part: KitPartId) => {
    const b = PART_MAP[part].bounds;
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const id = `custom-${Date.now().toString(36)}`;
    const names: Record<NewZoneKind, string> = {
      strip: 'Strip baru',
      panel: 'Panel baru',
      ellipse: 'Elips baru',
      triangle: 'Segitiga baru',
    };
    const size = Math.min(b.width, b.height);
    const shape: Partial<KitZoneDef> =
      kind === 'strip'
        ? { rects: [[cx - Math.max(30, b.width * 0.35), cy - 9, Math.max(60, b.width * 0.7), 18]] }
        : kind === 'panel'
        ? { rects: [[cx - b.width * 0.2, cy - b.height * 0.15, b.width * 0.4, b.height * 0.3]] }
        : kind === 'ellipse'
        ? { ellipses: [[cx - size * 0.15, cy - size * 0.15, size * 0.3, size * 0.3]] }
        : {
            polygons: [
              [[cx, cy - size * 0.18], [cx + size * 0.18, cy + size * 0.14], [cx - size * 0.18, cy + size * 0.14]] as Pt[],
            ],
          };
    const zone: KitZoneDef = {
      id,
      name: names[kind],
      part,
      group: PART_MAP[part].category,
      defaultColor: '#e2e8f0',
      defaultVisible: true,
      ...shape,
    };
    setTplBundle((prev) => ({
      def: { ...prev.def, modified: true, zones: [...prev.def.zones, zone] },
      state: { ...prev.state, zones: { ...prev.state.zones, [id]: { color: '#e2e8f0', visible: true } } },
    }));
    setSelectedZoneId(id);
  }, []);

  const handleDuplicateZone = useCallback((zoneId: string) => {
    const id = `custom-${Date.now().toString(36)}`;
    setTplBundle((prev) => {
      const src = prev.def.zones.find((z) => z.id === zoneId);
      if (!src) return prev;
      const srcState = prev.state.zones[zoneId] ?? { color: src.defaultColor, visible: true };
      const copy: KitZoneDef = { ...src, id, name: `${src.name} (salinan)` };
      return {
        def: { ...prev.def, modified: true, zones: [...prev.def.zones, copy] },
        state: {
          ...prev.state,
          zones: {
            ...prev.state.zones,
            [id]: { ...srcState, dx: (srcState.dx ?? 0) + 24, dy: (srcState.dy ?? 0) + 24 },
          },
        },
      };
    });
    setSelectedZoneId(id);
  }, []);

  // A layer dragged onto another group of the layer list moves to that part (copy: a copy goes there)
  const handleMoveZone = useCallback((zoneId: string, part: KitPartId, copy: boolean) => {
    const id = copy ? `custom-${Date.now().toString(36)}` : zoneId;
    setTplBundle((prev) => {
      const src = prev.def.zones.find((z) => z.id === zoneId);
      if (!src) return prev;
      const srcState = prev.state.zones[zoneId] ?? { color: src.defaultColor, visible: true };
      const { zone, scale } = moveZoneToPart(src, part, PART_MAP[src.part].bounds, PART_MAP[part].bounds);
      const moved: KitZoneDef = { ...zone, id, group: PART_MAP[part].category };
      // the shape is rebuilt on the new part (shifted and scaled), the eraser mask follows it
      let erase = srcState.erase;
      if (erase && (src.rects?.length || src.polygons?.length || src.ellipses?.length)) {
        const a = zoneBox(src);
        const b = zoneBox(moved);
        erase = remapErase(erase, new DOMMatrix().translate(b.cx, b.cy).scale(scale).translate(-a.cx, -a.cy)) ?? erase;
      }
      return {
        def: {
          ...prev.def,
          modified: true,
          zones: copy ? [...prev.def.zones, moved] : prev.def.zones.map((z) => (z.id === zoneId ? moved : z)),
        },
        state: {
          ...prev.state,
          zones: { ...prev.state.zones, [id]: { ...srcState, dx: (srcState.dx ?? 0) * scale, dy: (srcState.dy ?? 0) * scale, erase } },
        },
      };
    });
    setSelectedZoneId(id);
  }, []);

  // New order (bottom first) of some layers, e.g. one group of the layer list: they swap into the array slots they
  // already hold, so the other layers keep their places (later in the array = drawn on top)
  const handleSetZoneOrder = useCallback((ids: string[]) => {
    setTplBundle((prev) => {
      const wanted = new Set(ids);
      const slots = prev.def.zones.flatMap((z, i) => (wanted.has(z.id) ? [i] : []));
      if (slots.length !== ids.length) return prev;
      const byId = new Map(prev.def.zones.map((z) => [z.id, z]));
      const zones = [...prev.def.zones];
      slots.forEach((slot, k) => (zones[slot] = byId.get(ids[k])!));
      if (zones.every((z, i) => z === prev.def.zones[i])) return prev;
      return { ...prev, def: { ...prev.def, modified: true, zones } };
    });
  }, []);

  const handleDeleteZone = useCallback((zoneId: string) => {
    setTplBundle((prev) => {
      const zones = { ...prev.state.zones };
      delete zones[zoneId];
      return {
        def: { ...prev.def, modified: true, zones: prev.def.zones.filter((z) => z.id !== zoneId) },
        state: { ...prev.state, zones },
      };
    });
    setSelectedZoneIdRaw((cur) => (cur === zoneId ? null : cur));
  }, []);

  const handleStartDraw = useCallback(
    (kind: 'free' | 'poly' | 'stitch' | 'stitchFree') => {
      setBrush((prev) => ({ ...prev, active: false }));
      setSelectedZoneId(null);
      setEditSeam(null);
      setDrawPts([]);
      setDrawTool(kind);
      setViewMode((m) => (m === '3d' ? 'split' : m));
    },
    [setSelectedZoneId]
  );

  const handleDeleteSeam = useCallback((key: string) => {
    setTplBundle((prev) => ({
      ...prev,
      def: {
        ...prev.def,
        modified: true,
        seams: (prev.def.seams ?? []).filter((s, i) => (s.id ?? `seam-${i}`) !== key),
      },
    }));
    setEditSeam((cur) => (cur === key ? null : cur));
  }, []);

  // stitch line whose points are being edited on the 2D canvas (its key: id or "seam-<index>")
  const [editSeam, setEditSeam] = useState<string | null>(null);
  const updateSeamPoints = useCallback((key: string, fn: (pts: Pt[]) => Pt[]) => {
    setTplBundle((prev) => ({
      ...prev,
      def: {
        ...prev.def,
        modified: true,
        seams: (prev.def.seams ?? []).map((s, i) => ((s.id ?? `seam-${i}`) === key ? { ...s, points: fn(s.points) } : s)),
      },
    }));
  }, []);
  const handleSeamPointMove = useCallback(
    (key: string, idx: number, pt: Pt) => updateSeamPoints(key, (pts) => pts.map((p, i) => (i === idx ? pt : p))),
    [updateSeamPoints]
  );
  const handleSeamPointInsert = useCallback(
    (key: string, afterIdx: number, pt: Pt) => updateSeamPoints(key, (pts) => [...pts.slice(0, afterIdx + 1), pt, ...pts.slice(afterIdx + 1)]),
    [updateSeamPoints]
  );
  // a line keeps at least its two ends
  const handleSeamPointRemove = useCallback(
    (key: string, idx: number) => updateSeamPoints(key, (pts) => (pts.length > 2 ? pts.filter((_, i) => i !== idx) : pts)),
    [updateSeamPoints]
  );

  const handleToggleSeamCurve = useCallback((key: string) => {
    setTplBundle((prev) => ({
      ...prev,
      def: {
        ...prev.def,
        modified: true,
        seams: (prev.def.seams ?? []).map((s, i) => ((s.id ?? `seam-${i}`) === key ? { ...s, smooth: !s.smooth } : s)),
      },
    }));
  }, []);

  const handleSetSeamStyle = useCallback((key: string, style: KitSeamDef['style']) => {
    setTplBundle((prev) => ({
      ...prev,
      def: {
        ...prev.def,
        modified: true,
        seams: (prev.def.seams ?? []).map((s, i) => ((s.id ?? `seam-${i}`) === key ? { ...s, style } : s)),
      },
    }));
  }, []);

  // One active tool at a time: select, a drawing tool, or the pattern eraser
  const activeTool: ToolId = drawTool ?? (brush.active ? 'eraser' : 'select');
  const handleSelectTool = useCallback(
    (tool: ToolId) => {
      if (tool === 'select' || tool === 'eraser') {
        setDrawTool(null);
        setDrawPts([]);
        setBrush((prev) => ({ ...prev, active: tool === 'eraser' }));
        return;
      }
      handleStartDraw(tool);
    },
    [handleStartDraw]
  );

  const handleCancelDraw = useCallback(() => {
    setDrawTool(null);
    setDrawPts([]);
  }, []);

  const handleFinishDraw = useCallback(
    (pts: Pt[]) => {
      const kind = drawTool;
      setDrawTool(null);
      setDrawPts([]);
      if (!kind) return;

      // stitch line: an open polyline kept as a layer of the template (can be deleted again)
      if (kind === 'stitch' || kind === 'stitchFree') {
        const line = kind === 'stitchFree' ? simplifyPath(pts, 3) : pts;
        if (line.length < 2) return;
        const mx = line.reduce((a, p) => a + p[0], 0) / line.length;
        const my = line.reduce((a, p) => a + p[1], 0) / line.length;
        const under = PES_2021_PARTS.find((pt) =>
          pt.regions.some((r) => mx >= r.x && mx <= r.x + r.width && my >= r.y && my <= r.y + r.height)
        );
        const sPart: KitPartId = under?.id ?? (viewState.activePartId !== 'all' ? viewState.activePartId : 'front');
        setTplBundle((prev) => {
          const existing = prev.def.seams ?? [];
          const seam = {
            id: `stitch-${Date.now().toString(36)}`,
            name: `Garis jahit ${existing.filter((s) => s.id?.startsWith('stitch-')).length + 1}`,
            part: sPart,
            points: line.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10] as Pt),
            ...(kind === 'stitch' && drawCurve && line.length >= 3 ? { smooth: true } : {}),
          };
          return {
            def: { ...prev.def, modified: true, seams: [...existing, seam] },
            state: { ...prev.state, seams: { ...prev.state.seams, enabled: true } },
          };
        });
        setRightTab('template');
        return;
      }
      if (pts.length < 3) return;

      // freehand strokes are simplified; the outline is then smoothed so it reads as a curve
      // (4 px: few enough points to grab one by one when editing, the smoothing keeps the stroke's curve)
      const path = kind === 'free' ? simplifyPath(pts, 4) : pts;
      if (path.length < 3) return;

      // main part: the part under the shape's centre (else the active part, else the front)
      const cx = path.reduce((a, p) => a + p[0], 0) / path.length;
      const cy = path.reduce((a, p) => a + p[1], 0) / path.length;
      const hitPart = PES_2021_PARTS.find((pt) =>
        pt.regions.some((r) => cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height)
      );
      const part: KitPartId = hitPart?.id ?? (viewState.activePartId !== 'all' ? viewState.activePartId : 'front');

      const id = `custom-${Date.now().toString(36)}`;
      const zone: KitZoneDef = {
        id,
        name: kind === 'free' ? 'Gambar bebas' : 'Gambar titik',
        part,
        group: PART_MAP[part].category,
        polygons: [path.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10] as Pt)],
        defaultColor: '#e2e8f0',
        defaultVisible: true,
      };
      setTplBundle((prev) => ({
        def: { ...prev.def, modified: true, zones: [...prev.def.zones, zone] },
        state: {
          ...prev.state,
          zones: {
            ...prev.state.zones,
            [id]: { color: '#e2e8f0', visible: true, smooth: kind === 'free' ? 0.6 : 0 },
          },
        },
      }));
      setSelectedZoneId(id);
      setRightTab('template');
    },
    [drawTool, drawCurve, viewState.activePartId, setSelectedZoneId]
  );

  // Point editing: bake the zone into plain polygons (so the points are in texture space)
  const handleToggleEditPoints = useCallback(
    (zoneId: string) => {
      if (editPoints) {
        setEditPoints(false);
        return;
      }
      setTplBundle((prev) => {
        const z = prev.def.zones.find((x) => x.id === zoneId);
        if (!z) return prev;
        const zs = prev.state.zones[zoneId] ?? { color: z.defaultColor, visible: true };
        const baked = bakeZone(z, { ...zs, smooth: 0, edge: 'sharp' });
        // the move / turn / scale goes into the points, so the eraser mask takes it too
        const erase = zs.erase ? remapErase(zs.erase, zoneMatrix(z, zs)) ?? zs.erase : undefined;
        return {
          def: { ...prev.def, modified: true, zones: prev.def.zones.map((x) => (x.id === zoneId ? baked : x)) },
          state: {
            ...prev.state,
            zones: {
              ...prev.state.zones,
              [zoneId]: {
                color: zs.color,
                visible: zs.visible,
                opacity: zs.opacity,
                seam: zs.seam,
                smooth: zs.smooth,
                repeat: zs.repeat,
                repeatGap: zs.repeatGap,
                repeatDir: zs.repeatDir,
                erase,
              },
            },
          },
        };
      });
      setEditPoints(true);
    },
    [editPoints]
  );

  const updatePolygons = useCallback((zoneId: string, fn: (polys: Pt[][]) => Pt[][]) => {
    setTplBundle((prev) => ({
      ...prev,
      def: {
        ...prev.def,
        modified: true,
        zones: prev.def.zones.map((z) =>
          z.id === zoneId && z.polygons ? { ...z, polygons: fn(z.polygons) } : z
        ),
      },
    }));
  }, []);

  const handleZonePointMove = useCallback(
    (zoneId: string, poly: number, idx: number, pt: Pt) =>
      updatePolygons(zoneId, (polys) =>
        polys.map((pl, pi) => (pi === poly ? pl.map((p, i) => (i === idx ? pt : p)) : pl))
      ),
    [updatePolygons]
  );
  const handleZonePointInsert = useCallback(
    (zoneId: string, poly: number, afterIdx: number, pt: Pt) =>
      updatePolygons(zoneId, (polys) =>
        polys.map((pl, pi) => (pi === poly ? [...pl.slice(0, afterIdx + 1), pt, ...pl.slice(afterIdx + 1)] : pl))
      ),
    [updatePolygons]
  );
  const handleZonePointRemove = useCallback(
    (zoneId: string, poly: number, idx: number) =>
      updatePolygons(zoneId, (polys) =>
        polys.map((pl, pi) => (pi === poly && pl.length > 3 ? pl.filter((_, i) => i !== idx) : pl))
      ),
    [updatePolygons]
  );

  // Dragging the selected layer on the 3D model (UV movement -> layer position)
  const handleNudgeZone = useCallback((zoneId: string, dx: number, dy: number) => {
    setTplBundle((prev) => {
      const z = prev.def.zones.find((x) => x.id === zoneId);
      if (!z) return prev;
      const cur = prev.state.zones[zoneId] ?? { color: z.defaultColor, visible: true };
      return {
        ...prev,
        state: {
          ...prev.state,
          zones: {
            ...prev.state.zones,
            [zoneId]: { ...cur, dx: (cur.dx ?? 0) + dx, dy: (cur.dy ?? 0) + dy },
          },
        },
      };
    });
  }, []);

  // every selected layer (that still exists), the main one last
  const selectedZoneIds = useMemo(() => {
    if (!selectedZoneId) return [];
    const exists = new Set(tplBundle.def.zones.map((z) => z.id));
    return [...extraZoneIds.filter((id) => id !== selectedZoneId && exists.has(id)), selectedZoneId];
  }, [selectedZoneId, extraZoneIds, tplBundle.def.zones]);

  const zoneDrag3D = (() => {
    if (!selectedZoneId || selectedZoneIds.length > 1 || drawTool || brush.active || editPoints) return null;
    const zone = tplBundle.def.zones.find((z) => z.id === selectedZoneId);
    if (!zone) return null;
    const zs = tplBundle.state.zones[zone.id] ?? { color: zone.defaultColor, visible: true };
    if (zs.visible === false) return null;
    return {
      zoneId: zone.id,
      hit: (x: number, y: number) => zoneHitTest(zone, zs, x, y),
      onMove: (dx: number, dy: number) => handleNudgeZone(zone.id, dx, dy),
    };
  })();

  const handleSaveTemplate = useCallback(
    async (name: string): Promise<{ ok: boolean; message: string }> => {
      try {
        // Bake position / size / shape / colour into plain zones so the saved file is self-contained
        // mask URLs ("/api/library/file?p=templates%2Fx%2Fmasks%2Fa.png") go back to paths relative to
        // library/templates, which is where the saved file is written
        const relMask = (url?: string) => {
          if (!url) return undefined;
          // a merged image layer carries its picture inline; it stays in the saved file
          if (url.startsWith('data:image/png;base64,')) return url;
          try {
            const p = new URL(url, 'http://x').searchParams.get('p') ?? '';
            return p.replace(/^templates\//, '') || undefined;
          } catch {
            return undefined;
          }
        };
        const zones = tplBundle.def.zones.map((z) => {
          const zs = tplBundle.state.zones[z.id] ?? { color: z.defaultColor, visible: true };
          const maskOnly = !!z.mask && !z.rects?.length && !z.polygons?.length && !z.ellipses?.length;
          if (maskOnly) {
            // masks cannot be baked into polygons: keep the mask and store the transform as its start state
            const initial: Record<string, number> = {};
            (['dx', 'dy', 'sx', 'sy', 'rot', 'opacity'] as const).forEach((k) => {
              if (typeof zs[k] === 'number') initial[k] = zs[k] as number;
            });
            return { ...z, mask: relMask(z.mask), defaultColor: zs.color, defaultVisible: zs.visible, initial };
          }
          const baked = bakeZone(z, zs, true);
          return { ...baked, mask: relMask(baked.mask), defaultColor: zs.color, defaultVisible: zs.visible };
        });
        const res = await fetch('/api/library/template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, template: { ...tplBundle.def, name, zones } }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan.');
        library.reload();
        return { ok: true, message: `Tersimpan: library/templates/${data.file}` };
      } catch (e: any) {
        return { ok: false, message: e?.message || 'Gagal menyimpan template.' };
      }
    },
    [tplBundle, library]
  );

  const handleAddPsd = useCallback(
    async (file: File) => {
      try {
        const res = await fetch('/api/library/psd', {
          method: 'POST',
          headers: { 'x-file-name': encodeURIComponent(file.name) },
          body: file,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) throw new Error(data.error || `Server menjawab ${res.status}`);
        setPendingPsdId(data.id);
        library.reload();
      } catch (e: any) {
        alert(`Gagal menambah PSD: ${e?.message || e}`);
      }
    },
    [library]
  );

  // Rename / delete a template file of library/templates (a JSON template, or a PSD that is read as one)
  const libraryFileRequest = useCallback(async (method: 'PATCH' | 'DELETE', t: KitTemplate, extra: Record<string, unknown> = {}) => {
    const res = await fetch('/api/library/template', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: t.psdFile ? 'psd' : 'json', file: t.psdFile ?? t.libFile, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || `Server menjawab ${res.status}`);
    return data;
  }, []);

  const handleRenameLibraryTemplate = useCallback(
    async (t: KitTemplate, name: string) => {
      try {
        const data = await libraryFileRequest('PATCH', t, { name });
        // the open template follows (a PSD gets a new id from its new file name)
        setTplBundle((prev) =>
          prev.def.id !== t.id
            ? prev
            : { ...prev, def: { ...prev.def, name: data.name ?? name, id: data.id ?? prev.def.id, psdFile: data.file ?? prev.def.psdFile } }
        );
        library.reload();
        return null;
      } catch (e: any) {
        return String(e?.message || e);
      }
    },
    [libraryFileRequest, library]
  );

  const handleDeleteLibraryTemplate = useCallback(
    async (t: KitTemplate) => {
      try {
        await libraryFileRequest('DELETE', t);
        // the open kit keeps its layers; the template is then listed as "from the project"
        library.reload();
        return null;
      } catch (e: any) {
        return String(e?.message || e);
      }
    },
    [libraryFileRequest, library]
  );

  useEffect(() => {
    if (!pendingPsdId) return;
    const t = library.templates.find((x) => x.id === pendingPsdId);
    if (!t) return;
    setPendingPsdId(null);
    handleSelectTemplate(t);
  }, [pendingPsdId, library.templates, handleSelectTemplate]);

  // The active template is a PSD read from the library that was saved again: take its new layers, keep the
  // colours and choices of the layers that are still there (not when the user changed the layers in the editor).
  useEffect(() => {
    setTplBundle((prev) => {
      if (prev.def.source !== 'psd' || prev.def.modified) return prev;
      const fresh = library.templates.find((t) => t.id === prev.def.id);
      if (!fresh || fresh.rev === prev.def.rev) return prev;
      preloadTemplateMasks(fresh);
      const zones: TemplateBundle['state']['zones'] = {};
      fresh.zones.forEach((z) => {
        zones[z.id] = prev.state.zones[z.id] ?? { color: z.defaultColor, visible: z.defaultVisible, ...(z.initial ?? {}) };
      });
      return { def: fresh, state: { ...prev.state, zones } };
    });
  }, [library.templates, preloadTemplateMasks]);

  // An edited built-in template whose definition changed since: take the new built-in zones (keeping the
  // colours and the user's own zones / seams), or just stop the notice.
  const handleRefreshBuiltin = useCallback((apply: boolean) => {
    setSelectedZoneId(null);
    setTplBundle((prev) => {
      const fresh = BUILTIN_TEMPLATES.find((t) => t.id === prev.def.id);
      if (!fresh) return prev;
      if (!apply) return { ...prev, def: { ...prev.def, rev: fresh.rev } };
      const zoneIds = new Set(fresh.zones.map((z) => z.id));
      const seamKey = (s: KitSeamDef) => s.id ?? JSON.stringify(s);
      const seamKeys = new Set((fresh.seams ?? []).map(seamKey));
      const ownZones = prev.def.zones.filter((z) => !zoneIds.has(z.id));
      const ownSeams = (prev.def.seams ?? []).filter((s) => !seamKeys.has(seamKey(s)));
      const def: KitTemplate = {
        ...fresh,
        modified: ownZones.length + ownSeams.length > 0 || undefined,
        zones: [...fresh.zones, ...ownZones],
        seams: [...(fresh.seams ?? []), ...ownSeams],
      };
      const zones: TemplateBundle['state']['zones'] = {};
      def.zones.forEach((z) => {
        zones[z.id] = prev.state.zones[z.id] ?? { color: z.defaultColor, visible: z.defaultVisible };
      });
      return { def, state: { ...prev.state, zones } };
    });
  }, []);

  const handleResetZones = useCallback(() => {
    setTplBundle((prev) => ({ ...prev, state: buildTemplateState(prev.def, prev.state.seams) }));
  }, []);

  // Real-time 3D texture: rebuilt at most every TEXTURE_3D_MIN_MS (dragging a colour fires dozens of changes a
  // second and each rebuild renders the full texture), and not at all while the 3D view is hidden. The canvas goes
  // to the 3D view as it is, without a PNG round trip.
  const last3DTextureRef = useRef(0);
  useEffect(() => {
    if (viewMode === '2d') return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      last3DTextureRef.current = performance.now();
      const texture = renderKitCanvas(
        partsConfig,
        graphicItems,
        markingsPreview,
        true, // Include markings for 3D viewer
        1024,
        fabricConfig,
        activeBase,
        patternMask,
        tplBundle
      );
      if (texture && !cancelled) setTexture3D(texture);
    };
    // The generator draws from the image cache, so make sure imports / the mask are decoded first
    const pending: Promise<unknown>[] = [];
    if (baseTexture) pending.push(preloadImage(baseTexture.src));
    if (patternMask) pending.push(preloadImage(patternMask));
    tplBundle.def.zones.forEach((z) => z.mask && pending.push(preloadImage(z.mask)));
    Object.values(tplBundle.state.zones).forEach((zs) => zs.erase && pending.push(preloadImage(zs.erase)));
    const wait = Math.max(0, TEXTURE_3D_MIN_MS - (performance.now() - last3DTextureRef.current));
    const timer = setTimeout(() => {
      if (pending.length) Promise.all(pending).then(run);
      else run();
    }, wait);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [partsConfig, graphicItems, markingsPreview, fabricConfig, baseTexture, patternMask, tplBundle, assetTick, viewMode]);

  // Resize listener to fit canvas neatly
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        // The brush bar sits above the 2D canvas while the eraser brush is active
        const availableHeight = clientHeight - 30 - (brush.active && viewMode !== '3d' ? 52 : 0);
        const availableWidth = viewMode === 'split' ? (clientWidth / 2) - 30 : clientWidth - 40;
        const size = Math.min(availableWidth, availableHeight, 720);
        setCanvasDisplaySize(Math.max(300, Math.floor(size)));
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [viewMode, brush.active]);

  // Handlers
  const handleSelectPart = useCallback((partId: KitPartId) => {
    setViewState((prev) => ({
      ...prev,
      activePartId: partId,
    }));
    setSelectedGraphicId(null);
    setRightTab('template');
  }, []);

  const handleFocusPart = useCallback((partId: KitPartId) => {
    setViewState((prev) => ({
      ...prev,
      activePartId: partId,
      focusPartId: partId,
      zoom: 1,
      panX: 0,
      panY: 0,
    }));
    setSelectedGraphicId(null);
    setRightTab('template');
  }, []);

  const handleViewChange = useCallback((patch: Partial<CanvasViewState>) => {
    setViewState((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleViewAll = useCallback(() => {
    setViewState((prev) => ({
      ...prev,
      activePartId: 'all',
      focusPartId: undefined,
      zoom: 1,
      panX: 0,
      panY: 0,
    }));
  }, []);

  const handleToggleVisibility = useCallback((partId: KitPartId) => {
    setPartsConfig((prev) => ({
      ...prev,
      [partId]: {
        ...prev[partId],
        visible: !prev[partId].visible,
      },
    }));
  }, []);

  const handleUpdatePartConfig = useCallback(
    (partId: KitPartId, update: Partial<KitPartConfig>) => {
      setPartsConfig((prev) => ({
        ...prev,
        [partId]: {
          ...prev[partId],
          ...update,
        },
      }));
    },
    []
  );

  const handleSyncRelatedParts = useCallback(
    (partId: KitPartId) => {
      const current = partsConfig[partId];
      if (partId === 'leftSleeve' || partId === 'rightSleeve') {
        setPartsConfig((prev) => ({
          ...prev,
          leftSleeve: { ...current },
          rightSleeve: { ...current },
        }));
      } else if (partId === 'leftShorts' || partId === 'rightShorts') {
        setPartsConfig((prev) => ({
          ...prev,
          leftShorts: { ...current },
          rightShorts: { ...current },
        }));
      } else if (partId === 'leftSock' || partId === 'rightSock') {
        setPartsConfig((prev) => ({
          ...prev,
          leftSock: { ...current },
          rightSock: { ...current },
        }));
      } else if (partId === 'front' || partId === 'back') {
        // The back panel is stored upside-down, so the copy is flipped on both axes
        // to look the same as the front once worn.
        const other: KitPartId = partId === 'front' ? 'back' : 'front';
        setPartsConfig((prev) => ({
          ...prev,
          [other]: {
            ...current,
            patternMirrorX: !current.patternMirrorX,
            patternMirrorY: !current.patternMirrorY,
          },
        }));
      }
    },
    [partsConfig]
  );

  // "Base" rows of the layer list: one colour for a whole garment (all its parts)
  const handleSetBaseColor = useCallback((partIds: KitPartId[], color: string) => {
    setPartsConfig((prev) => {
      const next = { ...prev };
      partIds.forEach((id) => {
        next[id] = { ...prev[id], color };
      });
      return next;
    });
  }, []);

  const handleSelectPreset = useCallback((preset: KitPreset) => {
    // a preset brings its own patterns: they replace the current pattern layers
    setTplBundle((prev) => ({ ...prev, state: { ...prev.state, patterns: [] } }));
    setPartsConfig((prev) => ({ ...preset.parts, credit: prev.credit ?? DEFAULT_CREDIT_CONFIG }));
    setSelectedPresetId(preset.id);
  }, []);

  const handleReset = useCallback(() => {
    setTplBundle((prev) => ({ ...prev, state: { ...prev.state, patterns: [] } }));
    setPartsConfig(DEFAULT_PART_CONFIG);
    setSelectedPresetId('classic-red');
    setViewState((prev) => ({
      ...prev,
      activePartId: 'all',
      focusPartId: undefined,
      zoom: 1,
      panX: 0,
      panY: 0,
    }));
    setSelectedGraphicId(null);
  }, []);

  // Graphics Management
  const handleSelectGraphic = useCallback((id: string | null) => {
    setSelectedGraphicId(id);
    if (id) {
      setRightTab('logos');
    }
  }, []);

  const handleAddGraphic = useCallback((item: KitGraphicItem) => {
    setGraphicItems((prev) => [...prev, item]);
    setSelectedGraphicId(item.id);
    setRightTab('logos');
    if (item.src) preloadImage(item.src);
  }, []);

  const handleUpdateGraphic = useCallback((item: KitGraphicItem) => {
    setGraphicItems((prev) =>
      prev.map((g) => (g.id === item.id ? item : g))
    );
  }, []);

  const handleDeleteGraphic = useCallback((id: string) => {
    setGraphicItems((prev) => prev.filter((g) => g.id !== id));
    setSelectedGraphicId((prev) => (prev === id ? null : prev));
  }, []);

  const handleReorderGraphic = useCallback((id: string, direction: 'up' | 'down') => {
    setGraphicItems((prev) => {
      const idx = prev.findIndex((g) => g.id === id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;

      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  }, []);

  const handleUpdateMarkings = useCallback((update: Partial<PlayerMarkingsConfig>) => {
    setMarkings((prev) => ({ ...prev, ...update }));
  }, []);

  // Imported design handlers
  const handleImportDesign = useCallback(async (texture: BaseTexture) => {
    await preloadImage(texture.src);
    setBaseTexture(texture);
  }, []);

  const handleUpdateBaseTexture = useCallback((update: Partial<BaseTexture>) => {
    setBaseTexture((prev) => (prev ? { ...prev, ...update } : prev));
  }, []);

  const handleRemoveBaseTexture = useCallback(() => setBaseTexture(null), []);

  // Base layer: the part colours, or the imported design
  const handleChooseBase = useCallback(
    (source: 'colour' | 'import') => {
      if (source === 'colour') {
        setBaseTexture((prev) => (prev && prev.mode === 'replace' ? { ...prev, enabled: false } : prev));
        return;
      }
      if (!baseTexture) {
        setIsImportModalOpen(true);
        return;
      }
      setBaseTexture({ ...baseTexture, enabled: true, mode: 'replace', opacity: 1 });
    },
    [baseTexture]
  );

  // Load project callback
  const handleLoadProject = useCallback((project: KitProject) => {
    setPartsConfig({ ...DEFAULT_PART_CONFIG, ...project.partsConfig });
    setGraphicItems(project.graphicItems);
    setMarkings(project.markings);
    // older projects have none of these: keep the defaults / the current config
    setFabricConfig(project.fabricConfig ?? DEFAULT_FABRIC_CONFIG);
    if (project.kitConfig) setKitConfigText(project.kitConfig);
    if (project.fontset) setFontsetSettings(project.fontset);
    if (project.baseTexture) {
      const loadedBase = project.baseTexture;
      preloadImage(loadedBase.src).then(() => setBaseTexture(loadedBase));
    } else {
      setBaseTexture(null);
    }
    if (project.templateDef && project.template) {
      preloadTemplateMasks(project.templateDef);
      setTplBundle({ def: project.templateDef, state: project.template });
    } else {
      setTplBundle({ def: BUILTIN_TEMPLATES[0], state: DEFAULT_TEMPLATE_STATE });
    }
    if (project.patternMask) {
      const loadedMask = project.patternMask;
      preloadImage(loadedMask).then(() => setPatternMask(loadedMask));
    } else {
      setPatternMask(null);
    }
    setViewState((prev) => ({
      ...prev,
      activePartId: 'all',
      focusPartId: undefined,
      zoom: 1,
      panX: 0,
      panY: 0,
    }));
    setSelectedGraphicId(null);
    setSavedCount(getLocalProjectsList().length);
  }, []);

  // Kit texture as DDS, optionally wrapped as FTEX (shared by Export and the kitserver folder)
  const buildGameTexture = useCallback(
    async (resolution: ExportTextureResolution, includeMarkings: boolean, ddsFormat: ExportDdsFormat, mipmaps: boolean, ftex: boolean) => {
      const canvas = renderKitCanvas(partsConfig, graphicItems, markingsView, includeMarkings, resolution, fabricConfig, activeBase, patternMask, tplBundle);
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return null;
      const dds = encodeDDS(ctx.getImageData(0, 0, canvas.width, canvas.height), ddsFormat, mipmaps);
      return ftex ? await encodeFtex(dds) : dds;
    },
    [partsConfig, graphicItems, markingsView, fabricConfig, baseTexture, patternMask, tplBundle]
  );

  useEffect(() => {
    const saved = loadKitConfigText();
    if (saved) setKitConfigText(saved);
  }, []);
  useEffect(() => saveKitConfigText(kitConfigText), [kitConfigText]);

  // config.txt colour keys taken from the kit's parts
  const kitConfigColors = useMemo(() => {
    const shirt1 = partsConfig.front.color;
    const shirt2 = partsConfig.front.patternColor || partsConfig.leftSleeve.color;
    return {
      ShirtColor1: shirt1,
      ShirtColor2: shirt2,
      UndershirtColor: partsConfig.leftSleeve.color,
      ShortsColor: partsConfig.leftShorts.color,
      SocksColor: partsConfig.leftSock.color,
      UniColor_Color1: shirt1,
      UniColor_Color2: shirt2,
    };
  }, [partsConfig]);

  // Advanced Export Executor
  const handlePerformExport = useCallback(async (settings: ExportSettings) => {
    const download = (dataUrl: string, filename: string) => {
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    if (settings.exportType === 'showcase-card') {
      try {
        const card = await generateShowcaseCard(
          partsConfig,
          graphicItems,
          markingsView,
          fabricConfig,
          settings.filename,
          activeBase,
          patternMask,
          tplBundle
        );
        if (card) download(card, `${settings.filename}_showcase.png`);
      } catch (err) {
        console.error('Showcase card export failed:', err);
      }
      return;
    }

    if (settings.exportType === 'project-file') {
      const currentProj: KitProject = {
        id: `kit_${Date.now()}`,
        name: settings.filename,
        version: '1.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        partsConfig,
        graphicItems,
        markings,
        baseTexture,
        patternMask,
        template: tplBundle.state,
        templateDef: tplBundle.def,
        fabricConfig,
        kitConfig: kitConfigText,
        fontset: fontsetSettings,
      };
      downloadPeskitFile(currentProj);
      return;
    }

    if (settings.fileFormat === 'dds' || settings.fileFormat === 'ftex') {
      let fileBytes: Uint8Array | null;
      try {
        fileBytes = await buildGameTexture(
          settings.resolution,
          settings.includeMarkings,
          settings.ddsFormat,
          settings.ddsMipmaps,
          settings.fileFormat === 'ftex'
        );
      } catch (err) {
        console.error('FTEX export failed', err);
        alert('Gagal membuat file FTEX. Coba format DXT1 atau DXT5.');
        return;
      }
      if (!fileBytes) return;
      const url = URL.createObjectURL(new Blob([fileBytes as BlobPart], { type: 'application/octet-stream' }));
      download(url, `${settings.filename}.${settings.fileFormat}`);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return;
    }

    // Direct, crystal clean texture export using pure 2D Canvas engine
    const dataUrl = generateKitTexture(
      partsConfig,
      graphicItems,
      markingsView,
      settings.includeMarkings,
      settings.resolution,
      fabricConfig,
      activeBase,
      patternMask,
      tplBundle
    );

    if (dataUrl) download(dataUrl, `${settings.filename}.png`);
  }, [partsConfig, graphicItems, markings, markingsView, fabricConfig, baseTexture, patternMask, tplBundle, buildGameTexture]);

  // New kit replaces the colours and patterns: ask first (Undo still brings them back)
  const { t } = useI18n();
  const confirmReset = useCallback(() => {
    if (window.confirm(t('Mulai kit baru? Warna dan pola sekarang diganti dengan bawaan. Bisa dibatalkan dengan Undo (Ctrl+Z).'))) handleReset();
  }, [handleReset, t]);

  // Single-key shortcuts (not while typing or while a dialog is open): tools, view mode, save, export, help
  useEffect(() => {
    const TOOL_KEYS: Record<string, ToolId> = { v: 'select', b: 'free', p: 'poly', s: 'stitch', j: 'stitchFree', e: 'eraser' };
    const VIEW_KEYS: Record<string, WorkspaceViewMode> = { '1': '2d', '2': 'split', '3': '3d' };
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const key = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (key === 's') {
          e.preventDefault();
          setIsProjectsModalOpen(true);
        } else if (key === 'e') {
          e.preventDefault();
          setIsExportModalOpen(true);
        } else if (key === ',') {
          e.preventDefault();
          setHelpKind('settings');
        }
        return;
      }
      if (e.altKey) return;
      if (e.key === '?') setHelpKind('shortcuts');
      else if (TOOL_KEYS[key]) handleSelectTool(TOOL_KEYS[key]);
      else if (VIEW_KEYS[key]) setViewMode(VIEW_KEYS[key]);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSelectTool]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0d1017]">
      <ColorPopover />
      {/* Top Navigation */}
      <Navbar
        onOpenHelp={setHelpKind}
        viewState={viewState}
        onToggleView={(key) => setViewState((prev) => ({ ...prev, [key]: !prev[key] }))}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenKitConfig={() => setIsKitConfigOpen(true)}
        onOpenFontset={() => setIsFontsetOpen(true)}
        onOpenProjectsModal={() => setIsProjectsModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenPhotoPattern={() => setIsPhotoPatternOpen(true)}
        hasImportedDesign={!!baseTexture}
        onReset={confirmReset}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onSelectPreset={handleSelectPreset}
        selectedPresetId={selectedPresetId}
        savedCount={savedCount}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: tool rail */}
        <ToolRail active={activeTool} onSelect={handleSelectTool} />

        {/* Center: Dynamic Workspace (2D Canvas / 3D Model / Split View) */}
        <main className="flex-1 flex flex-col bg-[#0b0e14] overflow-hidden">
          <Toolbar
            viewState={viewState}
            setViewState={setViewState}
            onResetSolo={handleViewAll}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onFocusPart={handleFocusPart}
            kitConfig={kitConfigText}
            onKitConfigChange={setKitConfigText}
          />

          {/* Viewport Area */}
          <div
            ref={containerRef}
            className="flex-1 flex items-center justify-center p-3 relative overflow-hidden select-none gap-3"
          >
            {/* 2D Canvas Panel (Visible in '2d' and 'split' modes). Both panels stay mounted and are only
                hidden, so switching view keeps the 3D camera / sleeve mode and never rebuilds the WebGL scene. */}
            {(
              <div className={`h-full flex-col items-center justify-center gap-2 relative ${viewMode === '3d' ? 'hidden' : 'flex'} ${viewMode === 'split' ? 'flex-1 min-w-0' : 'w-full'}`}>
                <DrawBar
                  tool={drawTool}
                  pointCount={drawPts.length}
                  onFinish={() => handleFinishDraw(drawPts)}
                  onUndoPoint={() => setDrawPts((p) => p.slice(0, -1))}
                  onCancel={handleCancelDraw}
                  curve={drawCurve}
                  onToggleCurve={() => setDrawCurve((v) => !v)}
                />
                <PatternBrushPanel
                  brush={brush}
                  onChange={(u) => setBrush((prev) => ({ ...prev, ...u }))}
                  {...(() => {
                    const z = selectedZoneId ? tplBundle?.def.zones.find((d) => d.id === selectedZoneId) : undefined;
                    return z
                      ? {
                          targetName: t(z.name),
                          hasMask: !!tplBundle?.state.zones[z.id]?.erase,
                          onClear: () => handleUpdateZone(z.id, { erase: undefined }),
                        }
                      : { hasMask: !!patternMask, onClear: () => setPatternMask(null) };
                  })()}
                />
                <KitCanvasWrapper
                  partsConfig={partsConfig}
                  viewState={viewState}
                  onSelectPart={handleSelectPart}
                  onViewChange={handleViewChange}
                  hoveredPartId={hoveredPartId}
                  setHoveredPartId={setHoveredPartId}
                  graphicItems={graphicItems}
                  selectedGraphicId={selectedGraphicId}
                  onSelectGraphic={handleSelectGraphic}
                  onUpdateGraphic={handleUpdateGraphic}
                  onDeleteGraphic={handleDeleteGraphic}
                  markings={markingsPreview}
                  baseTexture={activeBase}
                  patternMask={patternMask}
                  templateBundle={tplBundle}
                  fabricConfig={fabricConfig}
                  selectedZoneId={selectedZoneId}
                  selectedZoneIds={selectedZoneIds}
                  onSelectZone={setSelectedZoneId}
                  onZoneTransform={handleUpdateZone}
                  drawTool={drawTool}
                  drawPts={drawPts}
                  drawCurve={drawCurve}
                  onDrawPts={setDrawPts}
                  onDrawFinish={handleFinishDraw}
                  onDrawCancel={handleCancelDraw}
                  editPoints={editPoints}
                  onZonePointMove={handleZonePointMove}
                  onZonePointInsert={handleZonePointInsert}
                  onZonePointRemove={handleZonePointRemove}
                  editSeam={editSeam}
                  onSeamPointMove={handleSeamPointMove}
                  onSeamPointInsert={handleSeamPointInsert}
                  onSeamPointRemove={handleSeamPointRemove}
                  onPatternMaskChange={setPatternMask}
                  brush={brush}
                  isExportingClean={isExportingClean}
                  stageRef={stageRef}
                  canvasDisplaySize={canvasDisplaySize}
                />
              </div>
            )}

            {/* 3D Preview Panel (Visible in '3d' and 'split' modes) */}
            {(
              <div className={`h-full relative ${viewMode === '2d' ? 'hidden' : ''} ${viewMode === 'split' ? 'flex-1 min-w-0' : 'w-full'}`}>
                <Kit3DViewerWrapper
                  textureCanvas={texture3D}
                  zoneDrag={zoneDrag3D}
                  kitConfig={kitConfigText}
                  className="w-full h-full shadow-2xl"
                />
              </div>
            )}
          </div>

        </main>

        {/* Right Sidebar: Tabbed Panel (Properties / Logos / Markings) */}
        <aside className="w-80 bg-[#121622] border-l border-slate-800 flex flex-col h-full select-none">
          {/* Top Tabs */}
          <div className="flex border-b border-slate-800 bg-[#0f131c]" role="tablist" aria-label="Panel">
            {(
              [
                ['properties', 'Kain', <Shirt key="i" className="w-3.5 h-3.5" />, undefined],
                ['kitTemplate', 'Template', <LayoutTemplate key="i" className="w-3.5 h-3.5" />, 'Pilih template, dasar kit, dan simpan sebagai template'],
                ['template', 'Layer', <LayoutGrid key="i" className="w-3.5 h-3.5" />, 'Warna dasar, layer template, pola, dan garis jahitan'],
                ['logos', 'Logo', <Shield key="i" className="w-3.5 h-3.5" />, undefined],
                ['markings', 'Nama', <Type key="i" className="w-3.5 h-3.5" />, 'Pratinjau nama dan nomor punggung'],
              ] as const
            ).map(([id, label, icon, hint]) => (
              <button
                key={id}
                role="tab"
                aria-selected={rightTab === id}
                aria-label={label}
                title={hint ?? label}
                onClick={() => {
                  if (id === 'logos') {
                    if (!selectedGraphicId && graphicItems.length > 0) setSelectedGraphicId(graphicItems[0].id);
                  } else {
                    setSelectedGraphicId(null);
                  }
                  setRightTab(id);
                }}
                // only the open tab shows its name: five names side by side do not fit
                className={`${rightTab === id ? 'flex-[2.2]' : 'flex-1'} min-w-0 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors border-b-2 ${
                  rightTab === id ? 'border-sky-500 text-white bg-slate-800/40' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {icon}
                {rightTab === id && <span className="truncate">{label}</span>}
                {id === 'logos' && graphicItems.length > 0 && (
                  <span className="text-[11px] font-normal text-slate-400">{graphicItems.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {rightTab === 'properties' && (
              <PropertiesPanel
                fabricConfig={fabricConfig}
                library={library}
                onUpdateFabricConfig={setFabricConfig}
              />
            )}

            {(rightTab === 'template' || rightTab === 'kitTemplate') && (
              <TemplatePanel
                template={tplBundle.def}
                state={tplBundle.state}
                partsConfig={partsConfig}
                activePartId={viewState.activePartId}
                onUpdatePartConfig={handleUpdatePartConfig}
                onTogglePartVisibility={handleToggleVisibility}
                onSetBaseColor={handleSetBaseColor}
                onEditPart={handleSelectPart}
                library={library}
                onSelectTemplate={handleSelectTemplate}
                selectedZoneId={selectedZoneId}
                onSelectZone={setSelectedZoneId}
                selectedZoneIds={selectedZoneIds}
                onSelectZones={handleSelectZones}
                onGroupZones={handleGroupZones}
                onUngroup={handleUngroup}
                onMergeZones={handleMergeZones}
                onRenameGroup={handleRenameGroup}
                onDuplicateGroup={handleDuplicateGroup}
                onUpdateZone={handleUpdateZone}
                onResetZone={handleResetZone}
                onUpdateZoneDef={handleUpdateZoneDef}
                onAddZone={handleAddZone}
                onDuplicateZone={handleDuplicateZone}
                onMoveZone={handleMoveZone}
                onSetZoneOrder={handleSetZoneOrder}
                onDeleteZone={handleDeleteZone}
                onSaveTemplate={handleSaveTemplate}
                onStartDraw={handleStartDraw}
                onChangePatterns={handleChangePatterns}
                baseTexture={baseTexture}
                onChooseBase={handleChooseBase}
                onEditBase={() => setIsImportModalOpen(true)}
                onChangeBackground={handleChangeBackground}
                onChangeSleeveShape={handleChangeSleeveShape}
                onDeleteSeam={handleDeleteSeam}
                onToggleSeamCurve={handleToggleSeamCurve}
                onSetSeamStyle={handleSetSeamStyle}
                editSeam={editSeam}
                onToggleEditSeam={(key) => setEditSeam((cur) => (cur === key ? null : key))}
                onAddPsd={handleAddPsd}
                onRenameLibraryTemplate={handleRenameLibraryTemplate}
                onDeleteLibraryTemplate={handleDeleteLibraryTemplate}
                view={rightTab === 'kitTemplate' ? 'template' : 'layers'}
                onOpenPngImport={() => setIsPngImportOpen(true)}
                editPoints={editPoints}
                onToggleEditPoints={handleToggleEditPoints}
                onUpdateSeams={handleUpdateSeams}
                onResetZones={handleResetZones}
                onRefreshBuiltin={handleRefreshBuiltin}
                onFocusPart={handleFocusPart}
                onSyncRelatedParts={handleSyncRelatedParts}
              />
            )}

            {rightTab === 'logos' && (
              <LogosPanel
                graphicItems={graphicItems}
                selectedGraphicId={selectedGraphicId}
                onSelectGraphic={handleSelectGraphic}
                onAddGraphic={handleAddGraphic}
                onUpdateGraphic={handleUpdateGraphic}
                onDeleteGraphic={handleDeleteGraphic}
                onReorderGraphic={handleReorderGraphic}
                library={library}
                activePartId={viewState.activePartId}
              />
            )}

            {rightTab === 'markings' && (
              <MarkingsPanel
                markings={markings}
                onUpdateMarkings={handleUpdateMarkings}
                kitConfig={kitConfigText}
                onKitConfigChange={setKitConfigText}
                library={library}
              />
            )}
          </div>
        </aside>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handlePerformExport}
        defaultProjectName="pes2021_kit"
      />

      <KitConfigModal
        isOpen={isKitConfigOpen}
        onClose={() => setIsKitConfigOpen(false)}
        configText={kitConfigText}
        onChange={setKitConfigText}
        kitColors={kitConfigColors}
        buildKitFtex={(res) => buildGameTexture(res, false, 'dxt5', true, true)}
      />

      <FontsetModal
        isOpen={isFontsetOpen}
        onClose={() => setIsFontsetOpen(false)}
        library={library}
        configText={kitConfigText}
        onConfigChange={setKitConfigText}
        settings={fontsetSettings}
        onSettingsChange={setFontsetSettings}
      />

      <ImportPngModal
        isOpen={isPngImportOpen}
        initialFile={pngImportFile}
        onClose={() => {
          setIsPngImportOpen(false);
          setPngImportFile(null);
        }}
        onImported={(t) => {
          library.reload();
          handleSelectTemplate(t);
        }}
        onAddPsd={handleAddPsd}
      />

      <PhotoPatternModal
        isOpen={isPhotoPatternOpen}
        onClose={() => setIsPhotoPatternOpen(false)}
        onDone={(file) => {
          setIsPhotoPatternOpen(false);
          setPngImportFile(file);
          setIsPngImportOpen(true);
        }}
        onApplyPattern={(r) => {
          setIsPhotoPatternOpen(false);
          setPartsConfig((prev) => ({
            ...prev,
            front: { ...prev.front, color: r.ground },
            back: { ...prev.back, color: r.ground },
            leftSleeve: { ...prev.leftSleeve, color: r.sleeve },
            rightSleeve: { ...prev.rightSleeve, color: r.sleeve },
          }));
          if (r.layer) {
            const parts: KitPartId[] = r.sleevesPatterned ? ['front', 'back', 'leftSleeve', 'rightSleeve'] : ['front', 'back'];
            const layer = { ...newPatternLayer(parts), ...r.layer, name: `${PATTERN_LABEL[r.layer.pattern] ?? r.layer.pattern} (foto)` };
            setTplBundle((prev) => ({ ...prev, state: { ...prev.state, patterns: [...(prev.state.patterns ?? []), layer] } }));
          }
        }}
      />

      {/* Help dialogs (documentation, shortcuts, updates, credits, about) */}
      <HelpDialog kind={helpKind} onClose={() => setHelpKind(null)} />

      {/* Import Design Modal */}
      <ImportDesignModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        baseTexture={baseTexture}
        onImport={handleImportDesign}
        onUpdate={handleUpdateBaseTexture}
        onRemove={handleRemoveBaseTexture}
      />

      {/* Save & Projects Modal */}
      <SaveProjectsModal
        isOpen={isProjectsModalOpen}
        onClose={() => {
          setIsProjectsModalOpen(false);
          setSavedCount(getLocalProjectsList().length);
        }}
        currentPartsConfig={partsConfig}
        currentGraphicItems={graphicItems}
        currentMarkings={markings}
        currentBaseTexture={baseTexture}
        currentPatternMask={patternMask}
        currentTemplate={tplBundle}
        currentFabricConfig={fabricConfig}
        currentKitConfig={kitConfigText}
        currentFontset={fontsetSettings}
        onLoadProject={handleLoadProject}
      />
    </div>
  );
}
