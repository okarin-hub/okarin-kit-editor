'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Undo2,
  Redo2,
  FolderOpen,
  ImageDown,
  FilePlus2,
  Grid,
  Tag,
  Eye,
  EyeOff,
  BookOpen,
  Keyboard,
  DownloadCloud,
  Heart,
  Info,
  FileCog,
  Type,
  Shirt,
  Settings,
} from 'lucide-react';
import { PRESET_KITS, KitPreset } from '@/constants/presets';
import { CanvasViewState } from '@/types/kit';
import { MenuHeading, MenuItem, MenuSeparator, TopMenu } from '@/components/ui/Menus';
import { ImportItems } from '@/components/ui/ImportMenu';
import { applyUiScale, canSetUiScale, getUiScale, getZoomSpeed, setUiScale, setZoomSpeed, UiScale, uiScaleFactor, ZoomSpeed } from '@/utils/uiPrefs';
import type { HelpKind } from '@/components/ui/HelpDialogs';

interface NavbarProps {
  onOpenExportModal: () => void;
  onOpenKitConfig: () => void;
  onOpenProjectsModal: () => void;
  onOpenImportModal: () => void;
  onPickPsd: () => void;
  onOpenPngImport: () => void;
  onOpenPhotoPattern: () => void;
  hasImportedDesign: boolean;
  onReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSelectPreset: (preset: KitPreset) => void;
  selectedPresetId: string;
  savedCount: number;
  viewState: CanvasViewState;
  onToggleView: (key: 'showWireframe' | 'showPartLabels' | 'showOriginalTemplate') => void;
  onOpenHelp: (kind: HelpKind) => void;
}

