import { DICTIONARY } from '@/i18n/dictionary';

export type Lang = 'id' | 'en' | 'pt' | 'es';

/** English is the main language; the source text of the app is Indonesian, translated from the dictionary. */
export const DEFAULT_LANG: Lang = 'en';

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'pt', label: 'Português' },
  { code: 'es', label: 'Español' },
];

const COLUMN: Record<Exclude<Lang, 'id'>, number> = { en: 1, pt: 2, es: 3 };

interface Index {
  exact: Map<string, string>;
  patterns: { re: RegExp; out: string }[];
}

const indexes = new Map<Lang, Index>();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildIndex(lang: Exclude<Lang, 'id'>): Index {
  const exact = new Map<string, string>();
  const patterns: { re: RegExp; out: string }[] = [];
  for (const row of DICTIONARY) {
    const key = row[0];
    const out = row[COLUMN[lang]];
    if (/\{\d\}/.test(key)) {
      const source = key
        .split(/\{\d\}/)
        .map(escapeRe)
        .join('(.+?)');
      // the dynamic parts may be reordered in the translation: {1}, {2} refer to the captured groups
      patterns.push({ re: new RegExp(`^${source}$`), out });
    } else {
      exact.set(key, out);
    }
  }
  return { exact, patterns };
}

/** Translates one UI string (written in Indonesian) into `lang`; unknown strings are returned unchanged. */
export function translate(raw: string, lang: Lang): string {
  if (lang === 'id' || !raw) return raw;
  const lead = raw.match(/^\s*/)![0];
  const trail = raw.match(/\s*$/)![0];
  const core = raw.trim().split(/\s+/).join(' ');
  if (!core) return raw;

  let index = indexes.get(lang);
  if (!index) {
    index = buildIndex(lang);
    indexes.set(lang, index);
  }

  const hit = index.exact.get(core);
  if (hit !== undefined) return lead + hit + trail;
  for (const p of index.patterns) {
    const m = core.match(p.re);
    // the dynamic parts are translated too when they are known strings (e.g. a part name)
    if (m) return lead + p.out.replace(/\{(\d)\}/g, (_, n) => translate(m[Number(n)] ?? '', lang)) + trail;
  }
  return raw;
}
