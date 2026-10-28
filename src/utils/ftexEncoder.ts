/**
 * FTEX (Fox Engine texture, used by PES 2021) writer.
 *
 * Takes the DDS bytes produced by `encodeDDS` and wraps them in a single self-contained .ftex
 * (all mip levels embedded, no .ftexs files; the same as running `FtexTool -f 0 file.dds`).
 *
 * The layout follows FtexTool by Atvaark (MIT licence): https://github.com/Atvaark/FtexTool
 *
 *   header (64 bytes) | mip info x mipCount (16 bytes each) | mip blocks, smallest mip first
 *   mip block         = chunk index x chunkCount (8 bytes each) | chunk data | pad to 16 | 8 zero bytes
 *   chunk data        = at most 16384 raw bytes, zlib-compressed (a single chunk that does not
 *                       shrink is stored raw and flagged with offset 0x80000008)
 */

export type FtexTextureType = 'diffuse' | 'material' | 'normal' | 'cube';

const TEXTURE_TYPE_CODE: Record<FtexTextureType, number> = {
  material: 0x01000001,
  diffuse: 0x01000003,
  cube: 0x01000007,
  normal: 0x01000009,
};

/** FtexUnknownFlags.Default (Flag1 | Flag2 | Flag3): what ~96% of game textures use. */
const DEFAULT_FLAGS = 273;
const MAX_CHUNK = 0x4000; // short.MaxValue / 2 + 1
const RELATIVE_OFFSET_FLAG = 0x80000000;
const CHUNK_INDEX_SIZE = 8;

interface ParsedDds {
  width: number;
  height: number;
  mipCount: number;
  pixelFormatType: number; // 0 = A8R8G8B8, 2 = DXT1, 4 = DXT3/DXT5
  levels: Uint8Array[];
}

function levelBytes(type: number, w: number, h: number): number {
  if (type === 0) return w * h * 4;
  const block = type === 2 ? 8 : 16;
  return Math.max(1, Math.ceil(w / 4)) * Math.max(1, Math.ceil(h / 4)) * block;
}

function parseDds(dds: Uint8Array): ParsedDds {
  const dv = new DataView(dds.buffer, dds.byteOffset, dds.byteLength);
  if (dv.getUint32(0, true) !== 0x20534444) throw new Error('Bukan file DDS');
  const height = dv.getUint32(12, true);
  const width = dv.getUint32(16, true);
  const mipCount = Math.max(1, dv.getUint32(28, true));
  const pfFlags = dv.getUint32(80, true);
  const fourCC = dv.getUint32(84, true);
  const str = String.fromCharCode(fourCC & 255, (fourCC >> 8) & 255, (fourCC >> 16) & 255, (fourCC >> 24) & 255);
  let type: number;
  if (pfFlags & 0x4) {
    if (str === 'DXT1') type = 2;
    else if (str === 'DXT5' || str === 'DXT3') type = 4;
    else throw new Error(`Format DDS ${str} tidak didukung untuk FTEX`);
  } else if (pfFlags & 0x40) {
    type = 0;
  } else {
    throw new Error('Format DDS tidak dikenali');
  }

  const levels: Uint8Array[] = [];
  let offset = 128;
  let w = width;
  let h = height;
  for (let i = 0; i < mipCount; i++) {
    const size = levelBytes(type, w, h);
    levels.push(dds.subarray(offset, offset + size));
    offset += size;
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
  }
  return { width, height, mipCount, pixelFormatType: type, levels };
}

/** zlib (RFC 1950) compression, the same wrapper FtexTool's DeflaterOutputStream writes. */
async function zlibDeflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

interface Chunk {
  raw: Uint8Array;
  comp: Uint8Array;
}

