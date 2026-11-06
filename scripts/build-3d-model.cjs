#!/usr/bin/env node
/**
 * Builds public/model/pes_kit.glb (the 3D preview model) from the full CometKIT export
 * public/model/pes_kit_model.glb (local only, git-ignored).
 *
 *   node scripts/build-3d-model.cjs [source.glb] [out.glb]
 *
 * Picks the parts the viewer uses, renames them to stable ids, welds duplicate vertices and keeps only
 * position, normal and the kit UV (the skin, second UV and vertex colours are not used), which makes
 * the file a fraction of the export's size. Part ids:
 *   shirt_out, shirt_out_tight
 *   sleeve_{short|long}_{normal|kappa}[_tight]
 *   pants_out, pants_out_tight, pants_leg_001..016 (ShortsModel), socks_{short|middle|long}
 *   collar_001..133 (Collar)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = process.argv[2] || path.join(root, 'public/model/pes_kit_model.glb');
const out = process.argv[3] || path.join(root, 'public/model/pes_kit.glb');

// part id -> node name in the CometKIT scene
const PARTS = {
  shirt_out: 'shirt_out',
  shirt_out_tight: 'Shirt_OUT',
  sleeve_short_normal: '1.SHORT_Sleeve',
  sleeve_short_kappa: '3.SHORT_Sleeve_Kappa',
  sleeve_long_normal: '5.LONG_Sleeve',
  sleeve_long_kappa: '7.LONG_Sleeve_Kappa',
  sleeve_short_normal_tight: '1. SHORT',
  sleeve_short_kappa_tight: '3. Short_Kappa',
  sleeve_long_normal_tight: '1. Long..',
  sleeve_long_kappa_tight: '3. Long__Kappa',
  pants_out: '2. Pants_out_sub',
  pants_out_tight: '3. Pants_Out_Tight',
  socks_short: 'socks_short',
  socks_middle: 'socks_middle',
  socks_long: 'socks_long',
};
for (let i = 1; i <= 16; i++) PARTS[`pants_leg_${String(i).padStart(3, '0')}`] = `MESH_pants_${String(i).padStart(3, '0')}`;
for (let i = 1; i <= 133; i++) PARTS[`collar_${String(i).padStart(3, '0')}`] = `MESH_collar_${String(i).padStart(3, '0')}`;

const b = fs.readFileSync(src);
const jsonLen = b.readUInt32LE(12);
const j = JSON.parse(b.slice(20, 20 + jsonLen));
const bin = 20 + jsonLen + 8;
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function readAccessor(ai) {
  const a = j.accessors[ai];
  const bv = j.bufferViews[a.bufferView];
  const n = SIZE[a.type];
  const bytes = a.componentType === 5126 || a.componentType === 5125 ? 4 : a.componentType === 5123 ? 2 : 1;
  const stride = bv.byteStride || n * bytes;
  const off = bin + (bv.byteOffset || 0) + (a.byteOffset || 0);
  const res = new Float64Array(a.count * n);
  for (let i = 0; i < a.count; i++)
    for (let k = 0; k < n; k++) {
      const o = off + i * stride + k * bytes;
      res[i * n + k] =
        a.componentType === 5126 ? b.readFloatLE(o)
        : a.componentType === 5125 ? b.readUInt32LE(o)
        : a.componentType === 5123 ? b.readUInt16LE(o)
        : b.readUInt8(o);
    }
  return res;
}

/**
 * Welds vertices with the same position and UV (the export splits every face corner) and averages
 * their normals, which keeps cloth smooth; returns compact arrays.
 */
function weld(pos, nor, uv, idx) {
  const map = new Map();
  const normalAt = new Map(); // position -> summed normal, shared across UV seams so seams don't show
  const P = [], U = [], I = [], posKeys = [];
  for (let t = 0; t < idx.length; t++) {
    const v = idx[t];
    const pk = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]].map((x) => Math.round(x * 1e5)).join(',');
    const key = pk + '|' + Math.round(uv[v * 2] * 1e5) + ',' + Math.round(uv[v * 2 + 1] * 1e5);
    let w = map.get(key);
    if (w === undefined) {
      w = P.length / 3;
      map.set(key, w);
      P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
      U.push(uv[v * 2], uv[v * 2 + 1]);
      posKeys.push(pk);
    }
    const n = normalAt.get(pk) || [0, 0, 0];
    for (let k = 0; k < 3; k++) n[k] += nor[v * 3 + k];
    normalAt.set(pk, n);
    I.push(w);
  }
  const N = [];
  for (const pk of posKeys) {
    const n = normalAt.get(pk);
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    N.push(n[0] / l, n[1] / l, n[2] / l);
  }
  return { P, N, U, I };
}

