'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AssetLibrary } from '@/hooks/useAssetLibrary';

/** "Muat ulang" for a library folder, with a short note when it is done: how many there are and how many are new. */
export const ReloadButton: React.FC<{ library: AssetLibrary; kind: 'patterns' | 'logos'; title: string }> = ({ library, kind, title }) => {
  const list = library[kind];
  const before = useRef<Set<string> | null>(null);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState<{ n: number; added: number } | null>(null);

  // after the reload has finished and the new list is rendered: count it against the one before
  useEffect(() => {
    if (!done || !before.current) return;
    const seen = before.current;
    setNote({ n: list.length, added: list.filter((e) => !seen.has(e.id)).length });
    before.current = null;
    setDone(false);
  }, [done, list]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(t);
  }, [note]);

  return (
    <span className="flex items-center gap-1.5">
      {note && (
        <span className="text-[10px] text-emerald-300" role="status">
          <span>{kind === 'patterns' ? `Dimuat: ${note.n} pola` : `Dimuat: ${note.n} logo`}</span>
          {note.added > 0 && <span className="ml-1">{`(${note.added} baru)`}</span>}
        </span>
      )}
      <button
        type="button"
        onClick={async () => {
          before.current = new Set(list.map((e) => e.id));
          setNote(null);
          await library.reload();
          setDone(true);
        }}
        disabled={library.loading}
        className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-60 flex items-center gap-1"
        title={title}
      >
        <RefreshCw className={`w-3 h-3 ${library.loading ? 'animate-spin' : ''}`} />
        Muat ulang
      </button>
    </span>
  );
};
