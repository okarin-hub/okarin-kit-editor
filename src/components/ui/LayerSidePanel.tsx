'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const SIZE_KEY = 'kit-creator-layer-panel-size';
const DEFAULT_W = 320;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Edge = 'w' | 'h' | 'wh';

/**
 * The settings of one layer in a panel left of the layer list, level with the layer's row (Settings, layer editor:
 * side panel). It follows the row while the list scrolls and stays inside the window. The left edge, the bottom edge
 * and the bottom-left corner resize it (remembered); a double click on them goes back to the default size.
 */
export const LayerSidePanel: React.FC<{ anchor: string; title: string; onClose: () => void; children: React.ReactNode }> = ({
  anchor,
  title,
  onClose,
  children,
}) => {
  const panel = useRef<HTMLDivElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number; arrow: number } | null>(null);
  // h undefined = as tall as the content (up to the window)
  const [size, setSize] = useState<{ w: number; h?: number }>({ w: DEFAULT_W });
  // while a handle is dragged the panel stays where it is, so the edge follows the pointer
  const resizing = useRef(false);
  const placeRef = useRef<() => void>(() => {});

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SIZE_KEY) ?? 'null');
      if (saved && typeof saved.w === 'number') setSize({ w: saved.w, h: typeof saved.h === 'number' ? saved.h : undefined });
    } catch {
      // nothing saved / storage blocked: default size
    }
  }, []);

  const saveSize = (next: { w: number; h?: number }) => {
    setSize(next);
    try {
      localStorage.setItem(SIZE_KEY, JSON.stringify(next));
    } catch {
      // storage blocked: the size lasts until the panel closes
    }
  };

  const startResize = (edge: Edge) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const w0 = size.w;
    const h0 = panel.current?.offsetHeight ?? 400;
    const top0 = panel.current?.getBoundingClientRect().top ?? 96;
    let next = size;
    resizing.current = true;
    const move = (ev: PointerEvent) => {
      next = {
        // the panel is anchored on its right side: dragging the left edge to the left makes it wider
        w: edge === 'h' ? w0 : clamp(w0 + x0 - ev.clientX, 260, Math.min(760, window.innerWidth - 420)),
        h: edge === 'w' ? size.h : clamp(h0 + ev.clientY - y0, 160, window.innerHeight - 12 - top0),
      };
      setSize(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      resizing.current = false;
      saveSize(next);
      placeRef.current();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const resetSize = () => saveSize({ w: DEFAULT_W });

  useLayoutEffect(() => {
    const place = () => {
      if (resizing.current) return;
      const row = document.querySelector(`[data-layer-anchor="${anchor}"]`);
      const list = row?.closest('aside');
      if (!row || !list) return;
      const r = row.getBoundingClientRect();
      // the chosen height, else the height of the content (the panel may still be cut short by its old place)
      const p = panel.current;
      const natural = p && body.current ? p.offsetHeight - body.current.clientHeight + body.current.scrollHeight : 400;
      const h = Math.min(size.h ?? natural, window.innerHeight - 108);
      // below the menu bar and the canvas toolbar
      const top = Math.min(Math.max(96, r.top - 8), window.innerHeight - 12 - h);
      setPos({ top, right: window.innerWidth - list.getBoundingClientRect().left + 10, arrow: r.top + 10 - top });
    };
    placeRef.current = place;
    place();
    // once more after the first paint, when the panel's height is known
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
    };
  }, [anchor, size.h]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label={title}
      style={{
        width: size.w,
        height: size.h,
        ...(pos ? { top: pos.top, right: pos.right, maxHeight: `calc(100vh - ${pos.top + 12}px)` } : { visibility: 'hidden' }),
      }}
      className="fixed z-50 flex flex-col rounded-xl border border-slate-700 bg-[#121622] shadow-2xl shadow-black/60"
    >
      {/* resize handles: left edge (width), bottom edge (height), bottom-left corner (both) */}
      <span
        aria-hidden
        title="Seret untuk mengubah lebar; klik dua kali untuk ukuran awal"
        onPointerDown={startResize('w')}
        onDoubleClick={resetSize}
        className="absolute -left-1 top-3 bottom-3 w-2 cursor-ew-resize rounded-full hover:bg-sky-500/40"
      />
      <span
        aria-hidden
        title="Seret untuk mengubah tinggi; klik dua kali untuk ukuran awal"
        onPointerDown={startResize('h')}
        onDoubleClick={resetSize}
        className="absolute -bottom-1 left-3 right-3 h-2 cursor-ns-resize rounded-full hover:bg-sky-500/40"
      />
      <span
        aria-hidden
        title="Seret untuk mengubah ukuran; klik dua kali untuk ukuran awal"
        onPointerDown={startResize('wh')}
        onDoubleClick={resetSize}
        className="absolute -left-1 -bottom-1 w-3.5 h-3.5 cursor-nesw-resize rounded-full hover:bg-sky-500/40"
      />
      {pos && pos.arrow > 8 && (
        <span
          aria-hidden
          style={{ top: pos.arrow }}
          className="absolute -right-[7px] w-3 h-3 rotate-45 border-t border-r border-slate-700 bg-[#121622]"
        />
      )}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800">
        <h3 className="flex-1 min-w-0 truncate text-xs font-semibold text-white">{title}</h3>
        <button type="button" onClick={onClose} className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800" title="Tutup" aria-label="Tutup">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div ref={body} className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
};

export default LayerSidePanel;
