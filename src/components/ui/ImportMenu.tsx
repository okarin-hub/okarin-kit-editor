'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, FileUp, ImageDown, ImagePlus, Import } from 'lucide-react';
import { MenuHeading, MenuItem } from '@/components/ui/Menus';

export interface ImportActions {
  /** a finished kit picture (PNG / JPG / DDS) as the kit base */
  onImportDesign: () => void;
  /** a PSD template into the library */
  onPickPsd: () => void;
  /** a PNG split into layers (experimental) */
  onImportPng: () => void;
  hasImportedDesign?: boolean;
}

/** The one list of import choices: used in File and in the Template tab, so both offer the same three. */
export const ImportItems: React.FC<ImportActions & { onPicked?: () => void; heading?: boolean }> = ({
  onImportDesign,
  onPickPsd,
  onImportPng,
  hasImportedDesign,
  onPicked,
  heading = true,
}) => {
  const pick = (fn: () => void) => () => {
    onPicked?.();
    fn();
  };
  return (
    <>
      {heading && <MenuHeading>Import</MenuHeading>}
      <MenuItem
        icon={<ImageDown className="w-3.5 h-3.5" />}
        label="Desain kit jadi…"
        title="Gambar kit yang sudah jadi (PNG / JPG / DDS) sebagai dasar kit"
        checked={hasImportedDesign}
        onClick={pick(onImportDesign)}
      />
      <MenuItem
        icon={<FileUp className="w-3.5 h-3.5" />}
        label="Template PSD…"
        title="Salin file PSD ke library/templates; layer-nya jadi layer template dan ikut diperbarui saat PSD disimpan ulang"
        onClick={pick(onPickPsd)}
      />
      <MenuItem
        icon={<ImagePlus className="w-3.5 h-3.5" />}
        label="PNG jadi layer…"
        badge="Eksp."
        title="PNG dipisah per warna (atau 1 file = 1 layer) menjadi template. Hasil bisa kurang tepat."
        onClick={pick(onImportPng)}
      />
    </>
  );
};

/** A single Import button with the same choices as File > Import. */
export const ImportButton: React.FC<ImportActions> = (props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-lg border border-sky-700/70 bg-sky-900/30 text-sky-100 hover:bg-sky-800/40"
      >
        <Import className="w-3.5 h-3.5" aria-hidden />
        Import
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl border border-slate-700 bg-[#161b26] p-1 shadow-xl shadow-black/40">
          <ImportItems {...props} heading={false} onPicked={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
};
