'use client';

import React, { useState } from 'react';
import {
  X,
  Download,
  Image as ImageIcon,
  FileCode,
  Sparkles,
  Check,
  AlertCircle,
  Layers,
  Settings2,
} from 'lucide-react';
import { ExportSettings, ExportTextureResolution, ExportFileFormat, ExportDdsFormat } from '@/types/project';
import { DDS_FORMAT_LABELS } from '@/utils/ddsEncoder';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: ExportSettings) => void;
  defaultProjectName: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  defaultProjectName,
}) => {
  const [exportType, setExportType] = useState<'game-texture' | 'project-file' | 'showcase-card'>('game-texture');
  const [resolution, setResolution] = useState<ExportTextureResolution>(1024);
  const [includeMarkings, setIncludeMarkings] = useState<boolean>(false);
  const [fileFormat, setFileFormat] = useState<ExportFileFormat>('png');
  const [ddsFormat, setDdsFormat] = useState<ExportDdsFormat>('dxt5');
  const [ddsMipmaps, setDdsMipmaps] = useState<boolean>(true);
  const [filename, setFilename] = useState<string>(
    defaultProjectName.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'pes2021_kit'
  );

  if (!isOpen) return null;

  const handleConfirmExport = () => {
    onExport({
      exportType,
      resolution,
      includeMarkings,
      fileFormat,
      ddsFormat,
      ddsMipmaps,
      filename: filename.trim() || 'pes2021_kit',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0f131c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-600/20 text-rose-400 border border-rose-500/30">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Export & Download Kit</h3>
              <p className="text-[11px] text-slate-400">Pilih format dan resolusi hasil akhir kit Anda</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* 1. Format Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Pilihan Format Export
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* Option 1: Game Texture */}
              <button
                type="button"
                onClick={() => setExportType('game-texture')}
                className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${
                  exportType === 'game-texture'
                    ? 'bg-rose-950/40 border-rose-500 text-white shadow-md shadow-rose-950/50'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <ImageIcon className="w-5 h-5 mb-1.5 text-rose-400" />
                <span className="text-xs font-bold">Tekstur Game</span>
                <span className="text-[10px] text-slate-500 mt-0.5">PNG PES 2021</span>
              </button>

              {/* Option 2: Project File */}
              <button
                type="button"
                onClick={() => setExportType('project-file')}
                className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${
                  exportType === 'project-file'
                    ? 'bg-rose-950/40 border-rose-500 text-white shadow-md shadow-rose-950/50'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-5 h-5 mb-1.5 text-sky-400" />
                <span className="text-xs font-bold">File Proyek</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Format .peskit</span>
              </button>

              {/* Option 3: Showcase Card */}
              <button
                type="button"
                onClick={() => setExportType('showcase-card')}
                className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${
                  exportType === 'showcase-card'
                    ? 'bg-rose-950/40 border-rose-500 text-white shadow-md shadow-rose-950/50'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-5 h-5 mb-1.5 text-amber-400" />
                <span className="text-xs font-bold">Showcase Card</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Gambar Mockup</span>
              </button>
            </div>
          </div>

          {/* 2. Options for Game Texture */}
          {exportType === 'game-texture' && (
            <div className="space-y-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              {/* Resolution options */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold">Resolusi Tekstur:</span>
                  <span className="text-slate-400 text-[11px] font-mono">
                    {resolution} × {resolution} px
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolution(1024)}
                    className={`p-2.5 rounded-lg border text-xs text-left transition-all ${
                      resolution === 1024
                        ? 'bg-rose-600/20 border-rose-500 text-white font-semibold'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold">1024 × 1024 px</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Standar Asli PES 2021</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResolution(2048)}
                    className={`p-2.5 rounded-lg border text-xs text-left transition-all ${
                      resolution === 2048
                        ? 'bg-rose-600/20 border-rose-500 text-white font-semibold'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      2048 × 2048 px
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">HD</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Ultra HD (Mod Sider/EvoWeb)</div>
                  </button>
                </div>
              </div>

              {/* File format */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                <span className="text-xs font-semibold text-slate-300">Format File:</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['png', 'dds', 'ftex'] as ExportFileFormat[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFileFormat(f)}
                      className={`p-2 rounded-lg border text-xs transition-all ${
                        fileFormat === f
                          ? 'bg-rose-600/20 border-rose-500 text-white font-semibold'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {f === 'png' ? 'PNG (Editing / Preview)' : f === 'dds' ? 'DDS (Format Game)' : 'FTEX (Langsung ke PES)'}
                    </button>
                  ))}
                </div>

                {(fileFormat === 'dds' || fileFormat === 'ftex') && (
                  <div className="space-y-2 pt-1">
                    <select
                      value={ddsFormat}
                      onChange={(e) => setDdsFormat(e.target.value as ExportDdsFormat)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                    >
                      {(Object.keys(DDS_FORMAT_LABELS) as ExportDdsFormat[]).map((k) => (
                        <option key={k} value={k}>
                          {DDS_FORMAT_LABELS[k]}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ddsMipmaps}
                        onChange={(e) => setDdsMipmaps(e.target.checked)}
                        className="accent-rose-500 cursor-pointer"
                      />
                      Sertakan mipmap
                    </label>
                    {fileFormat === 'ftex' && (
                      <p className="text-[10px] text-amber-300/90 leading-relaxed">
                        FTEX ditulis langsung (satu file .ftex, semua mipmap di dalamnya) mengikuti format FtexTool.
                        Belum diuji di dalam game, jadi simpan salinan file aslimu dan coba satu kit dulu.
                      </p>
                    )}
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Hasil DDS untuk dipakai di game lewat tool mod PES (misalnya Kitserver / Sider atau
                      pembuat file CPK). Format yang dibutuhkan bisa berbeda per mod — pastikan sesuai
                      panduan mod yang kamu pakai.
                    </p>
                  </div>
                )}
              </div>

              {/* Markings Checkbox */}
              <div className="pt-2 border-t border-slate-800/80">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMarkings}
                    onChange={(e) => setIncludeMarkings(e.target.checked)}
                    className="mt-0.5 accent-rose-500 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-200">
                      Sertakan Nama & Nomor Punggung di Tekstur
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                      💡 <em>Rekomendasi PES 2021:</em> Biarkan tidak tercentang agar file tekstur tetap bersih, karena game PES secara resmi menerapkan font nomor/nama dari sistem font internal game.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* 3. Filename Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Nama File
            </label>
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden px-3 py-2">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="pes2021_kit_home"
                className="bg-transparent text-xs text-white outline-none flex-1 font-mono"
              />
              <span className="text-xs text-slate-500 font-mono">
                {exportType === 'project-file'
                  ? '.peskit'
                  : exportType === 'game-texture' && fileFormat === 'dds'
                  ? '.dds'
                  : exportType === 'game-texture' && fileFormat === 'ftex'
                  ? '.ftex'
                  : '.png'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-800 bg-[#0f131c]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Batal
          </button>

          <button
            onClick={handleConfirmExport}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 shadow-lg shadow-rose-950 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download Sekarang</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
