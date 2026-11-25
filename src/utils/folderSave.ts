/** Writing files into a folder the user picks (File System Access API), or downloading them where it is missing. */
import { configFileRefs } from '@/utils/kitConfig';

export interface OutFile {
  name: string;
  data: BlobPart;
}

export const downloadFile = (data: BlobPart, name: string) => {
  const url = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

/**
 * Asks for a folder, then makes the files with `build` and writes them into it, confirming before any existing
 * file is overwritten. The folder is asked first: the browser only opens the picker right after a click, and
 * building textures can take longer than that. Returns a status line, or null when the folder dialog was closed.
 */
export async function saveFilesToFolder(build: () => Promise<OutFile[]>, pickerId = 'kitserver-kit'): Promise<string | null> {
  const picker = (window as unknown as { showDirectoryPicker?: (o: object) => Promise<FileSystemDirectoryHandle> })
    .showDirectoryPicker;
  let dir: FileSystemDirectoryHandle | null = null;
  if (picker) {
    try {
      dir = await picker({ mode: 'readwrite', id: pickerId });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return null;
      throw err;
    }
  }
  const files = await build();
  const names = files.map((f) => f.name).join(', ');
  if (!dir) {
    files.forEach((f) => downloadFile(f.data, f.name));
    return `Diunduh: ${names}. Taruh di folder kit (misalnya p1).`;
  }
  const exists = await Promise.all(files.map((f) => dir.getFileHandle(f.name).then(() => true, () => false)));
  const existing = files.filter((_, i) => exists[i]).map((f) => f.name);
  if (existing.length && !confirm(`Folder "${dir.name}" sudah berisi ${existing.join(', ')}. Timpa?`)) {
    return 'Dibatalkan, tidak ada file yang ditulis.';
  }
  for (const f of files) {
    const w = await (await dir.getFileHandle(f.name, { create: true })).createWritable();
    await w.write(new Blob([f.data]));
    await w.close();
  }
  // a config that names a file the folder does not have (renamed by hand, or not saved there): kitserver would not
  // find it, so say which
  const cfg = files.find((f) => f.name.toLowerCase() === 'config.txt' && typeof f.data === 'string');
  if (cfg) {
    const has = (n: string) => dir.getFileHandle(n).then(() => true, () => false);
    const missing: string[] = [];
    for (const ref of configFileRefs(cfg.data as string)) {
      if (!(await has(`${ref}.ftex`)) && !(await has(`${ref}.dds`))) missing.push(`${ref}.ftex`);
    }
    if (missing.length) {
      return `Tersimpan di folder "${dir.name}": ${names}. Perhatian: config.txt menyebut ${missing.join(', ')}, tapi file itu tidak ada di folder ini (namanya harus sama persis, termasuk garis bawah).`;
    }
  }
  return `Tersimpan di folder "${dir.name}": ${names}.`;
}
