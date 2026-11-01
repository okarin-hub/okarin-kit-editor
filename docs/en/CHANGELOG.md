# Changelog

[Bahasa Indonesia](../id/CATATAN-RILIS.md) · [Back to README](../../README.md)

## Unreleased

- **Shorts zones of the built-in templates sat a quarter up the leg.** They used the 3D model's coordinates (hem at x 81) instead of the game's (hem at x 0): the shorts trims, side panels and stripes of the Classic, Polo, Raglan, Yoke, Three stripes and Side panels templates now start at the hem. Templates you already edited keep their own zones until you take the update (see below).
- **Pattern from a jersey photo (experimental)** (*File → Pattern from a jersey photo…*): take a product photo of a shirt (front, and the back if you have one) and get its body pattern as colour layers you can edit. The body area is found by itself and can be redrawn; the pattern colours are found with the lighting taken out, and when the pattern colours differ in hue only hue is used, so shading, folds and creases are ignored; each area bounded by sharp edges takes one colour (a fold across a stripe goes with the stripe); the colour areas are drawn as clean vector shapes; logos, sponsors, numbers and names are left out and their area is filled by continuing the pattern along its main direction. The back is read with the front's colours. The result opens in the PNG "split by colour" import. Sleeves get the main colour.
- **Nothing is lost on a reload or in a project file any more:** the fabric texture layers (Fabric tab) are kept in the autosave and in saved projects / `.peskit` files, and a project also holds its kitserver config.txt and the fontset generator settings (fonts, colours, outline, format, pattern, logo with its per-digit shifts). The imported font sheet picture and a logo picked from a file on the computer are not kept (import them again).
- **Sharp letters from a font sheet picture.** Letters that have to be enlarged (a small picture, or the big back number) are traced into vector outlines and drawn at the slot size, instead of enlarging the pixels. The outline is read from the anti-aliased edge with sub-pixel accuracy; corners in any direction keep the picture's own shape: sharp corners are where the straight edges meet, slightly rounded ones get a matching round, straight edges are exactly straight and nearly upright / level ones exactly upright / level, and curves are smooth. The picture's own colours stay inside the outline (two-colour letters and stripes are kept).
- **PNG import: a picture that is not square** can now be stretched (as before), fitted whole (the rest stays empty) or cropped to the square (the middle is kept), in both the "split by colour" and the "1 file = 1 layer" import.
- **Smaller template files:** the masks of imported PSD / PNG templates are saved as only the area they cover, with their position, instead of a full 1024 × 1024 picture each. Templates saved before keep working.
- **No more console warnings** about the removed three.js soft shadow type and about too many Konva layers (the 2D canvas now uses 5 layers).
- **Shaded layers keep their shading:** a grey or shaded PSD / PNG layer that is recoloured with the zone colour now keeps its light and dark (the lightest part gets exactly the zone colour) instead of becoming one flat colour. Import the template again to get it; layers imported before stay flat.
- **Edited built-in templates are told about updates:** when a built-in template you changed gets a newer definition, the Template panel says so. *Use the new version* takes the new built-in zones and keeps your colours and the layers and seams you added yourself (shape changes to built-in zones are lost); *Ignore* hides the notice until the next update.
- **PSD / PNG import a little faster:** each layer is processed only inside its own box, masks are uploaded 4 at a time, and the page is given time to redraw only every 0.1 s (the PES 2019 PSD, 115 layers: about 27 → 23 s in the test browser). The result is the same as before.
- **3D preview: tilt the view.** Hold the middle mouse button (wheel button) and drag up / down to look at the kit from above or below; the view buttons bring the camera back level. Left drag still rotates, the wheel still zooms.

## 0.2.0 — kitserver: config.txt, fontsets and a simpler Layer tab

Number and name fonts made with the fontset generator were tested in PES 2021 as FTEX and show in the game. DDS
output from the generator is not tested in the game yet.

**Everything the editor does in 0.2.0**
- **Canvas and 3D:** 2D canvas and 3D preview with one shared renderer for 2D, 3D and export; real piece shapes,
  seam-free 3D texture, sleeve to the shoulder or without; free navigation and part shortcuts; split view.
- **Parts and colours:** the Layer tab holds every part with its colour editor (colour code, palette, *Match* front ↔
  back / left ↔ right) and its trims; background colour; part colours or an imported design as the base.
- **Patterns and fabric:** pattern layers (type, colour, scale, thickness, opacity, offset, rotation, mirror /
  symmetry, parts, order) and fabric texture layers in the Fabric tab (built-in meshes or your own tiles from
  `library/textures`).
- **Layers and tools:** stitch lines (points or freehand), freehand / point shapes, template zones, pattern eraser.
- **Logos, names and numbers:** logos from `library/logos`, upload or club-logo search, with outline, gradient,
  colour override, presets and *Auto Align* for chest, back, sleeves, shorts and socks; player name, back number and
  shorts number.
