'use client';

import React, { useMemo, useRef, useState } from 'react';
import { X, FileCog, FileUp, Download, FolderDown, Palette, RotateCcw, AlertCircle } from 'lucide-react';
import {
  KIT_CONFIG_FIELDS,
  KIT_CONFIG_GROUPS,
  DEFAULT_KIT_CONFIG,
  parseKitConfig,
  setKitConfigValue,
  kitConfigIssue,
  kitConfigToFile,
} from '@/utils/kitConfig';
import { ExportTextureResolution } from '@/types/project';

interface KitConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  configText: string;
  onChange: (text: string) => void;
  /** config colour keys filled from the kit's part colours */
  kitColors: Record<string, string>;
  /** the kit texture as FTEX (DXT5 + mipmaps), without names/numbers */
  buildKitFtex: (resolution: ExportTextureResolution) => Promise<Uint8Array | null>;
}

const download = (bytes: BlobPart, name: string) => {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

/** Editor for the kitserver config.txt of one kit, and saving the kit folder (config.txt + kit .ftex). */
export const KitConfigModal: React.FC<KitConfigModalProps> = ({
  isOpen,
  onClose,
  configText,
  onChange,
  kitColors,
  buildKitFtex,
}) => {
  const [showText, setShowText] = useState(false);
  const [resolution, setResolution] = useState<ExportTextureResolution>(1024);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const values = useMemo(() => parseKitConfig(configText), [configText]);

  if (!isOpen) return null;

  const set = (key: string, value: string) => onChange(setKitConfigValue(configText, key, value));
  const issues = KIT_CONFIG_FIELDS.map((f) => [f, kitConfigIssue(f, values[f.key])] as const).filter(([, i]) => i);
  const kitFile = values.KitFile || '';
  const kitFileOk = !!kitFile && !kitConfigIssue(KIT_CONFIG_FIELDS.find((f) => f.key === 'KitFile')!, kitFile);

  const importFile = async (file: File) => {
    onChange((await file.text()).replace(/^﻿/, '').replace(/\r\n/g, '\n'));
    setStatus(`config dimuat dari ${file.name}`);
  };

  const applyKitColors = () => {
    let t = configText;
    for (const [k, v] of Object.entries(kitColors)) t = setKitConfigValue(t, k, v.toUpperCase());
    onChange(t);
  };

  const saveFolder = async () => {
    if (!kitFileOk) return setStatus('Isi nama file "Tekstur kit" dulu (tanpa ekstensi).');
    setBusy(true);
    setStatus('Membuat tekstur kit…');
    try {
      const ftex = await buildKitFtex(resolution);
      if (!ftex) throw new Error('tekstur kit gagal dibuat');
      const picker = (window as unknown as { showDirectoryPicker?: (o: object) => Promise<FileSystemDirectoryHandle> })
        .showDirectoryPicker;
      if (!picker) {
        // browsers without the folder picker: hand over the two files
        download(kitConfigToFile(configText), 'config.txt');
        download(ftex as BlobPart, `${kitFile}.ftex`);
        setStatus(`config.txt dan ${kitFile}.ftex diunduh. Taruh keduanya di folder kit (misalnya p1).`);
        return;
      }
      const dir = await picker({ mode: 'readwrite', id: 'kitserver-kit' });
      const exists = async (name: string) => dir.getFileHandle(name).then(() => true, () => false);
      const names = ['config.txt', `${kitFile}.ftex`];
      const existing = (await Promise.all(names.map(exists))).map((e, i) => (e ? names[i] : null)).filter(Boolean);
      if (existing.length && !confirm(`Folder "${dir.name}" sudah berisi ${existing.join(' dan ')}. Timpa?`)) {
        setStatus('Dibatalkan, tidak ada file yang ditulis.');
        return;
      }
      const write = async (name: string, data: BlobPart) => {
        const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
        await w.write(new Blob([data]));
        await w.close();
      };
      await write('config.txt', kitConfigToFile(configText));
      await write(`${kitFile}.ftex`, ftex as BlobPart);
      setStatus(`Tersimpan di folder "${dir.name}": config.txt dan ${kitFile}.ftex.`);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') setStatus(null);
      else setStatus(`Gagal menyimpan: ${(err as Error)?.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-sky-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0f131c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-600/20 text-sky-400 border border-sky-500/30">
              <FileCog className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Kitserver: config.txt
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Eksperimental
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Pengaturan kit untuk kserv.lua (Sider). Batas nilai mengikuti kserv 1.13.</p>
              <p className="text-[10px] text-amber-300/80">Hanya mengatur file config; pratinjau 2D/3D belum mengikuti nilai ini.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-6 py-2 border-b border-slate-800 text-[11px]">
          <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800">
            <FileUp className="w-3.5 h-3.5" /> Impor config.txt
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = '';
            }}
          />
          <button type="button" onClick={applyKitColors} className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800" title="Isi warna config dari warna bagian kit">
            <Palette className="w-3.5 h-3.5" /> Ambil warna dari kit
          </button>
          <button
            type="button"
            onClick={() => confirm('Kembalikan config ke bawaan?') && onChange(DEFAULT_KIT_CONFIG)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Bawaan
          </button>
          <label className="ml-auto flex items-center gap-1.5 text-slate-400 cursor-pointer">
            <input type="checkbox" checked={showText} onChange={(e) => setShowText(e.target.checked)} className="accent-sky-500" />
            Edit sebagai teks
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {showText ? (
            <textarea
              value={configText}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
              className="w-full h-[55vh] bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-200 outline-none focus:border-sky-500 select-text"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              {KIT_CONFIG_GROUPS.map(([group, title]) => (
                <section key={group} className="space-y-1.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-1">{title}</h4>
                  {KIT_CONFIG_FIELDS.filter((f) => f.group === group).map((f) => {
                    const v = values[f.key] ?? '';
                    const issue = kitConfigIssue(f, values[f.key]);
                    return (
                      <div key={f.key} className="grid grid-cols-[1fr_9rem] items-center gap-2" title={f.key}>
                        <span className={`text-[11px] truncate ${issue ? 'text-amber-300' : 'text-slate-400'}`}>
                          {f.label}
                          {issue && <span className="text-[10px]"> ({issue})</span>}
                        </span>
                        {f.options ? (
                          <select value={v === '' && f.def !== undefined ? String(f.def) : v} onChange={(e) => set(f.key, e.target.value)} className={input}>
                            {!f.options.some(([o]) => String(o) === v) && v !== '' && <option value={v}>{v}</option>}
                            {f.options.map(([o, label]) => (
                              <option key={o} value={o}>
                                {label}
                              </option>
                            ))}
                          </select>
                        ) : f.kind === 'color' ? (
                          <div className="flex gap-1">
                            <input
                              type="color"
                              value={/^#[0-9a-fA-F]{6}$/.test(v) ? v : '#000000'}
                              onChange={(e) => set(f.key, e.target.value.toUpperCase())}
                              className="w-7 h-[26px] bg-transparent border border-slate-700 rounded cursor-pointer"
                            />
                            <input value={v} onChange={(e) => set(f.key, e.target.value)} className={`${input} font-mono uppercase`} />
                          </div>
                        ) : f.kind === 'file' ? (
                          <input value={v} onChange={(e) => set(f.key, e.target.value)} placeholder="(bawaan game)" className={`${input} font-mono`} />
                        ) : (
                          <input
                            type="number"
                            min={f.min}
                            max={f.max}
                            value={v}
                            onChange={(e) => set(f.key, e.target.value)}
                            className={`${input} font-mono`}
                          />
                        )}
                      </div>
                    );
                  })}
                  {group === 'files' && (
                    <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
                      Nama file tanpa .ftex. kserv hanya memakai file yang ada di folder kit itu sendiri; kalau kosong atau
                      filenya tidak ada, game memakai file bawaannya. File _srm dan _ex mengikuti nama di atas.
                    </p>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-800 bg-[#0f131c] space-y-2">
          {issues.length > 0 && (
            <p className="flex items-center gap-1.5 text-[11px] text-amber-300">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {issues.length} nilai di luar batas kserv: {issues.slice(0, 4).map(([f]) => f.key).join(', ')}
              {issues.length > 4 ? '…' : ''}
            </p>
          )}
          {status && <p className="text-[11px] text-sky-300">{status}</p>}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Tekstur kit:</span>
            <select
              value={resolution}
              onChange={(e) => setResolution(Number(e.target.value) as ExportTextureResolution)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 outline-none"
            >
              <option value={1024}>1024 px</option>
              <option value={2048}>2048 px</option>
            </select>
            <span className="text-[10px] text-slate-500">FTEX DXT5 + mipmap, tanpa nama/nomor</span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => download(kitConfigToFile(configText), 'config.txt')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5" /> config.txt
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={saveFolder}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50"
                title="Pilih folder kit (misalnya content/kit-server/<tim>/p1); config.txt dan tekstur kit ditulis ke sana"
              >
                <FolderDown className="w-3.5 h-3.5" /> Simpan ke folder kit…
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KitConfigModal;
