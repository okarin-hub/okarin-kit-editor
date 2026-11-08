'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Trash2,
  Copy,
  AlignCenter,
  Eye,
  EyeOff,
  Sliders,
  Layers,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  Type,
  Plus,
  FolderOpen,
  RefreshCw,
  Search,
  Link2,
  Link2Off,
  Replace,
} from 'lucide-react';
import { KitGraphicItem, KitPartId } from '@/types/kit';
import { LogoStylePanel } from '@/components/ui/LogoStylePanel';
import { LayerSidePanel } from '@/components/ui/LayerSidePanel';
import { useLayerEditorMode } from '@/hooks/useLayerEditorMode';
import { PES_2021_PARTS } from '@/constants/pes2021Parts';
import { AssetLibrary, LibraryEntry } from '@/hooks/useAssetLibrary';
import { TextStyleEditor, TextStyleFields } from '@/components/ui/TextStyleEditor';
import { DEFAULT_TEXT_FONT, fitTextBox } from '@/utils/textItem';
import FootballLogosModal from '@/components/ui/FootballLogosModal';

interface LogosPanelProps {
  graphicItems: KitGraphicItem[];
  selectedGraphicId: string | null;
  onSelectGraphic: (id: string | null) => void;
  onAddGraphic: (item: KitGraphicItem) => void;
  onUpdateGraphic: (item: KitGraphicItem) => void;
  onDeleteGraphic: (id: string) => void;
  onReorderGraphic: (id: string, direction: 'up' | 'down') => void;
  activePartId: KitPartId | 'all';
  library: AssetLibrary;
}


/** Number input that can be cleared and retyped; valid numbers apply as you type, blur restores the real value. */
const NumberField: React.FC<{ value: number; min?: number; onCommit: (v: number) => void; onFocus?: () => void; className?: string }> = ({
  value,
  min,
  onCommit,
  onFocus,
  className,
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => {
    // the value changed from outside (dragging on the canvas): drop the stale draft
    setDraft((d) => (d !== null && parseFloat(d) !== value ? null : d));
  }, [value]);
  return (
    <input
      type="number"
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        const v = parseFloat(e.target.value);
        if (!Number.isNaN(v) && (min === undefined || v >= min)) onCommit(v);
      }}
      onFocus={onFocus}
      onBlur={() => setDraft(null)}
      className={className}
    />
  );
};

/**
 * Where a new logo is centred on parts that are rotated or partly hidden in the texture, and the rotation
 * that makes it read upright on the 3D model. Measured on the model's UV (pes_kit.glb):
 *  - Shorts: the leg length runs along the texture x axis (hem at the outer edge, x 0 / 1024). The shirt hem
 *    covers everything but x 0..148 (right island: 876..1024); the leg faces the front at y ~ 875 (grid texture in
 *    game: ~880).
 *  - Socks: upright in the texture; the sock faces the front at (130, 441), right sock (894, 444).
 *  - Sleeves: the arm runs along the texture x axis. The spot where the game puts the competition badge (grid
 *    texture in game, badge X14 Y11, MARKINGS_CAL.badgeShort): (314, 513) / (710, 513).
 */
const PART_ANCHORS: Partial<Record<KitPartId, { x: number; y: number; rotation: number }>> = {
  leftSleeve: { x: 314, y: 513, rotation: 90 },
  rightSleeve: { x: 710, y: 513, rotation: -90 },
  leftShorts: { x: 75, y: 875, rotation: 90 },
  rightShorts: { x: 949, y: 877, rotation: -90 },
  leftSock: { x: 130, y: 441, rotation: 0 },
  rightSock: { x: 894, y: 444, rotation: 0 },
};

