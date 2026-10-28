import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TEMPLATE_DIR = path.join(process.env.KIT_LIBRARY_DIR || path.join(process.cwd(), 'library'), 'templates');
const MAX_BYTES = 512 * 1024;

/** POST { name, template } -> writes library/templates/<name>.json (never overwrites a file). */
export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (text.length > MAX_BYTES) {
      return NextResponse.json({ error: 'Template terlalu besar.' }, { status: 413 });
    }
    const body = JSON.parse(text);
    const tpl = body?.template;
    if (!tpl || typeof tpl !== 'object' || !Array.isArray(tpl.zones)) {
      return NextResponse.json({ error: 'Template tidak valid.' }, { status: 400 });
    }

    const rawName = String(body?.name || tpl.name || 'template-saya');
    const slug =
      rawName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'template-saya';

    fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
    let file = path.join(TEMPLATE_DIR, `${slug}.json`);
    let n = 2;
    while (fs.existsSync(file)) {
      file = path.join(TEMPLATE_DIR, `${slug}-${n++}.json`);
    }

    const data = {
      id: `lib-${path.basename(file, '.json')}`,
      name: rawName,
      description: typeof tpl.description === 'string' ? tpl.description : undefined,
      zones: tpl.zones,
      seams: Array.isArray(tpl.seams) ? tpl.seams : undefined,
    };
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return NextResponse.json({ ok: true, file: path.basename(file) });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Gagal menyimpan template.' }, { status: 500 });
  }
}
