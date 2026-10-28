import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIBRARY_ROOT = process.env.KIT_LIBRARY_DIR || path.join(process.cwd(), 'library');

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** Serves one file from the library folder (never anything outside of it). */
export async function GET(req: NextRequest) {
  const rel = req.nextUrl.searchParams.get('p') || '';
  const full = path.resolve(LIBRARY_ROOT, rel);
  const ext = path.extname(full).toLowerCase();

  const insideLibrary = full === LIBRARY_ROOT || full.startsWith(LIBRARY_ROOT + path.sep);
  if (!rel || !insideLibrary || !CONTENT_TYPES[ext]) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    if (!fs.statSync(full).isFile()) return new NextResponse('Not found', { status: 404 });
    const data = fs.readFileSync(full);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': CONTENT_TYPES[ext],
        'Cache-Control': 'no-cache',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
