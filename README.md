# Okarin Kit Editor

**English** | [Bahasa Indonesia](README.id.md)

A kit editor for **PES 2021**. Design a kit on a 2D texture canvas, see it on a 3D model at the same time, and export
the texture (PNG, DDS or FTEX) for use in the game. It runs in the browser (Next.js) and as a Windows desktop app
(Electron).

> Okarin Kit Editor is an unofficial fan tool. It is not affiliated with Konami. PES / eFootball are trademarks of
> their owners. See [Credits](docs/en/CREDITS.md).

## Download

Ready-to-run Windows build: see the [**Releases**](../../releases) page. Download the `.zip`, extract it, and open
`Okarin Kit Editor.exe` (no installation). Windows SmartScreen may warn because the app is not code-signed: choose
*More info* → *Run anyway*.

The `library` folder next to the exe starts **empty**: add your own logos, patterns, fonts and templates
(see [Adding your own logos](docs/en/ADDING-LOGOS.md)).

## Features

- 2D canvas (Konva) and 3D preview (Three.js) side by side, with the same renderer for both and for the export.
- Part colours, **pattern layers** (several per kit, each with size, rotation, offset, mirror, parts), fabric
  texture layers, trims, collar, captain's armband and credit box.
- **Base layer choice:** part colours, or an imported finished kit design (colours can be stacked on top).
- Sleeve shape: to the shoulder (PES template) or without shoulder.
- Logos and text with ratio lock, X/Y position, colour override, gradient and outline. Your own logo library.
- Stitch lines (by points with optional curve, or freehand), freehand / point shapes, template zones, pattern eraser.
- Player name and number, shorts number.
- Export: **PNG**, **DDS** (DXT1 / DXT5 / BGRA, mipmaps), **FTEX** (written directly, tested in PES 2021),
  `.peskit` project file, showcase card. 1024 or 2048 px.
- Languages: English, Bahasa Indonesia, Português, Español. Undo / redo, autosave, saved projects.

## Run from source

Requirements: Node.js 20+ and npm.

```bash
git clone https://github.com/okarin-hub/okarin-kit-editor.git
cd okarin-kit-editor
npm install
npm run dev        # http://localhost:3000
```

Other commands: `npm run build` (production build), `npm run electron:dev` (desktop shell), `npm run pack:win`
(Windows package). Details in [Building](docs/en/BUILDING.md).

## Documentation

| English | Bahasa Indonesia |
|---|---|
| [User guide](docs/en/USER-GUIDE.md) | [Panduan pengguna](docs/id/PANDUAN-PENGGUNA.md) |
| [Adding your own logos](docs/en/ADDING-LOGOS.md) | [Menambah logo sendiri](docs/id/MENAMBAH-LOGO.md) |
| [Custom templates (JSON)](docs/en/TEMPLATES.md) | [Template sendiri (JSON)](docs/id/TEMPLATE.md) |
| [Known issues](docs/en/KNOWN-ISSUES.md) | [Masalah yang diketahui](docs/id/MASALAH-DIKETAHUI.md) |
| [Building and packaging](docs/en/BUILDING.md) | [Membangun dan mengemas](docs/id/MEMBANGUN.md) |
| [Contributing](docs/en/CONTRIBUTING.md) | [Berkontribusi](docs/id/KONTRIBUSI.md) |
| [Changelog](docs/en/CHANGELOG.md) | [Catatan rilis](docs/id/CATATAN-RILIS.md) |
| [Credits and third-party](docs/en/CREDITS.md) | [Kredit dan pihak ketiga](docs/id/KREDIT.md) |

## Project layout

```
src/app            Next.js app (page.tsx is the editor), API routes for the library folder
src/components     canvas (Konva), 3D viewer (Three.js), UI panels, menus
src/utils          shared renderers (patterns, fabric, template, logos), texture generator, DDS / FTEX encoders
src/constants      PES 2021 part layout (outlines), presets, patterns
src/i18n           translation dictionary and the in-place translator
electron           desktop shell        scripts/pack-win.cjs   Windows packager
library            your logos, patterns, fonts, templates (empty in the repository)
public/model       the 3D preview model
```

## Contributing and forking

Forks and pull requests are welcome. Please read [Contributing](docs/en/CONTRIBUTING.md) first. Do **not** commit
logos, kit templates or other people's artwork to the repository: the `library` folder is ignored on purpose.

## License

[GPL-3.0](LICENSE). Third-party assets and trademarks are listed in [Credits](docs/en/CREDITS.md); they keep their own
terms and are not covered by this license.
