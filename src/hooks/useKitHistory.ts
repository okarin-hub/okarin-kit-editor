import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KitPartId,
  KitPartConfig,
  KitGraphicItem,
  PlayerMarkingsConfig,
  BaseTexture,
  TemplateBundle,
} from '@/types/kit';

export interface KitSnapshot {
  partsConfig: Record<KitPartId, KitPartConfig>;
  graphicItems: KitGraphicItem[];
  markings: PlayerMarkingsConfig;
  baseTexture: BaseTexture | null;
  patternMask: string | null;
  template: TemplateBundle;
}

const MAX_HISTORY = 100;
// Rapid edits (slider drags, dragging a logo) are merged into one undo step
const COMMIT_DELAY_MS = 400;

/**
 * Snapshot-based undo/redo over the editable kit state.
 * Pass the current state each render; call `undo`/`redo` with a callback that applies a snapshot.
 */
export function useKitHistory(
  current: KitSnapshot,
  apply: (snapshot: KitSnapshot) => void
) {
  const currentRef = useRef(current);
  currentRef.current = current;

  const lastRef = useRef<KitSnapshot | null>(null);
  const pastRef = useRef<KitSnapshot[]>([]);
  const futureRef = useRef<KitSnapshot[]>([]);
  const [, bump] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const now = currentRef.current;
      const last = lastRef.current;
      if (!last) {
        lastRef.current = now;
        return;
      }
      if (
        last.partsConfig === now.partsConfig &&
        last.graphicItems === now.graphicItems &&
        last.markings === now.markings &&
        last.baseTexture === now.baseTexture &&
        last.patternMask === now.patternMask &&
        last.template === now.template
      ) {
        return;
      }
      pastRef.current.push(last);
      if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift();
      futureRef.current = [];
      lastRef.current = now;
      bump((v) => v + 1);
    }, COMMIT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [
    current.partsConfig,
    current.graphicItems,
    current.markings,
    current.baseTexture,
    current.patternMask,
    current.template,
  ]);

  const undo = useCallback(() => {
    const target = pastRef.current.pop();
    if (!target) return;
    futureRef.current.push(currentRef.current);
    lastRef.current = target;
    apply(target);
    bump((v) => v + 1);
  }, [apply]);

  const redo = useCallback(() => {
    const target = futureRef.current.pop();
    if (!target) return;
    pastRef.current.push(currentRef.current);
    lastRef.current = target;
    apply(target);
    bump((v) => v + 1);
  }, [apply]);

  return {
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
