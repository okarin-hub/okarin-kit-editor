/**
 * Minimal DDS encoder for exporting kit textures.
 * Supports DXT1 (BC1), DXT5 (BC3) and uncompressed BGRA8, with optional mip chain.
 * DXT blocks use a fast bounding-box endpoint fit: good for flat kit colours, not a
 * high-end compressor.
 */

export type DdsFormat = 'dxt1' | 'dxt5' | 'bgra';

const DDSD_CAPS = 0x1;
const DDSD_HEIGHT = 0x2;
const DDSD_WIDTH = 0x4;
const DDSD_PITCH = 0x8;
const DDSD_PIXELFORMAT = 0x1000;
const DDSD_MIPMAPCOUNT = 0x20000;
const DDSD_LINEARSIZE = 0x80000;
const DDPF_ALPHAPIXELS = 0x1;
const DDPF_FOURCC = 0x4;
const DDPF_RGB = 0x40;
const DDSCAPS_COMPLEX = 0x8;
const DDSCAPS_TEXTURE = 0x1000;
const DDSCAPS_MIPMAP = 0x400000;

function fourCC(s: string): number {
  return s.charCodeAt(0) | (s.charCodeAt(1) << 8) | (s.charCodeAt(2) << 16) | (s.charCodeAt(3) << 24);
}

function levelSize(format: DdsFormat, w: number, h: number): number {
  if (format === 'bgra') return w * h * 4;
  const blockBytes = format === 'dxt1' ? 8 : 16;
  return Math.max(1, Math.ceil(w / 4)) * Math.max(1, Math.ceil(h / 4)) * blockBytes;
}

/** 2x2 box filter. Works on premultiplied-free RGBA bytes. */
function downsample(src: Uint8ClampedArray | Uint8Array, w: number, h: number): Uint8Array {
  const nw = Math.max(1, w >> 1);
  const nh = Math.max(1, h >> 1);
  const out = new Uint8Array(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const x0 = Math.min(w - 1, x * 2);
      const x1 = Math.min(w - 1, x * 2 + 1);
      const y0 = Math.min(h - 1, y * 2);
      const y1 = Math.min(h - 1, y * 2 + 1);
      for (let c = 0; c < 4; c++) {
        const sum =
          src[(y0 * w + x0) * 4 + c] +
          src[(y0 * w + x1) * 4 + c] +
          src[(y1 * w + x0) * 4 + c] +
          src[(y1 * w + x1) * 4 + c];
        out[(y * nw + x) * 4 + c] = (sum + 2) >> 2;
      }
    }
  }
  return out;
}

function to565(r: number, g: number, b: number): number {
  return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
}

