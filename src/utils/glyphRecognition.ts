/**
 * Reads which character each piece of a font sheet is: its shape is compared with A–Z / 0–9 drawn in a few common
 * fonts, then the row is aligned with the alphabet order (Needleman–Wunsch), so a duplicated piece is skipped and a
 * missing letter left out instead of shifting everything after it.
 */
import { SheetRow } from '@/utils/fontsetGenerator';

const GW = 20;
const GH = 28;
const REF_FONTS = ["'Arial'", "'Arial Black'", "'Impact'", "'Verdana'", "'Georgia'", "'Trebuchet MS'", "'Tahoma'", "'Bahnschrift'"];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';

/** shape stretched to a small grid (ink 0..1) and its width/height */
interface Shape {
  grid: Float32Array;
  aspect: number;
}

function shapeOf(src: HTMLCanvasElement, x0 = 0, y0 = 0, w = src.width, h = src.height): Shape {
  const c = document.createElement('canvas');
  c.width = GW;
  c.height = GH;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, x0, y0, w, h, 0, 0, GW, GH);
  const d = ctx.getImageData(0, 0, GW, GH).data;
  const grid = new Float32Array(GW * GH);
  for (let i = 0; i < grid.length; i++) grid[i] = d[i * 4 + 3] / 255;
  return { grid, aspect: w / Math.max(1, h) };
}

let refCache: Map<string, Shape[]> | null = null;

