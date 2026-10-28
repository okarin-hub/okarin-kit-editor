# Known issues and limitations

[Bahasa Indonesia](../id/MASALAH-DIKETAHUI.md) · [Back to README](../../README.md)

Priority: **P1** affects the result, **P2** affects use, **P3** polish. Pull requests that fix any of these are very
welcome (see [Contributing](CONTRIBUTING.md)).

## Tested and untested

- **FTEX export is confirmed to load in PES 2021** (tested by the author).
- **DDS export and 2048 px output have not been tested in the game.** Open the result in an image tool first.
- Only Chrome / Edge (and the Electron build) are tested. Touch screens and small phones are not supported.

## Template import (PSD / PNG) — experimental

| # | Pri | Issue | Idea |
|---|---|---|---|
| 1 | P1 | **Part mapping is a guess.** The part of a layer is guessed from the share of pixels in each area; layers that cross several areas or fill the whole 1024 × 1024 are often attached to the wrong part or to many parts. | Let the user fix the parts in a preview before saving. |
| 2 | P1 | **Official template PSDs produce many useless layers** (mesh, shadows, dotted stitch, UV, background) that become zones and cover the design. | Filter full-size / low-opacity / "mesh", "uv", "background" layers. |
| 3 | P1 | **PSD effects are not carried over:** blend modes, layer effects (shadow, stroke, colour overlay), clipping masks, adjustment layers, smart objects, text and vector shapes. | Support clipping masks and basic blend modes; auto-rasterize. |
| 4 | P2 | Conversion of large PSDs is slow (every layer is processed at 1024 × 1024 on the main thread). | Web Worker, crop masks to their bounding box, parallel upload. |
| 5 | P2 | Masks are stored full size even if the content is small (112 layers ≈ 3.4 MB). | Store cropped masks with an offset. |
| 6 | P2 | Mask zones cannot be edited point by point or get edge shapes. | "Convert mask to polygon". |
| 7 | P2 | A mask is painted with one colour, so grey layers lose their shading. | "Keep luminance" mode. |
| 8 | P2 | PNG split-by-colour is rough: jagged edges, gradients break into many layers, max 80 zones. | Edge smoothing, cluster merging, preview. |
| 9 | P2 | A non-square image is stretched to 1024 × 1024 without a fit / crop choice. | Fit / crop / stretch option. |
| 10 | P3 | Only pixel layers; groups are not kept as folders. PSD fill opacity is ignored. | |

## Templates and layers

| # | Pri | Issue |
|---|---|---|
| 11 | P1 | Built-in template zones were calibrated from the model UV; some are still off at the shoulders, shorts and long sleeves. |
| 12 | P2 | One layer = one shape on all selected parts. Parts sit at different UV positions, so a layer attached to many parts may only cover some of them. |
| 13 | P2 | Dragging a layer on the 3D model can jump over UV seams, and the drag direction is not exactly the mouse direction on shoulders. |
| 14 | P2 | A template you already edited is not updated automatically when its built-in definition changes (re-selecting it resets your edits). |
| 15 | P3 | Layer stitching follows only rectangle / polygon edges; mask layers are not stitched. Per-seam options (colour, thickness, hide) are missing. |
| 16 | P3 | Editing points bakes the transform and edge shape into the polygon. |

## Saving

| # | Pri | Issue |
|---|---|---|
| 17 | P2 | **Fabric texture layer settings are not stored** in autosave or `.peskit` yet; after a reload they return to the defaults. |
| 18 | P3 | Undo / redo does not cover zone selection, point editing in progress, or switching templates. |

## 3D preview

| # | Pri | Issue |
|---|---|---|
| 19 | P2 | **The long sleeve is generated** (a tapered tube): no elbow, no folds, and the shoulder joint can look tight from some angles. The model itself only has short sleeves. |
| 20 | P2 | **The shorts UV is an estimate.** The model uses only x 81–320 of the shorts area, the game uses x 0–330. The preview stretches the outer side (x 81 → 0, about 1.34×) so the 2D area shows in 3D; that factor is not measured from the game model. |
| 21 | P3 | Cloth material is simple (no normal map or realistic lighting). |
| 22 | P3 | Console warnings: three.js `PCFSoftShadowMap has been removed`; Konva warns about more than 5 layers. |

## App and distribution

| # | Pri | Issue |
|---|---|---|
| 23 | P3 | The Windows build is not code-signed (SmartScreen warning) and is large (about 340 MB unpacked, 130 MB zipped) because it bundles Chromium and Node. |
| 24 | P3 | The dev server can take 1–2 minutes to recompile after a change on a slow machine. Use `npm run build && npm start` for daily use. |
| 25 | P3 | **Translations are a dictionary** (`src/i18n/dictionary.ts`) applied to the screen text. A new UI string that is not in the dictionary stays in Indonesian (the source language) in every language. Names that come from your library are never translated. |
| 26 | P3 | *Help → Check for updates* needs internet access and a reachable release feed. |
| 27 | P3 | The 3D model is a third-party asset whose redistribution rights are not clear (see [Credits](CREDITS.md)). |
