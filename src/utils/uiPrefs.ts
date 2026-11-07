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

/** Size of the whole interface: 'auto' picks by screen width (the layout was made for ~1366 px wide screens). */
export type UiScale = 'auto' | 'small' | 'medium' | 'large' | 'xlarge';

const SCALE_KEY = 'kit-ui-scale';
const SCALE_FACTOR: Record<Exclude<UiScale, 'auto'>, number> = { small: 0.9, medium: 1, large: 1.15, xlarge: 1.3 };

export function getUiScale(): UiScale {
  try {
    const v = localStorage.getItem(SCALE_KEY);
    if (v === 'auto' || v === 'small' || v === 'medium' || v === 'large' || v === 'xlarge') return v;
  } catch {
    /* storage can be blocked */
  }
  return 'auto';
}

/** Zoom factor of a scale; 'auto' is 1.15 on screens 1800 px wide or more (1920 x 1080 at 100 %), else 1. */
export function uiScaleFactor(scale: UiScale = getUiScale(), screenWidth = window.screen.width): number {
  if (scale !== 'auto') return SCALE_FACTOR[scale];
  return screenWidth >= 1800 ? SCALE_FACTOR.large : SCALE_FACTOR.medium;
}

const zoomBridge = () =>
  typeof window === 'undefined' ? undefined : (window as unknown as { okarinZoom?: { set: (f: number) => void } }).okarinZoom;

/** Whether this is the Windows app, which can zoom its own page (a browser tab can't; there Ctrl + / − does it). */
export const canSetUiScale = () => !!zoomBridge();

/**
 * Applies the interface size in the Windows app: the app's own zoom, like the browser's Ctrl + / −, so the canvases,
 * the mouse and the vh-sized dialogs all stay right. (CSS zoom on the page would make 100vh / 100vw layouts overflow.)
 */
export function applyUiScale(): void {
  zoomBridge()?.set(uiScaleFactor());
}

export function setUiScale(v: UiScale): void {
  try {
    localStorage.setItem(SCALE_KEY, v);
  } catch {
    /* ignore */
  }
  applyUiScale();
  window.dispatchEvent(new Event(EVENT));
}

// self-check (runs once at import, cheap)
if (
  uiScaleFactor('auto', 1366) !== 1 ||
  uiScaleFactor('auto', 1920) !== 1.15 ||
  uiScaleFactor('small', 1920) !== 0.9 ||
  uiScaleFactor('xlarge', 1366) !== 1.3
) {
  console.error('uiPrefs scale self-check failed');
}

/** Calls fn whenever a preference changes (returns the unsubscribe). */
export function onPrefsChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
