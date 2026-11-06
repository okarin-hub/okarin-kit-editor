'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Shirt, ImagePlus, Trash2 } from 'lucide-react';
import { InfoTip } from '@/components/ui/InfoTip';
import { PhotoRect, PhotoMark, guessAreas } from '@/utils/photoPattern';
import type { PhotoPatternRequest, PhotoPatternReply } from '@/workers/photoPattern.worker';
import type { RecognisedPattern } from '@/utils/patternRecognise';

interface Shot {
  image: HTMLImageElement;
  /** the same picture for the worker */
  bitmap: ImageBitmap;
  name: string;
  rect: PhotoRect;
  /** sleeve boxes, by their side in the photo */
  left: PhotoRect;
  right: PhotoRect;
}

/** What a mouse action on the photo does: draw one of the boxes, or mark a colour as pattern (keep) or not (drop). */
type Area = 'rect' | 'left' | 'right' | 'keep' | 'drop';

interface PhotoPatternModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** the flat kit texture, ready for the PNG colour split */
  onDone: (file: File) => void;
  /** a recognised regular pattern: set the part colours and add it as a pattern layer */
  onApplyPattern: (pattern: RecognisedPattern) => void;
}

const VIEW = 300;

/** Short name of a recognised pattern. */
const patternName = (r: RecognisedPattern) => {
  if (r.kind === 'plain') return 'Polos';
  if (r.kind === 'stripes') return r.angle === 0 ? 'Strip vertikal' : r.angle === 90 ? 'Strip horizontal' : `Strip miring ${Math.round(r.angle)}°`;
  return r.angle === 0 ? 'Satu strip tegak' : r.angle === 90 ? 'Satu pita mendatar' : `Satu pita miring ${Math.round(r.angle)}°`;
};

