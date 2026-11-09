'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pipette } from 'lucide-react';

/** '#abc', 'ABC', ' #aabbcc ', '0xAABBCC' become '#aabbcc'; anything else is null. */
export function normalizeHex(text: string): string | null {
  const m = text.trim().replace(/^(#|0x)/i, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(m)) return `#${m}`;
  if (/^[0-9a-f]{3}$/.test(m)) return `#${m[0]}${m[0]}${m[1]}${m[1]}${m[2]}${m[2]}`;
  return null;
}

type Hsv = { h: number; s: number; v: number };

function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const f = (k: number) => {
    const p = (k + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(p, 4 - p, 1))) * 255).toString(16).padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

const WIDTH = 232;
const HEIGHT = 236;

/**
 * Replaces the browser's colour popup for every <input type="color"> of the app (that popup cannot be changed and
 * does not take a pasted code). The input stays the source of truth: a new colour is written into it and an `input`
 * event is fired, so each input's own onChange runs as usual.
 */
export const ColorPopover: React.FC = () => {
  const [target, setTarget] = useState<HTMLInputElement | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hsv, setHsv] = useState<Hsv>({ h: 0, s: 0, v: 0 });
  const [text, setText] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const svRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);
  const pendingHex = useRef<string | null>(null);

  // the page's own click on a colour input opens this popover instead of the browser's
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement) || el.type !== 'color' || el.disabled) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setPos({
        x: Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8)),
        y: r.bottom + 6 + HEIGHT > window.innerHeight ? Math.max(8, r.top - HEIGHT - 6) : r.bottom + 6,
      });
      setHsv(hexToHsv(normalizeHex(el.value) ?? '#000000'));
      setText(el.value);
      setTarget(el);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    if (!target) return;
    const start = target.value;
    inputRef.current?.focus();
    inputRef.current?.select();
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && rootRef.current?.contains(e.target)) return;
      if (e.target === target) return;
      setTarget(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      setTarget(null);
      target.focus();
    };
    const close = () => setTarget(null);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', close);
      // closing ends the edit like the browser's own picker: a 'change' event (React already saw the colour; the
      // activity log listens for it). A colour still waiting for the next frame is written first.
      if (frame.current) {
        cancelAnimationFrame(frame.current);
        frame.current = 0;
        const value = pendingHex.current;
        if (target.isConnected && value && target.value !== value) {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(target, value);
          target.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      if (target.isConnected && target.value !== start) target.dispatchEvent(new Event('change', { bubbles: true }));
    };
  }, [target]);

  /** Writes the colour into the input (at most once a frame: a drag fires far more moves than the kit can redraw). */
  const apply = useCallback(
    (hex: string) => {
      pendingHex.current = hex;
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        const value = pendingHex.current;
        if (!target?.isConnected || !value || target.value === value) return;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(target, value);
        target.dispatchEvent(new Event('input', { bubbles: true }));
      });
    },
    [target]
  );

  const setFromHsv = (next: Hsv) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setText(hex);
    apply(hex);
  };

  const setFromText = (value: string) => {
    setText(value);
    const hex = normalizeHex(value);
    if (!hex) return;
    setHsv(hexToHsv(hex));
    apply(hex);
  };

  const pickSv = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = svRef.current!.getBoundingClientRect();
    setFromHsv({
      h: hsv.h,
      s: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      v: 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    });
  };

  if (!target) return null;
  const valid = !!normalizeHex(text);
  const EyeDropperApi = (window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper;

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Pilih warna"
      data-color-popover
      style={{ left: pos.x, top: pos.y, width: WIDTH }}
      className="fixed z-[10000] rounded-lg border border-slate-700 bg-[#161b26] p-2.5 space-y-2.5 shadow-xl select-none"
    >
      <div
        ref={svRef}
        // keep the focus in the code field, so typing never reaches the app's single-key shortcuts
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          pickSv(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) pickSv(e);
        }}
        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
        className="relative h-32 rounded-md cursor-crosshair touch-none"
      >
        <div className="absolute inset-0 rounded-md bg-gradient-to-r from-white to-transparent" />
        <div className="absolute inset-0 rounded-md bg-gradient-to-t from-black to-transparent" />
        <div
          className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white shadow pointer-events-none"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={359}
        value={Math.round(hsv.h)}
        onChange={(e) => setFromHsv({ ...hsv, h: Number(e.target.value) })}
        aria-label="Rona warna"
        style={{ background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
        className="block w-full h-2.5 rounded-full appearance-none cursor-pointer"
      />
      <div className="flex items-center gap-1.5">
        <span className="w-7 h-7 rounded border border-slate-600 shrink-0" style={{ backgroundColor: normalizeHex(text) ?? hsvToHex(hsv) }} />
        <input
          ref={inputRef}
          type="text"
          value={text}
          spellCheck={false}
          onChange={(e) => setFromText(e.target.value)}
          aria-label="Kode warna (hex)"
          aria-invalid={!valid}
          title="Kode warna (hex)"
          className={`flex-1 min-w-0 bg-slate-900 border rounded px-2 py-1 text-xs font-mono uppercase text-slate-100 outline-none select-text ${
            valid ? 'border-slate-700 focus:border-sky-500' : 'border-rose-500'
          }`}
        />
        {EyeDropperApi && (
          <button
            type="button"
            onClick={() =>
              new EyeDropperApi()
                .open()
                .then((r) => setFromText(r.sRGBHex))
                .catch(() => {}) // Esc while picking
            }
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-700 text-slate-300 hover:bg-slate-800 shrink-0"
            title="Ambil warna dari layar"
            aria-label="Ambil warna dari layar"
          >
            <Pipette className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};
