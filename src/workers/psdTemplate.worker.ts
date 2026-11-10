/**
 * Reads a PSD from library/templates and turns it into a template in the background: every useful layer
 * becomes a mask (sent to the template import route as it is made), then the template JSON is written to
 * library/templates/.psd/<name>. Helper layers are left out; colour slots and variants are found from the
 * layer greys and names.
 */
import { initializeCanvas } from 'ag-psd';
import { parsePsd, convertLayer, assignSlots, newCanvas } from '@/utils/psdImport';

export interface PsdSyncRequest {
  path: string;
  name: string;
  rev: string;
}

export type PsdSyncReply =
  | { type: 'progress'; path: string; done: number; total: number }
  | { type: 'done'; path: string }
  | { type: 'error'; path: string; error: string };

const MAX_LAYERS = 150;

initializeCanvas((w, h) => newCanvas(w, h));

const post = async (body: Record<string, unknown>) => {
  const res = await fetch('/api/library/template-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || `Server menjawab ${res.status}`);
  return data;
};

const toDataUrl = async (c: HTMLCanvasElement) => {
  const blob = await (c as unknown as OffscreenCanvas).convertToBlob({ type: 'image/png' });
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
};

self.onmessage = async (e: MessageEvent<PsdSyncRequest>) => {
  const { path, name, rev } = e.data;
  const reply = (r: PsdSyncReply) => self.postMessage(r);
  try {
    const res = await fetch(`/api/library/file?p=${encodeURIComponent(path)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`PSD tidak bisa dibaca (${res.status})`);
    const parsed = await parsePsd(new File([await res.arrayBuffer()], `${name}.psd`));
    const useful = parsed.layers.filter((l) => !l.junk);
    const chosen = (useful.length ? useful : parsed.layers).slice(0, MAX_LAYERS);
    if (!chosen.length) throw new Error('Tidak ada layer piksel yang bisa dibaca.');

    const { folder } = await post({ action: 'init', psd: path });
    const zones: Record<string, unknown>[] = [];
    const flats: { flat?: string; pixels: number }[] = [];
    // layer key -> zone id, for clipping masks (a base layer always comes before the layers clipped to it)
    const ids = new Map<string, string>();
    let idx = 0;
    for (const [k, info] of chosen.entries()) {
      const out = convertLayer(info, parsed.width, parsed.height, idx);
      if (out) {
        await post({ action: 'mask', folder, file: out.maskFile, dataUrl: await toDataUrl(out.maskCanvas) });
        ids.set(info.key, String(out.zone.id));
        // a layer clipped to a layer that was left out (helper, empty) is drawn as a normal layer
        const clipTo = info.clipBase ? ids.get(info.clipBase) : undefined;
        if (clipTo) out.zone.clipTo = clipTo;
        zones.push(info.variant ? { ...out.zone, variant: info.variant } : out.zone);
        flats.push({ flat: out.flat, pixels: out.pixels });
        idx++;
      }
      reply({ type: 'progress', path, done: k + 1, total: chosen.length });
    }
    if (!zones.length) throw new Error('Semua layer kosong.');
    assignSlots(zones, flats, parsed.sharedSlots);
    await post({
      action: 'finish',
      folder,
      psd: path,
      rev,
      template: { name, description: `Dibaca langsung dari ${path.replace(/^templates\//, '')} (${zones.length} layer).`, zones },
    });
    reply({ type: 'done', path });
  } catch (err) {
    reply({ type: 'error', path, error: String((err as Error)?.message || err) });
  }
};
