/**
 * Logos and sponsors in a kit picture (Import PNG), found on the colour labels at 1024:
 *  0. colours a shade apart (a base split into light, dark and mesh blue) count as one family;
 *  1. the local background: per 16 px block, the most common colour in the 80 × 80 px around it (kit parts only);
 *  2. a pixel of another colour inside an area where one colour clearly rules is a candidate;
 *  3. candidates are grown sideways more than up and down, so the letters of a word and the pieces of a badge join
 *     while stacked sponsor lines stay apart, and grouped;
 *  4. a group that is long and thin (a pinstripe, a side panel, a cuff band, a diagonal stripe) or very large (a
 *     panel, a sash) is part of the design, not a logo.
 * The shirt, shorts and socks only: the collar strip and the armband / credit boxes (template watermarks) are left out.
 */
import { groupMap } from '@/utils/pngImport';
import { LAYER_GROUPS } from '@/utils/psdImport';

const SIZE = 1024;
const B = 16; // block size
const NB = SIZE / B;
const WIN = 2; // window radius in blocks (5 × 5 blocks = 80 px)
const GROW_X = 5, GROW_Y = 2;

export interface DetectedLogo {
  /** x, y, w, h at 1024 */
  box: [number, number, number, number];
  /** part group name (LAYER_GROUPS) */
  group: string;
  /** colour label of the area around it (it is filled with this colour under the logo) */
  bg: number;
  pixels: number;
}

/** Flag on a map value: a pixel inside a badge's outline that has the background colour (kept solid, not see-through). */
export const LOGO_INSIDE = 0x8000;

export interface LogoDetection {
  /** logo id + 1 per pixel at 1024 (0 = no logo), with LOGO_INSIDE on the enclosed background pixels of a badge */
  map: Uint16Array;
  logos: DetectedLogo[];
}

/**
 * Colour families: clusters closer than `within` (RGB distance) are joined, step by step (light blue - blue - dark
 * blue is one family). Returns the family of each cluster, numbered 0..
 */
export function colourFamilies(colors: [number, number, number][], within = 48): Int32Array {
  const parent = Int32Array.from(colors, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const [a, b] = [colors[i], colors[j]];
      if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < within) parent[find(j)] = find(i);
    }
  }
  const ids = new Map<number, number>();
  return Int32Array.from(colors, (_, i) => {
    const r = find(i);
    if (!ids.has(r)) ids.set(r, ids.size);
    return ids.get(r)!;
  });
}

// self-check: dark blue - blue - light blue chain into one family, white stays apart
{
  const f = colourFamilies([[20, 30, 120], [30, 40, 150], [45, 55, 180], [250, 250, 250]]);
  if (!(f[0] === f[1] && f[1] === f[2] && f[3] !== f[0])) console.error('logoDetect colourFamilies self-check failed');
}