function from565(c: number): [number, number, number] {
  const r = (c >> 11) & 31;
  const g = (c >> 5) & 63;
  const b = c & 31;
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

/** Encodes the colour half of a block (8 bytes) from 16 RGBA pixels. */
function writeColorBlock(
  px: Uint8Array,
  out: Uint8Array,
  outOff: number,
  allowTransparent: boolean
): void {
  let minR = 255, minG = 255, minB = 255, maxR = 0, maxG = 0, maxB = 0;
  let hasTransparent = false;
  for (let i = 0; i < 16; i++) {
    if (allowTransparent && px[i * 4 + 3] < 128) {
      hasTransparent = true;
      continue;
    }
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    if (r < minR) minR = r;
    if (g < minG) minG = g;
    if (b < minB) minB = b;
    if (r > maxR) maxR = r;
    if (g > maxG) maxG = g;
    if (b > maxB) maxB = b;
  }
  if (maxR < minR) {
    // fully transparent block
    minR = minG = minB = maxR = maxG = maxB = 0;
  }

  let c0 = to565(maxR, maxG, maxB);
  let c1 = to565(minR, minG, minB);
  // BC1 uses 3-colour + transparent mode when c0 <= c1, 4-colour mode when c0 > c1
  if (hasTransparent) {
    if (c0 > c1) [c0, c1] = [c1, c0];
  } else if (c0 < c1) {
    [c0, c1] = [c1, c0];
  }

  const p0 = from565(c0);
  const p1 = from565(c1);
  const palette: [number, number, number][] = [p0, p1];
  if (c0 > c1) {
    palette.push(
      [(2 * p0[0] + p1[0]) / 3, (2 * p0[1] + p1[1]) / 3, (2 * p0[2] + p1[2]) / 3],
      [(p0[0] + 2 * p1[0]) / 3, (p0[1] + 2 * p1[1]) / 3, (p0[2] + 2 * p1[2]) / 3]
    );
  } else {
    palette.push([(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2]);
  }

  let indices = 0;
  for (let i = 0; i < 16; i++) {
    let idx: number;
    if (allowTransparent && px[i * 4 + 3] < 128 && c0 <= c1) {
      idx = 3;
    } else {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      let best = 0;
      let bestDist = Infinity;
      for (let k = 0; k < palette.length; k++) {
        const dr = r - palette[k][0];
        const dg = g - palette[k][1];
        const db = b - palette[k][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestDist) {
          bestDist = d;
          best = k;
        }
      }
      idx = best;
    }
    indices |= idx << (2 * i);
  }

  out[outOff] = c0 & 0xff;
  out[outOff + 1] = c0 >> 8;
  out[outOff + 2] = c1 & 0xff;
  out[outOff + 3] = c1 >> 8;
  out[outOff + 4] = indices & 0xff;
  out[outOff + 5] = (indices >>> 8) & 0xff;
  out[outOff + 6] = (indices >>> 16) & 0xff;
  out[outOff + 7] = (indices >>> 24) & 0xff;
}

/** Encodes the BC3 alpha half of a block (8 bytes). */
function writeAlphaBlock(px: Uint8Array, out: Uint8Array, outOff: number): void {
  let minA = 255, maxA = 0;
  for (let i = 0; i < 16; i++) {
    const a = px[i * 4 + 3];
    if (a < minA) minA = a;
    if (a > maxA) maxA = a;
  }
  // a0 > a1 selects the 8-value interpolation mode
  const a0 = maxA;
  const a1 = minA;
  const table: number[] = [a0, a1];
  if (a0 > a1) {
    for (let k = 1; k <= 6; k++) table.push(((7 - k) * a0 + k * a1) / 7);
  } else {
    for (let k = 1; k <= 4; k++) table.push(((5 - k) * a0 + k * a1) / 5);
    table.push(0, 255);
  }

  // 16 x 3-bit indices = 48 bits
  let bitsLo = 0;
  let bitsHi = 0;
  for (let i = 0; i < 16; i++) {
    const a = px[i * 4 + 3];
    let best = 0;
    let bestDist = Infinity;
    for (let k = 0; k < table.length; k++) {
      const d = Math.abs(a - table[k]);
      if (d < bestDist) {
        bestDist = d;
        best = k;
      }
    }
    const bitPos = i * 3;
    if (bitPos < 32) {
      bitsLo |= best << bitPos;
      if (bitPos + 3 > 32) bitsHi |= best >> (32 - bitPos);
    } else {
      bitsHi |= best << (bitPos - 32);
    }
  }

  out[outOff] = a0;
  out[outOff + 1] = a1;
  out[outOff + 2] = bitsLo & 0xff;
  out[outOff + 3] = (bitsLo >>> 8) & 0xff;
  out[outOff + 4] = (bitsLo >>> 16) & 0xff;
  out[outOff + 5] = (bitsLo >>> 24) & 0xff;
  out[outOff + 6] = bitsHi & 0xff;
  out[outOff + 7] = (bitsHi >>> 8) & 0xff;
}

function encodeLevel(
  format: DdsFormat,
  rgba: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number
): Uint8Array {
  if (format === 'bgra') {
    const out = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      out[i * 4] = rgba[i * 4 + 2];
      out[i * 4 + 1] = rgba[i * 4 + 1];
      out[i * 4 + 2] = rgba[i * 4];
      out[i * 4 + 3] = rgba[i * 4 + 3];
    }
    return out;
  }

  const blocksX = Math.max(1, Math.ceil(w / 4));
  const blocksY = Math.max(1, Math.ceil(h / 4));
  const blockBytes = format === 'dxt1' ? 8 : 16;
  const out = new Uint8Array(blocksX * blocksY * blockBytes);
  const block = new Uint8Array(64);
  let off = 0;

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      // Gather 4x4 pixels, clamping at the edges for tiny mip levels
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const sx = Math.min(w - 1, bx * 4 + x);
          const sy = Math.min(h - 1, by * 4 + y);
          const si = (sy * w + sx) * 4;
          const di = (y * 4 + x) * 4;
          block[di] = rgba[si];
          block[di + 1] = rgba[si + 1];
          block[di + 2] = rgba[si + 2];
          block[di + 3] = rgba[si + 3];
        }
      }
      if (format === 'dxt5') {
        writeAlphaBlock(block, out, off);
        writeColorBlock(block, out, off + 8, false);
        off += 16;
      } else {
        writeColorBlock(block, out, off, true);
        off += 8;
      }
    }
  }
  return out;
}

