/**
 * Colour clustering for the PNG importer (pure functions, no DOM): groups the colours of a 1024x1024
 * image into clusters and labels every pixel.
 *
 * A flat design has far more colours than regions: every edge is anti-aliased, so a white logo on red
 * stripes is surrounded by pinks, and JPEG-like noise adds near-duplicates. Treating each of those as a
 * region gives dozens of useless zones and leaves specks of the logo in the wrong zone. So after the
 * greedy grouping the clusters are refined, blend colours (a point on the line between two bigger
 * colours) and tiny clusters are absorbed by the neighbouring region they came from, and isolated specks
 * are merged into their surroundings.
 */

const SIZE = 1024;
const NONE = 65535;

export interface ColorCluster {
  id: number;
  color: [number, number, number];
  count: number;
}

export interface ColorAnalysis {
  clusters: ColorCluster[];
  /** Cluster index per pixel (65535 = transparent / unused). */
  labels: Uint16Array;
  transparent: number;
}

type Rgb = [number, number, number];

const dist = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Distance from point p to the segment a-b, and where on the segment (0..1) the closest point lies. */
function toSegment(p: Rgb, a: Rgb, b: Rgb): { d: number; t: number } {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
  if (len2 === 0) return { d: dist(p, a), t: 0 };
  let t = ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / len2;
  const tc = Math.max(0, Math.min(1, t));
  const q: Rgb = [a[0] + ab[0] * tc, a[1] + ab[1] * tc, a[2] + ab[2] * tc];
  return { d: dist(p, q), t };
}

export interface AnalyzeOptions {
  /** Components smaller than this many pixels are merged into their surroundings (0 = keep). */
  minSpeck?: number;
  /** Absorb anti-aliasing blends and tiny clusters (default true). */
  absorbFringe?: boolean;
}

/**
 * Groups the colours of an image into clusters. Colours are first counted in 5-bit bins; bins are
 * merged greedily (most frequent first) when they lie within `tolerance` of a cluster centre, then the
 * centres are refined and the pixels labelled (see the file comment).
 */
