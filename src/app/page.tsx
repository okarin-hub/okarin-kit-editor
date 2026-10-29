'use client';

import { DEFAULT_FABRIC_CONFIG } from '@/components/ui/FabricLayersPanel';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type Konva from 'konva';
import Navbar from '@/components/ui/Navbar';
import { ToolRail, ToolId } from '@/components/ui/ToolRail';
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
  TemplateZoneState,
  SeamConfig,
  KitZoneDef,
  Pt,
} from '@/types/kit';
import { KitProject, ExportSettings } from '@/types/project';
import { DEFAULT_PART_CONFIG, DEFAULT_CREDIT_CONFIG, PRESET_KITS, KitPreset } from '@/constants/presets';
import { PES_2021_PARTS, PART_MAP, CANVAS_TEXTURE_SIZE, SHORTS_NUMBER_POS, migrateMarkings } from '@/constants/pes2021Parts';
import { bakeZone, simplifyPath, zoneHitTest } from '@/utils/zoneGeometry';
import DrawBar from '@/components/ui/DrawBar';
import ImportPsdModal from '@/components/ui/ImportPsdModal';
import ImportPngModal from '@/components/ui/ImportPngModal';
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
} from '@/services/storageService';
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
import { Shirt, Shield, Hash, Type, LayoutGrid } from 'lucide-react';

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
  const [texture3DDataUrl, setTexture3DDataUrl] = useState<string | null>(null);

  // Realistic athletic fabric texture configuration
  const [fabricConfig, setFabricConfig] = useState<FabricConfig>(DEFAULT_FABRIC_CONFIG);

  // Active tab on right sidebar: 'properties' | 'logos' | 'markings'
  const [rightTab, setRightTab] = useState<'properties' | 'template' | 'logos' | 'markings'>('template');

  // Selected graphic item for transform/delete
  const [selectedGraphicId, setSelectedGraphicId] = useState<string | null>(null);

  // Modals state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
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
    nameSize: 28,
    numberSize: 84,
    shortsNumberSize: 42,
    nameY: 105,
    numberY: 195,
    shortsNumberX: SHORTS_NUMBER_POS.x,
    shortsNumberY: SHORTS_NUMBER_POS.y,
  });

  const [isExportingClean, setIsExportingClean] = useState<boolean>(false);

  // Undo / Redo over parts, graphics and markings
  const applySnapshot = useCallback((snap: KitSnapshot) => {
    setPartsConfig({ ...DEFAULT_PART_CONFIG, ...snap.partsConfig });
    setGraphicItems(snap.graphicItems);
    setMarkings(snap.markings);
    setBaseTexture(snap.baseTexture);
    setPatternMask(snap.patternMask);
    setTplBundle(snap.template);
    setSelectedGraphicId((prev) =>
      prev && snap.graphicItems.some((g) => g.id === prev) ? prev : null
    );
  }, []);

  const { undo, redo, canUndo, canRedo } = useKitHistory(
    { partsConfig, graphicItems, markings, baseTexture, patternMask, template: tplBundle },
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
      if (autosaved.markings) setMarkings(migrateMarkings(autosaved.markings));
    }
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
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [partsConfig, graphicItems, markings]);

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
  const [editPoints, setEditPoints] = useState(false);
  const setSelectedZoneId = useCallback((id: string | null) => {
    setSelectedZoneIdRaw(id);
    setEditPoints(false);
  }, []);

  const [isPsdImportOpen, setIsPsdImportOpen] = useState(false);
  const [isPngImportOpen, setIsPngImportOpen] = useState(false);

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
      setTplBundle((prev) => ({ def: t, state: { ...buildTemplateState(t, prev.state.seams), patterns: prev.state.patterns, background: prev.state.background, sleeveShape: prev.state.sleeveShape } }));
    },
    [preloadTemplateMasks]
  );

  const handleUpdateZone = useCallback((zoneId: string, update: Partial<TemplateZoneState>) => {
    setTplBundle((prev) => {
      const current = prev.state.zones[zoneId] ?? { color: '#ffffff', visible: true };
      return {
        ...prev,
        state: { ...prev.state, zones: { ...prev.state.zones, [zoneId]: { ...current, ...update } } },
      };
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
  }, []);

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
        const line = kind === 'stitchFree' ? simplifyPath(pts, 2) : pts;
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
      const path = kind === 'free' ? simplifyPath(pts, 2.5) : pts;
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

  const zoneDrag3D = (() => {
    if (!selectedZoneId || drawTool || brush.active || editPoints) return null;
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
          const baked = bakeZone(z, zs);
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

  const handleResetZones = useCallback(() => {
    setTplBundle((prev) => ({ ...prev, state: buildTemplateState(prev.def, prev.state.seams) }));
  }, []);

  // Instant Real-time 3D Texture Generation
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      const texture = generateKitTexture(
        partsConfig,
        graphicItems,
        markings,
        true, // Include markings for 3D viewer
        1024,
        fabricConfig,
        activeBase,
        patternMask,
        tplBundle
      );
      if (texture && !cancelled) {
        setTexture3DDataUrl(texture);
      }
    };
    // The generator draws from the image cache, so make sure imports / the mask are decoded first
    const pending: Promise<unknown>[] = [];
    if (baseTexture) pending.push(preloadImage(baseTexture.src));
    if (patternMask) pending.push(preloadImage(patternMask));
    tplBundle.def.zones.forEach((z) => z.mask && pending.push(preloadImage(z.mask)));
    if (pending.length) {
      Promise.all(pending).then(run);
    } else {
      run();
    }
    return () => {
      cancelled = true;
    };
  }, [partsConfig, graphicItems, markings, fabricConfig, baseTexture, patternMask, tplBundle, assetTick]);

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
    setMarkings(migrateMarkings(project.markings));
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
          markings,
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
      };
      downloadPeskitFile(currentProj);
      return;
    }

    if (settings.fileFormat === 'dds' || settings.fileFormat === 'ftex') {
      const canvas = renderKitCanvas(
        partsConfig,
        graphicItems,
        markings,
        settings.includeMarkings,
        settings.resolution,
        fabricConfig,
        activeBase,
        patternMask,
        tplBundle
      );
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const dds = encodeDDS(
        ctx.getImageData(0, 0, canvas.width, canvas.height),
        settings.ddsFormat,
        settings.ddsMipmaps
      );
      let fileBytes: Uint8Array = dds;
      if (settings.fileFormat === 'ftex') {
        try {
          fileBytes = await encodeFtex(dds);
        } catch (err) {
          console.error('FTEX export failed', err);
          alert('Gagal membuat file FTEX. Coba format DXT1 atau DXT5.');
          return;
        }
      }
      const url = URL.createObjectURL(new Blob([fileBytes as BlobPart], { type: 'application/octet-stream' }));
      download(url, `${settings.filename}.${settings.fileFormat}`);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return;
    }

    // Direct, crystal clean texture export using pure 2D Canvas engine
    const dataUrl = generateKitTexture(
      partsConfig,
      graphicItems,
      markings,
      settings.includeMarkings,
      settings.resolution,
      fabricConfig,
      activeBase,
      patternMask,
      tplBundle
    );

    if (dataUrl) download(dataUrl, `${settings.filename}.png`);
  }, [partsConfig, graphicItems, markings, fabricConfig, baseTexture, patternMask, tplBundle]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0d1017]">
      {/* Top Navigation */}
      <Navbar
        onOpenHelp={setHelpKind}
        viewState={viewState}
        onToggleView={(key) => setViewState((prev) => ({ ...prev, [key]: !prev[key] }))}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenProjectsModal={() => setIsProjectsModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        hasImportedDesign={!!baseTexture}
        onReset={handleReset}
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
          />

          {/* Viewport Area */}
          <div
            ref={containerRef}
            className="flex-1 flex items-center justify-center p-3 relative overflow-hidden select-none gap-3"
          >
            {/* 2D Canvas Panel (Visible in '2d' and 'split' modes). Both panels stay mounted and are only
                hidden, so switching view keeps the 3D camera / sleeve mode and never rebuilds the WebGL scene. */}
            {(
              <div className={`h-full flex-col items-center justify-center gap-2 relative ${viewMode === '3d' ? 'hidden' : 'flex'} ${viewMode === 'split' ? 'flex-1' : 'w-full'}`}>
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
                  hasMask={!!patternMask}
                  onClear={() => setPatternMask(null)}
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
                  markings={markings}
                  baseTexture={activeBase}
                  patternMask={patternMask}
                  templateBundle={tplBundle}
                  fabricConfig={fabricConfig}
                  selectedZoneId={selectedZoneId}
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
              <div className={`h-full relative ${viewMode === '2d' ? 'hidden' : ''} ${viewMode === 'split' ? 'flex-1' : 'w-full'}`}>
                <Kit3DViewerWrapper
                  textureDataUrl={texture3DDataUrl}
                  zoneDrag={zoneDrag3D}
                  className="w-full h-full shadow-2xl"
                />
              </div>
            )}
          </div>

          {/* Bottom Quick Part Strip */}
          <div className="h-10 bg-[#121620] border-t border-slate-800/80 px-4 flex items-center gap-1.5 overflow-x-auto select-none">
            <span className="text-[10px] text-slate-500 font-bold uppercase shrink-0 mr-1">
              Pintasan Part:
            </span>
            {PES_2021_PARTS.map((p) => {
              const isSelected = viewState.activePartId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleFocusPart(p.id)}
                  className={`text-[11px] px-2 py-0.5 rounded transition-all shrink-0 flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-rose-950 border-rose-500/80 text-rose-300 font-semibold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: partsConfig[p.id].color }}
                  />
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        </main>

        {/* Right Sidebar: Tabbed Panel (Properties / Logos / Markings) */}
        <aside className="w-80 bg-[#121622] border-l border-slate-800 flex flex-col h-full select-none">
          {/* Top Tabs */}
          <div className="flex border-b border-slate-800 bg-[#0f131c]">
            <button
              onClick={() => {
                setSelectedGraphicId(null);
                setRightTab('properties');
              }}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all border-b-2 ${
                rightTab === 'properties'
                  ? 'border-rose-500 text-white bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shirt className="w-3.5 h-3.5" />
              <span>Kain</span>
            </button>

            <button
              onClick={() => {
                setSelectedGraphicId(null);
                setRightTab('template');
              }}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all border-b-2 ${
                rightTab === 'template'
                  ? 'border-sky-500 text-sky-200 bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              title="Layer: warna dasar, zona template (kerah, panel samping, manset...), armband, kredit, dan garis jahitan"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-sky-400" />
              <span>Layer</span>
            </button>

            <button
              onClick={() => {
                setRightTab('logos');
                if (!selectedGraphicId && graphicItems.length > 0) {
                  setSelectedGraphicId(graphicItems[0].id);
                }
              }}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all border-b-2 ${
                rightTab === 'logos'
                  ? 'border-rose-500 text-white bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Logo ({graphicItems.length})</span>
            </button>

            <button
              onClick={() => {
                setSelectedGraphicId(null);
                setRightTab('markings');
              }}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all border-b-2 ${
                rightTab === 'markings'
                  ? 'border-sky-500 text-sky-300 bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Type className="w-3.5 h-3.5 text-sky-400" />
              <span>Nama</span>
            </button>
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

            {rightTab === 'template' && (
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
                onUpdateZone={handleUpdateZone}
                onResetZone={handleResetZone}
                onUpdateZoneDef={handleUpdateZoneDef}
                onAddZone={handleAddZone}
                onDuplicateZone={handleDuplicateZone}
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
                onOpenPsdImport={() => setIsPsdImportOpen(true)}
                onOpenPngImport={() => setIsPngImportOpen(true)}
                editPoints={editPoints}
                onToggleEditPoints={handleToggleEditPoints}
                onUpdateSeams={handleUpdateSeams}
                onResetZones={handleResetZones}
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

      {/* PSD template import */}
      <ImportPsdModal
        isOpen={isPsdImportOpen}
        onClose={() => setIsPsdImportOpen(false)}
        onImported={(t) => {
          library.reload();
          handleSelectTemplate(t);
        }}
      />

      <ImportPngModal
        isOpen={isPngImportOpen}
        onClose={() => setIsPngImportOpen(false)}
        onImported={(t) => {
          library.reload();
          handleSelectTemplate(t);
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
        onLoadProject={handleLoadProject}
      />
    </div>
  );
}
