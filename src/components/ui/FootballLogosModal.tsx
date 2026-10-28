'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Search, ExternalLink, Download, Check, AlertTriangle, Loader2, Info } from 'lucide-react';
import { LibraryEntry } from '@/hooks/useAssetLibrary';

interface Hit {
  id: string;
  name: string;
  country: string;
  countryName: string;
  alt: string[];
  pageUrl: string;
  cached: boolean;
}

interface FootballLogosModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a logo is downloaded into library/logos/football-logos. */
  onPicked: (entry: LibraryEntry) => Promise<void> | void;
  onLibraryChanged: () => void;
}

/**
 * Search the football-logos.cc index and pull one club / league logo straight into the
 * logo library (and onto the kit). Fan, non-commercial use only (see the site's license).
 */
export const FootballLogosModal: React.FC<FootballLogosModalProps> = ({
  isOpen,
  onClose,
  onPicked,
  onLibraryChanged,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reqSeq = useRef(0);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  // Debounced search against our own API (which reads the site's public autocomplete index)
  useEffect(() => {
    if (!isOpen) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      setSearching(false);
      return;
    }
    const seq = ++reqSeq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/football-logos/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (seq !== reqSeq.current) return;
        if (!res.ok) throw new Error(data.error || 'Pencarian gagal.');
        setResults(data.results ?? []);
        setError(null);
      } catch (e: any) {
        if (seq !== reqSeq.current) return;
        setResults([]);
        setError(e?.message || 'Pencarian gagal.');
      } finally {
        if (seq === reqSeq.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, isOpen]);

  if (!isOpen) return null;

  const pick = async (hit: Hit) => {
    const key = `${hit.country}/${hit.id}`;
    setBusyId(key);
    setError(null);
    try {
      const res = await fetch('/api/football-logos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: hit.country, id: hit.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil logo.');

      onLibraryChanged();
      await onPicked({
        id: data.relPath,
        name: data.name,
        category: 'football-logos',
        path: data.relPath,
        url: data.url,
      });
      setDoneIds((prev) => new Set(prev).add(key));
      setResults((prev) => prev.map((r) => (r.country === hit.country && r.id === hit.id ? { ...r, cached: true } : r)));
    } catch (e: any) {
      setError(e?.message || 'Gagal mengambil logo.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-lg max-h-[88vh] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#0f131c]">
          <div>
            <h3 className="text-sm font-bold text-white">Cari Logo Klub</h3>
            <p className="text-[11px] text-slate-400">Sumber: football-logos.cc (klub, liga, turnamen)</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari klub, liga, atau negara... (mis. liverpool, persija, la liga)"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-9 py-2 text-xs text-white outline-none focus:border-sky-500"
            />
            {searching && (
              <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>

          {error && (
            <div className="flex gap-2 p-2.5 rounded-lg text-[11px] leading-relaxed border bg-rose-950/40 border-rose-900/60 text-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!error && query.trim().length >= 2 && !searching && results.length === 0 && (
            <p className="text-[11px] text-slate-500 text-center py-4">
              Tidak ada hasil untuk &quot;{query.trim()}&quot;. Coba nama lain atau buka situsnya langsung.
            </p>
          )}

          {results.length > 0 && (
            <div className="space-y-1">
              {results.map((hit) => {
                const key = `${hit.country}/${hit.id}`;
                const busy = busyId === key;
                const done = doneIds.has(key);
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-100 truncate">{hit.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {hit.countryName}
                        {hit.alt.length > 0 && ` · ${hit.alt.slice(0, 3).join(', ')}`}
                      </div>
                    </div>
                    <a
                      href={hit.pageUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Buka halaman logo di football-logos.cc"
                      className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => pick(hit)}
                      disabled={busy}
                      className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-60 ${
                        done
                          ? 'bg-emerald-700/40 text-emerald-200 border border-emerald-600/60'
                          : 'bg-sky-600 hover:bg-sky-500 text-white'
                      }`}
                    >
                      {busy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : done ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      {done ? 'Ditambah' : hit.cached ? 'Pakai' : 'Ambil'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 p-2.5 rounded-lg text-[10px] leading-relaxed border bg-slate-900/60 border-slate-800 text-slate-400">
            <Info className="w-3.5 h-3.5 shrink-0 text-sky-400 mt-0.5" />
            <span>
              Logo disimpan di <code>library/logos/football-logos</code> dan langsung ditambahkan ke kit. Semua logo
              adalah merek dagang pemiliknya; situs sumber hanya mengizinkan pemakaian informatif, editorial, dan
              fan <strong>non-komersial</strong> (bukan untuk produk, merchandise, atau promosi). Lihat{' '}
              <a
                href="https://football-logos.cc/license/"
                target="_blank"
                rel="noreferrer"
                className="underline text-sky-300"
              >
                lisensi situs
              </a>
              .
            </span>
          </div>

          <a
            href="https://football-logos.cc/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-300 hover:text-white border border-slate-700/60 hover:bg-slate-800 rounded-lg py-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Buka football-logos.cc di tab baru
          </a>
        </div>
      </div>
    </div>
  );
};

export default FootballLogosModal;