export function detectLogos(
  rawLabels: Uint16Array,
  colors: [number, number, number][],
  /** for tests: every group with the numbers it was judged by */
  debug?: (info: Record<string, number | string | boolean>) => void
): LogoDetection {
  const gm = groupMap();
  const fam = colourFamilies(colors);
  const K = colors.length ? Math.max(...fam) + 1 : 0;
  const map = new Uint16Array(SIZE * SIZE);
  if (!K) return { map, logos: [] };
  // the work runs on families; the background a logo is filled with is the family's largest cluster
  const labels = Uint16Array.from(rawLabels, (l) => (l === 65535 ? l : fam[l]));
  const size = new Uint32Array(colors.length);
  for (const l of rawLabels) if (l !== 65535) size[l]++;
  const famMain = new Int32Array(K).fill(-1);
  colors.forEach((_, c) => {
    if (famMain[fam[c]] < 0 || size[c] > size[famMain[fam[c]]]) famMain[fam[c]] = c;
  });
  const onKit = (p: number) => gm[p] >= 1 && gm[p] <= 3 && labels[p] !== 65535;
  // the texture's own backdrop (the colour around the parts) also fills the corners of the part boxes and the neck
  // hole: it is not cloth, unless it rules an area (black shorts on a black backdrop)
  const outside = new Uint32Array(K);
  for (let p = 0; p < labels.length; p++) if (!gm[p] && labels[p] !== 65535) outside[labels[p]]++;
  let bgFam = -1;
  for (let k = 0; k < K; k++) if (outside[k] > 0 && (bgFam < 0 || outside[k] > outside[bgFam])) bgFam = k;

  // 1. colour histogram per block, then the dominant colour of each block's window
  const hist = new Uint32Array(NB * NB * K);
  for (let p = 0; p < labels.length; p++) {
    if (!onKit(p)) continue;
    const x = p % SIZE, y = (p / SIZE) | 0;
    hist[(((y / B) | 0) * NB + ((x / B) | 0)) * K + labels[p]]++;
  }
  const bgBlock = new Int32Array(NB * NB).fill(-1);
  const sum = new Uint32Array(K);
  for (let by = 0; by < NB; by++) {
    for (let bx = 0; bx < NB; bx++) {
      sum.fill(0);
      let total = 0;
      for (let wy = Math.max(0, by - WIN); wy <= Math.min(NB - 1, by + WIN); wy++) {
        for (let wx = Math.max(0, bx - WIN); wx <= Math.min(NB - 1, bx + WIN); wx++) {
          const o = (wy * NB + wx) * K;
          for (let k = 0; k < K; k++) {
            sum[k] += hist[o + k];
            total += hist[o + k];
          }
        }
      }
      let best = -1, n = 0;
      for (let k = 0; k < K; k++) if (k !== bgFam && sum[k] > n) { n = sum[k]; best = k; }
      const cloth = total - (bgFam >= 0 ? sum[bgFam] : 0);
      // only where one colour clearly rules the area (the backdrop not counted): a striped or two-tone area has no
      // single background
      if (best >= 0 && cloth >= total * 0.3 && n >= cloth * 0.5) bgBlock[by * NB + bx] = best;
      else if (bgFam >= 0 && sum[bgFam] >= total * 0.5) bgBlock[by * NB + bx] = bgFam;
    }
  }
  const bgAt = (p: number) => bgBlock[((((p / SIZE) | 0) / B) | 0) * NB + (((p % SIZE) / B) | 0)];

  // the backdrop colour reached from outside the parts without leaving it: the backdrop itself, and the lines of that
  // colour that run into it (black side stripes ending at a black backdrop). A black logo inside the cloth is not
  // reached; black shorts are, but then the shorts are the background and their logos are not black anyway.
  const outerBackdrop = new Uint8Array(SIZE * SIZE);
  if (bgFam >= 0) {
    const queue = new Int32Array(SIZE * SIZE);
    let qh = 0, qt = 0;
    for (let p = 0; p < labels.length; p++) if (!gm[p] && labels[p] === bgFam) { outerBackdrop[p] = 1; queue[qt++] = p; }
    while (qh < qt) {
      const p = queue[qh++];
      const x = p % SIZE, y = (p / SIZE) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < SIZE - 1 ? p + 1 : -1, y > 0 ? p - SIZE : -1, y < SIZE - 1 ? p + SIZE : -1]) {
        if (q >= 0 && !outerBackdrop[q] && labels[q] === bgFam) { outerBackdrop[q] = 1; queue[qt++] = q; }
      }
    }
  }

  // within 2 px of that backdrop inside the parts: the anti-aliased rim around a backdrop-coloured line or corner
  const rim = new Uint8Array(SIZE * SIZE);
  for (let p = 0; p < labels.length; p++) {
    if (!outerBackdrop[p] || !gm[p]) continue;
    const x = p % SIZE, y = (p / SIZE) | 0;
    for (let yy = Math.max(0, y - 2); yy <= Math.min(SIZE - 1, y + 2); yy++) rim.fill(1, yy * SIZE + Math.max(0, x - 2), yy * SIZE + Math.min(SIZE, x + 3));
  }

  // 2. candidates
  const cand = new Uint8Array(SIZE * SIZE);
  for (let p = 0; p < labels.length; p++) {
    if (!onKit(p) || outerBackdrop[p]) continue;
    const bg = bgAt(p);
    if (bg >= 0 && labels[p] !== bg) cand[p] = 1;
  }
  // within 3 px of the cloth's edge (another part group, outside the parts, or the backdrop)
  const nearEdge = (p: number) => {
    const x = p % SIZE, y = (p / SIZE) | 0;
    for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= SIZE || yy >= SIZE) return true;
      const q = yy * SIZE + xx;
      // the backdrop colour is an edge only where it is not the cloth itself (black shorts on a black backdrop)
      if (gm[q] !== gm[p] || (labels[q] === bgFam && labels[p] !== bgFam && bgAt(p) !== bgFam)) return true;
    }
    return false;
  };
  // within 3 px of the edge of the part group itself (a UV seam)
  const nearSeam = (p: number) => {
    const x = p % SIZE, y = (p / SIZE) | 0;
    for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= SIZE || yy >= SIZE || gm[yy * SIZE + xx] !== gm[p]) return true;
    }
    return false;
  };
  // a piece whose main colour is the background of an area next to it (within 2 blocks): the edge of that area, where
  // the background changes (light stripes at the edge of a panel on a dark backdrop), not a logo on top of it
  const matchesArea = (famCount: Map<number, number>, x0: number, y0: number, x1: number, y1: number) => {
    let main = -1, n = 0;
    for (const [k, c] of famCount) if (c > n) { n = c; main = k; }
    const bx0 = Math.max(0, ((x0 / B) | 0) - 2), bx1 = Math.min(NB - 1, ((x1 / B) | 0) + 2);
    const by0 = Math.max(0, ((y0 / B) | 0) - 2), by1 = Math.min(NB - 1, ((y1 / B) | 0) + 2);
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) if (bgBlock[by * NB + bx] === main) return true;
    return false;
  };
  // long thin pieces (pinstripes, piping) go before grouping, or they would chain the logos they pass into one
  const dropped = dropStripes(cand, labels);
  // within 3 px of a dropped line: the short end pieces of a stripe left behind
  const nearLine = new Uint8Array(SIZE * SIZE);
  for (let p = 0; p < dropped.length; p++) {
    if (!dropped[p]) continue;
    const x = p % SIZE, y = (p / SIZE) | 0;
    for (let yy = Math.max(0, y - 3); yy <= Math.min(SIZE - 1, y + 3); yy++) nearLine.fill(1, yy * SIZE + Math.max(0, x - 3), yy * SIZE + Math.min(SIZE, x + 4));
  }

  // 3. grown (separable box max), kept inside the part group it started in
  const row = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    let last = -1e9;
    for (let x = 0; x < SIZE; x++) {
      if (cand[y * SIZE + x]) last = x;
      if (x - last <= GROW_X) row[y * SIZE + x] = 1;
    }
    last = 1e9;
    for (let x = SIZE - 1; x >= 0; x--) {
      if (cand[y * SIZE + x]) last = x;
      if (last - x <= GROW_X) row[y * SIZE + x] = 1;
    }
  }
  const grown = new Uint8Array(SIZE * SIZE);
  for (let x = 0; x < SIZE; x++) {
    let last = -1e9;
    for (let y = 0; y < SIZE; y++) {
      if (row[y * SIZE + x]) last = y;
      if (y - last <= GROW_Y) grown[y * SIZE + x] = 1;
    }
    last = 1e9;
    for (let y = SIZE - 1; y >= 0; y--) {
      if (row[y * SIZE + x]) last = y;
      if (last - y <= GROW_Y) grown[y * SIZE + x] = 1;
    }
  }
  for (let p = 0; p < grown.length; p++) if (!(gm[p] >= 1 && gm[p] <= 3)) grown[p] = 0;

  const groupArea = new Uint32Array(LAYER_GROUPS.length + 1);
  for (let p = 0; p < gm.length; p++) groupArea[gm[p]]++;

  // 4. groups, judged by shape and size
  const comp = new Int32Array(SIZE * SIZE).fill(-1);
  const stack = new Int32Array(SIZE * SIZE);
  const found: (DetectedLogo & { comp: number })[] = [];
  let compId = 0;
  for (let s = 0; s < grown.length; s++) {
    if (!grown[s] || comp[s] >= 0) continue;
    const id = compId++;
    let top = 0, area = 0, raw = 0, edge = 0, backdrop = 0, remnant = 0, seam = 0, rimmed = 0;
    let x0 = SIZE, y0 = SIZE, x1 = -1, y1 = -1;
    // the box of the logo's own pixels (the group's box includes the growth)
    let rx0 = SIZE, ry0 = SIZE, rx1 = -1, ry1 = -1;
    const groupCount = new Uint32Array(LAYER_GROUPS.length + 1);
    const famCount = new Map<number, number>();
    const bgCount = new Map<number, number>();
    comp[s] = id;
    stack[top++] = s;
    while (top) {
      const p = stack[--top];
      area++;
      const x = p % SIZE, y = (p / SIZE) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (cand[p]) {
        raw++;
        if (x < rx0) rx0 = x;
        if (x > rx1) rx1 = x;
        if (y < ry0) ry0 = y;
        if (y > ry1) ry1 = y;
        if (nearLine[p]) remnant++;
        if (nearSeam(p)) seam++;
        if (rim[p] && bgAt(p) !== bgFam) rimmed++;
        famCount.set(labels[p], (famCount.get(labels[p]) ?? 0) + 1);
        if (nearEdge(p)) edge++;
        if (labels[p] === bgFam) backdrop++;
        groupCount[gm[p]]++;
        const bg = bgAt(p);
        bgCount.set(bg, (bgCount.get(bg) ?? 0) + 1);
      }
      const nb = [x > 0 ? p - 1 : -1, x < SIZE - 1 ? p + 1 : -1, y > 0 ? p - SIZE : -1, y < SIZE - 1 ? p + SIZE : -1];
      for (const q of nb) {
        if (q >= 0 && grown[q] && comp[q] < 0 && gm[q] === gm[p]) {
          comp[q] = id;
          stack[top++] = q;
        }
      }
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    let g = 1;
    for (let k = 2; k <= 3; k++) if (groupCount[k] > groupCount[g]) g = k;
    const length = Math.hypot(w, h);
    const tooSmall = raw < 60 || Math.max(w, h) < 8;
    // a long thin group: its length squared is many times its area (a word is ~4, a badge ~1.5, a pinstripe 50+)
    const stripe = (length * length) / area >= 9;
    const tooBig = area > groupArea[g] * 0.05;
    // an elongated piece along the edge of the cloth: a cuff or side panel of the design
    const rw = rx1 - rx0 + 1, rh = ry1 - ry0 + 1;
    // ...or one solid bar of colour (a side panel), or a piece mostly along the edge (the end of a stripe)
    const panel =
      (edge >= raw * 0.08 && Math.max(w, h) >= 2.5 * Math.min(w, h)) ||
      (raw >= rw * rh * 0.75 && Math.max(rw, rh) >= 3 * Math.min(rw, rh)) ||
      edge >= raw * 0.3 ||
      remnant >= raw * 0.3 ||
      // a solid piece cut by a UV seam: the end of a stripe that runs on in another part
      (seam >= raw * 0.02 && raw >= rw * rh * 0.45) ||
      rimmed >= raw * 0.4 ||
      matchesArea(famCount, rx0, ry0, rx1, ry1);
    // the backdrop showing through: a solid blob of it without detail (the neck hole), or reaching the cloth's edge
    // (a corner of a part box). A black logo on a black backdrop has letters and gaps, so it is not that solid.
    const hole = backdrop >= raw * 0.8 && ((raw >= 300 && raw >= w * h * 0.55) || edge >= raw * 0.05);
    debug?.({ box: `${rx0},${ry0} ${rw}x${rh}`, raw, area, edge, seam, remnant, backdrop, tooSmall, stripe, tooBig, panel, hole });
    if (tooSmall || stripe || tooBig || panel || hole) continue;
    let bg = -1, n = 0;
    for (const [k, c] of bgCount) if (k >= 0 && c > n) { n = c; bg = k; }
    if (bg < 0) continue;
    found.push({ box: [rx0, ry0, rw, rh], group: LAYER_GROUPS[g - 1][0], bg: famMain[bg], pixels: raw, comp: id });
  }

  // 5. the pieces of one wide-spaced word (Z O M A) side by side: one logo
  const root = found.map((_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  for (let i = 0; i < found.length; i++) {
    for (let j = i + 1; j < found.length; j++) {
      const a = found[i], b = found[j];
      if (a.group !== b.group || a.bg !== b.bg) continue;
      const [ax, ay, aw, ah] = a.box, [bx, by, bw, bh] = b.box;
      const overlapY = Math.min(ay + ah, by + bh) - Math.max(ay, by);
      const gapX = Math.max(bx - (ax + aw), ax - (bx + bw));
      // letters of one word share their height; a badge next to a sponsor does not
      const alike = Math.max(ah, bh) <= 1.35 * Math.min(ah, bh);
      if (alike && overlapY >= 0.5 * Math.min(ah, bh) && gapX <= 0.8 * Math.max(ah, bh)) root[find(j)] = find(i);
    }
  }
  const logos: DetectedLogo[] = [];
  const idOf = new Map<number, number>();
  found.forEach((f, i) => {
    const r = find(i);
    if (!idOf.has(r)) {
      idOf.set(r, logos.length);
      logos.push({ box: [...f.box], group: f.group, bg: f.bg, pixels: 0 });
    }
    const l = logos[idOf.get(r)!];
    const x0 = Math.min(l.box[0], f.box[0]), y0 = Math.min(l.box[1], f.box[1]);
    const x1 = Math.max(l.box[0] + l.box[2], f.box[0] + f.box[2]), y1 = Math.max(l.box[1] + l.box[3], f.box[1] + f.box[3]);
    l.box = [x0, y0, x1 - x0, y1 - y0];
    l.pixels += f.pixels;
  });
  // a line that runs on outside the logo's box (a pinstripe through a sponsor) is not part of the logo: its colour is
  // left out along that column or row
  const lineAt = (x: number, y: number) => (x >= 0 && y >= 0 && x < SIZE && y < SIZE && dropped[y * SIZE + x] ? labels[y * SIZE + x] : -1);
  const beyond = (fixed: number, from: number, step: number, horizontal: boolean) => {
    for (let k = 1; k <= 4; k++) {
      const v = horizontal ? lineAt(from + step * k, fixed) : lineAt(fixed, from + step * k);
      if (v >= 0) return v;
    }
    return -1;
  };
  found.forEach((f, i) => {
    const id = idOf.get(find(i))! + 1;
    const [x0, y0, w, h] = f.box;
    const x1 = x0 + w - 1, y1 = y0 + h - 1;
    const col = Array.from({ length: w }, (_, k) => [beyond(x0 + k, y0, -1, false), beyond(x0 + k, y1, 1, false)]);
    const row = Array.from({ length: h }, (_, k) => [beyond(y0 + k, x0, -1, true), beyond(y0 + k, x1, 1, true)]);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const p = y * SIZE + x;
        if (!cand[p] || comp[p] !== f.comp) continue;
        const l = labels[p];
        if (col[x - x0].includes(l) || row[y - y0].includes(l)) continue;
        map[p] = id;
      }
    }
    // a badge (compact, two or more colours of its own: a crest) keeps what its outline encloses, also where that is the
    // base colour (the white field of a crest on a white shirt). Letters do not: the inside of an O follows the base.
    const fams = new Map<number, number>();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (map[y * SIZE + x] === id) fams.set(labels[y * SIZE + x], (fams.get(labels[y * SIZE + x]) ?? 0) + 1);
    const total = [...fams.values()].reduce((s, v) => s + v, 0);
    const colours = [...fams.values()].filter((v) => v >= total * 0.1).length;
    if (colours < 2 || Math.max(w, h) > 1.6 * Math.min(w, h)) return;
    const reach = new Uint8Array(w * h);
    const q: number[] = [];
    for (let x = 0; x < w; x++) q.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) q.push(y * w, y * w + w - 1);
    while (q.length) {
      const k = q.pop()!;
      if (reach[k] || map[(y0 + ((k / w) | 0)) * SIZE + x0 + (k % w)] === id) continue;
      reach[k] = 1;
      const kx = k % w, ky = (k / w) | 0;
      if (kx > 0) q.push(k - 1);
      if (kx < w - 1) q.push(k + 1);
      if (ky > 0) q.push(k - w);
      if (ky < h - 1) q.push(k + w);
    }
    for (let k = 0; k < w * h; k++) {
      const p = (y0 + ((k / w) | 0)) * SIZE + x0 + (k % w);
      if (!reach[k] && map[p] !== id && !map[p]) map[p] = id | LOGO_INSIDE;
    }
  });
  return { map, logos };
}

