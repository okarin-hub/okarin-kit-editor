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
  collar: 'details', armband: 'details',
};

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isPt = (p: unknown): boolean => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]);
const isBox = (r: unknown): boolean => Array.isArray(r) && r.length === 4 && r.every(isNum);

const INITIAL_KEYS = ['dx', 'dy', 'sx', 'sy', 'rot', 'opacity'] as const;

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
      keepColor: z.keepColor === true ? true : undefined,
      initial,
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

  for (const f of files) {
    const fileName = path.basename(f.full);
    try {
      const json = JSON.parse(fs.readFileSync(f.full, 'utf8'));
      // a folder with a single template.json uses the folder name as the id seed
      const nameSeed = fileName === 'template.json' && f.rel.length ? `${f.rel[f.rel.length - 1]}.json` : fileName;
      templates.push(parseTemplate(json, f.rel, nameSeed));
    } catch (e: any) {
      errors.push({ file: f.rel.length ? `${f.rel.join('/')}/${fileName}` : fileName, error: e?.message || 'JSON tidak valid' });
    }
  }
  return { templates, errors };
}
