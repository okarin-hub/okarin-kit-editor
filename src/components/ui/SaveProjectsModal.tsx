'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  FolderOpen,
  Upload,
  Database,
  Trash2,
  Download,
  Calendar,
  CheckCircle,
  AlertTriangle,
  FileCode,
  Sparkles,
} from 'lucide-react';
import { KitProject, SavedProjectMeta } from '@/types/project';
import { KitPartId, KitPartConfig, KitGraphicItem, PlayerMarkingsConfig, BaseTexture, TemplateBundle } from '@/types/kit';
import {
  getLocalProjectsList,
  getLocalProjectById,
  saveProjectLocally,
  deleteProjectLocally,
  downloadPeskitFile,
  parsePeskitFile,
  saveProjectToSupabase,
} from '@/services/storageService';
import { isSupabaseConfigured } from '@/lib/supabase';

interface SaveProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPartsConfig: Record<KitPartId, KitPartConfig>;
  currentGraphicItems: KitGraphicItem[];
  currentMarkings: PlayerMarkingsConfig;
  currentBaseTexture?: BaseTexture | null;
  currentPatternMask?: string | null;
  currentTemplate?: TemplateBundle | null;
  currentThumbnail?: string;
  onLoadProject: (project: KitProject) => void;
}

export const SaveProjectsModal: React.FC<SaveProjectsModalProps> = ({
  isOpen,
  onClose,
  currentPartsConfig,
  currentGraphicItems,
  currentMarkings,
  currentBaseTexture,
  currentPatternMask,
  currentTemplate,
  currentThumbnail,
  onLoadProject,
}) => {
  const [activeTab, setActiveTab] = useState<'save' | 'projects' | 'import' | 'cloud'>('save');
  const [projectName, setProjectName] = useState('Custom PES Kit');
  const [teamName, setTeamName] = useState('');
  const [season, setSeason] = useState('2024/2025');
  const [savedProjects, setSavedProjects] = useState<SavedProjectMeta[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Refresh saved projects on open or tab change
  useEffect(() => {
    if (isOpen) {
      setSavedProjects(getLocalProjectsList());
      setStatusMessage(null);
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // Build current project payload
  const buildCurrentProject = (): KitProject => {
    return {
      id: `kit_${Date.now()}`,
      name: projectName.trim() || 'Custom PES Kit',
      teamName: teamName.trim(),
      season: season.trim(),
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      thumbnail: currentThumbnail,
      partsConfig: currentPartsConfig,
      graphicItems: currentGraphicItems,
      markings: currentMarkings,
      baseTexture: currentBaseTexture ?? null,
      patternMask: currentPatternMask ?? null,
      template: currentTemplate?.state ?? null,
      templateDef: currentTemplate?.def ?? null,
    };
  };

  // Handle local save
  const handleSaveLocally = () => {
    const proj = buildCurrentProject();
    const success = saveProjectLocally(proj);
    if (success) {
      setSavedProjects(getLocalProjectsList());
      setStatusMessage({ text: 'Kit berhasil disimpan ke browser!', type: 'success' });
    } else {
      setStatusMessage({ text: 'Gagal menyimpan kit ke browser.', type: 'error' });
    }
  };

  // Handle download .peskit file
  const handleDownloadFile = () => {
    const proj = buildCurrentProject();
    downloadPeskitFile(proj);
    setStatusMessage({ text: 'File proyek .peskit berhasil didownload!', type: 'success' });
  };

  // Handle load saved project
  const handleLoadSaved = (id: string) => {
    const loaded = getLocalProjectById(id);
    if (loaded) {
      onLoadProject(loaded);
      onClose();
    } else {
      setStatusMessage({ text: 'Gagal memuat proyek kit.', type: 'error' });
    }
  };

  // Handle delete saved project
  const handleDeleteSaved = (id: string) => {
    if (confirm('Yakin ingin menghapus kit ini dari penyimpanan browser?')) {
      deleteProjectLocally(id);
      setSavedProjects(getLocalProjectsList());
    }
  };

  // Handle file import
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const loaded = await parsePeskitFile(file);
      onLoadProject(loaded);
      onClose();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Gagal membaca file proyek kit.', type: 'error' });
    } finally {
      e.target.value = '';
    }
  };

  // Handle Cloud Save (Supabase)
  const handleSaveToCloud = async () => {
    setIsCloudSaving(true);
    setStatusMessage(null);
    const proj = buildCurrentProject();
    const result = await saveProjectToSupabase(proj);
    setIsCloudSaving(false);
    setStatusMessage({
      text: result.message,
      type: result.success ? 'success' : 'error',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0f131c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-600/20 text-rose-400 border border-rose-500/30">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Manajemen Proyek Kit</h3>
              <p className="text-[11px] text-slate-400">Simpan, buka, atau bagikan kit kreasi Anda</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-800 bg-[#0c0f17] px-6 gap-2">
          <button
            onClick={() => setActiveTab('save')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'save'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan Kit</span>
          </button>

          <button
            onClick={() => setActiveTab('projects')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'projects'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Daftar Tersimpan ({savedProjects.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'import'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import File</span>
          </button>

          <button
            onClick={() => setActiveTab('cloud')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'cloud'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cloud Supabase</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {statusMessage && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs flex items-center gap-2 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: SIMPAN KIT */}
          {activeTab === 'save' && (
            <div className="space-y-4">
              <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="text-xs text-slate-300 font-semibold">Nama Kit</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Contoh: Arsenal 2024 Home"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white mt-1 outline-none focus:border-rose-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 font-semibold">Nama Tim / Klub</label>
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Contoh: Arsenal"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white mt-1 outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold">Musim</label>
                    <input
                      type="text"
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                      placeholder="2024/2025"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white mt-1 outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleSaveLocally}
                  className="p-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 flex flex-col items-center text-center transition-all group"
                >
                  <Save className="w-5 h-5 text-rose-400 mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-white">Simpan ke Browser</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Tersimpan di browser lokal Anda</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="p-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 flex flex-col items-center text-center transition-all group"
                >
                  <FileCode className="w-5 h-5 text-sky-400 mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-white">Download File .peskit</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">File JSON untuk backup atau sharing</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: DAFTAR KIT TERSIMPAN */}
          {activeTab === 'projects' && (
            <div className="space-y-2">
              {savedProjects.length === 0 ? (
                <div className="text-center py-10 bg-slate-900/30 rounded-xl border border-slate-800/60 p-6 space-y-2">
                  <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-slate-400">Belum ada kit yang tersimpan di browser</p>
                  <p className="text-[11px] text-slate-500">
                    Buka tab &quot;Simpan Kit&quot; untuk menyimpan desain kit Anda saat ini.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {savedProjects.map((proj) => (
                    <div
                      key={proj.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {proj.thumbnail ? (
                          <img
                            src={proj.thumbnail}
                            alt={proj.name}
                            className="w-10 h-10 rounded-lg object-contain bg-black/60 border border-slate-800"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-800/80 flex items-center justify-center text-rose-400 font-bold text-xs">
                            PES
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-bold text-white">{proj.name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            {proj.teamName && <span>{proj.teamName}</span>}
                            {proj.season && <span>• {proj.season}</span>}
                            <span>• {new Date(proj.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleLoadSaved(proj.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all"
                        >
                          Buka Kit
                        </button>

                        <button
                          onClick={() => {
                            const full = getLocalProjectById(proj.id);
                            if (full) downloadPeskitFile(full);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                          title="Download file .peskit"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteSaved(proj.id)}
                          className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/60"
                          title="Hapus kit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: IMPORT FILE */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".peskit,.json"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-rose-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-all group"
              >
                <div className="p-3 rounded-full bg-slate-800 text-slate-400 group-hover:text-rose-400 mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-white">Klik untuk memilih file .peskit / .json</div>
                <div className="text-[11px] text-slate-500 mt-1">Mendukung format file kit buatan PES Kit Creator</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                ℹ️ File <code>.peskit</code> menyimpan seluruh pengaturan warna, pola, posisi dan ukuran logo apparel/sponsor, serta penempatan nama dan nomor pemain.
              </div>
            </div>
          )}

          {/* TAB 4: CLOUD SUPABASE */}
          {activeTab === 'cloud' && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  isSupabaseConfigured
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">
                      {isSupabaseConfigured ? 'Supabase Terhubung' : 'Supabase Belum Dikonfigurasi'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {isSupabaseConfigured
                        ? 'Kit dapat disimpan langsung ke cloud database.'
                        : 'Untuk mengaktifkan cloud storage, tambahkan kredensial di file .env.local.'}
                    </div>
                  </div>
                </div>
              </div>

              {isSupabaseConfigured ? (
                <button
                  type="button"
                  onClick={handleSaveToCloud}
                  disabled={isCloudSaving}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs shadow-lg shadow-emerald-950/60 transition-all flex items-center justify-center gap-2"
                >
                  <Database className="w-4 h-4" />
                  <span>{isCloudSaving ? 'Menyimpan ke Cloud...' : 'Simpan Kit Ini ke Supabase Cloud'}</span>
                </button>
              ) : (
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs text-slate-400">
                  <div className="font-semibold text-slate-200">Cara Menghubungkan Supabase:</div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                    <li>Buat project gratis di <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-sky-400 underline">supabase.com</a></li>
                    <li>Buat file <code>.env.local</code> di folder utama project ini</li>
                    <li>Tambahkan <code>NEXT_PUBLIC_SUPABASE_URL</code> dan <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
                    <li>Restart server development (otomatis terdeteksi)</li>
                  </ol>
                  <div className="text-[10px] text-slate-500 italic pt-1">
                    *Meskipun tanpa Supabase, penyimpanan lokal (Browser Storage) dan file download <code>.peskit</code> sudah bekerja 100% penuh!
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SaveProjectsModal;
