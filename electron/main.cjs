/**
 * Electron shell for Okarin Kit Editor.
 *
 * Starts the bundled Next.js (standalone) server on a free local port and shows it in a window.
 * The `library` folder (logos, patterns, fonts, templates) lives next to the exe so it can be
 * edited by hand; it is created from the bundled template on first run.
 */
const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { once } = require('node:events');

const REPO = 'okarin-hub/okarin-kit-editor';

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

// localStorage (saved projects, settings) belongs to the page's origin, port included: a fixed port keeps
// the same origin on every launch. A random port is only the fallback when this one is taken.
const PREFERRED_PORT = 47821;

function freePort(want = 0) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(want, '127.0.0.1', () => {
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
  const port = await freePort(PREFERRED_PORT).catch(() => freePort());
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

/**
 * Up to 0.6.1 the server got a random port on every launch, so each launch had its own localStorage and the
 * saved projects of earlier launches went out of sight. Their data is still in the profile: this opens each old
 * origin once in a hidden window (the http requests answered here with an empty page, the real server is not
 * involved), reads its saved projects and merges them into the current origin. Merged ports are remembered.
 */
async function migrateOldOrigins(port) {
  const { session } = require('electron');
  const done = path.join(app.getPath('userData'), 'storage-migrated.json');
  let merged = [];
  try {
    merged = JSON.parse(fs.readFileSync(done, 'utf8'));
  } catch {}
  const dir = path.join(app.getPath('userData'), 'Local Storage', 'leveldb');
  const ports = new Set();
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(ldb|log)$/.test(f)) continue;
      const text = fs.readFileSync(path.join(dir, f)).toString('latin1');
      for (const m of text.matchAll(/http:\/\/127\.0\.0\.1:(\d{2,5})/g)) ports.add(Number(m[1]));
    }
  } catch {
    return;
  }
  ports.delete(port);
  const todo = [...ports].filter((p) => !merged.includes(p));
  if (!todo.length) return;

  const ses = session.defaultSession;
  ses.protocol.handle('http', () => new Response('<!doctype html><title></title>', { headers: { 'content-type': 'text/html' } }));
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  try {
    const projects = {};
    let list = [];
    const ok = [];
    for (const p of todo) {
      try {
        await win.loadURL(`http://127.0.0.1:${p}/`);
        const data = JSON.parse(
          await win.webContents.executeJavaScript(
            `JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('pes_kit_proj_')||k==='pes_kit_creator_saved_projects').map(k=>[k,localStorage.getItem(k)])))`
          )
        );
        for (const [k, v] of Object.entries(data)) {
          if (k === 'pes_kit_creator_saved_projects') {
            try {
              list = list.concat(JSON.parse(v));
            } catch {}
          } else projects[k] = projects[k] && stamp(projects[k]) >= stamp(v) ? projects[k] : v;
        }
        ok.push(p);
      } catch {}
    }
    await win.loadURL(`http://127.0.0.1:${port}/`);
    const result = await win.webContents.executeJavaScript(`(${mergeInto.toString()})(${JSON.stringify({ projects, list })})`);
    if (result.failed) console.warn(`storage migration: ${result.failed} projects did not fit`);
    fs.writeFileSync(done, JSON.stringify([...merged, ...ok]));
  } finally {
    win.destroy();
    ses.protocol.unhandle('http');
  }
}

function stamp(json) {
  return /"updatedAt":"([^"]+)"/.exec(json)?.[1] || '';
}

// runs in the page of the current origin: a project already there is replaced only by a newer copy
function mergeInto({ projects, list }) {
  const LIST = 'pes_kit_creator_saved_projects';
  const at = (s) => (s && /"updatedAt":"([^"]+)"/.exec(s)?.[1]) || '';
  let current = [];
  try {
    current = JSON.parse(localStorage.getItem(LIST) || '[]');
  } catch {}
  const byId = new Map();
  for (const m of [...current, ...list]) {
    if (!m || !m.id) continue;
    const old = byId.get(m.id);
    if (!old || (m.updatedAt || '') > (old.updatedAt || '')) byId.set(m.id, m);
  }
  let failed = 0;
  // newest first, so when the storage quota runs out the oldest projects are the ones left out
  const keys = Object.keys(projects).sort((a, b) => (at(projects[b]) > at(projects[a]) ? 1 : -1));
  for (const k of keys) {
    const here = localStorage.getItem(k);
    if (here && at(here) >= at(projects[k])) continue;
    try {
      localStorage.setItem(k, projects[k]);
    } catch {
      failed++;
    }
  }
  // list only projects whose data is there
  const metas = [...byId.values()].filter((m) => localStorage.getItem('pes_kit_proj_' + m.id));
  metas.sort((a, b) => ((b.updatedAt || '') > (a.updatedAt || '') ? 1 : -1));
  localStorage.setItem(LIST, JSON.stringify(metas));
  return { failed, count: metas.length };
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
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.cjs') },
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
    // a failed migration must not keep the app from opening
    await migrateOldOrigins(port).catch((err) => console.warn('storage migration failed:', err));
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

