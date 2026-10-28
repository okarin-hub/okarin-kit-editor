'use client';

import React from 'react';
import { Check } from 'lucide-react';

/** A top-level entry of the menu bar with a dropdown. Only one menu is open at a time (see MenuBar). */
export const TopMenu: React.FC<{
  id: string;
  label: string;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  children: (close: () => void) => React.ReactNode;
  width?: string;
}> = ({ id, label, openId, setOpenId, children, width = 'w-56' }) => {
  const open = openId === id;
  return (
    <div className="relative" onMouseEnter={() => openId && openId !== id && setOpenId(id)}>
      <button
        type="button"
        onClick={() => setOpenId(open ? null : id)}
        aria-expanded={open}
        className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${
          open ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`}
      >
        {label}
      </button>
      {open && (
        <div
          className={`absolute left-0 top-full mt-1 z-50 ${width} rounded-xl border border-slate-700 bg-[#161a26] shadow-2xl shadow-black/50 p-1.5 space-y-0.5`}
        >
          {children(() => setOpenId(null))}
        </div>
      )}
    </div>
  );
};

export const MenuHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-2 pt-1.5 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{children}</div>
);

export const MenuSeparator: React.FC = () => <div className="my-1 h-px bg-slate-700/70" />;

export const MenuItem: React.FC<{
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  title?: string;
  checked?: boolean;
  disabled?: boolean;
  onClick: () => void;
}> = ({ label, icon, shortcut, title, checked, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-300"
  >
    <span className="w-4 flex justify-center text-slate-400 shrink-0">{icon}</span>
    <span className="flex-1 min-w-0 truncate">{label}</span>
    {shortcut && <span className="text-[10px] text-slate-500 font-mono shrink-0">{shortcut}</span>}
    {checked && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
  </button>
);
