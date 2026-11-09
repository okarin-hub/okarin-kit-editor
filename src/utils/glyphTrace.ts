/**
 * Traces the outline of a letter from its coverage (alpha 0..1 per pixel) into an SVG path, for drawing a small
 * font sheet letter at a large size with sharp, accurate edges:
 *  1. marching squares on the 50 % line of the anti-aliased edge (sub-pixel positions, not pixel steps);
 *  2. corners found in any direction by how sharply the outline turns;
 *  3. straight stretches become lines, and lines within a few degrees of upright or level are made exactly so;
 *  4. the rest is smoothed lightly and drawn as Bézier curves through the points; corners stay sharp.
 * Pure code (no DOM), so it can be tested on its own.
 */

type P = { x: number; y: number };

/** marching squares: closed contours (in pixel units, pixel centres at +0.5) of the area where coverage >= 0.5 */
function contours(a: Float32Array, w: number, h: number): P[][] {
  const W = w + 2, H = h + 2; // a zero border so every contour closes
  const v = (i: number, j: number) => (i < 1 || j < 1 || i > w || j > h ? 0 : a[(j - 1) * w + (i - 1)]);
  const points = new Map<number, P>();
  const links = new Map<number, number[]>();
  const keyH = (i: number, j: number) => (j * W + i) * 2; // edge between samples (i,j)-(i+1,j)
  const keyV = (i: number, j: number) => (j * W + i) * 2 + 1; // edge between samples (i,j)-(i,j+1)
  const at = (key: number, ax: number, ay: number, av: number, bx: number, by: number, bv: number) => {
    if (!points.has(key)) {
      const t = (0.5 - av) / (bv - av);
      points.set(key, { x: ax + t * (bx - ax) - 0.5, y: ay + t * (by - ay) - 0.5 });
    }
    return key;
  };
  const link = (k1: number, k2: number) => {
    (links.get(k1) ?? links.set(k1, []).get(k1)!).push(k2);
    (links.get(k2) ?? links.set(k2, []).get(k2)!).push(k1);
  };
  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W - 1; i++) {
      const tl = v(i, j), tr = v(i + 1, j), br = v(i + 1, j + 1), bl = v(i, j + 1);
      const c = (tl >= 0.5 ? 8 : 0) | (tr >= 0.5 ? 4 : 0) | (br >= 0.5 ? 2 : 0) | (bl >= 0.5 ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const T = () => at(keyH(i, j), i, j, tl, i + 1, j, tr);
      const B = () => at(keyH(i, j + 1), i, j + 1, bl, i + 1, j + 1, br);
      const L = () => at(keyV(i, j), i, j, tl, i, j + 1, bl);
      const R = () => at(keyV(i + 1, j), i + 1, j, tr, i + 1, j + 1, br);
      const centre = (tl + tr + br + bl) / 4 >= 0.5;
      switch (c) {
        case 1: case 14: link(L(), B()); break;
        case 2: case 13: link(B(), R()); break;
        case 3: case 12: link(L(), R()); break;
        case 4: case 11: link(T(), R()); break;
        case 6: case 9: link(T(), B()); break;
        case 7: case 8: link(L(), T()); break;
        case 5: // tr + bl inside
          if (centre) { link(L(), T()); link(B(), R()); } else { link(T(), R()); link(L(), B()); }
          break;
        case 10: // tl + br inside
          if (centre) { link(T(), R()); link(L(), B()); } else { link(L(), T()); link(B(), R()); }
          break;
      }
    }
  }
  const loops: P[][] = [];
  const seen = new Set<number>();
  for (const start of links.keys()) {
    if (seen.has(start)) continue;
    const loop: P[] = [];
    let prev = -1, cur = start;
    while (!seen.has(cur)) {
      seen.add(cur);
      loop.push(points.get(cur)!);
      const next = links.get(cur)!.find((k) => k !== prev && !seen.has(k));
      if (next === undefined) break;
      prev = cur;
      cur = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

/** indices of corners: points where the outline turns sharply (local maxima of the turn over ±reach px) */
function corners(loop: P[], reach: number): number[] {
  const n = loop.length;
  const seg = loop.map((p, i) => dist(p, loop[(i + 1) % n]));
  const pointAt = (i: number, dir: 1 | -1) => {
    let d = 0, k = i;
    while (d < reach) {
      const step = dir === 1 ? seg[k] : seg[(k - 1 + n) % n];
      k = (k + dir + n) % n;
      d += step;
      if (k === i) break;
    }
    return loop[k];
  };
  /** signed turn at each point (+ one way, − the other) */
  const turnAt = (r: number) => {
    const keep = reach;
    reach = r;
    const t = loop.map((p, i) => {
      const a = pointAt(i, -1), b = pointAt(i, 1);
      const a1 = Math.atan2(p.y - a.y, p.x - a.x), a2 = Math.atan2(b.y - p.y, b.x - p.x);
      return Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1));
    });
    reach = keep;
    return t;
  };
  const signed = turnAt(reach);
  const turn = signed.map(Math.abs);
  // a corner turns as much seen from twice as far; a tight curve (the arch of an A) turns about twice as much
  const turnFar = turnAt(reach * 2).map(Math.abs);
  const out: number[] = [];
  const win = Math.max(1, Math.round(reach));
  for (let i = 0; i < n; i++) {
    // 30°: a 45° corner of a slightly blurred picture (a chamfer, the flag of a 1) reads only 32–35°
    if (turn[i] < (30 * Math.PI) / 180 || turnFar[i] > turn[i] * 1.5) continue;
    let max = true;
    for (let d = -win; d <= win && max; d++) {
      // only against turns the same way: a concave corner next to a convex one (a 1's flag at its stem) is its own
      if (!d || signed[(i + d + n) % n] * signed[i] < 0) continue;
      const tj = turn[(i + d + n) % n];
      if (tj > turn[i] || (tj === turn[i] && d < 0)) max = false;
    }
    if (max) out.push(i);
  }
  return out;
}

