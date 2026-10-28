'use client';

import React, { useEffect, useState } from 'react';
import { X, ExternalLink, RefreshCw, BookOpen, Keyboard, Info, Heart, DownloadCloud } from 'lucide-react';
import { APP_VERSION, PROJECT_URL, UpdateResult, checkForUpdate } from '@/lib/updateCheck';

export type HelpKind = 'docs' | 'shortcuts' | 'update' | 'credits' | 'about';

const DOCS: { title: string; text: string }[] = [
  {
    title: 'Mulai cepat',
    text: 'Pilih preset dari menu Preset, atur warna tiap bagian di tab Layer, lalu tambahkan pola, lis, dan logo. Hasilnya terlihat langsung di canvas 2D dan model 3D.',
  },
  {
    title: 'Dasar kit',
    text: 'Dasar kit bisa dari warna tiap bagian, atau dari desain yang kamu import (File, Import desain). Warna bagian bisa ditumpuk di atas desain impor dengan ikon mata. Bentuk lengan bisa sampai pundak (mengikuti template PES) atau tanpa pundak.',
  },
  {
    title: 'Pola',
    text: 'Tiap pola adalah layer sendiri dengan ukuran, rotasi, posisi, cermin, dan bagian yang memakainya. Matikan Berulang untuk menampilkan pola hanya sekali.',
  },
  {
    title: 'Alat gambar',
    text: 'Bar alat di kiri canvas berisi pilih dan geser, gambar bentuk bebas atau titik, garis jahit titik (bisa melengkung) atau bebas, dan kuas hapus pola. Scroll untuk zoom dan seret untuk menggeser canvas.',
  },
  {
    title: 'Logo dan teks',
    text: 'Di tab Logo kamu bisa upload logo, mencari logo klub dari football-logos.cc, lalu mengatur ukuran, posisi, warna, gradasi, dan outline. Logo milikmu disimpan di folder library/logos.',
  },
  {
    title: 'Tekstur kain',
    text: 'Di tab Warna, tambahkan layer tekstur kain (pori-pori) per bagian dengan ukuran dan intensitas sendiri.',
  },
  {
    title: 'Export',
    text: 'File, Export kit: PNG untuk diedit, DDS atau FTEX untuk dipakai di game. FTEX ditulis langsung dan sudah diuji di PES 2021.',
  },
  {
    title: 'Proyek',
    text: 'File, Simpan proyek menyimpan kit ke browser atau ke file .peskit. Pekerjaanmu juga disimpan otomatis.',
  },
  {
    title: 'Folder library',
    text: 'Folder library/logos, library/patterns, library/templates, dan library/fonts dibaca saat aplikasi dibuka atau lewat tombol Reload di panel masing-masing.',
  },
];

const SHORTCUTS: { keys: string; text: string }[] = [
  { keys: 'Ctrl + Z', text: 'Undo' },
  { keys: 'Ctrl + Y', text: 'Redo' },
  { keys: 'Scroll', text: 'Zoom canvas 2D' },
  { keys: 'Seret', text: 'Geser canvas 2D' },
  { keys: 'Enter', text: 'Selesai menggambar' },
  { keys: 'Esc', text: 'Batal menggambar' },
  { keys: 'Backspace', text: 'Hapus titik terakhir' },
  { keys: 'Panah / Shift + Panah', text: 'Geser logo terpilih 1 px / 10 px' },
  { keys: 'Delete', text: 'Hapus logo terpilih' },
];

const CREDITS: { name: string; text: string }[] = [
  { name: 'Okarin Kit Editor', text: 'Dibuat oleh okarin-hub.' },
  { name: 'CometKIT previewer', text: 'Model 3D untuk preview kit.' },
  { name: 'football-logos.cc', text: 'Sumber logo klub, liga, dan turnamen (hanya untuk pemakaian non-komersial).' },
  { name: 'Next.js, React, Konva, Three.js, Tailwind CSS, lucide-react', text: 'Pustaka yang dipakai aplikasi ini.' },
];

