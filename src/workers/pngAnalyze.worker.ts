/**
 * Import PNG colour analysis off the main thread: grouping 1024 × 1024 pixels (more with other colourways) takes long
 * enough to stall the tolerance slider on a big picture.
 */
import { analyzeColors, analyzeColorways, median3, type ColorAnalysis, type ColourVector } from '@/utils/pngImport';

export interface PngAnalyzeRequest {
  id: number;
  datas: ImageData[];
  tolerance: number;
  denoise: boolean;
}

export type PngAnalyzeReply =
  | { id: number; type: 'done'; analysis: ColorAnalysis & { vectors: ColourVector[] } }
  | { id: number; type: 'error'; error: string };

self.onmessage = (e: MessageEvent<PngAnalyzeRequest>) => {
  const { id, datas, tolerance, denoise } = e.data;
  try {
    const clean = datas.map((d) => (denoise ? median3(d) : d));
    let analysis: ColorAnalysis & { vectors: ColourVector[] };
    if (clean.length > 1) analysis = analyzeColorways(clean, tolerance);
    else {
      const one = analyzeColors(clean[0], tolerance);
      analysis = { ...one, vectors: one.clusters.map((c) => [...c.color]) };
    }
    self.postMessage({ id, type: 'done', analysis } satisfies PngAnalyzeReply, { transfer: [analysis.labels.buffer] });
  } catch (err) {
    self.postMessage({ id, type: 'error', error: String((err as Error)?.message || err) } satisfies PngAnalyzeReply);
  }
};