/** light smoothing that keeps both ends in place (removes the zig-zag of pixel noise) */
function smooth(run: P[], passes: number): P[] {
  let r = run.map((p) => ({ ...p }));
  for (let k = 0; k < passes; k++) {
    r = r.map((p, i) =>
      i === 0 || i === r.length - 1 ? p : { x: 0.25 * r[i - 1].x + 0.5 * p.x + 0.25 * r[i + 1].x, y: 0.25 * r[i - 1].y + 0.5 * p.y + 0.25 * r[i + 1].y }
    );
  }
  return r;
}

/** Douglas–Peucker: fewer points, none further than `tol` px from the original line */
function simplify(run: P[], tol: number): P[] {
  if (run.length < 3) return run;
  const a = run[0], b = run[run.length - 1];
  const len = dist(a, b);
  if (len < 1e-6) {
    // a closed run (a loop with one corner starts and ends on it) has no chord: split it at its farthest point
    let far = 1;
    for (let i = 2; i < run.length - 1; i++) if (dist(run[i], a) > dist(run[far], a)) far = i;
    return [...simplify(run.slice(0, far + 1), tol).slice(0, -1), ...simplify(run.slice(far), tol)];
  }
  let worst = 0, idx = 0;
  for (let i = 1; i < run.length - 1; i++) {
    const d = Math.abs((b.x - a.x) * (a.y - run[i].y) - (a.x - run[i].x) * (b.y - a.y)) / len;
    if (d > worst) {
      worst = d;
      idx = i;
    }
  }
  if (worst <= tol) return [a, b];
  return [...simplify(run.slice(0, idx + 1), tol).slice(0, -1), ...simplify(run.slice(idx), tol)];
}

type Line = { c: P; dir: P };

/** the run without `reach` px at each end (the part a rounded corner does not touch) */
function trim(run: P[], reach: number): P[] {
  let a = 0, b = run.length - 1, d = 0;
  while (a < b && d < reach) d += dist(run[a], run[++a]);
  d = 0;
  while (b > a && d < reach) d += dist(run[b], run[--b]);
  return b - a >= 2 ? run.slice(a, b + 1) : run;
}

