import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { TEMPLATE_DIR, psdFolder } from '@/lib/templateLoader';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 300 * 1024 * 1024;

/**
 * "Tambah PSD": the file body is written to library/templates/<name>.psd (an existing file of that name is
 * replaced, like saving it again). The library reader then lists it and the app reads it as a template.
 * Returns the id the template will have once it is read.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = decodeURIComponent(req.headers.get('x-file-name') || '');
    // only a plain file name, no folders
    const name = path.basename(raw).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
    if (!/\.psd$/i.test(name) || name.length > 120) {
      return NextResponse.json({ error: 'Pilih file berformat .psd.' }, { status: 400 });
    }
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length > MAX_BYTES) return NextResponse.json({ error: 'File PSD terlalu besar.' }, { status: 413 });
    if (buf.length < 26 || buf.toString('latin1', 0, 4) !== '8BPS') {
      return NextResponse.json({ error: 'File ini bukan PSD.' }, { status: 400 });
    }
    fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
    fs.writeFileSync(path.join(TEMPLATE_DIR, name), buf);
    return NextResponse.json({ ok: true, file: name, id: `psd-${psdFolder(name)}` });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Gagal menyalin PSD.' }, { status: 500 });
  }
}
