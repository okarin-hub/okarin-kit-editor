# Known issues and limitations

[Bahasa Indonesia](../id/MASALAH-DIKETAHUI.md) · [Back to README](../../README.md)

Priority: **P1** affects the result, **P2** affects use, **P3** polish. Pull requests that fix any of these are very
welcome (see [Contributing](CONTRIBUTING.md)).

## Tested and untested

- **FTEX export is confirmed to load in PES 2021** (tested by the author).
- **DDS export works:** the game itself only reads FTEX, and a DDS from the app turned into FTEX with a DDS → FTEX
  tool loads in PES 2021 (tested by the author). DDS is there for other tools and kit makers who need it.
- **2048 px output has not been tested in the game.** Open the result in an image tool first.
- Only Chrome / Edge (and the Electron build) are tested. Touch screens and small phones are not supported.

## Template import (PSD / PNG) — experimental

| # | Pri | Issue | Idea |
|---|---|---|---|
| 1 | P2 | **Part mapping is still a guess.** The part of a layer is guessed from the share of pixels in each area; layers that cross several areas are often attached to the wrong part. After converting, click a layer in the report to change its parts (saved at once). | Show the guess in a preview before saving. |
| 2 | P3 | **Official template PSDs hold many layers that only help the artist** (mesh, shadows, dotted stitch, guides, masks, background). They are now left unchecked by default (115 layers become 19 in the official 2019 PSD, tagged with the reason); *All* still selects them. The filter is by name (English and Japanese) and size, so an unusual name can slip through or a useful layer be tagged. | A preview of each layer. |
| 3 | P2 | **Some PSD effects are still not carried over:** layer styles (drop / inner shadow, stroke, glow, bevel, colour / pattern overlay), adjustment layers and gradient / pattern fill layers; a text layer without pixels is skipped (rasterize it). Blend modes, clipping masks, layer and vector masks, shape layers and group opacity / masks are read. A clipped layer blends with its base layer only, and while one part is focused in the 2D view a blended layer blends only with the template layers (3D and the export are exact). | Layer styles (stroke and drop shadow first). |
| 4 | P3 | Converting a large PSD takes a while (115 layers ≈ 20 s in the test browser) and runs on the main thread. Each layer is now processed only inside its own box and masks are uploaded 4 at a time. | Web Worker. |
| 6 | P2 | Mask zones cannot be edited point by point or get edge shapes. | "Convert mask to polygon". |
| 8 | P2 | PNG split-by-colour is better but still an approximation: anti-aliased edges and noise colours are absorbed into the neighbouring region, but gradients and shaded designs still break into several colours, and there is a maximum of 80 zones. A colour zone joins every part that holds a few dozen of its pixels, so it can list more parts than you expect. | Edge smoothing per zone, a preview of the parts. |
| 10 | P3 | Only pixel layers; groups are not kept as folders. PSD fill opacity is ignored. | |

## Templates and layers

| # | Pri | Issue |
|---|---|---|
| 11 | P2 | Built-in template zones were calibrated from the model UV. The shorts zones now use the game's coordinates (hem at x 0 / 1024); the shoulder and long-sleeve zones have not been checked in the game yet. |
| 12 | P2 | One layer = one shape on all selected parts. Parts sit at different UV positions, so a layer attached to many parts may only cover some of them. |
| 13 | P2 | Dragging a layer on the 3D model can jump over UV seams, and the drag direction is not exactly the mouse direction on shoulders. |
| 15 | P3 | Layer stitching follows only rectangle / polygon edges; mask layers are not stitched. Per-seam options (colour, thickness, hide) are missing. |
| 16 | P3 | Editing points bakes the transform and edge shape into the polygon. |

## Saving

| # | Pri | Issue |
|---|---|---|
| 18 | P3 | Undo / redo does not cover zone selection, point editing in progress, or switching templates. |

## 3D preview

