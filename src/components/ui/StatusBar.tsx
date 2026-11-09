'use client';

import React, { useEffect, useState } from 'react';
import { APP_VERSION, checkForUpdate } from '@/lib/updateCheck';
import { getUpdateExperimental } from '@/utils/uiPrefs';

/** Thin bar under the editor: the app version, and a link to the update dialog when a newer release exists. */
export const StatusBar: React.FC<{ onOpenUpdate: () => void }> = ({ onOpenUpdate }) => {
  const [latest, setLatest] = useState<string | null>(null);

  // one quiet check per start, on the channel chosen in the update dialog; offline or rate limited: nothing shown
  useEffect(() => {
    let live = true;
    checkForUpdate(getUpdateExperimental()).then((r) => {
      if (live && r.status === 'available') setLatest(r.latest);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <footer className="h-6 shrink-0 flex items-center justify-end gap-3 px-3 border-t border-slate-800 bg-[#0d1017] text-[11px] text-slate-500 select-none">
      {latest && (
        <button type="button" onClick={onOpenUpdate} className="flex items-center gap-1.5 text-sky-300 hover:text-sky-200">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" aria-hidden />
          <span>Versi baru tersedia:</span>
          <span data-no-i18n>{latest}</span>
        </button>
      )}
      <span data-no-i18n>Okarin Kit Editor {APP_VERSION}</span>
    </footer>
  );
};