/** Application menu bar: File, Edit (with the colour presets and the settings), View, Tools and Help. */
export const Navbar: React.FC<NavbarProps> = ({
  onOpenExportModal,
  onOpenKitConfig,
  onOpenProjectsModal,
  onOpenImportModal,
  onPickPsd,
  onOpenPngImport,
  onOpenPhotoPattern,
  hasImportedDesign,
  onReset,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSelectPreset,
  selectedPresetId,
  savedCount,
  viewState,
  onToggleView,
  onOpenHelp,
}) => {
  const [openId, setOpenId] = useState<string | null>(null);
  // wheel zoom speed (kept in this browser / app, read after mount)
  const [zoomSpeed, setZoomSpeedState] = useState<ZoomSpeed>('normal');
  useEffect(() => setZoomSpeedState(getZoomSpeed()), []);
  // the interface size is applied once at start (the menu bar is always on screen)
  const [uiScale, setUiScaleState] = useState<UiScale>('auto');
  const [scalable, setScalable] = useState(false);
  useEffect(() => {
    setUiScaleState(getUiScale());
    setScalable(canSetUiScale());
    applyUiScale();
  }, []);
  const barRef = useRef<HTMLDivElement | null>(null);

  // close on an outside click or Escape
  useEffect(() => {
    if (!openId) return;
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenId(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openId]);

  const run = (close: () => void, fn: () => void) => () => {
    close();
    fn();
  };

  const currentPreset = PRESET_KITS.find((p) => p.id === selectedPresetId);

  return (
    <header className="relative z-40 h-12 border-b border-slate-800 bg-[#121620] px-3 flex items-center gap-3 select-none">
      {/* Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="rounded-md border border-slate-700 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-slate-300">PES 2021</span>
        <h1 className="text-sm font-bold text-white">Okarin Kit Editor</h1>
      </div>

      {/* Menu bar */}
      <div ref={barRef} className="flex items-center gap-0.5">
        <TopMenu id="file" label="File" openId={openId} setOpenId={setOpenId} width="w-60">
          {(close) => (
            <>
              <MenuItem
                icon={<FilePlus2 className="w-3.5 h-3.5" />}
                label="Kit baru"
                title="Mulai dari awal (pengaturan default)"
                onClick={run(close, onReset)}
              />
              <MenuItem
                icon={<FolderOpen className="w-3.5 h-3.5" />}
                label="Buka / simpan proyek…"
                shortcut="Ctrl+S"
                title={savedCount > 0 ? `${savedCount} proyek tersimpan di browser` : 'Simpan kit ke browser atau ke file .peskit'}
                onClick={run(close, onOpenProjectsModal)}
              />
              <MenuSeparator />
              <ImportItems
                onImportDesign={onOpenImportModal}
                onPickPsd={onPickPsd}
                onImportPng={onOpenPngImport}
                hasImportedDesign={hasImportedDesign}
                onPicked={close}
              />
              <MenuSeparator />
              <MenuItem
                icon={<Download className="w-3.5 h-3.5" />}
                label="Export kit…"
                shortcut="Ctrl+E"
                title="Download tekstur kit PNG / DDS / FTEX atau file proyek"
                onClick={run(close, onOpenExportModal)}
              />
            </>
          )}
        </TopMenu>

        <TopMenu id="edit" label="Edit" openId={openId} setOpenId={setOpenId} width="w-60">
          {(close) => (
            <>
              <MenuItem
                icon={<Undo2 className="w-3.5 h-3.5" />}
                label="Undo"
                shortcut="Ctrl+Z"
                disabled={!canUndo}
                onClick={run(close, onUndo)}
              />
              <MenuItem
                icon={<Redo2 className="w-3.5 h-3.5" />}
                label="Redo"
                shortcut="Ctrl+Y"
                disabled={!canRedo}
                onClick={run(close, onRedo)}
              />
              <MenuItem
                icon={<Settings className="w-3.5 h-3.5" />}
                label="Pengaturan…"
                shortcut="Ctrl+,"
                title="Bahasa dan cara membuka pengaturan layer"
                onClick={run(close, () => onOpenHelp('settings'))}
              />
              <MenuSeparator />
              <MenuHeading>Terapkan preset warna</MenuHeading>
              {PRESET_KITS.map((preset) => (
                <MenuItem
                  key={preset.id}
                  icon={
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/40"
                      style={{ backgroundColor: preset.previewColor }}
                    />
                  }
                  label={preset.name}
                  checked={selectedPresetId === preset.id}
                  onClick={run(close, () => onSelectPreset(preset))}
                />
              ))}
            </>
          )}
        </TopMenu>

        <TopMenu id="view" label="Tampilan" openId={openId} setOpenId={setOpenId} width="w-60">
          {() => (
            <>
              <MenuHeading>Garis bantu dan label di canvas 2D</MenuHeading>
              <MenuItem
                icon={<Grid className="w-3.5 h-3.5" />}
                label="Garis bagian"
                title="Garis tepi tiap bagian template PES 2021"
                checked={viewState.showWireframe}
                onClick={() => onToggleView('showWireframe')}
              />
              <MenuItem
                icon={<Tag className="w-3.5 h-3.5" />}
                label="Label bagian"
                title="Nama tiap bagian di canvas"
                checked={viewState.showPartLabels}
                onClick={() => onToggleView('showPartLabels')}
              />
              <MenuItem
                icon={viewState.showOriginalTemplate ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                label="Template PES asli"
                title="Tampilkan template PES berlabel di atas kit (transparan)"
                checked={viewState.showOriginalTemplate}
                onClick={() => onToggleView('showOriginalTemplate')}
              />
              <MenuSeparator />
              <MenuHeading>Kecepatan zoom (scroll)</MenuHeading>
              {(
                [
                  ['slow', 'Pelan'],
                  ['normal', 'Normal'],
                  ['fast', 'Cepat'],
                ] as const
              ).map(([id, label]) => (
                <MenuItem
                  key={id}
                  label={label}
                  title="Seberapa jauh satu putaran scroll memperbesar atau memperkecil canvas 2D, 3D, dan pratinjau fontset"
                  checked={zoomSpeed === id}
                  onClick={() => {
                    setZoomSpeed(id);
                    setZoomSpeedState(id);
                  }}
                />
              ))}
              <MenuSeparator />
              <MenuHeading>Ukuran tampilan</MenuHeading>
              {!scalable && (
                <MenuItem label="Di browser: pakai Ctrl + / Ctrl −" title="Zoom bawaan browser mengubah ukuran seluruh tampilan" disabled onClick={() => {}} />
              )}
              {scalable && (
                [
                  ['auto', 'Otomatis', 'Sesuai lebar layar: 100% di layar sekitar 1366 px, 115% di layar 1920 px ke atas'],
                  ['small', 'Kecil', 'Teks dan tombol lebih kecil, ruang kerja lebih luas'],
                  ['medium', 'Normal', 'Ukuran asli'],
                  ['large', 'Besar', 'Teks dan tombol lebih besar'],
                  ['xlarge', 'Ekstra besar', 'Untuk layar besar atau jarak pandang jauh'],
                ] as const
              ).map(([id, label, hint]) => (
                <MenuItem
                  key={id}
                  label={label}
                  shortcut={`${Math.round(uiScaleFactor(id) * 100)}%`}
                  title={hint}
                  checked={uiScale === id}
                  onClick={() => {
                    setUiScale(id);
                    setUiScaleState(id);
                  }}
                />
              ))}
            </>
          )}
        </TopMenu>

        <TopMenu id="tools" label="Alat" openId={openId} setOpenId={setOpenId} width="w-64">
          {(close) => (
            <>
              <MenuItem
                icon={<Shirt className="w-3.5 h-3.5" />}
                label="Pola dari foto jersey…"
                badge="Eksp."
                title="Ambil pola badan baju dari foto jersey (tanpa logo) dan jadikan layer warna"
                onClick={run(close, onOpenPhotoPattern)}
              />
              <MenuItem
                icon={<FileCog className="w-3.5 h-3.5" />}
                label="Kitserver (config & font)…"
                title="config.txt kitserver dan font nomor / nama, dalam satu dialog"
                onClick={run(close, onOpenKitConfig)}
              />
            </>
          )}
        </TopMenu>

        <TopMenu id="help" label="Bantuan" openId={openId} setOpenId={setOpenId} width="w-56">
          {(close) => (
            <>
              <MenuItem
                icon={<BookOpen className="w-3.5 h-3.5" />}
                label="Panduan"
                onClick={run(close, () => onOpenHelp('docs'))}
              />
              <MenuItem
                icon={<Keyboard className="w-3.5 h-3.5" />}
                label="Pintasan keyboard"
                shortcut="?"
                onClick={run(close, () => onOpenHelp('shortcuts'))}
              />
              <MenuSeparator />
              <MenuItem
                icon={<DownloadCloud className="w-3.5 h-3.5" />}
                label="Cek pembaruan…"
                onClick={run(close, () => onOpenHelp('update'))}
              />
              <MenuItem
                icon={<Heart className="w-3.5 h-3.5" />}
                label="Kredit"
                onClick={run(close, () => onOpenHelp('credits'))}
              />
              <MenuItem
                icon={<Info className="w-3.5 h-3.5" />}
                label="Tentang"
                onClick={run(close, () => onOpenHelp('about'))}
              />
            </>
          )}
        </TopMenu>
      </div>

      {/* Current preset, as a hint of what is loaded */}
      {currentPreset && (
        <span className="hidden xl:flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
          <span className="w-2 h-2 rounded-full border border-black/40" style={{ backgroundColor: currentPreset.previewColor }} />
          {currentPreset.name}
        </span>
      )}

      <div className="flex-1" />

      {/* Primary action */}
      <button
        onClick={onOpenExportModal}
        className="flex items-center gap-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 px-3.5 py-1.5 rounded-lg transition-colors"
        title="Download tekstur kit PNG / DDS / FTEX atau file proyek (Ctrl+E)"
      >
        <Download className="w-4 h-4" />
        <span>Export Kit</span>
      </button>
    </header>
  );
};

export default Navbar;
