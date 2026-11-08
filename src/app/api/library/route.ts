import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { readTemplates } from '@/lib/templateLoader';

// Always read the folders fresh so files dropped in while the app runs show up after a refresh
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIBRARY_ROOT = process.env.KIT_LIBRARY_DIR || path.join(process.cwd(), 'library');
const IMAGE_EXT = /\.(png|jpe?g|webp|svg|gif)$/i;
const FONT_EXT = /\.(ttf|otf|woff2?)$/i;

interface Entry {
  id: string;
  name: string;
  category: string; // first sub-folder, '' when the file sits in the root of the folder
  path: string; // path relative to /library (posix), used by the file endpoint
  url: string;
}

function prettify(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function walk(kind: string, pattern: RegExp): Entry[] {
  const base = path.join(LIBRARY_ROOT, kind);
  const out: Entry[] = [];
  if (!fs.existsSync(base)) return out;

  const visit = (dir: string, rel: string[]) => {
    for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (dirent.name.startsWith('.')) continue;
      const full = path.join(dir, dirent.name);
      if (dirent.isDirectory()) {
        visit(full, [...rel, dirent.name]);
      } else if (pattern.test(dirent.name)) {
        const relPath = [kind, ...rel, dirent.name].join('/');
        out.push({
          id: relPath,
          name: prettify(dirent.name),
          category: rel[0] ?? '',
          path: relPath,
          url: `/api/library/file?p=${encodeURIComponent(relPath)}`,
        });
      }
    }
  };

  visit(base, []);
  return out.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

/** PES fontsets the generator saved: library/fonts/font_pes/<name>/<kind>.png (the mtime keeps a re-saved sheet out of the image cache). */
function readFontsets() {
  const base = path.join(LIBRARY_ROOT, 'fonts', 'font_pes');
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => {
      const files: Record<string, string> = {};
      for (const kind of ['back', 'chest', 'leg', 'name', 'name_ex']) {
        const full = path.join(base, d.name, `${kind}.png`);
        if (!fs.existsSync(full)) continue;
        const rel = `fonts/font_pes/${d.name}/${kind}.png`;
        files[kind] = `/api/library/file?p=${encodeURIComponent(rel)}&v=${Math.round(fs.statSync(full).mtimeMs)}`;
      }
      return { name: d.name, files };
    })
    .filter((f) => Object.keys(f.files).length)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET() {
  try {
    const fonts = walk('fonts', FONT_EXT).map((f) => ({
      ...f,
      // The file name (without extension) is used as the CSS font family
      family: f.path.split('/').pop()!.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim(),
    }));

    const tpl = readTemplates();
    return NextResponse.json(
      {
        root: LIBRARY_ROOT,
        templates: tpl.templates,
        psd: tpl.psd,
        templateErrors: tpl.errors,
        logos: walk('logos', IMAGE_EXT),
        patterns: walk('patterns', IMAGE_EXT),
        textures: walk('textures', IMAGE_EXT),
        fonts,
        fontsets: readFontsets(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Gagal membaca folder library.' }, { status: 500 });
  }
}
