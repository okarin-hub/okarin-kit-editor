'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  RotateCcw,
  Undo2,
  Redo2,
  FolderOpen,
  Save,
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
} from 'lucide-react';
import { PRESET_KITS, KitPreset } from '@/constants/presets';
import { CanvasViewState } from '@/types/kit';
import { LANGUAGES, Lang } from '@/i18n/engine';
import { useI18n } from '@/i18n/I18nProvider';
import { MenuHeading, MenuItem, MenuSeparator, TopMenu } from '@/components/ui/Menus';
import type { HelpKind } from '@/components/ui/HelpDialogs';

interface NavbarProps {
  onOpenExportModal: () => void;
  onOpenKitConfig: () => void;
  onOpenFontset: () => void;
  onOpenProjectsModal: () => void;
  onOpenImportModal: () => void;
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

/** Application menu bar: File, Edit, View, Preset and Settings (with the language choice). */
export const Navbar: React.FC<NavbarProps> = ({
  onOpenExportModal,
  onOpenKitConfig,
  onOpenFontset,
  onOpenProjectsModal,
  onOpenImportModal,
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
  const { lang, setLang } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);
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
        <div className="flex items-center gap-1.5 bg-rose-600/20 border border-rose-500/40 text-rose-400 px-2 py-0.5 rounded-md">
          <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="font-black text-[11px] tracking-wider uppercase">PES 2021</span>
        </div>
        <h1 className="text-sm font-bold text-white">Okarin Kit Editor</h1>
      </div>

      {/* Menu bar */}
      <div ref={barRef} className="flex items-center gap-0.5">
        <TopMenu id="file" label="File" openId={openId} setOpenId={setOpenId}>
          {(close) => (
            <>
              <MenuItem
                icon={<FilePlus2 className="w-3.5 h-3.5" />}
                label="Kit baru"
                title="Reset ke pengaturan default"
                onClick={run(close, onReset)}
              />
              <MenuItem
                icon={<FolderOpen className="w-3.5 h-3.5" />}
                label="Buka proyek…"
                title="Buka atau simpan proyek kit"
                onClick={run(close, onOpenProjectsModal)}
              />
              <MenuItem
                icon={<Save className="w-3.5 h-3.5" />}
                label="Simpan proyek…"
                title="Buka atau simpan proyek kit"
                onClick={run(close, onOpenProjectsModal)}
              />
              {savedCount > 0 && (
                <div className="px-2 pb-1 text-[10px] text-slate-500">
                  {savedCount} tersimpan di browser
                </div>
              )}
              <MenuSeparator />
              <MenuItem
                icon={<ImageDown className="w-3.5 h-3.5" />}
                label="Import desain…"
                title="Import desain kit yang sudah jadi (PNG / JPG / DDS)"
                checked={hasImportedDesign}
                onClick={run(close, onOpenImportModal)}
              />
              <MenuItem
                icon={<Download className="w-3.5 h-3.5" />}
                label="Export kit…"
                title="Download tekstur kit PNG atau file proyek"
                onClick={run(close, onOpenExportModal)}
              />
              <MenuItem
                icon={<FileCog className="w-3.5 h-3.5" />}
                label="Kitserver (config.txt)… (eksperimental)"
                title="Atur config.txt kitserver dan simpan folder kit"
                onClick={run(close, onOpenKitConfig)}
              />
              <MenuItem
                icon={<Type className="w-3.5 h-3.5" />}
                label="Generator fontset… (eksperimental)"
                title="Buat file font nomor dan nama untuk kitserver"
                onClick={run(close, onOpenFontset)}
              />
            </>
          )}
        </TopMenu>

        <TopMenu id="edit" label="Edit" openId={openId} setOpenId={setOpenId} width="w-52">
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
              <MenuSeparator />
              <MenuItem
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                label="Reset"
                title="Reset ke pengaturan default"
                onClick={run(close, onReset)}
              />
            </>
          )}
        </TopMenu>

        <TopMenu id="view" label="Tampilan" openId={openId} setOpenId={setOpenId} width="w-56">
          {() => (
            <>
              <MenuHeading>Garis bantu dan label di canvas 2D</MenuHeading>
              <MenuItem
                icon={<Grid className="w-3.5 h-3.5" />}
                label="Wireframe"
                title="Garis jahitan template PES 2021"
                checked={viewState.showWireframe}
                onClick={() => onToggleView('showWireframe')}
              />
              <MenuItem
                icon={<Tag className="w-3.5 h-3.5" />}
                label="Label"
                title="Label nama bagian"
                checked={viewState.showPartLabels}
                onClick={() => onToggleView('showPartLabels')}
              />
              <MenuItem
                icon={viewState.showOriginalTemplate ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                label="Overlay"
                title="Overlay template PES berlabel"
                checked={viewState.showOriginalTemplate}
                onClick={() => onToggleView('showOriginalTemplate')}
              />
            </>
          )}
        </TopMenu>

        <TopMenu id="preset" label="Preset" openId={openId} setOpenId={setOpenId} width="w-60">
          {(close) => (
            <>
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

        <TopMenu id="settings" label="Pengaturan" openId={openId} setOpenId={setOpenId} width="w-52">
          {() => (
            <>
              <MenuHeading>Bahasa</MenuHeading>
              <div data-no-i18n>
                {LANGUAGES.map((l) => (
                  <MenuItem
                    key={l.code}
                    label={l.label}
                    checked={lang === l.code}
                    onClick={() => setLang(l.code as Lang)}
                  />
                ))}
              </div>
            </>
          )}
        </TopMenu>

        <TopMenu id="help" label="Bantuan" openId={openId} setOpenId={setOpenId} width="w-56">
          {(close) => (
            <>
              <MenuItem
                icon={<BookOpen className="w-3.5 h-3.5" />}
                label="Dokumentasi"
                onClick={run(close, () => onOpenHelp('docs'))}
              />
              <MenuItem
                icon={<Keyboard className="w-3.5 h-3.5" />}
                label="Pintasan keyboard"
                onClick={run(close, () => onOpenHelp('shortcuts'))}
              />
              <MenuSeparator />
              <MenuItem
                icon={<DownloadCloud className="w-3.5 h-3.5" />}
                label="Cek pembaruan…"
                onClick={run(close, () => onOpenHelp('update'))}
              />
              <MenuSeparator />
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
        className="flex items-center gap-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 px-3.5 py-1.5 rounded-lg shadow-md shadow-rose-950 transition-all"
        title="Download tekstur kit PNG atau file proyek"
      >
        <Download className="w-4 h-4" />
        <span>Export Kit</span>
      </button>
    </header>
  );
};

export default Navbar;
