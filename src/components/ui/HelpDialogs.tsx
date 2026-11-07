'use client';

import React, { useEffect, useState } from 'react';
import { X, ExternalLink, RefreshCw, BookOpen, Keyboard, Info, Heart, DownloadCloud, Settings, Download } from 'lucide-react';
import { APP_VERSION, PROJECT_URL, UpdateResult, checkForUpdate } from '@/lib/updateCheck';
import { LANGUAGES, Lang } from '@/i18n/engine';
import { useI18n } from '@/i18n/I18nProvider';
import { InfoTip } from '@/components/ui/InfoTip';
import { getUpdateExperimental, setUpdateExperimental } from '@/utils/uiPrefs';
import { LayerEditorMode, useLayerEditorMode } from '@/hooks/useLayerEditorMode';

export type HelpKind = 'docs' | 'shortcuts' | 'update' | 'credits' | 'about' | 'settings';

const DOCS: { title: string; text: string }[] = [
  {
    title: 'Mulai cepat',
    text: "Pilih preset dari menu Preset, atur warna tiap bagian di tab Layer, lalu tambahkan pola, lis, dan logo. Hasilnya terlihat langsung di canvas 2D dan model 3D. Ikon ? di samping judul panel menjelaskan pengaturan itu.",
  },
  {
    title: 'Template',
    text: "Tab Template berisi daftar template: bawaan, file .json milikmu, dan setiap file .psd di library/templates (Baca PSD), yang dibaca otomatis saat aplikasi dibuka atau lewat Muat ulang. Tambah PSD menyalin PSD ke library lalu membukanya. Import PNG mengubah gambar template menjadi PSD berlayer, dipisah per warna (eksperimental). Dasar kit dan Simpan sebagai template juga ada di tab ini.",
  },
  {
    title: 'Dasar kit',
    text: "Dasar kit bisa dari warna tiap bagian, atau dari desain yang kamu import (File, Import desain). Warna bagian bisa ditumpuk di atas desain impor dengan ikon mata. Bentuk lengan Sampai pundak mengikuti template PES (lengan menyambung ke area leher); Tanpa pundak memakai lengan yang lebih pendek dan berhenti di lubang lengan.",
  },
  {
    title: 'Daftar layer',
    text: "Layer dikelompokkan per Baju, Celana, Kaus kaki, dan Aksesoris; klik nama grup untuk membuka atau menutupnya. Layer bantuan dari PSD (mesh, panduan, jahitan, bayangan, latar) dikumpulkan di \"Layer bantuan PSD\". Kolom cari muncul saat layernya banyak. Klik nama layer untuk membuka pengaturannya; layer yang dipilih tampil di canvas 2D dengan kotak biru: seret untuk menggeser, tarik sudut untuk mengubah ukuran, dan tarik pegangan atas untuk memutar. Urutan daftar sama dengan urutan tumpukan: layer paling atas tampil paling depan. Seret objek atau pola ke atas atau ke bawah di grupnya untuk mengubah urutannya (pola juga bisa dinaikkan ke atas objek), atau ke grup lain untuk memindahkannya.",
  },
  {
    title: 'Layer di banyak bagian',
    text: "Satu layer bisa menempel di beberapa bagian sekaligus. Bentuk yang sama digambar di semua bagian terpilih dan dipotong mengikuti tiap bagian, jadi geser atau lebarkan layer agar menyilang, misalnya strip melintasi depan, belakang, dan lengan.",
  },
  {
    title: 'Pola',
    text: "Pola ada di grup tab Layer: klik + Pola di grup Baju, Celana, Kaus kaki, atau Aksesoris untuk menambah. Seret baris pola ke grup lain untuk memindahkannya; tahan Ctrl saat melepas untuk menyalinnya. Pola digambar di atas warna dasar dan di bawah objek, kecuali kalau dinaikkan ke atas objek (panah atau seret); yang lebih atas di daftar tampil lebih depan. Tiap pola punya ukuran, rotasi, posisi, cermin, dan bagian grup yang ditutupinya. Simetris menggambar pola di satu sisi lalu mencerminkannya ke sisi lawan (cocok untuk diagonal dan sash). Matikan Berulang untuk menampilkan pola hanya sekali.",
  },
  {
    title: 'Alat gambar',
    text: "Bar alat di kiri canvas berisi pilih dan geser, gambar bentuk bebas atau titik, garis jahit titik (bisa melengkung) atau bebas, dan kuas hapus. Pilih layer dulu agar kuas hapus hanya menghapus layer itu (misalnya watermark di PSD / PNG impor); tanpa layer yang dipilih, kuas menghapus pola. Scroll untuk zoom (kecepatannya di menu Tampilan) dan seret untuk menggeser canvas.",
  },
  {
    title: 'Garis jahitan',
    text: "Canvas bersih secara bawaan: garis jahit hanya yang kamu gambar sendiri dan tepi layer. Nyalakan \"Jahitan di tepi tiap bagian\" di panel Garis Jahitan bila ingin garis di sekeliling setiap potongan.",
  },
  {
    title: 'Logo dan teks',
    text: "Di tab Logo kamu bisa upload logo, mencari logo klub dari football-logos.cc, lalu mengatur ukuran, posisi, warna, gradasi, dan outline (sudut tumpul atau tajam). Tambah Teks menampilkan pratinjau dulu; font, ukuran, warna, outline, dan bayangan teks bisa diubah kapan saja. Logo milikmu disimpan di folder library/logos.",
  },
  {
    title: 'Nama dan nomor',
    text: "PES membaca nama dan nomor dari font internal game, terpisah dari tekstur kit. Di tab Nama keduanya hanya pratinjau penempatan dan tidak ikut export PNG kecuali kamu menyalakannya. Font untuk game dibuat lewat generator fontset.",
  },
  {
    title: 'Tekstur kain',
    text: "Di tab Kain, tambahkan layer tekstur kain (bawaan atau dari library/textures). Tiap layer punya tekstur, ukuran, intensitas, dan bagian sendiri, dan tampil di canvas 2D, model 3D, dan hasil export.",
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
    title: 'Pembaruan',
    text: 'Bantuan, Cek pembaruan membandingkan versimu dengan rilis di GitHub. Di aplikasi Windows, Unduh dan pasang memasang versi baru lalu membuka aplikasi lagi; folder library tidak disentuh.',
  },
  {
    title: 'Folder library',
    text: 'Folder library/logos, library/patterns, library/templates, dan library/fonts dibaca saat aplikasi dibuka atau lewat tombol Reload di panel masing-masing.',
  },
];

