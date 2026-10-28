/**
 * Packs the app into a Windows folder with "Okarin Kit Editor.exe" (Electron + bundled Next server).
 *
 *   npm run build      (creates .next/standalone)
 *   npm run pack:win   (this script, output in release/)
 *
 * Output: release/Okarin Kit Editor-win32-x64/  (+ a .zip next to it)
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const stage = path.join(root, '.pack');
const standalone = path.join(root, '.next', 'standalone');

// only the public files the app actually loads (the rest are source files / archives)
// only the 3D model is shipped; the optional template overlay (public/templates) is never bundled
const PUBLIC_FILES = ['model/pes_kit.glb'];
const PUBLIC_DIRS = [];

function rm(p) {
  fs.rmSync(p, { recursive: true, force: true });
}
function cp(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

(async () => {
  if (!fs.existsSync(path.join(standalone, 'server.js'))) {
    throw new Error('.next/standalone/server.js tidak ada. Jalankan "npm run build" dulu.');
  }
  rm(stage);

  // 1. the Electron app itself (tiny: main process only)
  const appDir = path.join(stage, 'app');
  cp(path.join(root, 'electron', 'main.cjs'), path.join(appDir, 'electron', 'main.cjs'));
  fs.writeFileSync(
    path.join(appDir, 'package.json'),
    JSON.stringify({ name: 'okarin-kit-editor', version: pkg.version, main: 'electron/main.cjs', description: pkg.description, author: pkg.author }, null, 2)
  );

  // 2. the Next.js server (standalone + static assets + the few public files)
  const server = path.join(stage, 'server');
  cp(standalone, server);
  // file tracing copies the local library (user templates, downloaded logos) into the bundle: remove it
  ['library', 'docs', 'tools', 'scripts', 'release'].forEach((d) => rm(path.join(server, d)));
  // Next's tracing leaves out some runtime folders of the "next" package; fill them from node_modules
  const nextDist = path.join(root, 'node_modules', 'next', 'dist');
  const serverNextDist = path.join(server, 'node_modules', 'next', 'dist');
  for (const entry of fs.readdirSync(nextDist)) {
    if (!fs.existsSync(path.join(serverNextDist, entry))) cp(path.join(nextDist, entry), path.join(serverNextDist, entry));
  }
  cp(path.join(root, '.next', 'static'), path.join(server, '.next', 'static'));
  PUBLIC_DIRS.forEach((d) => cp(path.join(root, 'public', d), path.join(server, 'public', d)));
  PUBLIC_FILES.forEach((f) => fs.existsSync(path.join(root, 'public', f)) && cp(path.join(root, 'public', f), path.join(server, 'public', f)));

  // 3. library template (copied next to the exe on first run): only files tracked in git, so the
  //    user's own templates and downloaded logos never end up in a build
  const libTemplate = path.join(stage, 'library-template');
  fs.mkdirSync(libTemplate, { recursive: true });
  const tracked = execFileSync('git', ['ls-files', '-z', 'library'], { cwd: root, encoding: 'utf8' }).split(String.fromCharCode(0)).filter(Boolean);
  tracked.forEach((f) => cp(path.join(root, f), path.join(libTemplate, path.relative('library', f))));
  fs.mkdirSync(path.join(libTemplate, 'templates'), { recursive: true });

  // 4. package with Electron
  const { packager } = require('@electron/packager');
  const out = path.join(root, 'release');
  rm(out);
  const [dir] = await packager({
    dir: appDir,
    out,
    name: 'Okarin Kit Editor',
    platform: 'win32',
    arch: 'x64',
    overwrite: true,
    asar: true,
    prune: false,
    extraResource: [server, libTemplate],
    appVersion: pkg.version,
    win32metadata: { ProductName: 'Okarin Kit Editor', FileDescription: 'Okarin Kit Editor', CompanyName: pkg.author },
  });

  // 5. readmes, license and the documentation next to the exe + zip
  ['README.md', 'README.id.md', 'LICENSE'].forEach((f) => fs.existsSync(path.join(root, f)) && fs.copyFileSync(path.join(root, f), path.join(dir, f)));
  ['en', 'id', 'examples'].forEach((d) => fs.existsSync(path.join(root, 'docs', d)) && cp(path.join(root, 'docs', d), path.join(dir, 'docs', d)));
  const zip = path.join(out, `Okarin-Kit-Editor-${pkg.version}-win-x64.zip`);
  // bsdtar (built into Windows 10+) writes a standard zip with forward slashes and one top-level folder
  fs.rmSync(zip, { force: true });
  // use the Windows one explicitly: a GNU tar earlier on the PATH (Git Bash) reads "D:\..." as host:path
  const winTar = path.join(process.env.SystemRoot || 'C:\Windows', 'System32', 'tar.exe');
  execFileSync(fs.existsSync(winTar) ? winTar : 'tar', ['-a', '-c', '-f', zip, '-C', out, path.basename(dir)], { stdio: 'inherit' });
  console.log('\nSelesai:', dir);
  console.log('Zip   :', zip);
  rm(stage);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
