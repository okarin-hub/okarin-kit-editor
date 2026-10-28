# Building and packaging

[Bahasa Indonesia](../id/MEMBANGUN.md) · [Back to README](../../README.md)

Requirements: **Node.js 20+** and npm. The Windows package is built on Windows (PowerShell is used to zip it).

## Run in development

```bash
npm install
npm run dev        # http://localhost:3000 (the first compile can take a minute)
```

## Production build in the browser

```bash
npm run build
npm start          # http://localhost:3000
```

## Desktop shell (Electron) from source

```bash
npm run electron:dev
```

The Electron main process (`electron/main.cjs`) starts the Next.js server on a free local port (`127.0.0.1`) and opens a
window. It sets `KIT_LIBRARY_DIR` to the `library` folder next to the exe (or the project's `library/` in dev).

## Package a Windows build

1. Stop `npm run dev` (it shares the `.next` folder with the build).
2. `npm run build` — creates `.next/standalone` (`output: 'standalone'` in `next.config.ts`).
3. `npm run pack:win` — runs `scripts/pack-win.cjs`:
   - copies the standalone server, static files and the 3D model into a staging folder,
   - creates a *library template* from the **files tracked by Git** under `library/` (the READMEs), so your own logos
     and templates never end up in a build,
   - packs everything with `@electron/packager`,
   - adds `README.md`, `README.id.md`, `LICENSE` and `docs/`,
   - zips the result.

Output: `release/Okarin Kit Editor-win32-x64/` and `release/Okarin-Kit-Editor-<version>-win-x64.zip`.

Test it: open the exe, check that the 2D canvas and 3D model appear and that a logo dropped into the `library` folder
next to the exe shows up after *Reload*. Clear the `ELECTRON_RUN_AS_NODE` environment variable if the exe starts as a
plain Node process.

## Configuration

Copy `.env.example` to `.env.local` to change optional settings: Supabase cloud save, the update feed URL, the library
folder (`KIT_LIBRARY_DIR`). None of them is required.

## Releasing

1. Bump `version` in `package.json` (it is shown in *Help → About* and in *Check for updates*).
2. Update [CHANGELOG](CHANGELOG.md) and its Indonesian twin.
3. Build and package as above.
4. Create a GitHub release with the tag `v<version>` and attach the zip.
