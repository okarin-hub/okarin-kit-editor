import * as THREE from 'three';

/**
 * Procedural long sleeves for the 3D preview.
 *
 * The CometKIT model only has short sleeves, so the long-sleeve area of the PES texture (x 0-345 /
 * 680-1024, y 68-315) is not mapped to anything. This builds a tapered tube that continues each
 * short sleeve from its cuff ring to the wrist, and re-maps the UVs of the short sleeve plus the
 * tube onto the long-sleeve island, so everything drawn there (cuffs, stripes, panels) shows up in
 * 3D. Switching back to short sleeves restores the original UVs and hides the tubes.
 *
 * The geometry is generated from the model's own cuff ring, so it needs no extra asset.
 */

const SHORT_V0 = 347; // short-sleeve island: v range 347..604 (circumference)
const SHORT_V_SPAN = 257;
const LONG_V0 = 68; // long-sleeve island: y range 68..315
const LONG_V_SPAN = 247;
const LONG_LEFT_SHOULDER_X = 345; // texture-left long sleeve: shoulder at x = 345, wrist at x = 0
const RIGHT_LONG_SHOULDER_X = 680; // texture-right long sleeve: shoulder at 680, wrist at 1024
const RIGHT_LONG_SPAN = 344;

export interface LongSleeveController {
  setLong: (long: boolean) => void;
  dispose: () => void;
}

const longV = (shortV: number) => (LONG_V0 + ((shortV - SHORT_V0) / SHORT_V_SPAN) * LONG_V_SPAN) / 1024;

export function createLongSleeves(
  sleeveMesh: THREE.Mesh,
  material: THREE.Material
): LongSleeveController | null {
  const geo = sleeveMesh.geometry as THREE.BufferGeometry;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!pos || !uv) return null;

  const n = pos.count;
  const originalUV = new Float32Array(uv.array as ArrayLike<number>);
  const longUV = new Float32Array(originalUV);
  const tubes: THREE.Mesh[] = [];

  for (const side of [-1, 1] as const) {
    // vertices of this sleeve (the sleeve mesh holds both arms, the torso is not part of it)
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i);
      if (Math.sign(x) === side && Math.abs(x) > 0.05) idx.push(i);
    }
    if (idx.length < 20) continue;

    // UV x extremes: the cuff is the outer end (left: smallest x, right: largest x)
    let uMin = Infinity;
    let uMax = -Infinity;
    idx.forEach((i) => {
      const ux = originalUV[i * 2] * 1024;
      uMin = Math.min(uMin, ux);
      uMax = Math.max(uMax, ux);
    });
    const cuffU = side < 0 ? uMin : uMax;
    const shoulderU = side < 0 ? uMax : uMin;

    const ringIdx = idx.filter((i) => Math.abs(originalUV[i * 2] * 1024 - cuffU) < 1.5);
    const baseIdx = idx.filter((i) => Math.abs(originalUV[i * 2] * 1024 - shoulderU) < 12);
    if (ringIdx.length < 6 || baseIdx.length < 3) continue;

    // Unique ring positions (the mesh duplicates vertices along UV seams), ordered by v
    const seen = new Map<string, { p: THREE.Vector3; v: number }>();
    ringIdx.forEach((i) => {
      const p = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      const key = `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`;
      const v = originalUV[i * 2 + 1] * 1024;
      const prev = seen.get(key);
      if (!prev || v < prev.v) seen.set(key, { p, v });
    });
    const ring = Array.from(seen.values()).sort((a, b) => a.v - b.v);
    if (ring.length < 6) continue;
    // close the loop: the seam point appears again at the end of the v range
    ring.push({ p: ring[0].p.clone(), v: Math.max(...ringIdx.map((i) => originalUV[i * 2 + 1] * 1024)) });

    const centre = new THREE.Vector3();
    ringIdx.forEach((i) => centre.add(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))));
    centre.divideScalar(ringIdx.length);
    const base = new THREE.Vector3();
    baseIdx.forEach((i) => base.add(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))));
    base.divideScalar(baseIdx.length);

    const dir = centre.clone().sub(base);
    const shortLen = dir.length();
    dir.normalize();
    const tubeLen = shortLen * 1.45;
    const total = shortLen + tubeLen;

    // --- UVs of the short sleeve in long mode (axial position along the arm -> long island x)
    const toLongX = (s: number) =>
      (side < 0
        ? LONG_LEFT_SHOULDER_X * (1 - s)
        : RIGHT_LONG_SHOULDER_X + RIGHT_LONG_SPAN * s) / 1024;
    const tmp = new THREE.Vector3();
    idx.forEach((i) => {
      tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(base);
      const s = Math.min(1, Math.max(0, tmp.dot(dir) / total));
      longUV[i * 2] = toLongX(s);
      longUV[i * 2 + 1] = longV(originalUV[i * 2 + 1] * 1024);
    });

    // --- Tube: rings from the cuff to the wrist (slightly tapering, drooping a little)
    const M = 7;
    const R = ring.length;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const c = centre.clone();
    const down = new THREE.Vector3(0, -1, 0);
    for (let j = 0; j <= M; j++) {
      const t = j / M;
      if (j > 0) {
        const d = dir.clone().addScaledVector(down, 0.35 * t).normalize();
        c.addScaledVector(d, tubeLen / M);
      }
      const k = 1 - 0.3 * t; // taper towards the wrist
      const s = (shortLen + tubeLen * t) / total;
      ring.forEach(({ p, v }) => {
        const r = p.clone().sub(centre).multiplyScalar(k).add(c);
        positions.push(r.x, r.y, r.z);
        uvs.push(toLongX(s), longV(v));
      });
    }
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < R - 1; i++) {
        const a = j * R + i;
        const b = a + 1;
        const c2 = a + R;
        const d = c2 + 1;
        indices.push(a, c2, b, b, c2, d);
      }
    }
    const tubeGeo = new THREE.BufferGeometry();
    tubeGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    tubeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    tubeGeo.setIndex(indices);
    tubeGeo.computeVertexNormals();

    const tube = new THREE.Mesh(tubeGeo, material);
    tube.castShadow = true;
    tube.receiveShadow = true;
    tube.visible = false;
    tube.name = `long_sleeve_${side < 0 ? 'left' : 'right'}`;
    sleeveMesh.add(tube);
    tubes.push(tube);
  }

  if (tubes.length === 0) return null;

  return {
    setLong: (long: boolean) => {
      (uv.array as Float32Array).set(long ? longUV : originalUV);
      uv.needsUpdate = true;
      tubes.forEach((t) => (t.visible = long));
    },
    dispose: () => {
      tubes.forEach((t) => {
        t.geometry.dispose();
        t.removeFromParent();
      });
      (uv.array as Float32Array).set(originalUV);
      uv.needsUpdate = true;
    },
  };
}