export const LogosPanel: React.FC<LogosPanelProps> = ({
  graphicItems,
  selectedGraphicId,
  onSelectGraphic,
  onAddGraphic,
  onUpdateGraphic,
  onDeleteGraphic,
  onReorderGraphic,
  activePartId,
  library,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showTextModal, setShowTextModal] = useState(false);
  // the text being written in the "Teks Baru" form (seen in its preview before it is added)
  const [draft, setDraft] = useState<TextStyleFields>({
    text: 'CUSTOM TEXT',
    textColor: '#ffffff',
    fontFamily: DEFAULT_TEXT_FONT,
    fontSize: 28,
    strokeColor: '#000000',
    strokeWidth: 0,
    textShadow: false,
  });

  const [showFootballLogos, setShowFootballLogos] = useState(false);
  const [libraryCategory, setLibraryCategory] = useState<string>('all');
  const libraryCategories = Array.from(new Set(library.logos.map((l) => l.category))).filter(Boolean);
  const [librarySearch, setLibrarySearch] = useState('');
  const searchWords = librarySearch.toLowerCase().split(/\s+/).filter(Boolean);
  // every typed word must appear in the logo's name or its folder path
  const visibleLibraryLogos = library.logos.filter(
    (l) =>
      (libraryCategory === 'all' || l.category === libraryCategory) &&
      searchWords.every((w) => `${l.name} ${l.path}`.toLowerCase().includes(w))
  );

  const selectedItem = graphicItems.find((g) => g.id === selectedGraphicId);
  // width / height ratio taken when a size field gets focus: the fields apply every keystroke, so working it out
  // from the current size let "15" on the way to "150" (height clamped to 10) break the ratio for good
  const sizeRatio = useRef<number | null>(null);
  const keepRatio = () => {
    if (selectedItem) sizeRatio.current = selectedItem.width / selectedItem.height;
  };
  const ratioOf = (item: KitGraphicItem) => sizeRatio.current ?? item.width / item.height;
  useEffect(() => {
    sizeRatio.current = null;
  }, [selectedGraphicId]);

  const [editorMode] = useLayerEditorMode();
  // the logo that the next click in My Logos replaces (null = clicks add a new logo)
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (replaceTarget && replaceTarget !== selectedGraphicId) setReplaceTarget(null);
  }, [selectedGraphicId, replaceTarget]);

  const imageDims = (src: string) =>
    new Promise<{ w: number; h: number }>((resolve) => {
      const im = new Image();
      im.onload = () => resolve({ w: im.naturalWidth || 100, h: im.naturalHeight || 100 });
      im.onerror = () => resolve({ w: 100, h: 100 });
      im.src = src;
    });

  /** New picture in the same place: it fits inside the old box keeping its own ratio, centred (rotation turns
   * about the centre), and keeps rotation, opacity, lock and style. */
  const replaceImage = async (item: KitGraphicItem, src: string, name: string) => {
    const dims = await imageDims(src);
    const fit = Math.min(item.width / dims.w, item.height / dims.h);
    const width = Math.max(10, Math.round(dims.w * fit));
    const height = Math.max(10, Math.round(dims.h * fit));
    onUpdateGraphic({
      ...item,
      src,
      name,
      width,
      height,
      x: Math.round(item.x + (item.width - width) / 2),
      y: Math.round(item.y + (item.height - height) / 2),
    });
    setReplaceTarget(null);
  };

  const fileToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('read'));
      r.readAsDataURL(blob);
    });

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedItem) return;
    await replaceImage(selectedItem, await fileToDataUrl(file), file.name.replace(/\.[^/.]+$/, ''));
  };

  // Adds an image (data URL) with authentic PES UV positioning for the active part
  const addImageFromSrc = async (src: string, name: string) => {
    const dims = await imageDims(src);

    // Determine default position based on active part or chest
    let defaultX = 432;
    let defaultY = 690;
    let targetPart: KitPartId = 'front';
    let w = 150;
    let h = 50;
    let defaultRotation = 0;

    const anchored = activePartId !== 'all' ? PART_ANCHORS[activePartId] : undefined;
    if (anchored && activePartId !== 'all') {
      targetPart = activePartId;
      w = 50;
      h = 50;
      defaultX = anchored.x - w / 2;
      defaultY = anchored.y - h / 2;
      defaultRotation = anchored.rotation;
    } else if (activePartId === 'back') {
      // The shirt back is stored upside-down in the PES template: place the logo
      // ~150px below the neckline and rotate it 180° so it reads upright on the shirt.
      defaultX = 432;
      defaultY = 452 - 150 - 22;
      targetPart = 'back';
      w = 160;
      h = 45;
      defaultRotation = 180;
    }

    // Fit the image inside the default box keeping its own aspect ratio, centred in the box
    const boxW = w;
    const boxH = h;
    const ratio = dims.w / dims.h;
    if (ratio > boxW / boxH) {
      h = boxW / ratio;
    } else {
      w = boxH * ratio;
    }
    defaultX += (boxW - w) / 2;
    defaultY += (boxH - h) / 2;

    const newItem: KitGraphicItem = {
      id: `custom-logo-${Date.now()}`,
      name,
      partId: targetPart,
      type: 'image',
      category: 'custom',
      x: Math.round(defaultX),
      y: Math.round(defaultY),
      width: Math.round(w),
      height: Math.round(h),
      rotation: defaultRotation,
      opacity: 1,
      src,
      visible: true,
      locked: false,
    };

    onAddGraphic(newItem);
    onSelectGraphic(newItem.id);
  };

  // Handle custom file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      addImageFromSrc(event.target?.result as string, file.name.replace(/\.[^/.]+$/, ''));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Add a logo from the library/logos folder (embedded as data URL so projects stay portable)
  const addLibraryLogo = async (entry: LibraryEntry) => {
    try {
      const res = await fetch(entry.url);
      const dataUrl = await fileToDataUrl(await res.blob());
      const target = replaceTarget ? graphicItems.find((g) => g.id === replaceTarget) : undefined;
      if (target) await replaceImage(target, dataUrl, entry.name);
      else await addImageFromSrc(dataUrl, entry.name);
    } catch {
      alert('Gagal membaca logo dari folder library.');
    }
  };

  // Add custom text graphic
  const handleAddCustomText = () => {
    if (!draft.text?.trim()) return;

    let defaultX = 432;
    let defaultY = 690;
    let targetPart: KitPartId = 'front';

    let defaultRotation = 0;

    if (activePartId === 'back') {
      // Back panel is stored upside-down: rotate 180° so text reads upright on the shirt
      defaultX = 432;
      defaultY = 452 - 120 - 20;
      targetPart = 'back';
      defaultRotation = 180;
    }

    const newItem: KitGraphicItem = fitTextBox({
      id: `custom-text-${Date.now()}`,
      name: `Teks: ${(draft.text ?? '').slice(0, 10)}`,
      partId: targetPart,
      type: 'text',
      category: 'custom',
      ...draft,
      x: defaultX,
      y: defaultY,
      width: 160,
      height: 40,
      rotation: defaultRotation,
      opacity: 1,
      visible: true,
      locked: false,
    });

    onAddGraphic(newItem);
    onSelectGraphic(newItem.id);
    setShowTextModal(false);
  };

  // Duplicate item
  const handleDuplicate = (item: KitGraphicItem) => {
    const duplicated: KitGraphicItem = {
      ...item,
      id: `${item.id}-copy-${Date.now()}`,
      name: `${item.name} (Copy)`,
      x: item.x + 15,
      y: item.y + 15,
    };
    onAddGraphic(duplicated);
    onSelectGraphic(duplicated.id);
  };

  // Preset alignment anchors (UV coordinates)
  const alignToAnchor = (
    x: number,
    y: number,
    targetPartId?: KitPartId,
    rotation?: number
  ) => {
    if (!selectedItem) return;
    onUpdateGraphic({
      ...selectedItem,
      partId: targetPartId || selectedItem.partId,
      ...(rotation !== undefined ? { rotation } : {}),
      x: Math.round(x - selectedItem.width / 2),
      y: Math.round(y - selectedItem.height / 2),
    });
  };



  // settings of the selected logo: under its row, or in the side panel (Settings, layer editor)
  const renderInspector = (side = false) =>
    selectedItem && (
      <div
        className={
          side ? 'space-y-3.5 p-3' : 'space-y-3.5 mt-1 mb-2 bg-[#161a26]/70 p-3 rounded-xl border border-slate-800/80'
        }
        onClick={(e) => e.stopPropagation()}
      >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-rose-400" />
              <span>Pengaturan: {selectedItem.name}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  onUpdateGraphic({ ...selectedItem, locked: !selectedItem.locked })
                }
                className={`p-1 rounded ${
                  selectedItem.locked
                    ? 'text-amber-400 bg-amber-950/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                }`}
                title={selectedItem.locked ? 'Buka kunci posisi' : 'Kunci posisi'}
              >
                {selectedItem.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => handleDuplicate(selectedItem)}
                className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-white"
                title="Duplikat logo"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDeleteGraphic(selectedItem.id)}
                className="p-1 hover:bg-rose-950/60 rounded text-rose-400 hover:text-rose-300"
                title="Hapus logo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {selectedItem.type === 'image' && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-slate-400 flex items-center gap-1">
                <Replace className="w-3 h-3 text-sky-400" />
                Ganti logo
              </span>
              <button
                type="button"
                onClick={() => replaceInputRef.current?.click()}
                className="px-2 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                title="Ganti gambar logo ini dengan file dari komputer; posisi, ukuran, rotasi dan gayanya tetap"
              >
                Dari file…
              </button>
              <button
                type="button"
                onClick={() => setReplaceTarget(replaceTarget === selectedItem.id ? null : selectedItem.id)}
                aria-pressed={replaceTarget === selectedItem.id}
                className={`px-2 py-1 rounded border ${
                  replaceTarget === selectedItem.id
                    ? 'border-sky-500 text-sky-200 bg-sky-600/20'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
                title="Lalu klik logo di Logo Saya untuk menggantinya"
              >
                Dari Logo Saya
              </button>
            </div>
          )}

          {selectedItem.type === 'image' && <LogoStylePanel item={selectedItem} onChange={onUpdateGraphic} />}

          {selectedItem.type === 'text' && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Type className="w-3 h-3 text-sky-400" />
                <span>Teks</span>
              </div>
              <TextStyleEditor
                value={selectedItem}
                // the box follows the text (size, font, outline), centred where it was
                onChange={(p) => onUpdateGraphic(fitTextBox({ ...selectedItem, ...p, ...(p.text !== undefined ? { name: `Teks: ${p.text.slice(0, 10)}` } : {}) }))}
                library={library}
              />
            </div>
          )}

          {/* Quick Align to Authentic PES 2021 UV Positions */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <AlignCenter className="w-3 h-3 text-sky-400" />
              <span>Ratakan Otomatis (Snap Presisi PES 2021):</span>
            </label>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <button
                onClick={() => alignToAnchor(512, 640, 'front')}
                className="py-1 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-center"
              >
                🎯 Tengah Dada (Sponsor)
              </button>
              <button
                onClick={() => alignToAnchor(456, 575, 'front')}
                className="py-1 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-center"
              >
                🏷️ Dada Kanan (Apparel)
              </button>
              <button
                onClick={() => alignToAnchor(568, 575, 'front')}
                className="py-1 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-center"
              >
                🛡️ Dada Kiri (Crest)
              </button>
              <button
                onClick={() => alignToAnchor(PART_ANCHORS.leftSleeve!.x, PART_ANCHORS.leftSleeve!.y, 'leftSleeve', PART_ANCHORS.leftSleeve!.rotation)}
                className="py-1 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-center"
              >
                🏆 Lengan Kanan
              </button>
              <button
                onClick={() => alignToAnchor(PART_ANCHORS.rightSleeve!.x, PART_ANCHORS.rightSleeve!.y, 'rightSleeve', PART_ANCHORS.rightSleeve!.rotation)}
                className="py-1 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-center"
              >
                🏆 Lengan Kiri
              </button>
              <button
                onClick={() => alignToAnchor(PART_ANCHORS.leftShorts!.x, PART_ANCHORS.leftShorts!.y, 'leftShorts', PART_ANCHORS.leftShorts!.rotation)}
                className="py-1 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-center"
              >
                🩳 Celana Kanan
              </button>
              <button
                onClick={() => alignToAnchor(PART_ANCHORS.rightShorts!.x, PART_ANCHORS.rightShorts!.y, 'rightShorts', PART_ANCHORS.rightShorts!.rotation)}
                className="py-1 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-center"
              >
                🩳 Celana Kiri
              </button>
              <button
                onClick={() => alignToAnchor(PART_ANCHORS.leftSock!.x, PART_ANCHORS.leftSock!.y, 'leftSock', PART_ANCHORS.leftSock!.rotation)}
                className="py-1 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-center"
              >
                🧦 Kaus Kaki Kanan
              </button>
              <button
                onClick={() => alignToAnchor(PART_ANCHORS.rightSock!.x, PART_ANCHORS.rightSock!.y, 'rightSock', PART_ANCHORS.rightSock!.rotation)}
                className="py-1 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-center"
              >
                🧦 Kaus Kaki Kiri
              </button>
              <button
                onClick={() => alignToAnchor(512, 52, 'back', 180)}
                className="py-1 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-center"
              >
                🏷️ Punggung Bawah
              </button>
            </div>
          </div>

          {/* Width & Height */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 text-xs items-end">
            <div>
              <span className="text-[10px] text-slate-500">Lebar (px)</span>
              <NumberField
                value={selectedItem.width}
                min={10}
                onFocus={keepRatio}
                onCommit={(v) => {
                  const w = Math.round(v);
                  const ratioLocked = selectedItem.lockRatio ?? selectedItem.type === 'image';
                  onUpdateGraphic({
                    ...selectedItem,
                    width: w,
                    ...(ratioLocked ? { height: Math.max(10, Math.round(w / ratioOf(selectedItem))) } : {}),
                  });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-white text-xs mt-0.5"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateGraphic({ ...selectedItem, lockRatio: !(selectedItem.lockRatio ?? selectedItem.type === 'image') })
              }
              className={`h-7 w-7 flex items-center justify-center rounded border ${
                (selectedItem.lockRatio ?? selectedItem.type === 'image')
                  ? 'border-sky-500 text-sky-300 bg-sky-600/20'
                  : 'border-slate-700 text-slate-500 hover:text-white'
              }`}
              title={
                (selectedItem.lockRatio ?? selectedItem.type === 'image')
                  ? 'Rasio terkunci: lebar dan tinggi berubah bersama. Klik untuk melepas.'
                  : 'Rasio bebas: lebar atau tinggi bisa diubah sendiri. Klik untuk mengunci.'
              }
            >
              {(selectedItem.lockRatio ?? selectedItem.type === 'image') ? <Link2 className="w-3.5 h-3.5" /> : <Link2Off className="w-3.5 h-3.5" />}
            </button>
            <div>
              <span className="text-[10px] text-slate-500">Tinggi (px)</span>
              <NumberField
                value={selectedItem.height}
                min={10}
                onFocus={keepRatio}
                onCommit={(v) => {
                  const h = Math.round(v);
                  const ratioLocked = selectedItem.lockRatio ?? selectedItem.type === 'image';
                  onUpdateGraphic({
                    ...selectedItem,
                    height: h,
                    ...(ratioLocked ? { width: Math.max(10, Math.round(h * ratioOf(selectedItem))) } : {}),
                  });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-white text-xs mt-0.5"
              />
            </div>
          </div>

          {/* Position (centre of the logo, texture px) */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-500">Posisi X (pusat, px)</span>
              <NumberField
                value={Math.round(selectedItem.x + selectedItem.width / 2)}
                onCommit={(v) => onUpdateGraphic({ ...selectedItem, x: Math.round((v - selectedItem.width / 2) * 10) / 10 })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-white text-xs mt-0.5"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500">Posisi Y (pusat, px)</span>
              <NumberField
                value={Math.round(selectedItem.y + selectedItem.height / 2)}
                onCommit={(v) => onUpdateGraphic({ ...selectedItem, y: Math.round((v - selectedItem.height / 2) * 10) / 10 })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-white text-xs mt-0.5"
              />
            </div>
          </div>

          {/* Rotation & Opacity */}
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Rotasi</span>
                <span className="font-mono">{selectedItem.rotation}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                value={selectedItem.rotation}
                onChange={(e) =>
                  onUpdateGraphic({
                    ...selectedItem,
                    rotation: parseInt(e.target.value),
                  })
                }
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Opasitas (Transparansi)</span>
                <span className="font-mono">
                  {Math.round(selectedItem.opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={selectedItem.opacity}
                onChange={(e) =>
                  onUpdateGraphic({
                    ...selectedItem,
                    opacity: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>
          </div>
      </div>
    );

  return (
    <div className="flex flex-col h-full select-none overflow-y-auto text-slate-300 p-4 space-y-5">
      {/* 1. Action Header: Upload & Add Text */}
      <div className="grid grid-cols-2 gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/svg+xml,image/jpeg,image/webp"
          onChange={handleFileUpload}
          className="hidden"
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/png,image/svg+xml,image/jpeg,image/webp"
          onChange={handleReplaceFile}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors"
          title="Upload logo dari komputermu"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Logo</span>
        </button>

        <button
          onClick={() => setShowTextModal(!showTextModal)}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-white font-semibold text-xs border border-slate-700 transition-all"
          title="Tambah teks kustom atau slogan"
        >
          <Type className="w-3.5 h-3.5 text-sky-400" />
          <span>Tambah Teks</span>
        </button>
      </div>

      {/* Add Custom Text Collapsible Form */}
      {showTextModal && (
        <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700/80 space-y-2.5 text-xs">
          <div className="font-semibold text-white flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-sky-400" />
              <span>Teks Baru</span>
            </span>
            <button
              onClick={() => setShowTextModal(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <TextStyleEditor value={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} library={library} />

          <button
            onClick={handleAddCustomText}
            className="w-full py-1.5 font-semibold rounded-lg text-xs mt-1 transition-colors border border-slate-700 bg-slate-800/70 text-slate-100 hover:bg-slate-700"
          >
            Tambahkan ke Kit
          </button>
        </div>
      )}

      {/* Logos from the library/logos folder */}
      <div className="space-y-2.5 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>Logo Saya</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-mono">{library.logos.length} file</span>
            <button
              type="button"
              onClick={() => library.reload()}
              className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center gap-1"
              title="Baca ulang folder library/logos"
            >
              <RefreshCw className={`w-3 h-3 ${library.loading ? 'animate-spin' : ''}`} />
              Muat ulang
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowFootballLogos(true)}
          className="w-full flex items-center justify-center gap-2 text-xs font-semibold rounded-lg py-2 transition-colors border border-slate-700 bg-slate-800/70 text-slate-100 hover:bg-slate-700"
          title="Cari logo klub, liga, atau turnamen dari football-logos.cc"
        >
          <Search className="w-3.5 h-3.5" />
          Cari Logo Klub (football-logos.cc)
        </button>

        {library.error && (
          <p className="text-[10px] text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded p-2">
            {library.error}
          </p>
        )}

        {library.logos.length === 0 ? (
          <p className="text-[11px] text-slate-500 leading-snug bg-slate-900/40 rounded-lg p-3">
            Belum ada logo. Taruh file logo (PNG, JPG, SVG, WebP) di folder <code>library/logos</code>. Sub-folder
            jadi kategori, misalnya <code>brand</code> untuk apparel, <code>sponsor</code>, <code>klub</code>. Lalu klik Muat
            ulang. Logo muncul di sini dengan nama filenya.
          </p>
        ) : (
          <>
            {replaceTarget && (
              <div className="flex items-center justify-between gap-2 text-[11px] px-2 py-1.5 rounded-lg border border-sky-500/60 bg-sky-600/15 text-sky-100">
                <span className="min-w-0 truncate">
                  Klik logo untuk mengganti: {graphicItems.find((g) => g.id === replaceTarget)?.name}
                </span>
                <button type="button" onClick={() => setReplaceTarget(null)} className="shrink-0 underline hover:text-white">
                  Batal
                </button>
              </div>
            )}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Cari logo…"
                aria-label="Cari logo di Logo Saya"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-2 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
              />
            </div>

            {libraryCategories.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                {['all', ...libraryCategories].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setLibraryCategory(cat)}
                    className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-all ${
                      libraryCategory === cat
                        ? 'bg-sky-500/25 text-sky-100 font-semibold'
                        : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {cat === 'all' ? 'Semua' : cat}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
              {visibleLibraryLogos.map((logo) => (
                <button
                  key={logo.id}
                  onClick={() => addLibraryLogo(logo)}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all group"
                  title={logo.path}
                >
                  <div className="w-8 h-8 rounded bg-black/50 flex items-center justify-center p-1 shrink-0 border border-slate-700/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo.url} alt={logo.name} className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-medium text-slate-300 group-hover:text-white truncate">
                      {logo.name}
                    </span>
                    {logo.category && (
                      <span className="text-[10px] text-slate-500 capitalize truncate">{logo.category}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            {visibleLibraryLogos.length === 0 && (
              <p className="text-[11px] text-slate-500 text-center py-2">Tidak ada logo yang cocok.</p>
            )}
          </>
        )}
      </div>

      {/* 3. Added Graphics Layer Management */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Manajemen Layer ({graphicItems.length})</span>
          </div>
        </div>

        {graphicItems.length === 0 ? (
          <p className="text-xs text-slate-500 italic p-3 bg-slate-900/40 rounded-lg text-center">
            Belum ada logo atau teks. Upload logo, atau pilih dari Logo Saya di atas.
          </p>
        ) : (
          <div className="space-y-1">
            {graphicItems.map((item) => {
              const isSelected = selectedGraphicId === item.id;
              const isLocked = item.locked === true;

              return (
                <React.Fragment key={item.id}>
                <div
                  data-layer-anchor={`logo-${item.id}`}
                  onClick={() => onSelectGraphic(isSelected ? null : item.id)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer border transition-all ${
                    isSelected
                      ? 'bg-rose-950/40 border-rose-500 text-white font-medium shadow-sm'
                      : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isLocked && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
                    <span className="truncate max-w-[120px]">{item.name}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Layer reorder buttons */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderGraphic(item.id, 'up');
                      }}
                      className="p-1 hover:text-white rounded"
                      title="Pindah ke depan (Bring forward)"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderGraphic(item.id, 'down');
                      }}
                      className="p-1 hover:text-white rounded"
                      title="Pindah ke belakang (Send backward)"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>

                    {/* Lock toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateGraphic({ ...item, locked: !isLocked });
                      }}
                      className={`p-1 rounded ${
                        isLocked ? 'text-amber-400 hover:text-amber-300' : 'hover:text-white text-slate-500'
                      }`}
                      title={isLocked ? 'Buka kunci posisi' : 'Kunci posisi (cegah geser tak sengaja)'}
                    >
                      {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>

                    {/* Visibility */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateGraphic({ ...item, visible: item.visible === false });
                      }}
                      className="p-1 hover:text-white rounded"
                      title="Sembunyikan / Tampilkan"
                    >
                      {item.visible !== false ? (
                        <Eye className="w-3 h-3 text-slate-400" />
                      ) : (
                        <EyeOff className="w-3 h-3 text-rose-400" />
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteGraphic(item.id);
                      }}
                      className="p-1 hover:text-rose-400 rounded"
                      title="Hapus logo"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {isSelected &&
                  (editorMode === 'side' ? (
                    <LayerSidePanel anchor={`logo-${item.id}`} title={item.name} onClose={() => onSelectGraphic(null)}>
                      {renderInspector(true)}
                    </LayerSidePanel>
                  ) : (
                    renderInspector()
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {graphicItems.length > 0 && !selectedItem && (
        <p className="px-1 text-[11px] text-slate-400">
          Pilih logo di daftar atau di canvas untuk menggeser, memutar, mengganti, atau mengubah ukurannya.
        </p>
      )}
      <FootballLogosModal
        isOpen={showFootballLogos}
        onClose={() => setShowFootballLogos(false)}
        onLibraryChanged={() => library.reload()}
        onPicked={async (entry) => {
          await addLibraryLogo(entry);
        }}
      />
    </div>
  );
};

export default LogosPanel;