- **Templates:** your own templates from a PSD or a PNG split by colour (experimental), kept in `library/templates`.
- **Import and export:** import a finished design (PNG / JPG / WebP / DDS); export PNG, DDS, FTEX (tested in
  PES 2021), project files and a showcase card at 1024 / 2048 px.
- **Kitserver (new):** a config.txt editor and a fontset generator for number and name fonts (below).
- **Interface:** menu bar, tool rail, collapsible panels; English, Bahasa Indonesia, Português, Español; help,
  shortcuts, update check.
- **Windows build** with Electron; the library folder next to the exe starts empty.

**New**
- **Fontset generator (experimental)** (*File → Fontset generator…*): builds the kitserver number and name font textures from any font (built-in, `library/fonts` or installed on the PC) with a fill colour and outline. Back numbers 4096×512, chest and shorts numbers 2048×256, name font 2048×512 and its `_ex` file of accented capitals 2048×1024. Every character goes into the fixed slot measured from modder templates, on one common scale and baseline; accents taller than the space above the capitals are squeezed, never cut. Characters the font lacks are listed. *Save to kit folder…* writes the `.ftex` files (or DDS / PNG for editing elsewhere) and fills their names into config.txt.
  - **From a font sheet image:** import a picture of the letters and/or digits — PNG, JPG or any picture. Before it is read, a dialog shows the picture: drag a box to keep only the area you want, and check how the letters are cut from the background (a plain background is found by itself; for gradients or busy backgrounds pick the background and letter colours and set the tolerance; JPG noise specks are removed). With *Pick letters* the edges keep their anti-aliasing (each edge pixel is read as a mix of letter and background colour, without a background tint), and letters from a small picture are enlarged smoothly instead of showing pixel steps. Rows and characters are found automatically (touching letters are split) and each character is **recognised**: its shape is compared with A–Z / 0–9 in common fonts and the row is aligned with the alphabet order, so a duplicated letter is skipped and a missing one reported instead of shifting the rest. Each row shows its characters with the reading under them (unsure ones in yellow) and can be corrected; characters missing from the picture come from the chosen font in the picture's colour. Optional recolour and outline.
  - **Logo on the numbers:** a club or league badge (from `library/logos` or a file) on every digit, with size, position, opacity, a shift per digit (for digits whose middle is off-centre, like 4 or 7) and an option to cut it to the digit's shape; for back, chest and/or shorts numbers.
  - **Pattern in the characters:** a tile from `library/patterns` over the numbers and/or the name, recoloured or in its own colours, with size and opacity.
- **Kitserver config.txt editor (experimental)** (*File → Kitserver (config.txt)…*): every setting kserv.lua reads (shirt and collar model, name and number positions, shorts number, kit colours, sleeve badges, texture file names) with kserv 1.13's own limits; values outside them are flagged. *Import config.txt* opens an existing one and keeps its comments, order and unknown keys; *Take colours from the kit* fills the colour keys from the part colours. *Save to kit folder…* writes `config.txt` and the kit texture (FTEX DXT5 with mipmaps, without names/numbers) into the kit folder you pick, asking before it overwrites a file; browsers without a folder picker download the two files instead.
- **The Colour tab is now the Fabric tab** and only holds the fabric texture layers. A part's colour, palette and *Match* open in an editor under its row in the Layer tab (click the name or the gear); clicking a part on the canvas or its focus button stays in the Layer tab instead of jumping to another tab.
- **Shorts number:** placed where the leg faces the front below the shirt hem and turned 90° so it reads upright (the leg is stored sideways in the texture, hem at x 0). Projects that still have the old default position are moved automatically. New *Shorts Number Size* slider.
- **Back number:** the size slider goes up to 220 px (was 130) and the number can sit lower on the back (Y up to 400).

**Fixed**
- **Saving fonts or a kit folder failed** with *Must be handling a user gesture to show a file picker* when building
  the textures took more than a few seconds (a slow or hot laptop). The folder is now asked for first, then the files
  are made.
- **Font sheet import on a busy background** (neon lines, glow) merged whole rows into one piece and lost the big
  digits. Shapes are now found one by one, background lines are left out by their shape, big digits next to small
  letters are kept, and rows of the same kind are read together, so an unusual letter at the end of a row is no
  longer swapped with the first letter of the next row.
- **Outline-only (hollow) letters** were dropped as background and **two-colour letters** lost their second colour
  in automatic mode.
- **Jagged letters from a picture:** letters enlarged from a small picture and edges cut with *Pick letters* are
  smoother (not fully smooth yet, see known issue 41).
- **The fontset preview scrolled away** with the settings; the settings and the preview now scroll separately.
- **The focus button and a click on a part** jumped to another tab instead of staying in the Layer tab.
- **The shorts number** used an old guessed position hidden under the shirt hem.
- The value warnings of the config.txt editor were not translated.

