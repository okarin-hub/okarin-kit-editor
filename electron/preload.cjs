/**
 * The bridges from the page to the app shell: installing an update, and the interface size. For an update the page
 * names a release tag; the main process looks the download up on GitHub itself, so the page cannot make it fetch or
 * run anything else.
 */
const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('okarinZoom', {
  /** Zooms the whole page (like Ctrl + / −); the factor is clamped to 0.5 – 2. */
  set: (f) => {
    const n = Number(f);
    if (Number.isFinite(n)) webFrame.setZoomFactor(Math.min(2, Math.max(0.5, n)));
  },
});

contextBridge.exposeInMainWorld('okarinUpdater', {
  /** Downloads the Windows zip of `tag`, closes the app, copies it over this folder and starts it again. */
  install: (tag) => ipcRenderer.invoke('update:install', String(tag)),
  /** Progress while downloading: { phase: 'download' | 'extract' | 'restart', done, total } */
  onProgress: (cb) => {
    const handler = (_e, p) => cb(p);
    ipcRenderer.on('update:progress', handler);
    return () => ipcRenderer.removeListener('update:progress', handler);
  },
});
