'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Plus, Shirt, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { FabricConfig, FabricLayer, FabricTextureType, KitPartId } from '@/types/kit';
import { createFabricPattern } from '@/utils/fabricRenderer';

const FABRIC_TEXTURES: { id: FabricTextureType; label: string; desc: string }[] = [
  { id: 'jersey-dimple', label: 'Jersey Mesh Oval Datar', desc: 'Lubang oval mendatar bertingkat, seperti jersey bola putih' },
  { id: 'jersey-eyelet', label: 'Jersey Mesh Oval Tegak', desc: 'Lubang oval tegak dengan tepi terang, ringan dan lembut' },
  { id: 'jersey-knit', label: 'Jersey Rajut Gelap', desc: 'Rajutan rapat dengan celah kecil, cocok untuk warna gelap' },
  { id: 'micro-mesh', label: 'Micro-Mesh Pori-Pori', desc: 'Ventilasi atletik berpori' },
  { id: 'knit-honeycomb', label: 'Honeycomb Heksagonal', desc: 'Anyaman segienam modern' },
  { id: 'diagonal-twill', label: 'Jacquard Twill', desc: 'Tenunan diagonal premium' },
  { id: 'ribbed', label: 'Vertical Ribbing', desc: 'Rajutan bergaris serat klasik' },
];

const PART_GROUPS: { label: string; parts: { id: KitPartId; label: string }[] }[] = [
  { label: 'Baju', parts: [{ id: 'front', label: 'Depan' }, { id: 'back', label: 'Belakang' }, { id: 'collar', label: 'Kerah' }] },
  { label: 'Lengan', parts: [{ id: 'leftSleeve', label: 'Kanan' }, { id: 'rightSleeve', label: 'Kiri' }] },
  { label: 'Celana', parts: [{ id: 'leftShorts', label: 'Kanan' }, { id: 'rightShorts', label: 'Kiri' }] },
  { label: 'Kaus kaki', parts: [{ id: 'leftSock', label: 'Kanan' }, { id: 'rightSock', label: 'Kiri' }] },
];

export const DEFAULT_FABRIC_PARTS: KitPartId[] = PART_GROUPS.flatMap((g) => g.parts.map((p) => p.id));

export const DEFAULT_FABRIC_CONFIG: FabricConfig = {
  layers: [
    { id: 'fabric-base', type: 'micro-mesh', opacity: 0.22, scale: 1, visible: true, parts: DEFAULT_FABRIC_PARTS },
  ],
};

/** Magnified swatch of a fabric overlay (2.4x) on a typical jersey colour, so the weave is visible. */
const FabricSwatch: React.FC<{ type: FabricTextureType; small?: boolean }> = ({ type, small }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = type === 'jersey-knit' ? '#1e3a8a' : type === 'jersey-eyelet' ? '#d1d5db' : '#f3f4f6';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const pat = createFabricPattern(ctx, type);
    if (!pat) return;
    ctx.save();
    const k = small ? 1.3 : 2.4;
    ctx.scale(k, k);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, cv.width / k, cv.height / k);
    ctx.restore();
  }, [type, small]);
  return (
    <canvas
      ref={ref}
      width={small ? 36 : 72}
      height={small ? 24 : 48}
      className="rounded border border-slate-700 shrink-0"
    />
  );
};

interface FabricLayersPanelProps {
  config: FabricConfig;
  onChange: (config: FabricConfig) => void;
}

