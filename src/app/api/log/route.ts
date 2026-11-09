import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { LIBRARY_ROOT } from '@/lib/templateLoader';
import { isAppRequest } from '@/lib/sameOrigin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Activity log: library/logs/aktivitas-YYYY-MM-DD.log (inside the library, so it is never committed). */
const LOG_DIR = path.join(LIBRARY_ROOT, 'logs');
const KEEP_DAYS = 14;
const MAX_LINES = 300;
const MAX_LINE = 600;

/** POST { lines: string[] } appends the lines (each already time-stamped by the app) to today's file. */
export async function POST(req: NextRequest) {
  if (!isAppRequest(req)) return NextResponse.json({ error: 'Ditolak.' }, { status: 403 });
  try {
    const body = await req.json().catch(() => null);
    const lines: unknown = body?.lines;
    if (!Array.isArray(lines) || lines.length > MAX_LINES || !lines.every((l) => typeof l === 'string')) {
      return NextResponse.json({ error: 'Data log tidak valid.' }, { status: 400 });
    }
    // one entry per line: newlines inside an entry are flattened
    const text = (lines as string[]).map((l) => l.replace(/[\r\n]+/g, ' ').slice(0, MAX_LINE)).join('\n') + '\n';
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    const file = path.join(LOG_DIR, `aktivitas-${day}.log`);
    const fresh = !fs.existsSync(file);
    fs.appendFileSync(file, text, 'utf8');
    if (fresh) {
      // a new day: drop the files older than KEEP_DAYS
      const cutoff = Date.now() - KEEP_DAYS * 86400000;
      for (const f of fs.readdirSync(LOG_DIR)) {
        const m = /^aktivitas-(\d{4}-\d{2}-\d{2})\.log$/.exec(f);
        if (m && Date.parse(m[1]) < cutoff) fs.rmSync(path.join(LOG_DIR, f), { force: true });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Gagal menulis log.' }, { status: 500 });
  }
}
