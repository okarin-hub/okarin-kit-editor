'use client';

import { useEffect, useState } from 'react';

/** Where the settings of a layer open: under its row in the list, or in a side panel left of the list. */
export type LayerEditorMode = 'inline' | 'side';

const STORAGE_KEY = 'kit-creator-layer-editor';
const CHANGE_EVENT = 'kit-creator-layer-editor-change';

/** The layer editor setting (Settings dialog), kept in localStorage and shared by every component that uses it. */
export function useLayerEditorMode(): [LayerEditorMode, (mode: LayerEditorMode) => void] {
  const [mode, setModeState] = useState<LayerEditorMode>('inline');

  useEffect(() => {
    const read = () => {
      try {
        setModeState(localStorage.getItem(STORAGE_KEY) === 'side' ? 'side' : 'inline');
      } catch {
        // storage blocked: keep the default
      }
    };
    read();
    window.addEventListener(CHANGE_EVENT, read);
    return () => window.removeEventListener(CHANGE_EVENT, read);
  }, []);

  const setMode = (next: LayerEditorMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage blocked: the choice lasts for this session only
    }
    setModeState(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return [mode, setMode];
}
