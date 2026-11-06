import fs from 'fs';
import path from 'path';

/**
 * Server-side helpers for library/templates: validates a template JSON and resolves its mask files.
 * Shared by the library reader (/api/library) and the PSD import route.
 */

export const LIBRARY_ROOT = process.env.KIT_LIBRARY_DIR || path.join(process.cwd(), 'library');
export const TEMPLATE_DIR = path.join(LIBRARY_ROOT, 'templates');

export const PART_IDS = [
  'front', 'back', 'leftSleeve', 'rightSleeve', 'leftShorts', 'rightShorts',
  'leftSock', 'rightSock', 'collar', 'armband', 'credit',
] as const;

const PART_GROUP: Record<string, string> = {
  front: 'shirt', back: 'shirt', leftSleeve: 'shirt', rightSleeve: 'shirt',
  leftShorts: 'shorts', rightShorts: 'shorts', leftSock: 'socks', rightSock: 'socks',
  collar: 'details', armband: 'details', credit: 'details',
};

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isPt = (p: unknown): boolean => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]);
const isBox = (r: unknown): boolean => Array.isArray(r) && r.length === 4 && r.every(isNum);

const INITIAL_KEYS = ['dx', 'dy', 'sx', 'sy', 'rot', 'opacity'] as const;
// blend modes a template zone may use (what the PSD reader writes)
const BLEND_OPS = new Set([
  'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light',
  'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity', 'lighter',
]);

/** Validates one template JSON. `relDirs` = sub-folders of library/templates that hold the file. */
export function parseTemplate(json: any, relDirs: string[], fileName: string) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.zones)) throw new Error('"zones" harus berupa array');
  const id = String(json.id || 'lib-' + fileName.replace(/\.json$/i, '')).replace(/[^a-zA-Z0-9_-]/g, '-');
  const zoneIds = new Set<string>();

  const zones = json.zones.map((z: any, i: number) => {
    if (!z || typeof z !== 'object') throw new Error(`zona #${i + 1} tidak valid`);
    if (!(PART_IDS as readonly string[]).includes(z.part)) {
      throw new Error(`zona "${z.name ?? i + 1}": part harus salah satu dari ${PART_IDS.join(', ')}`);
    }
    const extraParts = Array.isArray(z.parts) ? z.parts : [];
    if (!extraParts.every((p: unknown) => (PART_IDS as readonly string[]).includes(p as string))) {
      throw new Error(`zona "${z.name ?? i + 1}": parts harus berisi nama bagian yang valid`);
    }
    const zid = String(z.id || `zone-${i + 1}`);
    if (zoneIds.has(zid)) throw new Error(`id zona ganda: ${zid}`);
    zoneIds.add(zid);

    const rects = Array.isArray(z.rects) ? z.rects : undefined;
    const polygons = Array.isArray(z.polygons) ? z.polygons : undefined;
    const ellipses = Array.isArray(z.ellipses) ? z.ellipses : undefined;
    if (rects && !rects.every(isBox)) throw new Error(`zona "${zid}": rects harus [x, y, lebar, tinggi]`);
    if (ellipses && !ellipses.every(isBox)) throw new Error(`zona "${zid}": ellipses harus [x, y, lebar, tinggi]`);
    if (polygons && !polygons.every((poly: unknown) => Array.isArray(poly) && poly.length >= 3 && poly.every(isPt))) {
      throw new Error(`zona "${zid}": polygons harus berisi minimal 3 titik [x, y]`);
    }

    let mask: string | undefined;
    if (typeof z.mask === 'string' && z.mask) {
      const rel = path.posix.join('templates', ...relDirs, z.mask.replace(/\\/g, '/'));
      mask = `/api/library/file?p=${encodeURIComponent(rel)}`;
    }
    if (!rects && !polygons && !ellipses && !mask) {
      throw new Error(`zona "${zid}": isi rects, polygons, ellipses, atau mask`);
    }

    let initial: Record<string, number> | undefined;
    if (z.initial && typeof z.initial === 'object') {
      initial = {};
      for (const k of INITIAL_KEYS) if (isNum(z.initial[k])) initial[k] = z.initial[k];
      if (!Object.keys(initial).length) initial = undefined;
    }

    return {
      id: zid,
      name: String(z.name || zid),
      part: z.part,
      parts: extraParts.length ? extraParts : undefined,
      group: PART_GROUP[z.part],
      rects,
      polygons,
      ellipses,
      mask,
      maskBox: isBox(z.maskBox) ? z.maskBox : undefined,
      maskCropped: z.maskCropped === true && isBox(z.maskBox) ? true : undefined,
      keepColor: z.keepColor === true ? true : undefined,
      initial,
      base: z.base === true ? true : undefined,
      slot: typeof z.slot === 'string' && z.slot ? z.slot.slice(0, 40) : undefined,
      variant:
        z.variant && typeof z.variant.set === 'string' && typeof z.variant.option === 'string'
          ? { set: z.variant.set.slice(0, 60), option: z.variant.option.slice(0, 20) }
          : undefined,
      blend: BLEND_OPS.has(z.blend) ? z.blend : undefined,
      clipTo: typeof z.clipTo === 'string' && z.clipTo ? z.clipTo.slice(0, 80) : undefined,
      defaultColor: typeof z.defaultColor === 'string' ? z.defaultColor : '#ffffff',
      defaultVisible: z.defaultVisible !== false,
    };
  });

  const seams = Array.isArray(json.seams)
    ? json.seams.filter(
        (s: any) => s && (PART_IDS as readonly string[]).includes(s.part) && Array.isArray(s.points) && s.points.every(isPt)
      )
    : undefined;

  return {
    id,
    name: String(json.name || id),
    description: json.description ? String(json.description) : undefined,
    source: 'library' as const,
    zones,
    seams,
  };
}