// ---------------------------------------------------------------- update in place

/**
 * Installs a release from GitHub: downloads its Windows zip, unpacks it, then a small PowerShell script waits
 * for this app to close, copies the new files over the app folder (the library folder is not in the zip, so the
 * user's logos, fonts and templates stay) and starts the app again.
 */
async function installUpdate(event, tag) {
  if (!app.isPackaged || process.platform !== 'win32') throw new Error('Pembaruan otomatis hanya untuk aplikasi Windows.');
  if (!/^v?\d+\.\d+\.\d+$/.test(tag)) throw new Error('Versi tidak valid.');
  const send = (p) => event.sender.send('update:progress', p);

  // the download address comes from GitHub, never from the page
  const rel = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!rel.ok) throw new Error(`Rilis ${tag} tidak ditemukan (${rel.status}).`);
  const info = await rel.json();
  const asset = (info.assets || []).find((a) => /win-x64\.zip$/i.test(a.name));
  const prefix = `https://github.com/${REPO}/releases/download/`;
  if (!asset || !String(asset.browser_download_url).startsWith(prefix)) throw new Error('File Windows untuk rilis ini tidak ada.');

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'okarin-update-'));
  const zip = path.join(work, 'update.zip');
  const res = await fetch(asset.browser_download_url);
  if (!res.ok || !res.body) throw new Error(`Unduhan gagal (${res.status}).`);
  const total = Number(res.headers.get('content-length')) || asset.size || 0;
  let done = 0;
  let last = 0;
  // one chunk at a time, each one copied: a chunk can be a view on a buffer the download fills again, so a chunk
  // still waiting in the file queue was overwritten by later data (seen: parts of the zip 16-80 KB out of place)
  const out = fs.createWriteStream(zip);
  const reader = res.body.getReader();
  const hash = crypto.createHash('sha256');
  try {
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      const chunk = Buffer.from(value);
      hash.update(chunk);
      if (!out.write(chunk)) await once(out, 'drain');
      done += chunk.length;
      if (done - last > 1024 * 1024 || done === total) {
        last = done;
        send({ phase: 'download', done, total });
      }
    }
  } finally {
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
  }
  // GitHub lists a SHA-256 for release files: a download that does not match is never installed
  const want = /^sha256:([0-9a-f]{64})$/i.exec(String(asset.digest || ''))?.[1];
  if (want && want.toLowerCase() !== hash.digest('hex')) throw new Error('File unduhan rusak (hash tidak cocok). Coba lagi.');
  if (total && done !== total) throw new Error('Unduhan tidak lengkap. Coba lagi.');

  send({ phase: 'extract', done: 0, total: 0 });
  const unpacked = path.join(work, 'files');
  fs.mkdirSync(unpacked);
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  execFileSync(tar, ['-x', '-f', zip, '-C', unpacked], { windowsHide: true });
  const top = fs.readdirSync(unpacked).map((d) => path.join(unpacked, d)).find((d) => fs.existsSync(path.join(d, 'Okarin Kit Editor.exe')));
  if (!top) throw new Error('Isi zip pembaruan tidak dikenali.');

  const dest = appDir();
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const script = path.join(work, 'apply-update.ps1');
  fs.writeFileSync(
    script,
    // BOM: Windows PowerShell reads a script without one in the ANSI code page (folder names with accents)
    '﻿' + [
      `$src = ${q(top)}; $dst = ${q(dest)}; $work = ${q(work)}`,
      '# wait until the app (and its server) has closed, so its files are no longer in use',
      '$deadline = (Get-Date).AddSeconds(90)',
      'while ((Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($dst, [StringComparison]::OrdinalIgnoreCase) }) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }',
      '# copy over the app folder; files only the user has (the library) are left alone',
      'robocopy $src $dst /E /R:5 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null',
      "Start-Process -FilePath (Join-Path $dst 'Okarin Kit Editor.exe')",
      'Start-Sleep -Seconds 5',
      'Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue',
    ].join('\r\n'),
    'utf8'
  );
  send({ phase: 'restart', done: 0, total: 0 });
  // started through cmd's `start`: a PowerShell spawned directly by Electron is ended when the app quits
  // (checked: direct spawn 0 of 4 runs survived, `start` 4 of 4). Windows paths cannot hold a double quote.
  spawn('cmd.exe', ['/d', '/s', '/c', `start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${script}"`], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    windowsVerbatimArguments: true,
  }).unref();
  setTimeout(() => app.quit(), 500);
  return { ok: true };
}

ipcMain.handle('update:install', async (event, tag) => {
  try {
    return await installUpdate(event, tag);
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

function stopServer() {
  app.isQuitting = true;
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
}

app.on('before-quit', stopServer);
app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});