const chunks = [];
let byteLen = 0;
const outJson = {
  asset: { version: '2.0', generator: 'okarin build-3d-model' },
  scene: 0,
  scenes: [{ name: 'kit', nodes: [] }],
  nodes: [],
  meshes: [],
  accessors: [],
  bufferViews: [],
  buffers: [],
  materials: [{ name: 'kit' }],
};
function addView(buf, target) {
  const pad = (4 - (byteLen % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); byteLen += pad; }
  outJson.bufferViews.push({ buffer: 0, byteOffset: byteLen, byteLength: buf.length, target });
  chunks.push(buf);
  byteLen += buf.length;
  return outJson.bufferViews.length - 1;
}
function addAccessor(arr, type, componentType, target, withMinMax) {
  const n = SIZE[type];
  const buf = componentType === 5126 ? Buffer.from(new Float32Array(arr).buffer)
    : componentType === 5125 ? Buffer.from(new Uint32Array(arr).buffer)
    : Buffer.from(new Uint16Array(arr).buffer);
  const acc = { bufferView: addView(buf, target), componentType, count: arr.length / n, type };
  if (withMinMax) {
    acc.min = Array(n).fill(Infinity); acc.max = Array(n).fill(-Infinity);
    for (let i = 0; i < arr.length; i++) { const k = i % n; acc.min[k] = Math.min(acc.min[k], arr[i]); acc.max[k] = Math.max(acc.max[k], arr[i]); }
  }
  outJson.accessors.push(acc);
  return outJson.accessors.length - 1;
}

const missing = [];
let verts = 0;
for (const [id, nodeName] of Object.entries(PARTS)) {
  const node = j.nodes.find((n) => n.name === nodeName && n.mesh !== undefined);
  if (!node) { missing.push(`${id} (${nodeName})`); continue; }
  if (node.translation || node.rotation || node.scale || node.matrix) throw new Error(`${nodeName} has a transform; not handled`);
  const prim = j.meshes[node.mesh].primitives[0];
  const at = prim.attributes;
  const w = weld(readAccessor(at.POSITION), readAccessor(at.NORMAL), readAccessor(at.TEXCOORD_0), readAccessor(prim.indices));
  verts += w.P.length / 3;
  const attributes = {
    POSITION: addAccessor(w.P, 'VEC3', 5126, 34962, true),
    NORMAL: addAccessor(w.N, 'VEC3', 5126, 34962, false),
    TEXCOORD_0: addAccessor(w.U, 'VEC2', 5126, 34962, false),
  };
  const indices = addAccessor(w.I, 'SCALAR', w.P.length / 3 > 65535 ? 5125 : 5123, 34963, false);
  outJson.meshes.push({ name: id, primitives: [{ attributes, indices, material: 0 }] });
  outJson.nodes.push({ name: id, mesh: outJson.meshes.length - 1 });
  outJson.scenes[0].nodes.push(outJson.nodes.length - 1);
}
if (missing.length) { console.error('Missing parts:', missing.join(', ')); process.exit(1); }

const binBuf = Buffer.concat(chunks, byteLen);
const binPad = Buffer.concat([binBuf, Buffer.alloc((4 - (binBuf.length % 4)) % 4)]);
outJson.buffers.push({ byteLength: binPad.length });
let jsonBuf = Buffer.from(JSON.stringify(outJson));
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binPad.length, 8);
const ch = (len, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(len, 0); h.writeUInt32LE(type, 4); return h; };
fs.writeFileSync(out, Buffer.concat([header, ch(jsonBuf.length, 0x4e4f534a), jsonBuf, ch(binPad.length, 0x004e4942), binPad]));
console.log(`${Object.keys(PARTS).length} parts, ${verts} vertices, ${(fs.statSync(out).size / 1e6).toFixed(2)} MB -> ${out}`);