const Shell: React.FC<{ title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode }> = ({
  title,
  icon,
  onClose,
  children,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onMouseDown={onClose}>
      <div
        className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl border border-slate-700 bg-[#121622] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-800">
          <span className="text-sky-400">{icon}</span>
          <h2 className="flex-1 text-sm font-bold text-white">{title}</h2>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800" title="Tutup">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-xs text-slate-300 space-y-3">{children}</div>
      </div>
    </div>
  );
};

const UpdateBody: React.FC = () => {
  const [state, setState] = useState<'checking' | 'done'>('checking');
  const [result, setResult] = useState<UpdateResult | null>(null);

  const run = async () => {
    setState('checking');
    setResult(await checkForUpdate());
    setState('done');
  };

  useEffect(() => {
    run();
  }, []);

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
        <span className="text-slate-400">Versi saat ini</span>
        <span className="font-mono text-slate-100" data-no-i18n>
          {APP_VERSION}
        </span>
      </div>

      {state === 'checking' && (
        <p className="flex items-center gap-2 text-slate-400">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Memeriksa pembaruan...
        </p>
      )}

      {state === 'done' && result?.status === 'latest' && (
        <p className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-emerald-200">
          Kamu memakai versi terbaru.
        </p>
      )}

      {state === 'done' && result?.status === 'available' && (
        <div className="space-y-2 rounded-lg border border-sky-700/60 bg-sky-950/30 px-3 py-2.5">
          <p className="text-sky-100 font-semibold">
            Versi baru tersedia: <span data-no-i18n>{result.latest}</span>
          </p>
          {result.notes && (
            <p className="whitespace-pre-wrap text-[11px] text-slate-300" data-no-i18n>
              {result.notes}
            </p>
          )}
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sky-300 hover:text-sky-200"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Buka halaman rilis
          </a>
        </div>
      )}

      {state === 'done' && result?.status === 'error' && (
        <p className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-amber-200 leading-relaxed">
          Tidak bisa membaca info rilis (repositori privat atau sedang offline). Cek manual di halaman proyek.
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={run}
          disabled={state === 'checking'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${state === 'checking' ? 'animate-spin' : ''}`} />
          Cek sekarang
        </button>
        <a
          href={PROJECT_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Halaman proyek
        </a>
      </div>
    </>
  );
};

/** Help dialogs: documentation, keyboard shortcuts, update check, credits and about. */
export const HelpDialog: React.FC<{ kind: HelpKind | null; onClose: () => void }> = ({ kind, onClose }) => {
  if (!kind) return null;

  if (kind === 'docs') {
    return (
      <Shell title="Dokumentasi" icon={<BookOpen className="w-4 h-4" />} onClose={onClose}>
        {DOCS.map((d) => (
          <div key={d.title} className="space-y-0.5">
            <h3 className="font-semibold text-slate-100">{d.title}</h3>
            <p className="leading-relaxed text-slate-400">{d.text}</p>
          </div>
        ))}
        <p className="pt-1 text-[11px] text-slate-500 leading-relaxed">
          Dokumentasi lengkap dalam bahasa Inggris dan Indonesia ada di halaman proyek.{' '}
          <a href={`${PROJECT_URL}#documentation`} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200">
            Buka dokumentasi
          </a>
        </p>
      </Shell>
    );
  }

  if (kind === 'shortcuts') {
    return (
      <Shell title="Pintasan keyboard" icon={<Keyboard className="w-4 h-4" />} onClose={onClose}>
        <div className="divide-y divide-slate-800/80 rounded-lg border border-slate-800">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-slate-300">{s.text}</span>
              <kbd className="shrink-0 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  if (kind === 'update') {
    return (
      <Shell title="Cek pembaruan" icon={<DownloadCloud className="w-4 h-4" />} onClose={onClose}>
        <UpdateBody />
      </Shell>
    );
  }

  if (kind === 'credits') {
    return (
      <Shell title="Kredit" icon={<Heart className="w-4 h-4" />} onClose={onClose}>
        {CREDITS.map((c) => (
          <div key={c.name} className="space-y-0.5">
            <h3 className="font-semibold text-slate-100" data-no-i18n>
              {c.name}
            </h3>
            <p className="text-slate-400">{c.text}</p>
          </div>
        ))}
        <p className="pt-1 text-[11px] text-slate-500 leading-relaxed">
          Semua logo adalah merek dagang milik klub / liga / asosiasi masing-masing.
        </p>
      </Shell>
    );
  }

  return (
    <Shell title="Tentang" icon={<Info className="w-4 h-4" />} onClose={onClose}>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-white" data-no-i18n>
          Okarin Kit Editor
        </h3>
        <p className="font-mono text-slate-400" data-no-i18n>
          v{APP_VERSION}
        </p>
      </div>
      <p className="leading-relaxed text-slate-400">
        Editor kit pribadi untuk membuat tekstur kit PES 2021: canvas 2D, preview 3D, dan export PNG, DDS, atau FTEX.
      </p>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Proyek ini tidak berafiliasi dengan Konami. PES 2021 adalah merek dagang pemiliknya.
      </p>
      <p className="text-[11px] text-slate-500">
        Lisensi: <span data-no-i18n>GPL-3.0</span>
      </p>
      <a href={PROJECT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sky-300 hover:text-sky-200">
        <ExternalLink className="w-3.5 h-3.5" />
        Halaman proyek
      </a>
    </Shell>
  );
};

export default HelpDialog;
