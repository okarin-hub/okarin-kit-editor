'use client';

import React, { useEffect, useRef } from 'react';
import { KitGraphicItem } from '@/types/kit';
import { FontPicker } from '@/components/ui/FontPicker';
import { AssetLibrary } from '@/hooks/useAssetLibrary';
import { drawTextItem, textBoxSize } from '@/utils/textItem';
import { subscribeAssets } from '@/utils/imageCache';

export type TextStyleFields = Pick<
  KitGraphicItem,
  'text' | 'textColor' | 'fontFamily' | 'fontSize' | 'strokeColor' | 'strokeWidth' | 'textShadow'
>;

interface TextStyleEditorProps {
  value: TextStyleFields;
  onChange: (patch: Partial<TextStyleFields>) => void;
  library: AssetLibrary;
}

/**
 * Text, font, size, colour, outline and shadow of a text graphic, with a live preview drawn exactly like the
 * kit (same renderer), so the result is seen before it is added.
 */
export const TextStyleEditor: React.FC<TextStyleEditorProps> = ({ value, onChange, library }) => {
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const draw = () => {
      const cv = previewRef.current;
      if (!cv) return;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      // shrink the text to fit the preview strip (the kit keeps the real size)
      const box = textBoxSize(value);
      const k = Math.min(1, (W - 16) / box.width, (H - 8) / box.height);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(k, k);
      drawTextItem(ctx, value);
      ctx.restore();
    };
    draw();
    // library fonts load in the background: draw again when one is ready
    return subscribeAssets(draw);
  }, [value]);

  const outline = !!(value.strokeColor && value.strokeWidth);

  return (
    <div className="space-y-2 text-[11px] text-slate-400">
      <canvas
        ref={previewRef}
        width={520}
        height={120}
        className="w-full h-[60px] rounded-lg border border-slate-700 bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)] bg-[length:16px_16px]"
        aria-label="Pratinjau teks"
      />
      <input
        type="text"
        value={value.text ?? ''}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="Tulis teks..."
        aria-label="Isi teks"
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold"
      />
      <div>
        <span className="text-[10px]">Font</span>
        <div className="mt-1">
          <FontPicker value={value.fontFamily ?? ''} onChange={(f) => onChange({ fontFamily: f })} library={library} compact />
        </div>
      </div>
      <label className="block space-y-0.5">
        <div className="flex justify-between">
          <span>Ukuran huruf</span>
          <span className="font-mono">{value.fontSize ?? 32}px</span>
        </div>
        <input
          type="range"
          min={8}
          max={160}
          value={value.fontSize ?? 32}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          className="w-full accent-sky-500"
        />
      </label>
      <div className="flex items-center gap-2">
        <span className="w-16">Warna</span>
        <input
          type="color"
          value={value.textColor ?? '#ffffff'}
          onChange={(e) => onChange({ textColor: e.target.value })}
          className="w-7 h-6 rounded border border-slate-700 cursor-pointer bg-transparent"
          aria-label="Warna teks"
        />
        <span className="font-mono text-[10px]">{value.textColor ?? '#ffffff'}</span>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 w-16 cursor-pointer">
          <input
            type="checkbox"
            checked={outline}
            onChange={(e) =>
              onChange(e.target.checked ? { strokeColor: value.strokeColor || '#000000', strokeWidth: value.strokeWidth || 3 } : { strokeWidth: 0 })
            }
            className="accent-sky-500"
          />
          Outline
        </label>
        {outline && (
          <>
            <input
              type="color"
              value={value.strokeColor ?? '#000000'}
              onChange={(e) => onChange({ strokeColor: e.target.value })}
              className="w-7 h-6 rounded border border-slate-700 cursor-pointer bg-transparent"
              aria-label="Warna outline teks"
            />
            <input
              type="range"
              min={1}
              max={16}
              value={value.strokeWidth ?? 3}
              onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
              className="flex-1 accent-sky-500"
              aria-label="Tebal outline teks"
            />
            <span className="font-mono w-8 text-right">{value.strokeWidth}px</span>
          </>
        )}
      </div>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input type="checkbox" checked={!!value.textShadow} onChange={(e) => onChange({ textShadow: e.target.checked })} className="accent-sky-500" />
        Bayangan
      </label>
    </div>
  );
};

export default TextStyleEditor;
