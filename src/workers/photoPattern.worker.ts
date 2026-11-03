/**
 * Runs the jersey photo pattern off the main thread (it takes seconds on a large photo): the photos come in as
 * ImageBitmaps with their boxes, the kit texture goes back as an ImageBitmap.
 */
import { PhotoRect, extractPattern, extractSleeves, buildKitTexture } from '@/utils/photoPattern';
import { recognisePattern, RecognisedPattern } from '@/utils/patternRecognise';

export interface WorkerShot {
  image: ImageBitmap;
  rect: PhotoRect;
  left: PhotoRect;
  right: PhotoRect;
}

export interface PhotoPatternRequest {
  id: number;
  front: WorkerShot;
  back: WorkerShot | null;
  minShare: number;
  withSleeves: boolean;
}

export type PhotoPatternReply =
  | { id: number; palette: string[]; texture: ImageBitmap; recognised: RecognisedPattern | null }
  | { id: number; error: string };

self.onmessage = (e: MessageEvent<PhotoPatternRequest>) => {
  const { id, front, back, minShare, withSleeves } = e.data;
  try {
    const f = extractPattern(front.image, front.rect, minShare);
    const b = back ? extractPattern(back.image, back.rect, minShare, f) : null;
    const sleevesOf = (s: WorkerShot) => extractSleeves(s.image, s.left, s.right, f);
    const sleeves = withSleeves ? { front: sleevesOf(front), back: back ? sleevesOf(back) : null } : null;
    // a regular pattern (stripes, a band, plain) can become a pattern layer instead of colour layers
    let recognised: RecognisedPattern | null = null;
    try {
      recognised = recognisePattern(f, sleeves?.front ?? null);
    } catch {
      recognised = null;
    }
    // an OffscreenCanvas here (see newCanvas in photoPattern)
    const texture = (buildKitTexture(f, b, sleeves) as unknown as OffscreenCanvas).transferToImageBitmap();
    const reply: PhotoPatternReply = { id, palette: f.palette, texture, recognised };
    self.postMessage(reply, { transfer: [texture] });
  } catch (err) {
    const reply: PhotoPatternReply = { id, error: String((err as Error)?.message || err) };
    self.postMessage(reply);
  }
};