export async function encodeFtex(
  dds: Uint8Array,
  options: { textureType?: FtexTextureType; flags?: number } = {}
): Promise<Uint8Array> {
  const parsed = parseDds(dds);
  const { mipCount } = parsed;

  // split each mip level into chunks and compress them
  const mipChunks: Chunk[][] = [];
  for (const level of parsed.levels) {
    const chunks: Chunk[] = [];
    for (let off = 0; off < level.length; off += MAX_CHUNK) {
      const raw = level.subarray(off, Math.min(level.length, off + MAX_CHUNK));
      chunks.push({ raw, comp: await zlibDeflate(raw) });
    }
    mipChunks.push(chunks);
  }

  const headerSize = 64 + 16 * mipCount;
  const parts: { pos: number; bytes: Uint8Array }[] = [];
  const mipInfos: { offset: number; decompressed: number; size: number; index: number; chunkCount: number }[] =
    new Array(mipCount);

  let pos = headerSize;
  // the smallest mip is written first
  for (let m = mipCount - 1; m >= 0; m--) {
    const chunks = mipChunks[m];
    const base = pos;
    pos += CHUNK_INDEX_SIZE * chunks.length;

    const index = new DataView(new ArrayBuffer(CHUNK_INDEX_SIZE * chunks.length));
    let written = 0;
    chunks.forEach((c, i) => {
      const single = chunks.length === 1;
      let encoded: number;
      let data: Uint8Array;
      if (single && c.raw.length <= c.comp.length) {
        encoded = (CHUNK_INDEX_SIZE | RELATIVE_OFFSET_FLAG) >>> 0;
        data = c.raw;
      } else {
        encoded = pos - base;
        data = c.comp;
      }
      index.setInt16(i * 8, data.length, true); // written size
      index.setInt16(i * 8 + 2, c.raw.length, true); // decompressed size
      index.setUint32(i * 8 + 4, encoded, true);
      parts.push({ pos, bytes: data });
      pos += data.length;
      written += data.length;
    });
    parts.push({ pos: base, bytes: new Uint8Array(index.buffer) });

    const alignment = (16 - (pos % 16)) % 16;
    pos += alignment + 8; // padding, then 8 zero bytes (streaming info, left empty)

    mipInfos[m] = {
      offset: base,
      decompressed: parsed.levels[m].length,
      size: CHUNK_INDEX_SIZE * chunks.length + written + alignment,
      index: m,
      chunkCount: chunks.length,
    };
  }

  const out = new Uint8Array(pos);
  const dv = new DataView(out.buffer);

  // header
  dv.setUint32(0, 0x58455446, true); // 'FTEX'
  dv.setUint32(4, 0x4001eb85, true); // 85 EB 01 40
  dv.setInt16(8, parsed.pixelFormatType, true);
  dv.setInt16(10, parsed.width, true);
  dv.setInt16(12, parsed.height, true);
  dv.setInt16(14, 1, true); // depth
  dv.setUint8(16, mipCount);
  dv.setUint8(17, 2); // nrt flag (0 for _nrt normal maps)
  dv.setInt16(18, options.flags ?? DEFAULT_FLAGS, true);
  dv.setInt32(20, 1, true);
  dv.setInt32(24, 0, true);
  dv.setInt32(28, TEXTURE_TYPE_CODE[options.textureType ?? 'diffuse'], true);
  dv.setUint8(32, 0); // ftexs file count (everything is embedded)
  dv.setUint8(33, 0); // additional ftexs files
  // bytes 34..47 are zero, 48..63 hash (left zero)

  mipInfos.forEach((info, i) => {
    const o = 64 + i * 16;
    dv.setInt32(o, info.offset, true);
    dv.setInt32(o + 4, info.decompressed, true);
    dv.setInt32(o + 8, info.size, true);
    dv.setUint8(o + 12, info.index);
    dv.setUint8(o + 13, 0); // ftexs file number 0 = this file
    dv.setInt16(o + 14, info.chunkCount, true);
  });

  parts.forEach((p) => out.set(p.bytes, p.pos));
  return out;
}