/**
 * Clears the 8-connected pieces of `mask` that are long and thin: a line, not a letter (even a tall I is ~5). A piece
 * is one colour family, so a yellow pinstripe goes but the white letters printed across it stay.
 */
function dropStripes(mask: Uint8Array, labels: Uint16Array): Uint8Array {
  const dropped = new Uint8Array(mask.length);
  // straight lines first, pixel by pixel: on a run of one colour at least 64 px long one way and at most 8 px the
  // other way (a pinstripe, the side stripes of a panel even where they break up; a letter's stroke or the frame of a
  // badge is wider or shorter)
  const runV = new Uint16Array(mask.length), runH = new Uint16Array(mask.length);
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; ) {
      const p = y * SIZE + x;
      if (!mask[p]) { y++; continue; }
      let e = y;
      while (e < SIZE && mask[e * SIZE + x] && labels[e * SIZE + x] === labels[p]) e++;
      for (let k = y; k < e; k++) runV[k * SIZE + x] = e - y;
      y = e;
    }
  }
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; ) {
      const p = y * SIZE + x;
      if (!mask[p]) { x++; continue; }
      let e = x;
      while (e < SIZE && mask[y * SIZE + e] && labels[y * SIZE + e] === labels[p]) e++;
      for (let k = x; k < e; k++) runH[y * SIZE + k] = e - x;
      x = e;
    }
  }
  for (let p = 0; p < mask.length; p++) {
    if (mask[p] && ((runV[p] >= 64 && runH[p] <= 8) || (runH[p] >= 64 && runV[p] <= 8))) {
      mask[p] = 0;
      dropped[p] = 1;
    }
  }
  const seen = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  const piece: number[] = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    piece.length = 0;
    let top = 0, x0 = SIZE, y0 = SIZE, x1 = -1, y1 = -1;
    seen[s] = 1;
    stack[top++] = s;
    while (top) {
      const p = stack[--top];
      piece.push(p);
      const x = p % SIZE, y = (p / SIZE) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= SIZE || yy >= SIZE) continue;
          const q = yy * SIZE + xx;
          if (mask[q] && !seen[q] && labels[q] === labels[p]) {
            seen[q] = 1;
            stack[top++] = q;
          }
        }
      }
    }
    const len = Math.hypot(x1 - x0 + 1, y1 - y0 + 1);
    if (len >= 40 && (len * len) / piece.length >= 12) {
      for (const p of piece) {
        mask[p] = 0;
        dropped[p] = 1;
      }
    }
  }
  return dropped;
}

/** The labels with every logo pixel turned into the colour around it (the colour layers then run under the logos). */
export function labelsWithoutLogos(labels: Uint16Array, det: LogoDetection): Uint16Array {
  const out = labels.slice();
  for (let p = 0; p < out.length; p++) if (det.map[p]) out[p] = det.logos[(det.map[p] & ~LOGO_INSIDE) - 1].bg;
  return out;
}