## 0.1.1 — fixes and library textures

**New**
- **Fabric textures from the library.** Put tile images (a mesh, knit or weave swatch) in `library/textures` and use them in a fabric texture layer; they show in 2D, 3D and every export. See [Adding your own logos](ADDING-LOGOS.md).
- **PSD import is less noisy.** Layers that only help the artist (mesh, stitch lines, shadows, guides, masks, thin lines, canvas-sized) start unchecked with a reason tag (115 layers become 19 in the official 2019 PSD). After converting you can click a layer to change its parts; the change is saved at once. A ZIP renamed to `.psd` now gives a clear message.
- **PNG import (split by colour) is smarter.** A small area of a colour is no longer lost: the white sponsor lettering on a chest used to be dropped because the same white on socks and cuffs was bigger, so the zone was only attached to those parts. A zone now joins every part that holds a few dozen of its pixels. The empty background is recognised by where it sits (almost no pixels on a kit part) instead of by being the biggest colour, so a navy kit no longer starts with its main colour switched off. Anti-aliasing blends and noise colours are absorbed into the region they border and specks are merged (on a synthetic test the colour list went from 21 to 4 and specks from 2382 to 204).
- **Auto Align** has Right Sock / Left Sock buttons.

**Fixed**
- **A logo moved to another part disappeared from the 3D model and the export.** A logo was clipped to the part it was created on, so a logo added on the chest and then dragged onto the shorts or a sleeve showed in 2D but was cut away in 3D. The part is now the one under the logo's centre.
- **Logo placement on sleeves, shorts and socks.** New logos and the *Auto Align* buttons now land where the part faces the front on the 3D model, rotated to read upright (shorts and sleeves are stored sideways in the texture). Before, a logo on the shorts went to the middle of the area, which the shirt hem covers (only x 0-148 of the 336 px shorts area is visible in the preview), and socks had no default position at all (the logo went to the chest).
- **Rotated logos were misplaced in the 2D canvas.** A logo with a rotation (every logo placed on the shirt back starts at 180°) pivoted on its top-left corner in 2D but on its centre in the 3D preview and the export, so the 2D view showed it shifted by one logo width / height.
- **Converting a PNG / PSD failed** with *part must be one of ...* when a colour or layer fell on the credit area. `credit` is now accepted in templates.
- **Switching between 2D, 3D and split view** no longer rebuilds the 3D scene: the camera and sleeve mode are kept and WebGL contexts are no longer leaked, which could blank the 3D view after many switches.

## 0.1.0 — first public release

Okarin Kit Editor (formerly a private project) is now open source under the GPL-3.0, with a Windows build.

**Canvas and 3D**
- 2D canvas (Konva) and 3D preview (Three.js) with one shared renderer for 2D, 3D and export.
- Real piece shapes for shirt front / back, sleeves, shorts and socks; seam-free texture on the 3D model.
- **Sleeve shape:** to the shoulder (follows the PES template, the shoulder takes the sleeve colour) or without shoulder.
- Free navigation on the 2D canvas (scroll to zoom, drag to pan); part shortcuts focus a part.

**Colour, patterns, fabric**
- **Pattern layers:** several per kit, each with type, colour, scale, thickness, opacity, offset, rotation, mirror /
  symmetry, repeating on / off, part selection and order. Old single patterns migrate automatically.
- **Fabric texture layers** (micro-mesh, honeycomb, twill, ribbing and three jersey meshes) per part, drawn above
  colours, patterns and zones, and over an imported design.
- Trims (cuff, hem, collar, sock top) as layers with an eye toggle; shorts hem on the correct side.
- Background colour, separate from the part colours.
- **Base layer choice:** part colours or an imported design; part colours can be stacked over the design with
  per-part opacity.

**Layers, tools, stitching**
- Stitch lines as layers: by points (optional curve) or freehand; deletable; edge stitching off by default.
- Freehand and point shapes, template zones, pattern eraser brush, all from a Photoshop-style tool rail.

**Logos and text**
- Logos from your own `library/logos` (no built-in logos), upload, club-logo search, ratio lock, X / Y position,
  position presets, colour override, gradient, inside / centre / outside outline.

**Import and export**
- Import a finished design (PNG / JPG / WebP / DDS) as base or overlay.
- Export PNG, DDS, **FTEX** (written directly; tested in PES 2021), project files and showcase card at 1024 / 2048 px.

**Interface**
- Menu bar (File, Edit, View, Preset, Settings, Help), left tool rail, collapsible panel cards.
- Languages: English (default), Bahasa Indonesia, Português, Español.
- Help: documentation, shortcuts, update check, credits, about.

**Packaging**
- Windows build with Electron; the library folder next to the exe starts empty.

See [Known issues](KNOWN-ISSUES.md) for what is still missing.

## 0.0.1 — first private build

A Windows build of the first working editor (colours, patterns, templates, logos, PNG / DDS / FTEX export).
