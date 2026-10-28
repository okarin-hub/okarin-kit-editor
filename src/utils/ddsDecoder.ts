/**
 * Minimal DDS decoder (top mip level only) for importing existing kit textures.
 * Supports DXT1 / DXT3 / DXT5 and uncompressed 24/32-bit RGB(A). BC7/DX10 and other
 * formats are rejected with a readable error.
 */

export interface DecodedImage {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA
}

const fourCCToString = (v: number) =>
  String.fromCharCode(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);

function from565(c: number): [number, number, number] {
  const r = (c >> 11) & 31;
  const g = (c >> 5) & 63;
  const b = c & 31;
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

/** Writes the 4x4 colour block at `off` into `out`. Returns nothing. */
function decodeColorBlock(
  src: Uint8Array,
  off: number,
  out: Uint8ClampedArray,
  width: number,
  height: number,
  bx: number,
  by: number,
  hasAlphaMode: boolean
): void {
  const c0 = src[off] | (src[off + 1] << 8);
  const c1 = src[off + 2] | (src[off + 3] << 8);
  const p0 = from565(c0);
  const p1 = from565(c1);
  const pal: [number, number, number, number][] = [
    [...p0, 255],
    [...p1, 255],
    [0, 0, 0, 255],
    [0, 0, 0, 255],
  ];
  if (c0 > c1 || !hasAlphaMode) {
    pal[2] = [(2 * p0[0] + p1[0]) / 3, (2 * p0[1] + p1[1]) / 3, (2 * p0[2] + p1[2]) / 3, 255];
    pal[3] = [(p0[0] + 2 * p1[0]) / 3, (p0[1] + 2 * p1[1]) / 3, (p0[2] + 2 * p1[2]) / 3, 255];
  } else {
    pal[2] = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, 255];
    pal[3] = [0, 0, 0, 0]; // transparent (DXT1 only)
  }

  const bits = (src[off + 4] | (src[off + 5] << 8) | (src[off + 6] << 16) | (src[off + 7] << 24)) >>> 0;
  for (let i = 0; i < 16; i++) {
    const x = bx * 4 + (i & 3);
    const y = by * 4 + (i >> 2);
    if (x >= width || y >= height) continue;
    const c = pal[(bits >>> (2 * i)) & 3];
    const o = (y * width + x) * 4;
    out[o] = c[0];
    out[o + 1] = c[1];
    out[o + 2] = c[2];
    out[o + 3] = c[3];
  }
}

export function decodeDDS(buffer: ArrayBuffer): DecodedImage {
  const dv = new DataView(buffer);
  if (buffer.byteLength < 128 || dv.getUint32(0, true) !== 0x20534444) {
    throw new Error('Bukan file DDS yang valid.');
  }
  const height = dv.getUint32(12, true);
  const width = dv.getUint32(16, true);
  if (!width || !height || width > 8192 || height > 8192) {
    throw new Error('Ukuran DDS tidak didukung.');
  }

  const pfFlags = dv.getUint32(80, true);
  const fourCC = fourCCToString(dv.getUint32(84, true));
  const bitCount = dv.getUint32(88, true);
  const rMask = dv.getUint32(92, true);
  const gMask = dv.getUint32(96, true);
  const bMask = dv.getUint32(100, true);
  const aMask = dv.getUint32(104, true);

  const src = new Uint8Array(buffer, 128);
  const out = new Uint8ClampedArray(width * height * 4);
  const blocksX = Math.ceil(width / 4);
  const blocksY = Math.ceil(height / 4);

  if (pfFlags & 0x4) {
    // FourCC compressed
    if (fourCC === 'DXT1') {
      if (src.length < blocksX * blocksY * 8) throw new Error('File DDS terpotong.');
      for (let by = 0; by < blocksY; by++)
        for (let bx = 0; bx < blocksX; bx++)
          decodeColorBlock(src, (by * blocksX + bx) * 8, out, width, height, bx, by, true);
    } else if (fourCC === 'DXT3' || fourCC === 'DXT5') {
      if (src.length < blocksX * blocksY * 16) throw new Error('File DDS terpotong.');
      for (let by = 0; by < blocksY; by++) {
        for (let bx = 0; bx < blocksX; bx++) {
          const off = (by * blocksX + bx) * 16;
          decodeColorBlock(src, off + 8, out, width, height, bx, by, false);

          // alpha
          const alpha = new Array<number>(16);
          if (fourCC === 'DXT3') {
            for (let i = 0; i < 16; i++) {
              const byte = src[off + (i >> 1)];
              const nib = i & 1 ? byte >> 4 : byte & 15;
              alpha[i] = nib * 17;
            }
          } else {
            const a0 = src[off];
            const a1 = src[off + 1];
            const table: number[] = [a0, a1];
            if (a0 > a1) {
              for (let k = 1; k <= 6; k++) table.push(((7 - k) * a0 + k * a1) / 7);
            } else {
              for (let k = 1; k <= 4; k++) table.push(((5 - k) * a0 + k * a1) / 5);
              table.push(0, 255);
            }
            // 48 bits of 3-bit indices, read as two 24-bit halves (little endian)
            const lo = src[off + 2] | (src[off + 3] << 8) | (src[off + 4] << 16);
            const hi = src[off + 5] | (src[off + 6] << 8) | (src[off + 7] << 16);
            for (let i = 0; i < 16; i++) {
              const half = i < 8 ? lo : hi;
              alpha[i] = table[(half >> ((i & 7) * 3)) & 7];
            }
          }
          for (let i = 0; i < 16; i++) {
            const x = bx * 4 + (i & 3);
            const y = by * 4 + (i >> 2);
            if (x < width && y < height) out[(y * width + x) * 4 + 3] = alpha[i];
          }
        }
      }
    } else {
      throw new Error(
        `Format DDS "${fourCC}" belum didukung. Gunakan DXT1, DXT3, DXT5, atau BGRA 32-bit (atau simpan ulang sebagai PNG).`
      );
    }
  } else if ((pfFlags & 0x40) && (bitCount === 32 || bitCount === 24)) {
    // Uncompressed RGB(A)
    const bytes = bitCount / 8;
    if (src.length < width * height * bytes) throw new Error('File DDS terpotong.');
    const shiftOf = (mask: number) => (mask ? 31 - Math.clz32(mask & -mask) : 0);
    const rs = shiftOf(rMask), gs = shiftOf(gMask), bs = shiftOf(bMask), as = shiftOf(aMask);
    for (let i = 0; i < width * height; i++) {
      let v = 0;
      for (let k = 0; k < bytes; k++) v |= src[i * bytes + k] << (8 * k);
      v >>>= 0;
      out[i * 4] = (v & rMask) >>> rs;
      out[i * 4 + 1] = (v & gMask) >>> gs;
      out[i * 4 + 2] = (v & bMask) >>> bs;
      out[i * 4 + 3] = aMask ? (v & aMask) >>> as : 255;
    }
  } else {
    throw new Error('Format DDS ini belum didukung. Simpan ulang sebagai PNG, DXT5, atau BGRA 32-bit.');
  }

  return { width, height, data: out };
}
