/**
 * Import PNG colour analysis off the main thread: grouping 1024 × 1024 pixels (more with other colourways) takes long
 * enough to stall the tolerance slider on a big picture.
 */
import { analyzeColors, analyzeColorways, median3, shadeMerges, type ColorAnalysis, type ColourVector } from '@/utils/pngImport';
import { detectLogos, labelsWithoutLogos, type LogoDetection } from '@/utils/logoDetect';

export interface PngAnalyzeRequest {
  id: number;
  datas: ImageData[];
  tolerance: number;
  denoise: boolean;
  /** Find logos and sponsors: they become their own layers, and their colours leave the colour list. */
  logos: boolean;
}

/** shades: per cluster the cluster it is a shade of (itself when it is a colour of its own), see shadeMerges */
export type PngAnalysis = ColorAnalysis & { vectors: ColourVector[]; logos?: LogoDetection; shades?: Int32Array };

export type PngAnalyzeReply = { id: number; type: 'done'; analysis: PngAnalysis } | { id: number; type: 'error'; error: string };

self.onmessage = (e: MessageEvent<PngAnalyzeRequest>) => {
  const { id, datas, tolerance, denoise, logos } = e.data;
  try {
    const clean = datas.map((d) => (denoise ? median3(d) : d));
    let analysis: PngAnalysis;
    if (clean.length > 1) analysis = analyzeColorways(clean, tolerance);
    else {
      const one = analyzeColors(clean[0], tolerance);
      analysis = { ...one, vectors: one.clusters.map((c) => [...c.color]) };
    }
    if (logos) {
      const det = detectLogos(analysis.labels, analysis.clusters.map((c) => c.color));
      // the colours are counted without the logos: a colour only found in logos drops to 0 and starts off
      const labels = labelsWithoutLogos(analysis.labels, det);
      const counts = new Array(analysis.clusters.length).fill(0);
      for (let p = 0; p < labels.length; p++) if (labels[p] !== 65535) counts[labels[p]]++;
      analysis = { ...analysis, labels, clusters: analysis.clusters.map((c, i) => ({ ...c, count: counts[i] })), logos: det };
    }
    // with other colourways a shade in one picture can be a colour of its own in another: no shade merging then
    if (clean.length === 1) analysis = { ...analysis, shades: shadeMerges(analysis.labels, analysis.clusters.map((c) => c.color)) };
    const transfer: Transferable[] = [analysis.labels.buffer];
    if (analysis.logos) transfer.push(analysis.logos.map.buffer);
    self.postMessage({ id, type: 'done', analysis } satisfies PngAnalyzeReply, { transfer });
  } catch (err) {
    self.postMessage({ id, type: 'error', error: String((err as Error)?.message || err) } satisfies PngAnalyzeReply);
  }
};
