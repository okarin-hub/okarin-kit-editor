'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface PanelSectionProps {
  /** Stable id: the open / closed state is remembered per section in this browser. */
  id: string;
  title: string;
  icon?: React.ReactNode;
  /** Small text next to the title (a count or a name). */
  badge?: string | number;
  /** Controls on the right of the header (stays clickable when the section is closed). */
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const KEY = (id: string) => `kit-creator-section-${id}`;

/** A collapsible card used to group the controls of a side panel. */
export const PanelSection: React.FC<PanelSectionProps> = ({
  id,
  title,
  icon,
  badge,
  action,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  // restore the remembered state after mount (the server render always uses the default)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY(id));
      if (saved === '1' || saved === '0') setOpen(saved === '1');
    } catch {
      /* storage can be blocked */
    }
  }, [id]);

  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(KEY(id), o ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !o;
    });
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/30">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left text-slate-300 hover:text-white"
          aria-expanded={open}
        >
          {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-500" />}
          {icon}
          <span className="text-[11px] font-bold uppercase tracking-wider truncate">{title}</span>
          {badge !== undefined && badge !== '' && (
            <span className="ml-0.5 max-w-[110px] truncate text-[10px] font-normal normal-case tracking-normal text-slate-500">
              {typeof badge === 'number' ? `(${badge})` : badge}
            </span>
          )}
        </button>
        {action && <div className="shrink-0 flex items-center gap-1.5">{action}</div>}
      </div>
      {open && <div className="px-3 pb-3 space-y-2.5">{children}</div>}
    </section>
  );
};

export default PanelSection;