| # | Pri | Issue |
|---|---|---|
| 19 | P3 | **Sleeve and sock length in 3D are preview buttons.** Collar, shorts model, Kappa sleeves and the tight kit follow the kit config, but the game takes sleeve and sock length from the player, so the preview can't know them. (Long sleeves now use the model's own long sleeve, no longer a generated tube.) |
| 20 | P2 | **The shirt hem covers the top of the shorts** in the preview, so a logo placed near the waist of the shorts area is hidden under the shirt. The shorts leg piece (ShortsModel 1–16) shows the outer side from x 17; x 0–17 is not on the model. |
| 21 | P3 | Cloth material is simple (no normal map or realistic lighting). |
| 51 | P3 | **Some wide collars share pixels with the shorts** (e.g. 63–67, 70, 71, 77, 79, 81–86, 90, 100, 102, 103, 106, 107, 110, 114, 125): their model reads x 704–848 (or 205–320) at y 967–972, where the shorts are too. That is the PES texture layout, so in the game too those collar edges show the shorts design there. |
| 49 | P3 | **Not in the 3D model:** Collar 134–135 and ShortsModel 0 / 17 have no model in the CometKIT scene; the preview shows model 1 for them. The scene's PS4 collars are copies of the PC collars and are left out. Goalkeeper sleeves exist only as long sleeves and without a Kappa cut. |
## App and distribution

| # | Pri | Issue |
|---|---|---|
| 23 | P3 | The Windows build is not code-signed (SmartScreen warning) and is large (about 340 MB unpacked, 130 MB zipped) because it bundles Chromium and Node. |
| 24 | P3 | The dev server can take 1–2 minutes to recompile after a change on a slow machine. Use `npm run build && npm start` for daily use. |
| 25 | P3 | **Translations are a dictionary** (`src/i18n/dictionary.ts`) applied to the screen text. A new UI string that is not in the dictionary stays in Indonesian (the source language) in every language. Names that come from your library are never translated. |
| 26 | P3 | *Help → Check for updates* needs internet access and a reachable release feed. |
| 27 | P3 | The 3D model is a third-party asset whose redistribution rights are not clear (see [Credits](CREDITS.md)). |

## Logos, imports and fabric (added in 0.1.1)

| # | Pri | Issue |
|---|---|---|
| 28 | P3 | The 2D canvas shows a logo whole, but the 3D preview and the export clip it to the part under its centre. A logo that straddles two parts shows only the piece inside that part in 3D. |
| 29 | P3 | A logo you drag onto the shorts or a sleeve keeps its rotation. Those parts are stored sideways in the texture, so set the rotation to 90° / -90° (the *Auto Align* buttons and new logos do it for you). |
| 30 | P3 | The logo and sleeve anchors come from the CometKIT model, not from the game. In the game the shirt may cover the shorts differently, so check a finished kit in PES. |
| 31 | P3 | Patterns and fabric textures from the library are stored in the project by file path (logos are embedded). If the file is removed from `library`, the layer is empty after a reload. |
| 32 | P3 | A PSD from the PES 2019 template has a different layout from the 2021 texture, so many layers land on the wrong part; fix them from the report after converting. |
| 33 | P3 | A PSD / PNG import that fails halfway leaves an empty folder in `library/templates`; delete it by hand. |
| 34 | P3 | PNG split-by-colour on a design with a halftone or dither pattern can still produce many small pieces. Raise the colour tolerance. |

## Kitserver and fontsets (added in 0.2.0)

