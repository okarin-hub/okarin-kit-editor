/**
 * Electron shell for Okarin Kit Editor.
 *
 * Starts the bundled Next.js (standalone) server on a free local port and shows it in a window.
 * The `library` folder (logos, patterns, fonts, templates) lives next to the exe so it can be
 * edited by hand; it is created from the bundled template on first run.
 */
const { app, BrowserWindow, shell, dialog } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

let serverProcess = null;
let mainWindow = null;

function appDir() {
  // portable layout: <folder>/Okarin Kit Editor.exe + <folder>/library
  return app.isPackaged ? path.dirname(app.getPath('exe')) : path.resolve(__dirname, '..');
}

function serverDir() {
  return app.isPackaged ? path.join(process.resourcesPath, 'server') : path.resolve(__dirname, '..', '.next', 'standalone');
}

function ensureLibrary() {
  const target = path.join(appDir(), 'library');
  if (fs.existsSync(target)) return target;
  const template = app.isPackaged ? path.join(process.resourcesPath, 'library-template') : path.resolve(__dirname, '..', 'library');
  try {
    fs.cpSync(template, target, { recursive: true });
  } catch {
    fs.mkdirSync(target, { recursive: true });
  }
  return target;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function waitForServer(port, timeoutMs = 60000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 2000 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', retry);
      req.on('timeout', () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) reject(new Error('Server tidak merespons'));
      else setTimeout(tryOnce, 400);
    };
    tryOnce();
  });
}

async function startServer() {
  const port = await freePort();
  const library = ensureLibrary();
  const dir = serverDir();
  serverProcess = spawn(process.execPath, [path.join(dir, 'server.js')], {
    cwd: dir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      KIT_LIBRARY_DIR: library,
    },
    stdio: 'ignore',
    windowsHide: true,
  });
  serverProcess.on('exit', (code) => {
    if (!app.isQuitting && code) dialog.showErrorBox('Okarin Kit Editor', `Server berhenti tak terduga (kode ${code}).`);
  });
  await waitForServer(port);
  return port;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0b0e14',
    title: 'Okarin Kit Editor',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(
    'data:text/html;charset=utf-8,' +
      encodeURIComponent(
        '<body style="margin:0;background:#0b0e14;color:#94a3b8;font:14px system-ui;display:flex;align-items:center;justify-content:center;height:100vh">Memulai Okarin Kit Editor…</body>'
      )
  );

  try {
    const port = await startServer();
    await mainWindow.loadURL(`http://127.0.0.1:${port}`);
  } catch (err) {
    dialog.showErrorBox('Okarin Kit Editor', `Gagal memulai aplikasi:\n${err && err.message ? err.message : err}`);
    app.quit();
    return;
  }

  // external links open in the normal browser, downloads (export) stay in the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url) && !url.startsWith('http://127.0.0.1')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(createWindow);
}

function stopServer() {
  app.isQuitting = true;
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
}

app.on('before-quit', stopServer);
app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});
