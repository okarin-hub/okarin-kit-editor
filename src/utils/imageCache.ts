/**
 * Shared in-memory image cache. Rendering code (texture generator, pattern renderer) draws
 * synchronously, so every image must be loaded into this cache first. Whenever something new
 * finishes loading (image or font) subscribers are told so they can redraw.
 */

const imageCache: Map<string, HTMLImageElement> = new Map();
const pending: Map<string, Promise<HTMLImageElement>> = new Map();
const listeners: Set<() => void> = new Set();

export function subscribeAssets(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyAssetsChanged(): void {
  listeners.forEach((l) => l());
}

export function getCachedImage(src: string): HTMLImageElement | undefined {
  const img = imageCache.get(src);
  return img && img.complete && img.naturalWidth > 0 ? img : undefined;
}

export function preloadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);

  const inflight = pending.get(src);
  if (inflight) return inflight;

  const promise = new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      pending.delete(src);
      resolve(img);
      notifyAssetsChanged();
    };
    img.onerror = () => {
      pending.delete(src);
      resolve(img);
    };
    img.src = src;
  });
  pending.set(src, promise);
  return promise;
}