function referenceShapes(): Map<string, Shape[]> {
  if (refCache) return refCache;
  const map = new Map<string, Shape[]>();
  const size = 96;
  const c = document.createElement('canvas');
  c.width = size * 2;
  c.height = size * 2;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  for (const ch of LETTERS + DIGITS + '.') {
    const shapes: Shape[] = [];
    for (const font of REF_FONTS) {
      for (const weight of ['normal', 'bold']) {
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.font = `${weight} ${size}px ${font}, sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#000';
        ctx.fillText(ch, size / 2, size * 1.4);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
        for (let y = 0; y < c.height; y++) {
          for (let x = 0; x < c.width; x++) {
            if (d[(y * c.width + x) * 4 + 3] > 60) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
          }
        }
        if (x1 >= 0) shapes.push(shapeOf(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1));
      }
    }
    map.set(ch, shapes);
  }
  refCache = map;
  return map;
}

const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

/** Similarity 0..1 of every glyph of a row to every candidate character (relative width counts too). */
function similarities(row: SheetRow, chars: string): number[][] {
  const refs = referenceShapes();
  const shapes = row.glyphs.map((g) => {
    const s = shapeOf(g.canvas);
    // the full stop is told apart by its size, not its (stretched) shape
    return { ...s, small: g.canvas.height < g.capH * 0.4 };
  });
  const rowAspect = median(shapes.filter((s) => !s.small).map((s) => s.aspect)) || 1;
  const refAspect = (ch: string) => median(refs.get(ch)!.map((r) => r.aspect));
  const refMedian = median(Array.from(LETTERS + DIGITS).map(refAspect));
  return shapes.map((s) =>
    Array.from(chars).map((ch) => {
      if (ch === '.' || s.small) return ch === '.' && s.small ? 1 : 0;
      let best = 0;
      for (const r of refs.get(ch)!) {
        let diff = 0;
        for (let i = 0; i < s.grid.length; i++) diff += Math.abs(s.grid[i] - r.grid[i]);
        best = Math.max(best, 1 - diff / s.grid.length);
      }
      const widthGap = Math.abs(Math.log(s.aspect / rowAspect / (refAspect(ch) / refMedian)));
      return best - 0.12 * widthGap;
    })
  );
}

/** Aligns the glyphs with `expected` in order; returns the character per glyph ('_' = skipped) and the score. */
function align(sim: number[][], expected: string) {
  const exp = Array.from(expected);
  const n = sim.length, m = exp.length;
  const BASE = 0.72; // a match scores (similarity - BASE)
  // exactly one piece per expected character (A–Z, 0–9): every piece gets one, even an unusual shape
  const exact = n === exp.filter((ch) => ch !== '.').length || n === m;
  const SKIP_GLYPH = exact ? 0.3 : 0.08;
  const skipExpected = (ch: string) => (ch === '.' ? 0.01 : exact ? 0.3 : 0.08);
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const from = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1)); // 1 match, 2 skip glyph, 3 skip expected
  for (let i = 1; i <= n; i++) {
    dp[i][0] = dp[i - 1][0] - SKIP_GLYPH;
    from[i][0] = 2;
  }
  for (let j = 1; j <= m; j++) {
    dp[0][j] = dp[0][j - 1] - skipExpected(exp[j - 1]);
    from[0][j] = 3;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const a = dp[i - 1][j - 1] + sim[i - 1][j - 1] - BASE;
      const b = dp[i - 1][j] - SKIP_GLYPH;
      const c = dp[i][j - 1] - skipExpected(exp[j - 1]);
      if (a >= b && a >= c) {
        dp[i][j] = a;
        from[i][j] = 1;
      } else if (b >= c) {
        dp[i][j] = b;
        from[i][j] = 2;
      } else {
        dp[i][j] = c;
        from[i][j] = 3;
      }
    }
  }
  const out: string[] = new Array(n).fill('_');
  const conf: number[] = new Array(n).fill(0);
  for (let i = n, j = m; i > 0 || j > 0; ) {
    const f = from[i][j];
    if (f === 1) {
      out[i - 1] = exp[j - 1];
      conf[i - 1] = sim[i - 1][j - 1];
      i--;
      j--;
    } else if (f === 2) i--;
    else j--;
  }
  return { chars: out, conf, score: dp[n][m] };
}

export interface RowReading {
  /** one character per glyph, '_' = not used */
  text: string;
  /** similarity of each glyph to the character it got (0 when skipped) */
  confidence: number[];
  /** expected characters that no glyph matched */
  missing: string[];
}

/**
 * Reads all rows of a sheet. Each row is read on its own first; then consecutive rows of the same kind
 * (A–N + O–Z, 01234 + 56789) are read again as one sequence, so the alphabet order carries across rows and an
 * unusual letter at the end of a row is not swapped with the first letter of the next.
 */
export function readSheetRows(rows: SheetRow[]): RowReading[] {
  const out = rows.map(readSheetRow);
  const kindOf = (r: RowReading) => {
    const t = r.text.replace(/_/g, '');
    return (t.match(/[0-9]/g) ?? []).length > t.length / 2 ? 'digits' : 'letters';
  };
  const kinds = out.map(kindOf);
  for (let i = 0; i < rows.length; ) {
    let j = i;
    while (j + 1 < rows.length && kinds[j + 1] === kinds[i]) j++;
    const expected = kinds[i] === 'digits' ? DIGITS : LETTERS + '.';
    const group = rows.slice(i, j + 1);
    const count = group.reduce((n, r) => n + r.glyphs.length, 0);
    // two full alphabets (two styles on one sheet) are left as separate rows
    if (j > i && count <= expected.length + 3) {
      const sims = group.flatMap((r) => similarities(r, expected));
      const res = align(sims, expected);
      const used = new Set(res.chars);
      let k = 0;
      group.forEach((r, g) => {
        const n = r.glyphs.length;
        out[i + g] = {
          text: res.chars.slice(k, k + n).join(''),
          confidence: res.conf.slice(k, k + n),
          missing: g === group.length - 1 ? Array.from(expected).filter((ch) => !used.has(ch) && ch !== '.') : [],
        };
        k += n;
      });
    }
    i = j + 1;
  }
  return out;
}

/** Reads one sheet row as letters, digits or both (whichever fits best). */
export function readSheetRow(row: SheetRow): RowReading {
  if (!row.glyphs.length) return { text: '', confidence: [], missing: [] };
  const candidates = [LETTERS + '.', DIGITS, LETTERS + '.' + DIGITS, DIGITS + LETTERS + '.'];
  const all = LETTERS + '.' + DIGITS;
  const simAll = similarities(row, all);
  let best: (ReturnType<typeof align> & { expected: string }) | null = null;
  for (const expected of candidates) {
    const idx = Array.from(expected).map((ch) => all.indexOf(ch));
    const sim = simAll.map((r) => idx.map((k) => r[k]));
    const res = align(sim, expected);
    if (!best || res.score > best.score) best = { ...res, expected };
  }
  const used = new Set(best!.chars);
  return {
    text: best!.chars.join(''),
    confidence: best!.conf,
    missing: Array.from(best!.expected).filter((ch) => !used.has(ch) && ch !== '.'),
  };
}
