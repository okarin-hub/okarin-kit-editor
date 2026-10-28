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
  Palette,
  Check,
  FolderOpen,
  RefreshCw,
  Search,
  Link2,
  Link2Off,
} from 'lucide-react';
import { KitGraphicItem, KitPartId } from '@/types/kit';
import { LogoStylePanel } from '@/components/ui/LogoStylePanel';
import { PES_2021_PARTS } from '@/constants/pes2021Parts';
import { AssetLibrary, LibraryEntry } from '@/hooks/useAssetLibrary';
import FontPicker from '@/components/ui/FontPicker';
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

const PRESET_COLORS = [
  { label: 'Putih', hex: '#ffffff' },
  { label: 'Hitam', hex: '#111111' },
  { label: 'Emas', hex: '#fbbf24' },
  { label: 'Merah', hex: '#e11d48' },
  { label: 'Biru Royal', hex: '#2563eb' },
  { label: 'Biru Navy', hex: '#0f172a' },
  { label: 'Kuning', hex: '#facc15' },
  { label: 'Hijau', hex: '#16a34a' },
  { label: 'Cyan Neon', hex: '#06b6d4' },
];

/** Number input that can be cleared and retyped; valid numbers apply as you type, blur restores the real value. */
const NumberField: React.FC<{ value: number; min?: number; onCommit: (v: number) => void; className?: string }> = ({
  value,
  min,
  onCommit,
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
      onBlur={() => setDraft(null)}
      className={className}
    />
  );
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
  const [customText, setCustomText] = useState('CUSTOM TEXT');
  const [customTextColor, setCustomTextColor] = useState('#ffffff');
  const [customTextFont, setCustomTextFont] = useState("'Impact', 'Arial Black', sans-serif");

  const [showFootballLogos, setShowFootballLogos] = useState(false);
  const [libraryCategory, setLibraryCategory] = useState<string>('all');
  const libraryCategories = Array.from(new Set(library.logos.map((l) => l.category))).filter(Boolean);
  const visibleLibraryLogos = library.logos.filter(
    (l) => libraryCategory === 'all' || l.category === libraryCategory
  );

  const selectedItem = graphicItems.find((g) => g.id === selectedGraphicId);

  // Adds an image (data URL) with authentic PES UV positioning for the active part
  const addImageFromSrc = async (src: string, name: string) => {
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const im = new Image();
      im.onload = () => resolve({ w: im.naturalWidth || 100, h: im.naturalHeight || 100 });
      im.onerror = () => resolve({ w: 100, h: 100 });
      im.src = src;
    });

    // Determine default position based on active part or chest
    let defaultX = 432;
    let defaultY = 690;
    let targetPart: KitPartId = 'front';
    let w = 150;
    let h = 50;
    let defaultRotation = 0;

    if (activePartId === 'leftSleeve') {
      defaultX = 276;
      defaultY = 446;
      targetPart = 'leftSleeve';
      w = 50;
      h = 50;
    } else if (activePartId === 'rightSleeve') {
      defaultX = 698;
      defaultY = 446;
      targetPart = 'rightSleeve';
      w = 50;
      h = 50;
    } else if (activePartId === 'leftShorts') {
      defaultX = 140;
      defaultY = 760;
      targetPart = 'leftShorts';
      w = 50;
      h = 50;
    } else if (activePartId === 'rightShorts') {
      defaultX = 840;
      defaultY = 760;
      targetPart = 'rightShorts';
      w = 50;
      h = 50;
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
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error('read'));
        r.readAsDataURL(blob);
      });
      await addImageFromSrc(dataUrl, entry.name);
    } catch {
      alert('Gagal membaca logo dari folder library.');
    }
  };

  // Add custom text graphic
  const handleAddCustomText = () => {
    if (!customText.trim()) return;

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

    const newItem: KitGraphicItem = {
      id: `custom-text-${Date.now()}`,
      name: `Teks: ${customText.slice(0, 10)}`,
      partId: targetPart,
      type: 'text',
      category: 'custom',
      text: customText,
      textColor: customTextColor,
      fontFamily: customTextFont,
      fontSize: 28,
      x: defaultX,
      y: defaultY,
      width: 160,
      height: 40,
      rotation: defaultRotation,
      opacity: 1,
      visible: true,
      locked: false,
    };

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

  // Apply color tint to selected SVG logo
  const handleTintSelected = (colorHex: string) => {
    if (!selectedItem) return;

    if (selectedItem.type === 'text') {
      onUpdateGraphic({
        ...selectedItem,
        textColor: colorHex,
      });
      return;
    }

    onUpdateGraphic({
      ...selectedItem,
      color: colorHex,
    });
  };

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
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-98 text-white font-semibold text-xs shadow-md shadow-rose-950/60 transition-all border border-rose-400/30"
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

          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Tulis teks..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold"
          />

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <span className="text-[10px] text-slate-400">Pilihan Font</span>
              <div className="mt-1">
                <FontPicker
                  value={customTextFont}
                  onChange={setCustomTextFont}
                  library={library}
                  compact
                />
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400">Warna Teks</span>
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="color"
                  value={customTextColor}
                  onChange={(e) => setCustomTextColor(e.target.value)}
                  className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent"
                />
                <span className="text-[10px] font-mono">{customTextColor}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleAddCustomText}
            className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs mt-1 transition-colors"
          >
            Tambahkan ke Kit
          </button>
        </div>
      )}

      {/* Logos from the library/logos folder */}
      <div className="space-y-2.5 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
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
          className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 active:scale-[0.99] rounded-lg py-2 transition-all"
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
            {libraryCategories.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                {['all', ...libraryCategories].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setLibraryCategory(cat)}
                    className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-all ${
                      libraryCategory === cat
                        ? 'bg-sky-600 text-white font-semibold shadow-sm'
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
                      <span className="text-[9px] text-slate-500 capitalize truncate">{logo.category}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 3. Added Graphics Layer Management */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
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
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {graphicItems.map((item) => {
              const isSelected = selectedGraphicId === item.id;
              const isLocked = item.locked === true;

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectGraphic(item.id)}
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
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Selected Graphic Inspector */}
      {selectedItem ? (
        <div className="space-y-3.5 pt-3 border-t border-slate-800 bg-[#161a26]/70 p-3 rounded-xl border border-slate-800/80">
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

          {selectedItem.type === 'image' && <LogoStylePanel item={selectedItem} onChange={onUpdateGraphic} />}

          {selectedItem.type === 'text' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Palette className="w-3 h-3 text-amber-400" />
                  <span>Pilihan Warna Logo / Teks:</span>
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  {selectedItem.color || selectedItem.textColor || '#ffffff'}
                </span>
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => handleTintSelected(c.hex)}
                    title={c.label}
                    className="w-5 h-5 rounded-full border border-black/50 shadow-sm flex items-center justify-center transition-transform hover:scale-110"
                    style={{ backgroundColor: c.hex }}
                  >
                    {(selectedItem.color === c.hex || selectedItem.textColor === c.hex) && (
                      <Check
                        className={`w-3 h-3 ${
                          c.hex === '#ffffff' || c.hex === '#facc15' ? 'text-black' : 'text-white'
                        }`}
                      />
                    )}
                  </button>
                ))}
                <input
                  type="color"
                  value={selectedItem.color || selectedItem.textColor || '#ffffff'}
                  onChange={(e) => handleTintSelected(e.target.value)}
                  className="w-6 h-6 rounded border border-slate-700 cursor-pointer bg-transparent"
                  title="Warna Kustom"
                />
              </div>
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
                onClick={() => alignToAnchor(301, 471, 'leftSleeve')}
                className="py-1 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-center"
              >
                🏆 Lengan Kanan
              </button>
              <button
                onClick={() => alignToAnchor(723, 471, 'rightSleeve')}
                className="py-1 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-center"
              >
                🏆 Lengan Kiri
              </button>
              <button
                onClick={() => alignToAnchor(172, 785, 'leftShorts')}
                className="py-1 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-center"
              >
                🩳 Celana Kanan
              </button>
              <button
                onClick={() => alignToAnchor(852, 785, 'rightShorts')}
                className="py-1 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-center"
              >
                🩳 Celana Kiri
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
                onCommit={(v) => {
                  const w = Math.round(v);
                  const ratioLocked = selectedItem.lockRatio ?? selectedItem.type === 'image';
                  onUpdateGraphic({
                    ...selectedItem,
                    width: w,
                    ...(ratioLocked ? { height: Math.max(10, Math.round((w * selectedItem.height) / selectedItem.width)) } : {}),
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
                onCommit={(v) => {
                  const h = Math.round(v);
                  const ratioLocked = selectedItem.lockRatio ?? selectedItem.type === 'image';
                  onUpdateGraphic({
                    ...selectedItem,
                    height: h,
                    ...(ratioLocked ? { width: Math.max(10, Math.round((h * selectedItem.width) / selectedItem.height)) } : {}),
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
      ) : (
        <div className="p-3 bg-slate-900/30 rounded-lg border border-slate-800/60 text-center text-xs text-slate-500">
          💡 Klik salah satu logo langsung pada kanvas untuk menggeser, memutar, atau mengubah ukuran dengan handel transform.
        </div>
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