/** best straight line through the points (principal direction) and the largest distance of a point from it */
function fitLine(pts: P[]): { line: Line; resid: number } {
  const n = pts.length;
  const c = { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) {
    sxx += (p.x - c.x) ** 2;
    syy += (p.y - c.y) ** 2;
    sxy += (p.x - c.x) * (p.y - c.y);
  }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const dir = { x: Math.cos(ang), y: Math.sin(ang) };
  const resid = Math.max(0, ...pts.map((p) => Math.abs((p.x - c.x) * dir.y - (p.y - c.y) * dir.x)));
  return { line: { c, dir }, resid };
}

function intersect(a: Line, b: Line): P | null {
  const den = a.dir.x * b.dir.y - a.dir.y * b.dir.x;
  if (Math.abs(den) < 0.17) return null; // under ~10°: no clear meeting point
  const t = ((b.c.x - a.c.x) * b.dir.y - (b.c.y - a.c.y) * b.dir.x) / den;
  return { x: a.c.x + t * a.dir.x, y: a.c.y + t * a.dir.y };
}

function project(l: Line, p: P): P {
  const t = (p.x - l.c.x) * l.dir.x + (p.y - l.c.y) * l.dir.y;
  return { x: l.c.x + t * l.dir.x, y: l.c.y + t * l.dir.y };
}

const fmt = (v: number) => +v.toFixed(2);

/**
 * Curve through the points as cubic Béziers. The direction at each point blends the directions to its neighbours,
 * weighted by distance (Bessel tangents), and each handle is a third of its segment: unlike plain Catmull-Rom this
 * never overshoots where a long straight stretch meets closely spaced points. Open runs end on their own chord.
 */
