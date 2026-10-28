import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { TEMPLATE_DIR, parseTemplate } from '@/lib/templateLoader';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_MASK_BYTES = 12 * 1024 * 1024;
const MAX_JSON_BYTES = 4 * 1024 * 1024;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'template-psd';

/** Resolves a folder name to a directory inside library/templates (never outside of it). */
function folderPath(folder: unknown): string | null {
  if (typeof folder !== 'string' || !/^[a-z0-9][a-z0-9-]{0,59}$/.test(folder)) return null;
  const full = path.join(TEMPLATE_DIR, folder);
  return full.startsWith(TEMPLATE_DIR + path.sep) ? full : null;
}

/**
 * PSD import in three steps (a PSD can hold many masks, so they are sent one by one):
 *  - { action: 'init', name }                 -> creates library/templates/<slug>/masks, returns { folder }
 *  - { action: 'mask', folder, file, dataUrl } -> writes masks/<file>.png
 *  - { action: 'finish', folder, template }    -> validates and writes template.json, returns the template
 */
export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (text.length > MAX_MASK_BYTES * 1.4) {
      return NextResponse.json({ error: 'Permintaan terlalu besar.' }, { status: 413 });
    }
    const body = JSON.parse(text);

    if (body.action === 'init') {
      const base = slugify(String(body.name || 'template-psd'));
      fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
      let folder = base;
      let n = 2;
      while (fs.existsSync(path.join(TEMPLATE_DIR, folder)) || fs.existsSync(path.join(TEMPLATE_DIR, `${folder}.json`))) {
        folder = `${base}-${n++}`;
      }
      fs.mkdirSync(path.join(TEMPLATE_DIR, folder, 'masks'), { recursive: true });
      return NextResponse.json({ folder });
    }

    const dir = folderPath(body.folder);
    if (!dir || !fs.existsSync(dir)) {
      return NextResponse.json({ error: 'Folder template tidak valid.' }, { status: 400 });
    }

    if (body.action === 'mask') {
      const file = String(body.file || '');
      const m = String(body.dataUrl || '').match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
      if (!/^[a-z0-9][a-z0-9_-]{0,80}\.png$/.test(file) || !m) {
        return NextResponse.json({ error: 'Data mask tidak valid.' }, { status: 400 });
      }
      const buf = Buffer.from(m[1], 'base64');
      if (buf.length === 0 || buf.length > MAX_MASK_BYTES) {
        return NextResponse.json({ error: 'Ukuran mask tidak wajar.' }, { status: 413 });
      }
      fs.writeFileSync(path.join(dir, 'masks', file), buf);
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'finish') {
      const json = JSON.stringify(body.template ?? {});
      if (json.length > MAX_JSON_BYTES) {
        return NextResponse.json({ error: 'Template terlalu besar.' }, { status: 413 });
      }
      const folder = path.basename(dir);
      // validate exactly like the library reader does before anything is written
      const parsed = parseTemplate(body.template, [folder], `${folder}.json`);
      fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify(body.template, null, 2), 'utf8');
      return NextResponse.json({ ok: true, template: parsed });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Import gagal.' }, { status: 500 });
  }
}
