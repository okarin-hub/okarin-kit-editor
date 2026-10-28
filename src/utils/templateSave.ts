import { KitTemplate } from '@/types/kit';
import { ConvertedZone } from '@/utils/psdImport';

/** POST helper for /api/library/template-import. */
export async function importPost(body: unknown) {
  const res = await fetch('/api/library/template-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Permintaan gagal.');
  return data;
}

/**
 * Saves converted zones as library/templates/<folder>/ (masks + template.json) and returns the
 * template as validated by the server.
 */
export async function saveConvertedTemplate(
  name: string,
  description: string,
  items: ConvertedZone[],
  onProgress?: (done: number, total: number) => void
): Promise<KitTemplate> {
  if (items.length === 0) throw new Error('Tidak ada layer yang bisa disimpan.');
  const { folder } = await importPost({ action: 'init', name });
  let done = 0;
  for (const it of items) {
    await importPost({ action: 'mask', folder, file: it.maskFile, dataUrl: it.maskDataUrl });
    onProgress?.(++done, items.length);
  }
  const res = await importPost({
    action: 'finish',
    folder,
    template: {
      id: `lib-${folder}`,
      name,
      description,
      zones: items.map((i) => i.zone),
    },
  });
  return res.template as KitTemplate;
}
