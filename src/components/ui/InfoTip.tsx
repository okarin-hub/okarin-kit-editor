'use client';

import React, { useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';

const TIP_W = 240;

/**
 * A small "?" next to a heading: the explanation shows on hover / focus / click instead of a paragraph that is
 * always on screen. The full guide is in Help, Panduan. The bubble is placed in screen coordinates so a
 * scrolling side panel or the window edge never cuts it off.
 */
export const InfoTip: React.FC<{ text: React.ReactNode }> = ({ text }) => {
  const btn = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - TIP_W / 2), window.innerWidth - TIP_W - 8);
    setPos({ left, top: r.bottom + 6 });
  };
  const hide = () => setPos(null);

  return (
    <span className="inline-flex align-middle" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={btn}
        type="button"
        aria-label="Penjelasan"
        aria-expanded={!!pos}
        onClick={(e) => {
          e.stopPropagation();
          if (pos) hide();
          else show();
        }}
        onFocus={show}
        onBlur={hide}
        className="rounded-full text-slate-500 hover:text-slate-200 focus-visible:text-slate-200"
      >
        <CircleHelp className="w-3.5 h-3.5" />
      </button>
      {pos && (
        <span
          role="tooltip"
          style={{ left: pos.left, top: pos.top, width: TIP_W }}
          className="fixed z-[70] rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-[11px] font-normal normal-case tracking-normal leading-snug text-slate-300 shadow-lg shadow-black/50 pointer-events-none"
        >
          {text}
        </span>
      )}
    </span>
  );
};

export default InfoTip;
