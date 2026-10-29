/** Writing files into a folder the user picks (File System Access API), or downloading them where it is missing. */

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
 * Asks for a folder and writes `files` into it, confirming before any existing file is overwritten.
 * Returns a status line, or null when the user closed the folder dialog.
 */
export async function saveFilesToFolder(files: OutFile[], pickerId = 'kitserver-kit'): Promise<string | null> {
  const names = files.map((f) => f.name).join(', ');
  const picker = (window as unknown as { showDirectoryPicker?: (o: object) => Promise<FileSystemDirectoryHandle> })
    .showDirectoryPicker;
  if (!picker) {
    files.forEach((f) => downloadFile(f.data, f.name));
    return `Diunduh: ${names}. Taruh di folder kit (misalnya p1).`;
  }
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await picker({ mode: 'readwrite', id: pickerId });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return null;
    throw err;
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
  return `Tersimpan di folder "${dir.name}": ${names}.`;
}
