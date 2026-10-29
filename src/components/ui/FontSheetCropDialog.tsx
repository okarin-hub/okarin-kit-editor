'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Crop, Pipette, Maximize } from 'lucide-react';
import { Rect, InkOptions, extractInk, colorAt } from '@/utils/inkExtract';

interface FontSheetCropDialogProps {
  image: HTMLImageElement;
  name: string;
  onCancel: () => void;
  /** the chosen area with its background removed */
  onApply: (sheet: HTMLCanvasElement) => void;
}

const VIEW_W = 820;
const VIEW_H = 520;
const hex = (c: [number, number, number]) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

/** Before a font sheet is read: pick the area to use and how the letters are separated from the background. */
export const FontSheetCropDialog: React.FC<FontSheetCropDialogProps> = ({ image, name, onCancel, onApply }) => {
  const full: Rect = { x: 0, y: 0, w: image.width, h: image.height };
  const [rect, setRect] = useState<Rect>(full);
  const [opts, setOpts] = useState<InkOptions>({ bg: null, ink: null, tolerance: 50, useAlpha: true });
  const [picking, setPicking] = useState<'bg' | 'ink' | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const scale = Math.min(VIEW_W / image.width, VIEW_H / image.height, 1);
  const vw = Math.round(image.width * scale);
  const vh = Math.round(image.height * scale);

  // the picture, or the separated letters inside the chosen area on a checkerboard
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const t = setTimeout(() => {
      c.width = vw;
      c.height = vh;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, vw, vh);
      if (!showResult) {
        ctx.drawImage(image, 0, 0, vw, vh);
        return;
      }
      ctx.globalAlpha = 0.25;
      ctx.drawImage(image, 0, 0, vw, vh);
      ctx.globalAlpha = 1;
      const out = extractInk(image, rect, opts, Math.max(vw, vh) * 1.5);
      const x = rect.x * scale, y = rect.y * scale, w = rect.w * scale, h = rect.h * scale;
      ctx.fillStyle = '#64748b';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#475569';
      for (let yy = 0; yy < h; yy += 8) for (let xx = (Math.floor(yy / 8) % 2) * 8; xx < w; xx += 16) ctx.fillRect(x + xx, y + yy, 8, 8);
      ctx.drawImage(out, x, y, w, h);
    }, 120);
    return () => clearTimeout(t);
  }, [image, rect, opts, showResult, vw, vh, scale]);

  const toImage = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(image.width, (e.clientX - r.left) / scale)),
      y: Math.max(0, Math.min(image.height, (e.clientY - r.top) / scale)),
    };
  };

  const onDown = (e: React.MouseEvent) => {
    const p = toImage(e);
    drag.current = { ...p, moved: false };
  };
  const onMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    const p = toImage(e);
    const s = drag.current;
    if (Math.abs(p.x - s.x) * scale + Math.abs(p.y - s.y) * scale < 4) return;
    s.moved = true;
    setRect({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const onUp = (e: React.MouseEvent) => {
    const s = drag.current;
    drag.current = null;
    if (!s) return;
    if (!s.moved && picking) {
      const col = colorAt(image, s.x, s.y);
      setOpts((o) => ({ ...o, [picking]: col, useAlpha: false }));
      setPicking(null);
      setShowResult(true);
    } else if (s.moved && (rect.w < 8 || rect.h < 8)) {
      setRect(full);
    }
    void e;
  };

  const apply = () => {
    setBusy(true);
    // let the button show its state before the full-size pass
    setTimeout(() => {
      onApply(extractInk(image, rect, opts));
      setBusy(false);
    }, 30);
  };

  const btn = 'flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px]';
  const swatch = (c: [number, number, number] | null, label: string) => (
    <span className="flex items-center gap-1.5">
      <span className="w-4 h-4 rounded border border-slate-600" style={{ background: c ? hex(c) : 'transparent' }} />
      <span className="font-mono">{c ? hex(c) : label}</span>
    </span>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 select-none">
      <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-[#0f131c]">
          <div className="flex items-center gap-2.5">
            <Crop className="w-4 h-4 text-sky-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Ambil huruf dari gambar</h3>
              <p className="text-[11px] text-slate-400">{name}</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 lg:grid-cols-[1fr_16rem]">
          <div className="p-5 flex flex-col items-center gap-2 min-w-0">
            <div
              className={`relative ${picking ? 'cursor-crosshair' : 'cursor-cell'}`}
              style={{ width: vw, height: vh }}
              onMouseDown={onDown}
              onMouseMove={onMove}
              onMouseUp={onUp}
              onMouseLeave={() => (drag.current = null)}
            >
              <canvas ref={canvasRef} className="block rounded" style={{ width: vw, height: vh }} />
              {/* everything outside the area is dimmed */}
              <div
                className="absolute border-2 border-sky-400 pointer-events-none"
                style={{
                  left: rect.x * scale,
                  top: rect.y * scale,
                  width: rect.w * scale,
                  height: rect.h * scale,
                  boxShadow: '0 0 0 9999px rgba(2,6,23,0.55)',
                }}
              />
            </div>
            <p className="text-[10px] text-slate-500">
              {picking
                ? picking === 'bg'
                  ? 'Klik warna latar di gambar.'
                  : 'Klik warna huruf di gambar.'
                : 'Tarik kotak di gambar untuk memilih area yang diambil; bagian di luar kotak diabaikan.'}
            </p>
          </div>

          <div className="p-5 space-y-4 border-l border-slate-800 text-[11px] text-slate-400">
            <section className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-1">Area</h4>
              <p className="font-mono text-slate-500">{`${Math.round(rect.w)}×${Math.round(rect.h)} px`}</p>
              <button type="button" onClick={() => setRect(full)} className={`${btn} border-slate-700 text-slate-300 hover:bg-slate-800`}>
                <Maximize className="w-3.5 h-3.5" /> Seluruh gambar
              </button>
            </section>

            <section className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-1">Pisahkan dari latar</h4>
              <div className="flex items-center justify-between gap-2">
                <span>Latar</span>
                {swatch(opts.bg, 'otomatis')}
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setPicking(picking === 'bg' ? null : 'bg')}
                  className={`${btn} ${picking === 'bg' ? 'border-sky-500 bg-sky-600/20 text-white' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                >
                  <Pipette className="w-3.5 h-3.5" /> Pilih latar
                </button>
                {opts.bg && (
                  <button type="button" onClick={() => setOpts((o) => ({ ...o, bg: null }))} className={`${btn} border-slate-700 text-slate-400 hover:bg-slate-800`}>
                    Otomatis
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Warna huruf</span>
                {swatch(opts.ink, 'otomatis')}
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setPicking(picking === 'ink' ? null : 'ink')}
                  className={`${btn} ${picking === 'ink' ? 'border-sky-500 bg-sky-600/20 text-white' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                >
                  <Pipette className="w-3.5 h-3.5" /> Pilih huruf
                </button>
                {opts.ink && (
                  <button type="button" onClick={() => setOpts((o) => ({ ...o, ink: null }))} className={`${btn} border-slate-700 text-slate-400 hover:bg-slate-800`}>
                    Otomatis
                  </button>
                )}
              </div>
              <label className="flex items-center justify-between gap-2">
                <span>{`Toleransi ${opts.tolerance}`}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={opts.tolerance}
                  onChange={(e) => setOpts((o) => ({ ...o, tolerance: Number(e.target.value) }))}
                  className="w-24 accent-sky-500"
                />
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer" title="Untuk PNG yang latarnya sudah transparan">
                <input type="checkbox" checked={opts.useAlpha} onChange={(e) => setOpts((o) => ({ ...o, useAlpha: e.target.checked }))} className="accent-sky-500" />
                Pakai transparansi gambar
              </label>
              <p className="text-[10px] text-slate-500 leading-snug">
                Latar polos dikenali otomatis. Untuk latar bergradasi atau berwarna-warni, pilih warna latar dan warna huruf, lalu atur toleransi.
              </p>
            </section>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input type="checkbox" checked={showResult} onChange={(e) => setShowResult(e.target.checked)} className="accent-sky-500" />
              Lihat hasil pemisahan
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-3 border-t border-slate-800 bg-[#0f131c]">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800">
            Batal
          </button>
          <button
            onClick={apply}
            disabled={busy}
            className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? 'Memproses…' : 'Pakai area ini'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FontSheetCropDialog;
