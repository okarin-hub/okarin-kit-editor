import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { TEMPLATE_DIR, PSD_CACHE_DIR, psdFolder } from '@/lib/templateLoader';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// merged image layers carry their PNG inside the template (see templateLoader: 8 MB per layer)
const MAX_BYTES = 16 * 1024 * 1024;

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
        .replace(/[̀-ͯ]/g, '')
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
      layerGroups: Array.isArray(tpl.layerGroups) ? tpl.layerGroups : undefined,
    };
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return NextResponse.json({ ok: true, file: path.basename(file) });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Gagal menyimpan template.' }, { status: 500 });
  }
}

/**
 * A template file of the library from the client: `json` = a .json path relative to library/templates,
 * `psd` = a .psd path relative to the library root ("templates/…"). Null when it points anywhere else.
 */
function resolveTemplateFile(body: any): { kind: 'json' | 'psd'; full: string; rel: string } | null {
  const kind = body?.kind === 'psd' ? 'psd' : body?.kind === 'json' ? 'json' : null;
  let rel = typeof body?.file === 'string' ? body.file.replace(/\\/g, '/') : '';
  if (!kind || !rel) return null;
  if (kind === 'psd') {
    if (!rel.startsWith('templates/')) return null;
    rel = rel.slice('templates/'.length);
  }
  if (!(kind === 'psd' ? /\.psd$/i : /\.json$/i).test(rel)) return null;
  // never the converted copies (.psd) or any other dot folder, never outside library/templates
  if (rel.split('/').some((s: string) => !s || s.startsWith('.'))) return null;
  const full = path.resolve(TEMPLATE_DIR, rel);
  if (!full.startsWith(path.resolve(TEMPLATE_DIR) + path.sep) || !fs.existsSync(full)) return null;
  return { kind, full, rel };
}

/** A file name typed by the user, safe for Windows. */
const safeFileName = (s: string) =>
  s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 80);

/** PATCH { kind, file, name } -> renames a library template (a JSON keeps its file, a PSD file is renamed). */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const target = resolveTemplateFile(body);
    if (!target) return NextResponse.json({ error: 'Template tidak ditemukan.' }, { status: 404 });
    const name = String(body?.name ?? '').trim().slice(0, 80);
    if (!name) return NextResponse.json({ error: 'Nama kosong.' }, { status: 400 });

    if (target.kind === 'json') {
      const json = JSON.parse(fs.readFileSync(target.full, 'utf8'));
      json.name = name;
      fs.writeFileSync(target.full, JSON.stringify(json, null, 2), 'utf8');
      return NextResponse.json({ ok: true });
    }

    // a PSD is named after its file: rename it, and move its converted copy along so it is not read again
    const base = safeFileName(name);
    if (!base) return NextResponse.json({ error: 'Nama tidak bisa dipakai sebagai nama file.' }, { status: 400 });
    const newRel = [...target.rel.split('/').slice(0, -1), `${base}.psd`].join('/');
    const newFull = path.resolve(TEMPLATE_DIR, newRel);
    if (newFull.toLowerCase() !== target.full.toLowerCase() && fs.existsSync(newFull)) {
      return NextResponse.json({ error: 'Sudah ada PSD dengan nama itu.' }, { status: 409 });
    }
    fs.renameSync(target.full, newFull);
    const oldDir = path.join(PSD_CACHE_DIR, psdFolder(target.rel));
    const newFolder = psdFolder(newRel);
    const newDir = path.join(PSD_CACHE_DIR, newFolder);
    if (oldDir !== newDir && fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
      fs.renameSync(oldDir, newDir);
    }
    // keep the cache pointing at the new file and showing the new name
    try {
      const src = path.join(newDir, 'source.json');
      fs.writeFileSync(src, JSON.stringify({ ...JSON.parse(fs.readFileSync(src, 'utf8')), file: `templates/${newRel}` }));
      const tplFile = path.join(newDir, 'template.json');
      fs.writeFileSync(tplFile, JSON.stringify({ ...JSON.parse(fs.readFileSync(tplFile, 'utf8')), name: base }));
    } catch {
      // no converted copy yet: the PSD is simply read under its new name
    }
    return NextResponse.json({ ok: true, id: `psd-${newFolder}`, file: `templates/${newRel}`, name: base });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Gagal mengganti nama.' }, { status: 500 });
  }
}

/** DELETE { kind, file } -> deletes a library template: the JSON (or its folder with the masks) or the PSD and its copy. */
export async function DELETE(req: NextRequest) {
  try {
    const target = resolveTemplateFile(await req.json());
    if (!target) return NextResponse.json({ error: 'Template tidak ditemukan.' }, { status: 404 });

    if (target.kind === 'psd') {
      fs.rmSync(target.full);
      fs.rmSync(path.join(PSD_CACHE_DIR, psdFolder(target.rel)), { recursive: true, force: true });
      return NextResponse.json({ ok: true });
    }

    // a template.json alone in its folder (an import with its masks) goes with the folder
    const dir = path.dirname(target.full);
    const others =
      path.basename(target.full) === 'template.json' && dir !== path.resolve(TEMPLATE_DIR)
        ? fs.readdirSync(dir).filter((f) => f !== 'template.json' && /\.(json|psd)$/i.test(f))
        : ['(file)'];
    if (others.length === 0) fs.rmSync(dir, { recursive: true, force: true });
    else fs.rmSync(target.full);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Gagal menghapus template.' }, { status: 500 });
  }
}