export function analyzeColors(
  image: { data: ArrayLike<number> },
  tolerance: number,
  maxClusters = 32,
  options: AnalyzeOptions = {}
): ColorAnalysis {
  const { minSpeck = 10, absorbFringe = true } = options;
  const d = image.data;
  const BINS = 32 * 32 * 32;
  const counts = new Uint32Array(BINS);
  const sums = new Float64Array(BINS * 3);
  let transparent = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) {
      transparent++;
      continue;
    }
    const b = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
    counts[b]++;
    sums[b * 3] += d[i];
    sums[b * 3 + 1] += d[i + 1];
    sums[b * 3 + 2] += d[i + 2];
  }

  const bins: { b: number; n: number; c: Rgb }[] = [];
  for (let b = 0; b < BINS; b++) {
    if (counts[b] > 0) bins.push({ b, n: counts[b], c: [sums[b * 3] / counts[b], sums[b * 3 + 1] / counts[b], sums[b * 3 + 2] / counts[b]] });
  }
  bins.sort((a, b) => b.n - a.n);

  // 1. greedy grouping, most frequent bins first
  const clusters: { c: Rgb; n: number }[] = [];
  const binToCluster = new Int32Array(BINS).fill(-1);
  for (const bin of bins) {
    let best = -1;
    let bestD = Infinity;
    clusters.forEach((cl, i) => {
      const dd = dist(cl.c, bin.c);
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    });
    if (best >= 0 && (bestD <= tolerance || clusters.length >= maxClusters)) {
      binToCluster[bin.b] = best;
      const cl = clusters[best];
      cl.c = [
        (cl.c[0] * cl.n + bin.c[0] * bin.n) / (cl.n + bin.n),
        (cl.c[1] * cl.n + bin.c[1] * bin.n) / (cl.n + bin.n),
        (cl.c[2] * cl.n + bin.c[2] * bin.n) / (cl.n + bin.n),
      ];
      cl.n += bin.n;
    } else {
      binToCluster[bin.b] = clusters.length;
      clusters.push({ c: [...bin.c] as Rgb, n: bin.n });
    }
  }

  // 2. refine: every bin goes to its nearest FINAL centre (the greedy pass assigned it against a centre
  //    that kept moving), centres are recomputed; a few rounds settle it
  if (clusters.length > 1) {
    for (let round = 0; round < 3; round++) {
      const accN = new Float64Array(clusters.length);
      const accS = new Float64Array(clusters.length * 3);
      for (const bin of bins) {
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < clusters.length; i++) {
          const dd = dist(clusters[i].c, bin.c);
          if (dd < bestD) {
            bestD = dd;
            best = i;
          }
        }
        binToCluster[bin.b] = best;
        accN[best] += bin.n;
        accS[best * 3] += bin.c[0] * bin.n;
        accS[best * 3 + 1] += bin.c[1] * bin.n;
        accS[best * 3 + 2] += bin.c[2] * bin.n;
      }
      clusters.forEach((cl, i) => {
        cl.n = accN[i];
        if (accN[i] > 0) cl.c = [accS[i * 3] / accN[i], accS[i * 3 + 1] / accN[i], accS[i * 3 + 2] / accN[i]];
      });
    }
  }

  // initial labels (empty clusters keep a slot until they are dropped below)
  const labels = new Uint16Array(SIZE * SIZE).fill(NONE);
  for (let p = 0, i = 0; p < SIZE * SIZE; p++, i += 4) {
    if (d[i + 3] < 128) continue;
    labels[p] = binToCluster[((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3)];
  }

  // 3. which clusters are not real regions? Anti-aliasing blends (lie on the line between two bigger
  //    colours) and tiny noise clusters
  const opaque = clusters.reduce((n, c) => n + c.n, 0) || 1;
  const minor = new Array<boolean>(clusters.length).fill(false);
  if (absorbFringe && clusters.length > 2) {
    const order = clusters.map((_, i) => i).sort((a, b) => clusters[b].n - clusters[a].n);
    const blendTol = Math.max(8, tolerance * 0.55);
    order.forEach((i, r) => {
      const cl = clusters[i];
      if (cl.n === 0 || cl.n < opaque * 0.0001) {
        minor[i] = true;
        return;
      }
      if (cl.n >= opaque * 0.03) return; // big mid-tones are real regions
      for (let a = 0; a < r && !minor[i]; a++) {
        if (minor[order[a]]) continue;
        for (let b = a + 1; b < r; b++) {
          if (minor[order[b]]) continue;
          const A = clusters[order[a]].c;
          const B = clusters[order[b]].c;
          if (dist(A, B) < tolerance * 1.5) continue;
          const s = toSegment(cl.c, A, B);
          if (s.d < blendTol && s.t > 0.06 && s.t < 0.94) {
            minor[i] = true;
            break;
          }
        }
      }
    });
    if (minor.every(Boolean)) minor.fill(false);
  }

  // 4. pixels of absorbed clusters take the label of the nearest-coloured real region around them
  if (minor.some(Boolean)) {
    const major = clusters.map((_, i) => i).filter((i) => !minor[i]);
    const next = new Uint16Array(labels);
    const R = 3;
    for (let p = 0; p < SIZE * SIZE; p++) {
      const lab = labels[p];
      if (lab === NONE || !minor[lab]) continue;
      const i = p * 4;
      const px: Rgb = [d[i], d[i + 1], d[i + 2]];
      const x = p % SIZE;
      const y = (p / SIZE) | 0;
      let best = -1;
      let bestD = Infinity;
      for (let dy = -R; dy <= R; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= SIZE) continue;
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= SIZE) continue;
          const l = labels[yy * SIZE + xx];
          if (l === NONE || minor[l]) continue;
          const dd = dist(px, clusters[l].c);
          if (dd < bestD) {
            bestD = dd;
            best = l;
          }
        }
      }
      if (best < 0) {
        for (const l of major) {
          const dd = dist(px, clusters[l].c);
          if (dd < bestD) {
            bestD = dd;
            best = l;
          }
        }
      }
      next[p] = best;
    }
    labels.set(next);
  }

  // 5. isolated specks (a few pixels) are merged into what surrounds them
  if (minSpeck > 0) removeSpecks(labels, minSpeck);

  // 6. final clusters: drop the absorbed / empty ones, order by size, remap labels
  const finalCount = new Float64Array(clusters.length);
  for (let p = 0; p < SIZE * SIZE; p++) if (labels[p] !== NONE) finalCount[labels[p]]++;
  const keep = clusters.map((_, i) => i).filter((i) => finalCount[i] > 0);
  keep.sort((a, b) => finalCount[b] - finalCount[a]);
  const remap = new Int32Array(clusters.length).fill(-1);
  keep.forEach((old, ni) => (remap[old] = ni));
  for (let p = 0; p < SIZE * SIZE; p++) if (labels[p] !== NONE) labels[p] = remap[labels[p]];

  return {
    clusters: keep.map((old, ni) => ({
      id: ni,
      color: [Math.round(clusters[old].c[0]), Math.round(clusters[old].c[1]), Math.round(clusters[old].c[2])] as Rgb,
      count: finalCount[old],
    })),
    labels,
    transparent,
  };
}

/** Connected pieces (4-neighbours) smaller than `minArea` pixels take the label that surrounds them most. */
export function removeSpecks(labels: Uint16Array, minArea: number): void {
  const visited = new Uint8Array(SIZE * SIZE);
  const stack: number[] = [];
  const members: number[] = [];
  for (let start = 0; start < SIZE * SIZE; start++) {
    const lab = labels[start];
    if (visited[start] || lab === NONE) continue;
    members.length = 0;
    stack.push(start);
    visited[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      members.push(p);
      const x = p % SIZE;
      const y = (p / SIZE) | 0;
      if (x > 0 && !visited[p - 1] && labels[p - 1] === lab) { visited[p - 1] = 1; stack.push(p - 1); }
      if (x < SIZE - 1 && !visited[p + 1] && labels[p + 1] === lab) { visited[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && !visited[p - SIZE] && labels[p - SIZE] === lab) { visited[p - SIZE] = 1; stack.push(p - SIZE); }
      if (y < SIZE - 1 && !visited[p + SIZE] && labels[p + SIZE] === lab) { visited[p + SIZE] = 1; stack.push(p + SIZE); }
    }
    if (members.length >= minArea) continue;
    const votes = new Map<number, number>();
    for (const p of members) {
      const x = p % SIZE;
      const y = (p / SIZE) | 0;
      const around = [x > 0 ? labels[p - 1] : NONE, x < SIZE - 1 ? labels[p + 1] : NONE, y > 0 ? labels[p - SIZE] : NONE, y < SIZE - 1 ? labels[p + SIZE] : NONE];
      for (const l of around) if (l !== NONE && l !== lab) votes.set(l, (votes.get(l) ?? 0) + 1);
    }
    let best = -1;
    let bestN = 0;
    votes.forEach((n, l) => {
      if (n > bestN) {
        bestN = n;
        best = l;
      }
    });
    if (best >= 0) for (const p of members) labels[p] = best;
  }
}
