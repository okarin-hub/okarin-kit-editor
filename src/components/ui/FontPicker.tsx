'use client';

import React, { useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { AssetLibrary } from '@/hooks/useAssetLibrary';
import { notifyAssetsChanged } from '@/utils/imageCache';

export const BUILTIN_FONTS = [
  { id: "'Impact', 'Arial Black', sans-serif", label: 'Impact (Block Modern)' },
  { id: "'Arial Black', sans-serif", label: 'Arial Black (Athletic)' },
  { id: "'Trebuchet MS', sans-serif", label: 'Trebuchet (Clean Modern)' },
  { id: "'Georgia', serif", label: 'Georgia (Classic Vintage)' },
  { id: "'Courier New', monospace", label: 'Courier New (Monospace)' },
  { id: 'system-ui, sans-serif', label: 'Modern Sans' },
];

const familyValue = (family: string) => `'${family.replace(/'/g, '')}', sans-serif`;
const familyOf = (value: string) => value.match(/^'([^']+)'/)?.[1] ?? value;

interface FontPickerProps {
  value: string;
  onChange: (fontFamily: string) => void;
  library: AssetLibrary;
  compact?: boolean;
}

/**
 * Font selector: built-in fonts, fonts from the project `library/fonts` folder and every font
 * installed on this PC (after the browser's permission prompt, Chromium/Edge).
 */
export const FontPicker: React.FC<FontPickerProps> = ({ value, onChange, library, compact }) => {
  const [filter, setFilter] = useState('');
  const { fonts, systemFonts, systemFontStatus, loadSystemFonts } = library;

  const q = filter.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);

  const known = useMemo(() => {
    const set = new Set<string>(BUILTIN_FONTS.map((f) => f.id));
    fonts.forEach((f) => set.add(familyValue(f.family)));
    systemFonts.forEach((f) => set.add(familyValue(f)));
    return set;
  }, [fonts, systemFonts]);

  const handleChange = async (next: string) => {
    onChange(next);
    // Make sure the browser has the font ready before the canvas draws with it
    try {
      await document.fonts.load(`bold 20px ${next}`);
      notifyAssetsChanged();
    } catch {
      // ignore: canvas falls back to the next font in the stack
    }
  };

  const showSearch = systemFonts.length + fonts.length > 12;

  return (
    <div className="space-y-1.5">
      {showSearch && (
        <div className="relative">
          <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Cari font..."
            className={`w-full bg-slate-950 border border-slate-800 rounded-lg pl-6 pr-2 ${
              compact ? 'py-1 text-[11px]' : 'py-1.5 text-xs'
            } text-white outline-none focus:border-sky-500`}
          />
        </div>
      )}

      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 ${
          compact ? 'py-1 text-[11px]' : 'py-1.5 text-xs'
        } text-white outline-none`}
        style={{ fontFamily: value }}
      >
        {!known.has(value) && <option value={value}>{familyOf(value)} (tersimpan)</option>}

        <optgroup label="Bawaan">
          {BUILTIN_FONTS.filter((f) => matches(f.label)).map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </optgroup>

        {fonts.filter((f) => matches(f.family)).length > 0 && (
          <optgroup label="Folder library/fonts">
            {fonts
              .filter((f) => matches(f.family))
              .map((f) => (
                <option key={f.id} value={familyValue(f.family)}>
                  {f.family}
                </option>
              ))}
          </optgroup>
        )}

        {systemFonts.filter(matches).length > 0 && (
          <optgroup label={`Terpasang di PC (${systemFonts.length})`}>
            {systemFonts.filter(matches).map((f) => (
              <option key={f} value={familyValue(f)}>
                {f}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
        <button
          type="button"
          onClick={() => {
            loadSystemFonts();
            library.reload();
          }}
          disabled={systemFontStatus === 'loading'}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          title="Baca semua font yang terpasang di komputer ini (browser akan meminta izin)"
        >
          <RefreshCw className={`w-3 h-3 ${systemFontStatus === 'loading' ? 'animate-spin' : ''}`} />
          {systemFontStatus === 'ready' ? 'Perbarui font PC' : 'Muat font terpasang di PC'}
        </button>
        <span className="truncate">
          {systemFontStatus === 'unsupported' &&
            'Browser ini tidak bisa membaca font PC. Pakai Chrome/Edge, atau taruh file font di library/fonts.'}
          {systemFontStatus === 'denied' && 'Izin ditolak. Izinkan akses font lokal di browser.'}
          {systemFontStatus === 'ready' && `${systemFonts.length} font PC`}
        </span>
      </div>
    </div>
  );
};

export default FontPicker;