/** Reads library/templates/**.json */
export function readTemplates() {
  const templates: any[] = [];
  const errors: { file: string; error: string }[] = [];
  if (!fs.existsSync(TEMPLATE_DIR)) return { templates, errors };

  const files: { full: string; rel: string[] }[] = [];
  const visit = (dir: string, rel: string[]) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (d.name.startsWith('.')) continue;
      const full = path.join(dir, d.name);
      if (d.isDirectory()) visit(full, [...rel, d.name]);
      else if (/\.json$/i.test(d.name)) files.push({ full, rel });
    }
  };
  visit(TEMPLATE_DIR, []);

  // PSDs read straight from the folder: their converted copy lives in .psd/<folder>
  const psd = listPsd();
  removeOrphanPsdCaches(psd);
  for (const p of psd) {
    if (!p.ready) continue;
    try {
      const json = JSON.parse(fs.readFileSync(path.join(PSD_CACHE_DIR, p.folder, 'template.json'), 'utf8'));
      const t = parseTemplate(json, ['.psd', p.folder], `psd-${p.folder}.json`);
      // the revision in the mask URLs so a PSD saved again is not drawn from the image cache
      const zones = t.zones.map((z: any) => (z.mask ? { ...z, mask: `${z.mask}&v=${p.rev}` } : z));
      templates.push({ ...t, id: `psd-${p.folder}`, zones, source: 'psd', rev: p.rev, psdFile: p.path });
    } catch (e: any) {
      errors.push({ file: p.path, error: e?.message || 'Hasil baca PSD tidak valid' });
    }
  }

  for (const f of files) {
    const fileName = path.basename(f.full);
    try {
      const json = JSON.parse(fs.readFileSync(f.full, 'utf8'));
      // a folder with a single template.json uses the folder name as the id seed
      const nameSeed = fileName === 'template.json' && f.rel.length ? `${f.rel[f.rel.length - 1]}.json` : fileName;
      // the file, so the app can rename or delete it
      templates.push({ ...parseTemplate(json, f.rel, nameSeed), libFile: [...f.rel, fileName].join('/') });
    } catch (e: any) {
      errors.push({ file: f.rel.length ? `${f.rel.join('/')}/${fileName}` : fileName, error: e?.message || 'JSON tidak valid' });
    }
  }
  return { templates, errors, psd };
}

/** Converted copies of the PSDs in library/templates (a dot folder, so the JSON reader skips it). */
export const PSD_CACHE_DIR = path.join(TEMPLATE_DIR, '.psd');

/** Cache folder name for a PSD path relative to library/templates. */
export const psdFolder = (rel: string) =>
  rel
    .toLowerCase()
    .replace(/\.psd$/i, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'psd';

/** Deletes converted copies whose PSD is gone (only folders the reader made: they hold a source.json). */
function removeOrphanPsdCaches(psd: PsdEntry[]): void {
  if (!fs.existsSync(PSD_CACHE_DIR)) return;
  const keep = new Set(psd.map((p) => p.folder));
  for (const d of fs.readdirSync(PSD_CACHE_DIR, { withFileTypes: true })) {
    if (!d.isDirectory() || keep.has(d.name)) continue;
    const dir = path.join(PSD_CACHE_DIR, d.name);
    if (!fs.existsSync(path.join(dir, 'source.json'))) continue;
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // in use or locked: tried again on the next read
    }
  }
}

/** Raise when the PSD reader draws layers differently (2: blend modes, clipping, vector masks, shape layers;
 *  4: Import PNG layers keep every part of their own group holding their pixels). */
const PSD_READER_VERSION = 4;

export interface PsdEntry {
  /** Path relative to the library root ("templates/adidas/adidas AUTH.psd"), for /api/library/file. */
  path: string;
  name: string;
  folder: string;
  /** Changes whenever the PSD is saved again (modified time + size). */
  rev: string;
  /** The cache holds a conversion of this exact revision. */
  ready: boolean;
}

/** Every .psd under library/templates, with whether its converted copy is up to date. */
export function listPsd(): PsdEntry[] {
  const out: PsdEntry[] = [];
  if (!fs.existsSync(TEMPLATE_DIR)) return out;
  const visit = (dir: string, rel: string[]) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (d.name.startsWith('.')) continue;
      const full = path.join(dir, d.name);
      if (d.isDirectory()) visit(full, [...rel, d.name]);
      else if (/\.psd$/i.test(d.name)) {
        const st = fs.statSync(full);
        const relPath = [...rel, d.name].join('/');
        const folder = psdFolder(relPath);
        // the reader version is part of it, so PSDs are read again when the way of reading them changes
        const rev = `${Math.round(st.mtimeMs)}-${st.size}-r${PSD_READER_VERSION}`;
        let ready = false;
        try {
          const src = JSON.parse(fs.readFileSync(path.join(PSD_CACHE_DIR, folder, 'source.json'), 'utf8'));
          ready = src.rev === rev && fs.existsSync(path.join(PSD_CACHE_DIR, folder, 'template.json'));
        } catch {
          ready = false;
        }
        out.push({ path: `templates/${relPath}`, name: d.name.replace(/\.psd$/i, ''), folder, rev, ready });
      }
    }
  };
  visit(TEMPLATE_DIR, []);
  return out;
}
