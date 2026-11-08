import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIBRARY_ROOT = process.env.KIT_LIBRARY_DIR || path.join(process.cwd(), 'library');
const FONTSET_DIR = path.join(LIBRARY_ROOT, 'fonts', 'font_pes');
const KINDS = ['back', 'chest', 'leg', 'name', 'name_ex'];
// five PNG sheets as base64; the back number sheet (4096×512) is the largest
const MAX_BYTES = 60 * 1024 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/** A folder name typed by the user, safe for Windows. */
const safeName = (s: string) =>
  s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').replace(/[. ]+$/, '').slice(0, 60);

/**
 * POST { name, files: { back?, chest?, leg?, name?, name_ex?: base64 PNG } } -> library/fonts/font_pes/<name>/<kind>.png.
 * Saving under the same name again replaces those sheets (the folder belongs to the generator).
 */
export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (text.length > MAX_BYTES) return NextResponse.json({ error: 'Fontset terlalu besar.' }, { status: 413 });
    const body = JSON.parse(text);
    const name = safeName(String(body?.name || ''));
    if (!name) return NextResponse.json({ error: 'Nama fontset kosong.' }, { status: 400 });
    const files = body?.files && typeof body.files === 'object' ? body.files : {};
    const sheets = KINDS.filter((k) => typeof files[k] === 'string').map((k) => [k, Buffer.from(files[k], 'base64')] as const);
    if (!sheets.length || sheets.some(([, b]) => !b.subarray(0, 4).equals(PNG_MAGIC))) {
      return NextResponse.json({ error: 'File font tidak valid.' }, { status: 400 });
    }
    const dir = path.join(FONTSET_DIR, name);
    if (!path.resolve(dir).startsWith(path.resolve(FONTSET_DIR) + path.sep)) {
      return NextResponse.json({ error: 'Nama fontset tidak valid.' }, { status: 400 });
    }
    fs.mkdirSync(dir, { recursive: true });
    for (const [k, data] of sheets) fs.writeFileSync(path.join(dir, `${k}.png`), data);
    return NextResponse.json({ ok: true, name, count: sheets.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Gagal menyimpan fontset.' }, { status: 500 });
  }
}
