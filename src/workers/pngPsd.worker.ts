/**
 * Import PNG -> PSD off the main thread: cutting the chosen colours at 2048 and writing the PSD takes seconds
 * (much longer with other colourways), and the app stays usable meanwhile.
 */
import { initializeCanvas } from 'ag-psd';
import { newCanvas } from '@/utils/psdImport';
import { buildPngPsd, PngPsdRequest } from '@/utils/pngImport';

export type PngPsdReply =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; buf: ArrayBuffer }
  | { type: 'error'; error: string };

initializeCanvas((w, h) => newCanvas(w, h));

self.onmessage = async (e: MessageEvent<PngPsdRequest>) => {
  const reply = (r: PngPsdReply, transfer: Transferable[] = []) => self.postMessage(r, { transfer });
  try {
    const buf = await buildPngPsd(e.data, (done, total) => reply({ type: 'progress', done, total }));
    reply({ type: 'done', buf }, [buf]);
  } catch (err) {
    reply({ type: 'error', error: String((err as Error)?.message || err) });
  }
};