| # | Pri | Issue |
|---|---|---|
| 37 | P3 | **Experimental:** the 3D preview follows *Collar*, *Shorts model*, *Short sleeves model* and *Tight kit* of the config.txt editor. The other values (name/number positions, badges, *Shirt model*, winter collar) are only written to the file: the positions are game units that still need calibrating from in-game screenshots. |
| 38 | P3 | The fontset generator's FTEX output was tested in PES 2021 (numbers and name show in the game); its DDS output is not tested. The character slots come from modder templates (three fontsets agree to ±5 px), not from the game files; one slot of the `_ex` file (between Ę and Ğ) is empty in every sample and is left empty. |
| 39 | P3 | A character missing from the chosen font is drawn with a fallback font; the check compares shapes and can miss a fallback that looks the same. Letters wider than their slot are squeezed sideways. |
| 40 | P3 | Font sheet import: letters that touch are split at the thinnest column, which can cut a little off one of them; recognition compares shapes with common fonts and relies on the sheet being in alphabet order, so very decorative letters or a shuffled sheet need the row text corrected by hand. On a very busy background (neon lines, glow) the automatic cut can still pick up background pieces: use *Pick letters* in the import dialog. A pattern also covers the outline. Accented letters are not built from the sheet yet (they come from the fallback font). |
| 41 | P3 | Letters from a font sheet picture are traced into vector outlines when they are enlarged, so their edges are sharp, but a wobble or a dent that is in the picture itself stays, and very small letters (under about 40 px) can lose their finest details. Use the largest, cleanest picture you have. |
| 42 | P2 | **Pattern from a jersey photo is on hold and still needs refinement.** It works on a product mockup (tested with one kit, front and back) but is an approximation: perspective, the body's curve and folds bend straight lines; with two pattern colours of the same hue (light / dark blue) some shading still shows; the pattern behind a big logo or number is continued along its main direction, so it can break where the pattern turns; the automatic body box leaves out the sides (redraw it to take more). Sleeves and shoulders are taken from the photo (since 0.3.2) but squeezed into the PES sleeve shape: a sleeve box that starts at the shoulder squashes the pattern along the arm, and the long-sleeve area keeps the main colour. Stripes, hoops, slanted stripes, a sash and plain shirts are recognised and rebuilt as a pattern layer (tested with generated mockups only); chevrons, checks, pinstripes and patterns of three or more colours are not yet. Free-form prints (marble, brush strokes, paint splashes) are not recognised and come out poorly as colour layers too: thin accent colours fall under the threshold, and a pattern that lives on the sides is outside the default body box. Still to do: more real test photos. A thin pattern colour under the threshold (default 8 %) is treated as a logo. | Tested again with three colourways of one design (a diagonal sash, a tone-on-tone print, raglan sleeves): the shades of one colour are now one colour, and a sash with a soft edge is kept (recognised as one slanted band); a sash is found by itself (mark it with *+ Pattern colour* when it is not), and plain sleeves in a colour of their own (raglan) take that colour; a patterned sleeve in colours of its own is not read yet.

## Layer tab (added in 0.3.0)

| # | Pri | Issue |
|---|---|---|
| 43 | P3 | Moving a pattern or object to another group and resizing the side panel need a mouse; with the keyboard the arrow buttons only change the order inside a group. |
| 44 | P3 | Patterns are listed at the top of their group but are always drawn under the template layers of that group, so the list order between patterns and template layers is not the drawing order. |
| 45 | P3 | All copies of a repeated object have the same size. Editing the points of a rotated repeated object straightens the repeat direction (it then follows the texture axes). |
| 46 | P3 | **Read PSD:** the PSD is converted by the app while it is open (a 30-layer PSD takes about 10 to 30 seconds). A read-PSD template you changed in the editor (added, deleted or re-assigned layers) is not refreshed when the PSD is saved again; pick it again in the list. Colour slots join layers by their exact grey, so two unrelated layers that happen to have the same flat grey also share a colour, and one layer cannot be taken out of its slot yet. |

## Added in 0.4.0

| # | Pri | Issue |
|---|---|---|
| 47 | P3 | **Update from the app** exists from 0.4.0 on: 0.3.3 and older must download 0.4.0 by hand once. The 0.4.0 updater can fail with "ZIP decompression failed" (fixed in 0.4.1): try again or download the zip by hand. It needs internet access to GitHub and only works in the Windows app (not from source, not in the browser). If the copy fails halfway (a file locked by another program), download the zip again by hand; the `library` folder is never touched. |
| 48 | P3 | The eraser brush keeps a layer's erased spots at 1024 px in the layer's own space; a layer scaled up a lot shows them a little softer. *Save as template* does not take the erased spots along (they stay in the project). |
