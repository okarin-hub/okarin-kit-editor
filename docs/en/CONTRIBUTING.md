# Contributing

[Bahasa Indonesia](../id/KONTRIBUSI.md) · [Back to README](../../README.md)

Thanks for wanting to improve Okarin Kit Editor. Forks, issues and pull requests are welcome.

## Ground rules

- **Do not commit other people's assets.** No logos, kit templates, official PES template images, game files or
  artwork from other kit tools. The `library/` contents and `public/templates/` are ignored on purpose; keep it that way.
- Do not copy code or assets from closed-source tools. Write your own implementation.
- Keep the app **offline-friendly**: no hidden network calls. The only ones are the optional logo search and the
  update check.
- By contributing you agree that your contribution is released under the project license (GPL-3.0).

## Setup

```bash
git clone https://github.com/<you>/okarin-kit-editor.git
cd okarin-kit-editor
npm install
npm run dev
```

Check types before you open a PR: `npx tsc --noEmit`.

## How the code is organised

- **One renderer, three outputs.** The 2D canvas, the 3D texture and the exports all call the same functions:
  `src/utils/textureGenerator.ts` (the whole texture), `patternRenderer.ts`, `fabricRenderer.ts`,
  `templateRenderer.ts`, `logoStyle.ts`, `creditRenderer.ts`. If you add a visual feature, put the drawing in a shared
  renderer and call it from both `KitCanvas.tsx` (Konva) and `textureGenerator.ts`, otherwise 2D, 3D and export drift
  apart.
- **Part layout.** `src/constants/pes2021Parts.ts` defines every part with its rectangles and its outline polygons
  (`outline`). Helpers are in `src/utils/partShape.ts`. The texture is 1024 × 1024; the shirt back is stored
  upside-down; the shorts are rotated 90°.
- **State.** `src/app/page.tsx` owns the editor state; the template bundle (`TemplateState`) holds pattern layers,
  background colour, sleeve shape and seam settings so that they are part of undo / redo and the project file.
- **Library API.** `src/app/api/library/*` reads the `library` folder at runtime (`KIT_LIBRARY_DIR`).
- **Export.** `ddsEncoder.ts`, `ddsDecoder.ts`, `ftexEncoder.ts` (FTEX: header + mip infos, mips written smallest
  first, zlib chunks).
- **Menus and panels.** `src/components/ui/` (menu bar `Navbar.tsx`, `ToolRail.tsx`, `Toolbar.tsx`, `TemplatePanel.tsx`
  with collapsible `PanelSection`s, …).

## Translations

The UI text is written in Indonesian in the code and translated on screen from a dictionary:
`src/i18n/dictionary.ts`, one entry per string:

```ts
["Teks Indonesia", "English", "Português", "Español"],
```

Use `{1}`, `{2}` for values that change (`"Diimpor dari {1} ({2} layer)."`). When you add or change a visible string,
add the entry; otherwise it stays Indonesian in every language. To add a language, add a column in
`src/i18n/engine.ts` (`LANGUAGES`, `COLUMN`) and the translations in the dictionary. Text that must never be
translated (names, file names) can be wrapped in an element with the `data-no-i18n` attribute.

## Good first issues

See [Known issues](KNOWN-ISSUES.md): persisting fabric settings in autosave, per-seam options, a measured shorts UV
mapping, a better long sleeve, a safer PSD / PNG importer, code signing, more languages.

## Pull request checklist

- `npx tsc --noEmit` passes.
- 2D, 3D and the exported PNG show the same result for your change.
- New UI strings are in the dictionary.
- No third-party assets were added.