/** One photo with the body (and sleeve) boxes; dragging redraws the box being edited, a click in mark mode marks a colour. */
const ShotView: React.FC<{
  shot: Shot;
  area: Area;
  sleeves: boolean;
  onRect: (r: PhotoRect) => void;
  marks?: PhotoMark[];
  onMark?: (m: PhotoMark) => void;
}> = ({ shot, area, sleeves, onRect, marks = [], onMark }) => {
  const marking = area === 'keep' || area === 'drop';
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const scale = Math.min(VIEW / shot.image.width, (VIEW * 1.25) / shot.image.height);
  const vw = Math.round(shot.image.width * scale), vh = Math.round(shot.image.height * scale);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = vw;
    c.height = vh;
    c.getContext('2d')!.drawImage(shot.image, 0, 0, vw, vh);
  }, [shot.image, vw, vh]);
  const at = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(shot.image.width, (e.clientX - r.left) / scale)),
      y: Math.max(0, Math.min(shot.image.height, (e.clientY - r.top) / scale)),
    };
  };
  const box = (r: PhotoRect, active: boolean, colour: string, key: string) => (
    <div
      key={key}
      className={`absolute border-2 pointer-events-none ${colour} ${active ? '' : 'border-dashed opacity-60'}`}
      style={{ left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale }}
    />
  );
  const dim = marking ? shot.rect : shot[area as 'rect' | 'left' | 'right'];
  return (
    <div
      className={`relative mx-auto ${marking && !onMark ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
      style={{ width: vw, height: vh }}
      onMouseDown={(e) => {
        if (marking) {
          const p = at(e);
          onMark?.({ x: Math.round(p.x), y: Math.round(p.y), keep: area === 'keep' });
          return;
        }
        drag.current = at(e);
      }}
      onMouseMove={(e) => {
        const s = drag.current;
        if (!s) return;
        const p = at(e);
        if (Math.abs(p.x - s.x) * scale + Math.abs(p.y - s.y) * scale < 6) return;
        onRect({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
      }}
      onMouseUp={() => (drag.current = null)}
      onMouseLeave={() => (drag.current = null)}
    >
      <canvas ref={ref} className="block rounded" style={{ width: vw, height: vh }} />
      <div
        className="absolute pointer-events-none"
        style={{ left: dim.x * scale, top: dim.y * scale, width: dim.w * scale, height: dim.h * scale, boxShadow: '0 0 0 9999px rgba(2,6,23,0.45)' }}
      />
      {box(shot.rect, area === 'rect', 'border-sky-400', 'rect')}
      {sleeves && box(shot.left, area === 'left', 'border-amber-400', 'left')}
      {sleeves && box(shot.right, area === 'right', 'border-amber-400', 'right')}
      {marks.map((m, i) => (
        <span
          key={i}
          className={`absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white pointer-events-none ${m.keep ? 'bg-emerald-500' : 'bg-rose-500'}`}
          style={{ left: m.x * scale, top: m.y * scale }}
        />
      ))}
    </div>
  );
};

/** Pattern of a jersey photo (front, optional back) as a flat kit texture; logos are left out. */
export const PhotoPatternModal: React.FC<PhotoPatternModalProps> = ({ isOpen, onClose, onDone, onApplyPattern }) => {
  const [front, setFront] = useState<Shot | null>(null);
  const [back, setBack] = useState<Shot | null>(null);
  const [minShare, setMinShare] = useState(8);
  const [withSleeves, setWithSleeves] = useState(true);
  const [area, setArea] = useState<Area>('rect');
  // colours marked on the front photo
  const [marks, setMarks] = useState<PhotoMark[]>([]);
  const [result, setResult] = useState<{ palette: string[]; texture: HTMLCanvasElement; recognised: RecognisedPattern | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const lastRequest = useRef(0);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const frontInput = useRef<HTMLInputElement | null>(null);
  const backInput = useRef<HTMLInputElement | null>(null);

  // the pattern work runs in a worker (seconds on a big photo) so the editor stays responsive
  useEffect(() => {
    if (!isOpen) return;
    const w = new Worker(new URL('../../workers/photoPattern.worker.ts', import.meta.url));
    w.onmessage = (e: MessageEvent<PhotoPatternReply>) => {
      const reply = e.data;
      // an older request (a box was moved again meanwhile): drop it
      if (reply.id !== lastRequest.current) {
        if ('texture' in reply) reply.texture.close();
        return;
      }
      setBusy(false);
      if ('error' in reply) return setStatus(`Pola gagal dibuat: ${reply.error}`);
      const texture = document.createElement('canvas');
      texture.width = reply.texture.width;
      texture.height = reply.texture.height;
      texture.getContext('2d')!.drawImage(reply.texture, 0, 0);
      reply.texture.close();
      setResult({ palette: reply.palette, texture, recognised: reply.recognised });
    };
    // the worker itself failed (did not load, or crashed): say so instead of waiting for ever
    w.onerror = (e) => {
      setBusy(false);
      setStatus(`Pola gagal dibuat: ${e.message || 'worker error'}`);
    };
    worker.current = w;
    return () => {
      w.terminate();
      worker.current = null;
    };
  }, [isOpen]);

  // flatten the pattern again shortly after the last change
  useEffect(() => {
    if (!isOpen || !front) {
      setBusy(false);
      return setResult(null);
    }
    const t = setTimeout(() => {
      const shot = (s: Shot) => ({ image: s.bitmap, rect: s.rect, left: s.left, right: s.right });
      const req: PhotoPatternRequest = {
        id: ++lastRequest.current,
        front: shot(front),
        back: back ? shot(back) : null,
        minShare: minShare / 100,
        withSleeves,
        marks,
      };
      setBusy(true);
      worker.current?.postMessage(req);
    }, 200);
    return () => clearTimeout(t);
  }, [isOpen, front, back, minShare, withSleeves, marks]);

  // marks belong to one photo
  useEffect(() => setMarks([]), [front?.image]);

  // preview: the shirt pieces of the texture (front, back and sleeves)
  useEffect(() => {
    const c = previewRef.current;
    if (!c || !result) return;
    const src = { x: 0, y: 0, w: 1024, h: 940 };
    c.width = 512;
    c.height = Math.round((512 * src.h) / src.w);
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(result.texture, src.x, src.y, src.w, src.h, 0, 0, c.width, c.height);
  }, [result]);

  if (!isOpen) return null;

  const load = async (file: File | undefined, set: (s: Shot) => void) => {
    if (!file) return;
    try {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      await image.decode();
      const g = guessAreas(image);
      set({ image, bitmap: await createImageBitmap(image), name: file.name, rect: g.body, left: g.left, right: g.right });
      setStatus(null);
    } catch {
      setStatus('Gambar gagal dibaca.');
    }
  };

  const finish = () => {
    if (!result) return;
    result.texture.toBlob((blob) => {
      if (!blob) return setStatus('Tekstur gagal dibuat.');
      onDone(new File([blob], `${(front?.name ?? 'jersey').replace(/\.[^.]+$/, '')}-pola.png`, { type: 'image/png' }));
    }, 'image/png');
  };

  // the sleeve boxes only exist with "sleeves from the photo"
  const mode: Area = !withSleeves && (area === 'left' || area === 'right') ? 'rect' : area;
  const slot = (title: string, shot: Shot | null, set: (s: Shot | null) => void, input: React.RefObject<HTMLInputElement | null>, optional: boolean) => (
    <section className="space-y-2 min-w-0">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-200">{title}</h4>
        {shot && (
          <button type="button" onClick={() => set(null)} className="p-1 rounded text-slate-400 hover:bg-slate-800" title="Hapus foto">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {shot ? (
        <>
          <ShotView
            shot={shot}
            area={mode}
            sleeves={withSleeves}
            onRect={(r) => set({ ...shot, [mode]: r })}
            // colours are marked on the front photo (its colours are the pattern colours)
            marks={optional ? [] : marks}
            onMark={optional ? undefined : (m) => setMarks((prev) => [...prev, m])}
          />
          <p className="text-[10px] text-slate-500 text-center">
            {mode === 'keep' || mode === 'drop'
              ? optional
                ? 'Tandai warna di foto depan.'
                : mode === 'keep'
                  ? 'Klik warna yang termasuk pola (misalnya sash yang hilang).'
                  : 'Klik warna yang bukan pola (misalnya tulisan sponsor).'
              : mode === 'rect'
                ? 'Tarik kotak di badan baju (tanpa lengan dan kerah).'
                : 'Tarik kotak di lengan: dari bahu sampai ujung lengan.'}
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="w-full h-40 flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-700 text-[11px] text-slate-400 hover:bg-slate-800/50"
        >
          <ImagePlus className="w-5 h-5" />
          {optional ? 'Foto belakang (opsional)' : 'Pilih foto depan'}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          load(e.target.files?.[0], set);
          e.target.value = '';
        }}
      />
    </section>
  );

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0f131c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-600/20 text-sky-400 border border-sky-500/30">
              <Shirt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Pola dari foto jersey
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Eksperimental
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Pola badan baju diambil dari foto; logo dan tulisan dibuang. Hasilnya dijadikan layer warna yang bisa diedit.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.3fr] gap-5 p-5">
          {(front || back) && (
            <div className="lg:col-span-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 -mb-2">
              <span>Kotak yang ditarik:</span>
              {(
                [
                  ['rect', 'Badan'],
                  ...(withSleeves
                    ? [
                        ['left', 'Lengan kiri gambar'],
                        ['right', 'Lengan kanan gambar'],
                      ]
                    : []),
                ] as [Area, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setArea(k)}
                  className={`px-2 py-1 rounded border ${mode === k ? 'border-sky-500 bg-sky-500/15 text-sky-200' : 'border-slate-700 hover:bg-slate-800'}`}
                >
                  {label}
                </button>
              ))}
              <span className="ml-2 flex items-center gap-1">
                Tandai warna:
                <InfoTip text="Klik di foto depan. + Warna pola: warna itu selalu dipakai, walaupun kecil (sash yang hilang). − Buang warna: warna itu tidak dipakai (tulisan sponsor yang terbaca sebagai pola)." />
              </span>
              {(
                [
                  ['keep', '+ Warna pola', 'border-emerald-500 bg-emerald-500/15 text-emerald-200'],
                  ['drop', '− Buang warna', 'border-rose-500 bg-rose-500/15 text-rose-200'],
                ] as [Area, string, string][]
              ).map(([k, label, on]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setArea(k)}
                  className={`px-2 py-1 rounded border ${mode === k ? on : 'border-slate-700 hover:bg-slate-800'}`}
                >
                  {label}
                </button>
              ))}
              {marks.length > 0 && (
                <button type="button" onClick={() => setMarks([])} className="px-2 py-1 rounded border border-slate-700 hover:bg-slate-800">
                  {`Hapus tanda (${marks.length})`}
                </button>
              )}
            </div>
          )}
          {(front || back) && <div className="hidden lg:block" />}
          {slot('Depan', front, setFront, frontInput, false)}
          {slot('Belakang', back, setBack, backInput, true)}
          <section className="space-y-2 min-w-0">
            <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              Hasil
              {busy && <span className="text-[10px] font-normal text-sky-300 animate-pulse">Memproses…</span>}
            </h4>
            <div
              className="rounded-lg border border-slate-800 overflow-hidden"
              style={{ backgroundImage: 'repeating-conic-gradient(#64748b 0% 25%, #475569 0% 50%)', backgroundSize: '16px 16px' }}
            >
              {result ? <canvas ref={previewRef} className="w-full h-auto block" /> : <div className="h-40" />}
            </div>
            {result && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                <span>Warna pola:</span>
                {result.palette.map((c) => (
                  <span key={c} className="flex items-center gap-1 font-mono text-[10px]">
                    <span className="w-4 h-4 rounded border border-slate-600" style={{ background: c }} />
                    {c}
                  </span>
                ))}
              </div>
            )}
            {result?.recognised && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 space-y-1 text-[11px] text-emerald-200">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span>Pola dikenali:</span>
                  <b>{patternName(result.recognised)}</b>
                  {result.recognised.kind === 'stripes' && (
                    <span>{`lebar ${Math.round(result.recognised.width)} px, jarak ${Math.round(result.recognised.period)} px`}</span>
                  )}
                  <span className="text-emerald-300/70">{`${Math.round(result.recognised.fit * 100)}% cocok`}</span>
                </div>
                <p className="text-[10px] text-emerald-200/70 leading-snug">
                  Pakai sebagai layer pola: warna dasar baju dan lengan diganti, lalu polanya ditambahkan sebagai layer pola di grup Baju (bisa diubah lebar, jarak, dan warnanya; Ctrl+Z membatalkan).
                </p>
              </div>
            )}
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
              <input type="checkbox" checked={withSleeves} onChange={(e) => setWithSleeves(e.target.checked)} className="accent-sky-500" />
              Lengan dan bahu dari foto (kotak kuning)
            </label>
            <label className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                {`Batas warna pola ${minShare}%`}
                <InfoTip text="Warna yang menutupi kurang dari batas ini dianggap logo atau tulisan dan diisi dari pola di sekitarnya. Turunkan kalau ada warna pola tipis yang hilang." />
              </span>
              <input type="range" min={3} max={25} value={minShare} onChange={(e) => setMinShare(Number(e.target.value))} className="w-28 accent-sky-500" />
            </label>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-800 bg-[#0f131c]">
          {status && <span className="mr-auto text-[11px] text-amber-300">{status}</span>}
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800">
            Batal
          </button>
          <button
            onClick={finish}
            disabled={!result}
            className={
              result?.recognised
                ? 'px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800 disabled:opacity-50'
                : 'px-5 py-2 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50'
            }
          >
            Lanjut: jadikan layer warna
          </button>
          {result?.recognised && (
            <button
              onClick={() => onApplyPattern(result.recognised!)}
              className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-500"
            >
              Pakai sebagai layer pola
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoPatternModal;