const SHORTCUTS: { keys: string; text: string }[] = [
  { keys: 'Ctrl + S', text: 'Buka / simpan proyek' },
  { keys: 'Ctrl + E', text: 'Export kit' },
  { keys: 'Ctrl + ,', text: 'Pengaturan (bahasa, pengaturan layer)' },
  { keys: 'Ctrl + Z', text: 'Undo' },
  { keys: 'Ctrl + Y', text: 'Redo' },
  { keys: 'Scroll', text: 'Zoom canvas 2D' },
  { keys: 'Seret', text: 'Geser canvas 2D' },
  { keys: 'Enter', text: 'Selesai menggambar' },
  { keys: 'Esc', text: 'Batal menggambar' },
  { keys: 'Backspace', text: 'Hapus titik terakhir' },
  { keys: 'Panah / Shift + Panah', text: 'Geser logo terpilih 1 px / 10 px' },
  { keys: 'Delete', text: 'Hapus logo terpilih' },
  { keys: 'V', text: 'Alat pilih dan geser' },
  { keys: 'B / P', text: 'Gambar bentuk bebas / titik' },
  { keys: 'S / J', text: 'Garis jahit titik / bebas' },
  { keys: 'E', text: 'Kuas hapus (layer yang dipilih, atau pola)' },
  { keys: '1 / 2 / 3', text: 'Tampilan 2D / Split / 3D' },
  { keys: '?', text: 'Daftar pintasan ini' },
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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onMouseDown={onClose}>
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

const OPTION = (active: boolean) =>
  `rounded-lg border px-3 py-2 text-left transition-colors ${
    active ? 'border-sky-500 bg-sky-500/15 text-sky-100' : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800'
  }`;

const LAYER_EDITOR: { id: LayerEditorMode; label: string; hint: string }[] = [
  { id: 'inline', label: 'Di bawah baris', hint: 'Pengaturan layer terbuka di dalam daftar, tepat di bawah barisnya.' },
  { id: 'side', label: 'Panel samping', hint: 'Pengaturan layer muncul di panel di kiri daftar layer, jadi daftarnya tidak memanjang.' },
];

const SettingsBody: React.FC = () => {
  const { lang, setLang } = useI18n();
  const [mode, setMode] = useLayerEditorMode();
  return (
    <>
      <section className="space-y-1.5">
        <h3 className="font-semibold text-slate-100">Bahasa</h3>
        <div className="grid grid-cols-2 gap-1.5" data-no-i18n>
          {LANGUAGES.map((l) => (
            <button key={l.code} type="button" aria-pressed={lang === l.code} onClick={() => setLang(l.code as Lang)} className={OPTION(lang === l.code)}>
              {l.label}
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-1.5 pt-2">
        <h3 className="font-semibold text-slate-100">Pengaturan layer</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {LAYER_EDITOR.map((o) => (
            <button key={o.id} type="button" aria-pressed={mode === o.id} onClick={() => setMode(o.id)} className={OPTION(mode === o.id)}>
              <span className="block font-semibold">{o.label}</span>
              <span className="block mt-0.5 text-[11px] leading-snug text-slate-400">{o.hint}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
};

/** The update bridge of the Windows app (electron/preload.cjs); absent in a browser. */
interface OkarinUpdater {
  install: (tag: string) => Promise<{ ok: boolean; error?: string }>;
  onProgress: (cb: (p: { phase: 'download' | 'extract' | 'restart'; done: number; total: number }) => void) => () => void;
}
const updater = (): OkarinUpdater | undefined => (typeof window !== 'undefined' ? (window as any).okarinUpdater : undefined);

const UpdateBody: React.FC = () => {
  const [state, setState] = useState<'checking' | 'done'>('checking');
  const [result, setResult] = useState<UpdateResult | null>(null);
  const [experimental, setExperimental] = useState(false);
  const [install, setInstall] = useState<{ phase: string; done: number; total: number } | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  const run = async (exp = experimental) => {
    setState('checking');
    setResult(await checkForUpdate(exp));
    setState('done');
  };

  useEffect(() => {
    const exp = getUpdateExperimental();
    setExperimental(exp);
    run(exp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startInstall = async (tag: string) => {
    const u = updater();
    if (!u) return;
    setInstallError(null);
    setInstall({ phase: 'download', done: 0, total: 0 });
    const off = u.onProgress((p) => setInstall(p));
    const r = await u.install(tag);
    off();
    if (!r.ok) {
      setInstall(null);
      setInstallError(r.error || 'Pembaruan gagal.');
    }
  };

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
          {result.experimental && <p className="text-[11px] text-amber-300">Ini rilis eksperimental.</p>}
          {result.notes && (
            <p className="whitespace-pre-wrap text-[11px] text-slate-300 max-h-40 overflow-y-auto" data-no-i18n>
              {result.notes}
            </p>
          )}
          {updater() && !install && (
            <button
              type="button"
              onClick={() => startInstall(result.tag)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh dan pasang
            </button>
          )}
          {install && (
            <p className="flex items-center gap-2 text-sky-100" role="status">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              {install.phase === 'download'
                ? install.total
                  ? `Mengunduh ${Math.round((install.done / install.total) * 100)}%`
                  : 'Mengunduh...'
                : install.phase === 'extract'
                ? 'Membuka file pembaruan...'
                : 'Aplikasi akan ditutup dan dibuka lagi...'}
            </p>
          )}
          {installError && <p className="text-[11px] text-rose-300">{installError}</p>}
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sky-300 hover:text-sky-200"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Buka halaman rilis
          </a>
          {updater() && (
            <p className="text-[10px] text-slate-500">
              Folder library (logo, font, template) tidak disentuh. Proyek yang belum disimpan sebaiknya disimpan dulu.
            </p>
          )}
        </div>
      )}

      {state === 'done' && result?.status === 'error' && (
        <p className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-amber-200 leading-relaxed">
          Tidak bisa membaca info rilis (repositori privat atau sedang offline). Cek manual di halaman proyek.
        </p>
      )}

      <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          checked={experimental}
          onChange={(e) => {
            setExperimental(e.target.checked);
            setUpdateExperimental(e.target.checked);
            run(e.target.checked);
          }}
          className="accent-sky-500"
        />
        Ikut rilis eksperimental
        <InfoTip text="Rilis eksperimental berisi fitur terbaru yang belum sepenuhnya diuji. Matikan untuk hanya menerima rilis stabil." />
      </label>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => run()}
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

/** Help dialogs: documentation, keyboard shortcuts, settings, update check, credits and about. */
export const HelpDialog: React.FC<{ kind: HelpKind | null; onClose: () => void }> = ({ kind, onClose }) => {
  if (!kind) return null;

  if (kind === 'docs') {
    return (
      <Shell title="Panduan" icon={<BookOpen className="w-4 h-4" />} onClose={onClose}>
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

  if (kind === 'settings') {
    return (
      <Shell title="Pengaturan" icon={<Settings className="w-4 h-4" />} onClose={onClose}>
        <SettingsBody />
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
