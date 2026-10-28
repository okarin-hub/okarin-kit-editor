import { NextRequest, NextResponse } from 'next/server';
import { importLogo } from '@/lib/footballLogos';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST { country, id }  ->  downloads one logo into library/logos/football-logos */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await importLogo(String(body?.country || ''), String(body?.id || ''));
    return NextResponse.json({
      ...result,
      url: `/api/library/file?p=${encodeURIComponent(result.relPath)}`,
    });
  } catch (err: any) {
    const offline = err?.name === 'AbortError' || /fetch failed|ENOTFOUND|ECONN/i.test(String(err?.message));
    return NextResponse.json(
      {
        error: offline
          ? 'Tidak bisa menghubungi football-logos.cc. Periksa koneksi internet.'
          : err?.message || 'Gagal mengambil logo.',
      },
      { status: 502 }
    );
  }
}