/** Fabric textures as layers: each one has its own weave, size, strength and the parts it covers. */
export const FabricLayersPanel: React.FC<FabricLayersPanelProps> = ({ config, onChange }) => {
  const [openId, setOpenId] = useState<string | null>(config.layers[0]?.id ?? null);

  const update = (id: string, patch: Partial<FabricLayer>) =>
    onChange({ layers: config.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  const addLayer = () => {
    const id = `fabric-${Date.now().toString(36)}`;
    onChange({
      layers: [
        ...config.layers,
        { id, type: 'jersey-dimple', opacity: 0.6, scale: 1, visible: true, parts: [] },
      ],
    });
    setOpenId(id);
  };

  const removeLayer = (id: string) => {
    onChange({ layers: config.layers.filter((l) => l.id !== id) });
    if (openId === id) setOpenId(null);
  };

  const togglePart = (l: FabricLayer, part: KitPartId) =>
    update(l.id, { parts: l.parts.includes(part) ? l.parts.filter((p) => p !== part) : [...l.parts, part] });

  const toggleGroup = (l: FabricLayer, ids: KitPartId[]) => {
    const all = ids.every((i) => l.parts.includes(i));
    update(l.id, { parts: all ? l.parts.filter((p) => !ids.includes(p)) : Array.from(new Set([...l.parts, ...ids])) });
  };

  return (
    <div className="bg-[#151926] p-3.5 rounded-xl border border-slate-800/80 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-white flex items-center gap-1.5">
          <Shirt className="w-3.5 h-3.5 text-amber-400" />
          <span>Layer Tekstur Kain</span>
        </span>
        <button
          type="button"
          onClick={addLayer}
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-amber-700/60 bg-amber-900/20 text-amber-100 hover:bg-amber-800/30"
        >
          <Plus className="w-3 h-3" />
          Tambah
        </button>
      </div>
      <p className="text-[11px] text-slate-400 leading-snug">
        Tiap layer punya tekstur, ukuran, dan intensitas sendiri, lalu centang bagian mana saja yang memakainya. Tampil
        di canvas 2D, model 3D, dan hasil export.
      </p>

      {config.layers.length === 0 && (
        <p className="text-[11px] text-slate-500 text-center py-2">Belum ada layer tekstur. Klik Tambah.</p>
      )}

      {config.layers.map((l) => {
        const open = openId === l.id;
        const label = FABRIC_TEXTURES.find((t) => t.id === l.type)?.label ?? 'Tekstur';
        return (
          <div key={l.id} className="rounded-lg border border-slate-800 bg-slate-900/40">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <button type="button" onClick={() => update(l.id, { visible: !l.visible })} className="text-slate-400 hover:text-white" title="Tampilkan / sembunyikan">
                {l.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <button type="button" onClick={() => setOpenId(open ? null : l.id)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                <FabricSwatch type={l.type} small />
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-semibold text-slate-200">{label}</span>
                  <span className="block text-[10px] text-slate-500">{l.parts.length} bagian</span>
                </span>
                {open ? <ChevronDown className="w-3.5 h-3.5 ml-auto text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-500" />}
              </button>
              <button type="button" onClick={() => removeLayer(l.id)} className="text-slate-500 hover:text-rose-400" title="Hapus layer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {open && (
              <div className="px-2 pb-2.5 space-y-2.5 border-t border-slate-800 pt-2.5">
                <div className="space-y-1.5">
                  {FABRIC_TEXTURES.map((fab) => (
                    <button
                      key={fab.id}
                      type="button"
                      onClick={() => update(l.id, { type: fab.id, ...(fab.id.startsWith('jersey') ? { opacity: Math.max(l.opacity, 0.6) } : {}) })}
                      className={`w-full text-left p-1.5 rounded-lg border text-xs transition-all ${
                        l.type === fab.id
                          ? 'bg-amber-950/40 border-amber-500/80 text-white font-medium'
                          : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FabricSwatch type={fab.id} small />
                        <div className="min-w-0">
                          <div className="font-semibold text-[11px]">{fab.label}</div>
                          <div className="text-[10px] text-slate-500 leading-snug">{fab.desc}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Ukuran Pori / Serat</span>
                    <span className="font-mono text-amber-300">{l.scale.toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.4" max="3" step="0.1" value={l.scale} onChange={(e) => update(l.id, { scale: parseFloat(e.target.value) })} className="w-full accent-amber-500 cursor-pointer" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Intensitas</span>
                    <span className="font-mono text-amber-300">{Math.round(l.opacity * 100)}%</span>
                  </div>
                  <input type="range" min="0.05" max="1" step="0.02" value={l.opacity} onChange={(e) => update(l.id, { opacity: parseFloat(e.target.value) })} className="w-full accent-amber-500 cursor-pointer" />
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dipakai di bagian</div>
                  {PART_GROUPS.map((g) => {
                    const ids = g.parts.map((p) => p.id);
                    const all = ids.every((i) => l.parts.includes(i));
                    const some = ids.some((i) => l.parts.includes(i));
                    return (
                      <div key={g.label} className="flex items-center gap-2 text-[11px] text-slate-300">
                        <label className="flex items-center gap-1.5 w-20 cursor-pointer font-medium">
                          <input
                            type="checkbox"
                            checked={all}
                            ref={(el) => {
                              if (el) el.indeterminate = some && !all;
                            }}
                            onChange={() => toggleGroup(l, ids)}
                            className="accent-amber-500"
                          />
                          {g.label}
                        </label>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {g.parts.map((p) => (
                            <label key={p.id} className="flex items-center gap-1 cursor-pointer text-slate-400">
                              <input type="checkbox" checked={l.parts.includes(p.id)} onChange={() => togglePart(l, p.id)} className="accent-amber-500" />
                              {p.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FabricLayersPanel;
