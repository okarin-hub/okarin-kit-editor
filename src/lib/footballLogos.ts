import fs from 'fs';
import path from 'path';

/**
 * Server-side helper for football-logos.cc (a free fan resource; logos are trademarks of their
 * owners and licensed for informational / editorial / fan, NON-COMMERCIAL use only).
 *
 * Politeness rules used here:
 *  - the site's own public autocomplete index (/ac-v3.json) is fetched at most once a day;
 *  - one page + one image request happens only when the user picks a logo;
 *  - every downloaded logo is cached in library/logos/football-logos and never fetched twice;
 *  - requests identify themselves with a descriptive User-Agent.
 */

const SITE = 'https://football-logos.cc';
const USER_AGENT = 'OkarinKitEditor/0.1 (fan kit tool; non-commercial)';
const INDEX_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const LOGO_FOLDER = path.join(process.env.KIT_LIBRARY_DIR || path.join(process.cwd(), 'library'), 'logos', 'football-logos');

export interface LogoIndexEntry {
  id: string;
  name: string;
  categoryId: string; // country slug, or "tournaments"
  alt?: string[];
  h?: string;
  hasPng?: boolean;
  hasSvg?: boolean;
  variantCount?: number;
}

let indexCache: { at: number; list: LogoIndexEntry[] } | null = null;

async function fetchWithTimeout(url: string, ms = 20000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
      signal: ctrl.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function getIndex(): Promise<LogoIndexEntry[]> {
  if (indexCache && Date.now() - indexCache.at < INDEX_TTL_MS) return indexCache.list;
  const res = await fetchWithTimeout(`${SITE}/ac-v3.json`, 30000);
  if (!res.ok) throw new Error(`football-logos.cc menjawab ${res.status}`);
  const list = (await res.json()) as LogoIndexEntry[];
  if (!Array.isArray(list)) throw new Error('Format indeks football-logos.cc tidak dikenali');
  indexCache = { at: Date.now(), list };
  return list;
}

export const slugOk = (s: string) => /^[a-z0-9][a-z0-9-]*$/.test(s) && s.length <= 120;

export const prettyCountry = (slug: string) =>
  slug === 'tournaments'
    ? 'Tournaments'
    : slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export interface SearchHit {
  id: string;
  name: string;
  country: string; // slug
  countryName: string;
  alt: string[];
  pageUrl: string;
  cached: boolean;
}

export function pagePath(entry: { id: string; categoryId: string }): string {
  return entry.categoryId === 'tournaments'
    ? `/tournaments/${entry.id}/`
    : `/${entry.categoryId}/${entry.id}/`;
}

export function safeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
}

export function localFileFor(entry: { name: string; categoryId: string }): string {
  const base = `${safeFileName(entry.name)} (${prettyCountry(entry.categoryId)}).png`;
  return path.join(LOGO_FOLDER, base);
}

export async function search(query: string, limit = 30): Promise<SearchHit[]> {
  const q = fold(query).trim();
  if (q.length < 2) return [];
  const list = await getIndex();

  const scored: { score: number; e: LogoIndexEntry }[] = [];
  for (const e of list) {
    const hay = [e.name, e.id.replace(/-/g, ' '), ...(e.alt ?? []), prettyCountry(e.categoryId)].map(fold);
    let score = 0;
    const name = hay[0];
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (hay.slice(1, -1).some((h) => h === q)) score = 75;
    else if (name.includes(q)) score = 60;
    else if (hay.slice(1, -1).some((h) => h.includes(q))) score = 50;
    else if (q.split(/\s+/).every((tok) => hay.some((h) => h.includes(tok)))) score = 30;
    if (score) scored.push({ score, e });
  }
  scored.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name));

  return scored.slice(0, limit).map(({ e }) => ({
    id: e.id,
    name: e.name,
    country: e.categoryId,
    countryName: prettyCountry(e.categoryId),
    alt: e.alt ?? [],
    pageUrl: SITE + pagePath(e),
    cached: fs.existsSync(localFileFor(e)),
  }));
}

/** Finds the PNG URL of the main logo (not a variant / history logo) in the club page HTML. */
function findPngUrl(html: string, entry: LogoIndexEntry): string | null {
  const id = entry.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const size of ['512x512', '700x700', '256x256', '1500x1500']) {
    const re = new RegExp(
      `https://assets\\.football-logos\\.cc/logos/(?:[a-z0-9-]+/)?${size}/${id}\\.[0-9a-f]{6,12}\\.png`
    );
    const m = html.match(re);
    if (m) return m[0];
  }
  return null;
}

export interface ImportResult {
  name: string;
  country: string;
  countryName: string;
  relPath: string; // path relative to /library (posix)
  pageUrl: string;
  alreadyHad: boolean;
}

/** Downloads one logo into library/logos/football-logos (skips when it is already there). */
export async function importLogo(country: string, id: string): Promise<ImportResult> {
  if (!slugOk(country) || !slugOk(id)) throw new Error('Parameter logo tidak valid.');

  const list = await getIndex();
  const entry = list.find((e) => e.id === id && e.categoryId === country);
  if (!entry) throw new Error('Logo tidak ditemukan di football-logos.cc.');

  const file = localFileFor(entry);
  const relPath = ['logos', 'football-logos', path.basename(file)].join('/');
  const result: ImportResult = {
    name: entry.name,
    country,
    countryName: prettyCountry(country),
    relPath,
    pageUrl: SITE + pagePath(entry),
    alreadyHad: false,
  };

  if (fs.existsSync(file)) {
    result.alreadyHad = true;
    return result;
  }

  const pageRes = await fetchWithTimeout(result.pageUrl);
  if (!pageRes.ok) throw new Error(`Halaman logo menjawab ${pageRes.status}`);
  const pngUrl = findPngUrl(await pageRes.text(), entry);
  if (!pngUrl) throw new Error('Berkas PNG logo tidak ditemukan di halaman. Coba unduh manual dari situsnya.');

  const imgRes = await fetchWithTimeout(pngUrl);
  if (!imgRes.ok) throw new Error(`Unduhan gambar gagal (${imgRes.status})`);
  if (!(imgRes.headers.get('content-type') || '').startsWith('image/png')) {
    throw new Error('Respons bukan gambar PNG.');
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) throw new Error('Ukuran gambar tidak wajar.');

  fs.mkdirSync(LOGO_FOLDER, { recursive: true });
  fs.writeFileSync(file, buf);

  // Keep a small record of where each file came from (the license asks for non-commercial use)
  const note = path.join(LOGO_FOLDER, '_SUMBER.txt');
  if (!fs.existsSync(note)) {
    fs.writeFileSync(
      note,
      'Logo di folder ini diambil dari https://football-logos.cc/ lewat tombol "Cari Logo Klub".\n' +
        'Semua logo adalah merek dagang milik klub / liga / asosiasi masing-masing.\n' +
        'Situs sumber hanya mengizinkan penggunaan informatif, editorial, dan fan (NON-KOMERSIAL):\n' +
        'jangan dipakai untuk produk, merchandise, atau materi promosi. Lihat https://football-logos.cc/license/\n\n'
    );
  }
  fs.appendFileSync(note, `${path.basename(file)}  <-  ${result.pageUrl}\n`);

  return result;
}