export function encodeDDS(
  imageData: ImageData,
  format: DdsFormat,
  generateMipmaps: boolean
): Uint8Array {
  const { width, height } = imageData;

  const levels: Uint8Array[] = [];
  let curData: Uint8ClampedArray | Uint8Array = imageData.data;
  let w = width;
  let h = height;
  levels.push(encodeLevel(format, curData, w, h));
  if (generateMipmaps) {
    while (w > 1 || h > 1) {
      curData = downsample(curData, w, h);
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
      levels.push(encodeLevel(format, curData, w, h));
    }
  }

  const total = 128 + levels.reduce((n, l) => n + l.length, 0);
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);

  dv.setUint32(0, 0x20534444, true); // 'DDS '
  dv.setUint32(4, 124, true);
  let flags = DDSD_CAPS | DDSD_HEIGHT | DDSD_WIDTH | DDSD_PIXELFORMAT;
  flags |= format === 'bgra' ? DDSD_PITCH : DDSD_LINEARSIZE;
  if (levels.length > 1) flags |= DDSD_MIPMAPCOUNT;
  dv.setUint32(8, flags, true);
  dv.setUint32(12, height, true);
  dv.setUint32(16, width, true);
  dv.setUint32(20, format === 'bgra' ? width * 4 : levelSize(format, width, height), true);
  dv.setUint32(24, 0, true); // depth
  dv.setUint32(28, levels.length, true);
  // reserved1[11] at 32..75 left as zero

  // DDS_PIXELFORMAT at offset 76
  dv.setUint32(76, 32, true);
  if (format === 'bgra') {
    dv.setUint32(80, DDPF_RGB | DDPF_ALPHAPIXELS, true);
    dv.setUint32(84, 0, true);
    dv.setUint32(88, 32, true);
    dv.setUint32(92, 0x00ff0000, true);
    dv.setUint32(96, 0x0000ff00, true);
    dv.setUint32(100, 0x000000ff, true);
    dv.setUint32(104, 0xff000000, true);
  } else {
    dv.setUint32(80, DDPF_FOURCC, true);
    dv.setUint32(84, fourCC(format === 'dxt1' ? 'DXT1' : 'DXT5'), true);
  }

  let caps = DDSCAPS_TEXTURE;
  if (levels.length > 1) caps |= DDSCAPS_COMPLEX | DDSCAPS_MIPMAP;
  dv.setUint32(108, caps, true);

  let offset = 128;
  for (const level of levels) {
    bytes.set(level, offset);
    offset += level.length;
  }
  return bytes;
}

export const DDS_FORMAT_LABELS: Record<DdsFormat, string> = {
  dxt5: 'DXT5 (BC3) — dengan alpha',
  dxt1: 'DXT1 (BC1) — ukuran kecil',
  bgra: 'BGRA 32-bit — tanpa kompresi',
};