function curveTo(pts: P[], closed: boolean): string {
  const n = pts.length;
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[i]);
  const unit = (a: P, b: P) => {
    const l = dist(a, b) || 1;
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  };
  const tangent = (i: number): P => {
    if (!closed && i === 0) return unit(pts[0], pts[1]);
    if (!closed && i === n - 1) return unit(pts[n - 2], pts[n - 1]);
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1);
    const d0 = dist(p0, p1) || 1, d1 = dist(p1, p2) || 1;
    const u0 = unit(p0, p1), u1 = unit(p1, p2);
    const t = { x: (u0.x * d1 + u1.x * d0) / (d0 + d1), y: (u0.y * d1 + u1.y * d0) / (d0 + d1) };
    const l = Math.hypot(t.x, t.y) || 1;
    return { x: t.x / l, y: t.y / l };
  };
  // A handle that turns away from its segment is shortened (not turned) so the curve stays within ~0.3 px of the
  // straight segment: long segments (straight sides) stay straight, and both handles at a point keep the same
  // direction, so a gentle curve has no kink at its points (turning them showed as small steps when enlarged).
  const handle = (t: P, c: P, len: number) => {
    const cos = c.x * t.x + c.y * t.y;
    if (cos <= 0) return 0;
    const sin = Math.abs(c.x * t.y - c.y * t.x);
    return Math.min(len / 3, sin > 1e-6 ? 0.4 / sin : len / 3);
  };
  let d = '';
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p1 = at(i), p2 = at(i + 1);
    const len = dist(p1, p2);
    const c = unit(p1, p2);
    const t1 = tangent(i), t2 = tangent((i + 1) % (closed ? n : Infinity));
    const h1 = handle(t1, c, len), h2 = handle(t2, c, len);
    d += `C${fmt(p1.x + t1.x * h1)} ${fmt(p1.y + t1.y * h1)} ${fmt(p2.x - t2.x * h2)} ${fmt(p2.y - t2.y * h2)} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return d;
}

const SNAP = (3 * Math.PI) / 180; // lines within 3° of level / upright are made exactly so

/**
 * SVG path (pixel units) of the area where `alpha` (0..1, row by row, `w`×`h`) is at least 0.5, or '' when empty.
 * `reach` is how far (px) the corner test looks along the outline; about 3 % of the letter height works well.
 */
export function traceCoverage(alpha: Float32Array, w: number, h: number, reach = Math.max(1.5, Math.min(4, h * 0.03))): string {
  let d = '';
  // a small letter (it will be enlarged) carries no detail under ~0.5 px: its curves are smoothed more, so the
  // picture's own sub-pixel wobble does not show as dents when it is drawn 3× larger
  const passes = h < 200 ? 6 : 2;
  const tol = h < 200 ? 0.45 : 0.3;
  for (const loop of contours(alpha, w, h)) {
    // a loop under 2 px (one stray pixel at the edge of a badge or of noise) would only leave a speck or a pinhole
    const xs = loop.map((p) => p.x), ys = loop.map((p) => p.y);
    if (Math.max(...xs) - Math.min(...xs) < 2 && Math.max(...ys) - Math.min(...ys) < 2) continue;
    const cs = corners(loop, reach);
    if (cs.length === 0) {
      // no corner (O, 0): one smooth closed curve; simplified as two halves (a closed run has no chord)
      const sm = smooth([...loop, loop[0]], passes);
      let far = 0;
      sm.forEach((p, i) => dist(p, sm[0]) > dist(sm[far], sm[0]) && (far = i));
      const pts = [...simplify(sm.slice(0, far + 1), tol).slice(0, -1), ...simplify(sm.slice(far), tol).slice(0, -1)];
      if (pts.length < 3) continue;
      d += `M${fmt(pts[0].x)} ${fmt(pts[0].y)}` + curveTo(pts, true) + 'Z';
      continue;
    }
    // runs between corners; corner points are shared objects, so a snapped line moves its corners too
    const corner = cs.map((i) => ({ ...loop[i] }));
    const runs = cs.map((ci, k) => {
      const cj = cs[(k + 1) % cs.length];
      const run: P[] = [];
      for (let i = ci; ; i = (i + 1) % loop.length) {
        run.push(loop[i]);
        if (i === cj && run.length > 1) break;
      }
      return run;
    });
    // a run is a line when its middle (away from the rounded-off corners) fits a straight line
    const lines = runs.map((run) => {
      const mid = trim(run, reach);
      const fit = fitLine(mid);
      const len = dist(run[0], run[run.length - 1]);
      return fit.resid <= Math.max(0.35, len * 0.01) ? fit.line : null;
    });
    // the lines as measured, before straightening: the real corners (for telling a rounded corner from a sharp one)
    const measured = lines.map((l) => l && { c: { ...l.c }, dir: { ...l.dir } });
    // near-level / near-upright lines become exactly so, but only while the straightened line still lies on the
    // outline: on a long side of a small, enlarged letter even 2° moves the ends a few px and leaves a step
    lines.forEach((l, k) => {
      if (!l) return;
      const ang = Math.atan2(l.dir.y, l.dir.x);
      const off = (t: number) => Math.abs(Math.atan2(Math.sin(ang - t), Math.cos(ang - t)));
      const dir = Math.min(off(0), off(Math.PI)) < SNAP ? { x: 1, y: 0 } : Math.min(off(Math.PI / 2), off(-Math.PI / 2)) < SNAP ? { x: 0, y: 1 } : null;
      if (!dir) return;
      const fits = trim(runs[k], reach).every((p) => Math.abs((p.x - l.c.x) * dir.y - (p.y - l.c.y) * dir.x) <= 0.5);
      if (fits) l.dir = dir;
    });
    // a rounder corner can be read as two corners with a short line between: that line goes, the corners merge.
    // Only when both corners turn the same way: a convex and a concave one close together are a step (a 1's flag
    // meeting its stem), not a rounded corner
    const chord = (run: P[]) => ({ x: run[run.length - 1].x - run[0].x, y: run[run.length - 1].y - run[0].y });
    const cross = (a: P, b: P) => a.x * b.y - a.y * b.x;
    for (let k = 0; runs.length > 3 && k < runs.length; ) {
      const n = runs.length;
      const prev = lines[(k - 1 + n) % n], next = lines[(k + 1) % n];
      const v0 = chord(runs[(k - 1 + n) % n]), v1 = chord(runs[k]), v2 = chord(runs[(k + 1) % n]);
      const sameWay = cross(v0, v1) * cross(v1, v2) > 0;
      if (lines[k] && prev && next && sameWay && dist(corner[k], corner[(k + 1) % n]) < reach * 2.5 && intersect(prev, next)) {
        runs[(k + 1) % n] = [...runs[k], ...runs[(k + 1) % n]];
        runs.splice(k, 1);
        lines.splice(k, 1);
        measured.splice(k, 1);
        corner.splice((k + 1) % n, 1);
        if ((k + 1) % n === 0) corner.unshift(corner.pop()!); // keep corner[i] at the start of runs[i]
      } else k++;
    }
    // a corner between two lines is where the lines meet; next to one line it is moved onto that line
    const original = corner.map((c) => ({ ...c }));
    corner.forEach((c, k) => {
      const before = lines[(k - 1 + lines.length) % lines.length], after = lines[k];
      const p = before && after ? intersect(before, after) : null;
      const q = p ?? (before ? project(before, c) : after ? project(after, c) : c);
      // never move a corner far (a nearly parallel pair would throw it away)
      if (dist(q, c) < reach * 3) {
        c.x = q.x;
        c.y = q.y;
      }
    });
    // rounded corners: how far the real outline stays from the sharp meeting point gives the radius
    const fillets = corner.map((c, k) => {
      const n = corner.length;
      if (!lines[(k - 1 + n) % n] || !lines[k]) return null;
      const prev = corner[(k - 1 + n) % n], next = corner[(k + 1) % n];
      const lenIn = dist(prev, c), lenOut = dist(c, next);
      const uin = { x: (c.x - prev.x) / (lenIn || 1), y: (c.y - prev.y) / (lenIn || 1) };
      const uout = { x: (next.x - c.x) / (lenOut || 1), y: (next.y - c.y) / (lenOut || 1) };
      const turn = Math.acos(Math.max(-1, Math.min(1, uin.x * uout.x + uin.y * uout.y)));
      if (turn < 0.2) return null;
      const tip = intersect(measured[(k - 1 + n) % n]!, measured[k]!) ?? c;
      let gap = Infinity;
      for (const p of loop) if (dist(p, original[k]) < reach * 4) gap = Math.min(gap, dist(p, tip));
      // even a sharp corner reads ~0.35 px in from its tip (the anti-aliased tip pixel is not full)
      const dev = gap - 0.35;
      if (!(dev > 0.4)) return null;
      const r = dev / (1 / Math.cos(turn / 2) - 1);
      const t = Math.min(r * Math.tan(turn / 2), lenIn * 0.45, lenOut * 0.45);
      const rr = t / Math.tan(turn / 2);
      const h = (4 / 3) * Math.tan(turn / 4) * rr; // handle length of a circular arc
      const a = { x: c.x - uin.x * t, y: c.y - uin.y * t };
      const b = { x: c.x + uout.x * t, y: c.y + uout.y * t };
      return { a, b, c1: { x: a.x + uin.x * h, y: a.y + uin.y * h }, c2: { x: b.x - uout.x * h, y: b.y - uout.y * h } };
    });
    const entry = (k: number) => fillets[k]?.a ?? corner[k];
    const exit = (k: number) => fillets[k]?.b ?? corner[k];
    const arc = (k: number) => {
      const f = fillets[k];
      return f ? `C${fmt(f.c1.x)} ${fmt(f.c1.y)} ${fmt(f.c2.x)} ${fmt(f.c2.y)} ${fmt(f.b.x)} ${fmt(f.b.y)}` : '';
    };
    d += `M${fmt(exit(0).x)} ${fmt(exit(0).y)}`;
    runs.forEach((run, k) => {
      const k2 = (k + 1) % corner.length;
      const end = entry(k2);
      if (lines[k]) d += `L${fmt(end.x)} ${fmt(end.y)}`;
      else {
        const inner = simplify(smooth(run, passes), tol);
        inner[0] = exit(k);
        inner[inner.length - 1] = end;
        d += curveTo(inner, false);
      }
      d += arc(k2);
    });
    d += 'Z';
  }
  return d;
}
