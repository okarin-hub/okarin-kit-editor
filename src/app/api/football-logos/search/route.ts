import { NextRequest, NextResponse } from 'next/server';
import { search } from '@/lib/footballLogos';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET /api/football-logos/search?q=liverpool  ->  matches from the football-logos.cc index */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  try {
    const results = await search(q.slice(0, 80));
    return NextResponse.json({ results });
  } catch (err: any) {
    const offline = err?.name === 'AbortError' || /fetch failed|ENOTFOUND|ECONN/i.test(String(err?.message));
    return NextResponse.json(
      {
        error: offline
          ? 'Tidak bisa menghubungi football-logos.cc. Periksa koneksi internet.'
          : err?.message || 'Pencarian gagal.',
      },
      { status: 502 }
    );
  }
}
