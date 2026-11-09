'use client';

import React, { useEffect, useRef } from 'react';
import { CANVAS_TEXTURE_SIZE } from '@/constants/pes2021Parts';

const T = 18; // ruler thickness, CSS px
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];

/** Label step for a zoom: the smallest whose labels sit at least 56 CSS px apart. */
export function rulerStep(pxPerUnit: number): number {
  return STEPS.find((s) => s * pxPerUnit >= 56) ?? 1000;
}

// self-check (runs once at import, cheap)
if (rulerStep(0.6) !== 100 || rulerStep(1) !== 100 || rulerStep(3) !== 20 || rulerStep(0.05) !== 1000) {
  console.error('CanvasRulers step self-check failed');
}

interface Props {
  /** Container size, CSS px. */
  w: number;
  h: number;
  /** Where texture (0, 0) sits in the container, CSS px. */
  originX: number;
  originY: number;
  /** CSS px per texture px. */
  pxPerUnit: number;
}

/** Top and left rulers over the 2D canvas, in texture px (0 to 1024, the kit's edges in red). */
export const CanvasRulers: React.FC<Props> = ({ w, h, originX, originY, pxPerUnit }) => {
  const topRef = useRef<HTMLCanvasElement>(null);
  const leftRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const step = rulerStep(pxPerUnit);
    const minor = step % 5 === 0 ? step / 5 : step / 2;
    const showMinor = minor * pxPerUnit >= 6;
    const draw = (cv: HTMLCanvasElement | null, len: number, origin: number, vertical: boolean) => {
      if (!cv) return;
      cv.width = Math.round((vertical ? T : len) * dpr);
      cv.height = Math.round((vertical ? len : T) * dpr);
      const c = cv.getContext('2d');
      if (!c) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      // drawn as a top ruler; the left one swaps x and y (a mirror along the diagonal), its labels turned back below
      if (vertical) c.transform(0, 1, 1, 0, 0, 0);
      c.fillStyle = '#0f131c';
      c.fillRect(0, 0, len, T);
      c.fillStyle = '#1e293b';
      c.fillRect(0, T - 1, len, 1);
      c.font = '9px ui-monospace, monospace';
      c.textBaseline = 'top';
      // texture units shown: from the ruler's start (after the corner) to its end
      const u0 = (T - origin) / pxPerUnit;
      const u1 = (len - origin) / pxPerUnit;
      const unit = showMinor ? minor : step;
      for (let u = Math.ceil(u0 / unit) * unit; u <= u1; u += unit) {
        const p = Math.round(origin + u * pxPerUnit) + 0.5;
        const major = u % step === 0;
        const edge = u === 0 || u === CANVAS_TEXTURE_SIZE;
        c.fillStyle = edge ? '#f43f5e' : major ? '#64748b' : '#334155';
        const tick = edge || major ? T - 4 : 5;
        c.fillRect(p, T - 1 - tick, 1, tick);
        if (major) {
          c.fillStyle = edge ? '#fda4af' : '#94a3b8';
          c.save();
          if (vertical) {
            // undo the diagonal mirror for the text and turn it a quarter: it reads bottom to top
            c.translate(p - 3, 2);
            c.transform(0, 1, 1, 0, 0, 0);
            c.rotate(-Math.PI / 2);
            c.fillText(String(u), 0, 0);
          } else {
            c.fillText(String(u), p + 3, 2);
          }
          c.restore();
        }
      }
    };
    draw(topRef.current, w, originX, false);
    draw(leftRef.current, h, originY, true);
  }, [w, h, originX, originY, pxPerUnit]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
      <canvas ref={topRef} className="absolute left-0 top-0" style={{ width: w, height: T }} />
      <canvas ref={leftRef} className="absolute left-0 top-0" style={{ width: T, height: h }} />
      <div className="absolute left-0 top-0 bg-[#0f131c] border-b border-r border-slate-800" style={{ width: T, height: T }} />
    </div>
  );
};
