/**
 * Small interface preferences kept in this browser / app (not in the project file): the zoom speed of the
 * mouse wheel on the 2D canvas, the 3D view and the fontset preview.
 */

export type ZoomSpeed = 'slow' | 'normal' | 'fast';

const KEY = 'kit-zoom-speed';
const FACTOR: Record<ZoomSpeed, number> = { slow: 0.5, normal: 1, fast: 2 };
const EVENT = 'kit-ui-prefs';

export function getZoomSpeed(): ZoomSpeed {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'slow' || v === 'normal' || v === 'fast') return v;
  } catch {
    /* storage can be blocked */
  }
  return 'normal';
}

/** Multiplier for the wheel zoom step (1 = the default speed). */
export const zoomFactor = () => FACTOR[getZoomSpeed()];

export function setZoomSpeed(v: ZoomSpeed): void {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

const CHANNEL_KEY = 'kit-update-channel';

/** Update channel: stable releases only, or experimental (pre-release) ones too. */
export function getUpdateExperimental(): boolean {
  try {
    return localStorage.getItem(CHANNEL_KEY) === 'experimental';
  } catch {
    return false;
  }
}

export function setUpdateExperimental(on: boolean): void {
  try {
    localStorage.setItem(CHANNEL_KEY, on ? 'experimental' : 'stable');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Calls fn whenever a preference changes (returns the unsubscribe). */
export function onPrefsChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
