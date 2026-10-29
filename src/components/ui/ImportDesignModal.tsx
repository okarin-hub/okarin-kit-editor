'use client';

import React, { useRef, useState } from 'react';
import { X, Upload, ImageDown, Trash2, AlertTriangle, Layers } from 'lucide-react';
import { BaseTexture } from '@/types/kit';
import { decodeDDS } from '@/utils/ddsDecoder';

interface ImportDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseTexture: BaseTexture | null;
  onImport: (texture: BaseTexture) => void;
  onUpdate: (update: Partial<BaseTexture>) => void;
  onRemove: () => void;
}

const MAX_FILE_MB = 40;
const MAX_SIDE = 2048;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Gagal membaca file.'));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('File gambar tidak bisa dibuka.'));
    img.src = src;
  });
}

/** Converts a DDS file to a PNG data URL. */
async function ddsToPngDataUrl(file: File): Promise<{ url: string; width: number; height: number }> {
  const decoded = decodeDDS(await file.arrayBuffer());
  const canvas = document.createElement('canvas');
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia.');
  const img = ctx.createImageData(decoded.width, decoded.height);
  img.data.set(decoded.data);
  ctx.putImageData(img, 0, 0);
  return { url: canvas.toDataURL('image/png'), width: decoded.width, height: decoded.height };
}

/** Downscales huge images so memory use and autosave stay reasonable. */
async function limitSize(url: string): Promise<{ url: string; width: number; height: number }> {
  const img = await loadImage(url);
  const { naturalWidth: w, naturalHeight: h } = img;
  if (Math.max(w, h) <= MAX_SIDE) return { url, width: w, height: h };
  const k = MAX_SIDE / Math.max(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
}

export const ImportDesignModal: React.FC<ImportDesignModalProps> = ({
  isOpen,
  onClose,
  baseTexture,
  onImport,
  onUpdate,
  onRemove,
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'replace' | 'overlay'>('replace');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'warn' } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setMessage({ text: `File terlalu besar (maks ${MAX_FILE_MB} MB).`, type: 'error' });
      return;
    }

    setBusy(true);
    try {
      const isDds = /\.dds$/i.test(file.name);
      const isImage =
        /^image\/(png|jpeg|webp|bmp|gif)$/i.test(file.type) || /\.(png|jpe?g|webp|bmp)$/i.test(file.name);
      if (!isDds && !isImage) {
        throw new Error('Format belum didukung. Gunakan PNG, JPG, WebP, atau DDS.');
      }

      const raw = isDds ? await ddsToPngDataUrl(file) : await limitSize(await readAsDataUrl(file));

      if (raw.width !== raw.height) {
        setMessage({
          text: `Gambar tidak persegi (${raw.width}×${raw.height}). Template PES berukuran 1024×1024 atau 2048×2048; gambar akan diregangkan.`,
          type: 'warn',
        });
      } else if (![1024, 2048].includes(raw.width)) {
        setMessage({
          text: `Ukuran ${raw.width}×${raw.height} bukan ukuran standar PES (1024 atau 2048); akan diskalakan.`,
          type: 'warn',
        });
      }

      onImport({
        src: raw.url,
        name: file.name,
        mode,
        opacity: mode === 'overlay' ? 0.6 : 1,
      });
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal mengimpor desain.', type: 'error' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const activeMode = baseTexture ? baseTexture.mode : mode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0f131c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-600/20 text-sky-400 border border-sky-500/30">
              <ImageDown className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Import Desain</h3>
              <p className="text-[11px] text-slate-400">Muat tekstur kit yang sudah jadi ke canvas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Cara Menampilkan
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['replace', 'Ganti Desain', 'Gambar jadi dasar kit; pola, strip & logo bisa ditambah di atasnya'],
                  ['overlay', 'Overlay', 'Gambar di atas bagian kit dengan transparansi'],
                ] as const
              ).map(([m, title, desc]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    if (baseTexture) {
                      onUpdate({
                        mode: m,
                        opacity: m === 'overlay' ? Math.min(baseTexture.opacity, 0.6) : 1,
                      });
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    activeMode === m
                      ? 'bg-sky-950/40 border-sky-500 text-white'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="text-xs font-bold">{title}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Current import */}
          {baseTexture && (
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={baseTexture.src}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover border border-slate-700 bg-[#111318]"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate">{baseTexture.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {baseTexture.mode === 'replace' ? 'Menggantikan bagian kit' : 'Overlay di atas bagian kit'}
                  </div>
                </div>
                <button
                  onClick={onRemove}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-300 hover:text-white bg-rose-950/50 hover:bg-rose-700 border border-rose-900/70 px-2.5 py-1.5 rounded-lg transition-colors"
                  title="Hapus desain impor dan kembali ke bagian kit"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus
                </button>
              </div>

              {baseTexture.mode === 'overlay' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Transparansi</span>
                    <span className="font-mono">{Math.round(baseTexture.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    value={Math.round(baseTexture.opacity * 100)}
                    onChange={(e) => onUpdate({ opacity: Number(e.target.value) / 100 })}
                    className="w-full accent-sky-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              dragOver
                ? 'border-sky-400 bg-sky-950/30'
                : 'border-slate-700 hover:border-slate-500 bg-slate-900/40'
            }`}
          >
            <Upload className="w-6 h-6 mx-auto mb-2 text-sky-400" />
            <div className="text-xs font-semibold text-slate-200">
              {busy
                ? 'Memproses...'
                : baseTexture
                ? 'Pilih file lain untuk mengganti'
                : 'Klik atau seret file ke sini'}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              PNG, JPG, WebP, atau DDS (DXT1/DXT3/DXT5/BGRA) — idealnya 1024×1024 atau 2048×2048
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.bmp,.dds,image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          {message && (
            <div
              className={`flex gap-2 p-3 rounded-lg text-[11px] leading-relaxed border ${
                message.type === 'error'
                  ? 'bg-rose-950/40 border-rose-900/60 text-rose-200'
                  : 'bg-amber-950/30 border-amber-900/50 text-amber-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{message.text}</span>
            </div>
          )}

          <div className="flex gap-2 text-[10px] text-slate-500 leading-relaxed">
            <Layers className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Gambar harus berformat template PES (punggung terbalik di atas, depan di bawah). Setelah diimpor kamu
              tetap bisa menambah logo, nama dan nomor, melihat hasilnya di 3D, lalu export. Di mode Ganti Desain warna dasar bagian tidak dipakai, tetapi pola dan strip dari tab Layer tetap digambar di atas gambar (pilih pola Polos bila tidak diinginkan). Untuk membuka file proyek
              .peskit, pakai menu Proyek.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-800 bg-[#0f131c]">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 active:scale-95 transition-all"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportDesignModal;
