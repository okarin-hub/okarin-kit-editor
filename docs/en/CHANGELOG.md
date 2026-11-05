# Changelog

[Bahasa Indonesia](../id/CATATAN-RILIS.md) · [Back to README](../../README.md)

## 0.4.1 (experimental) — PSD effects, rename / delete library templates

- **More of a PSD is kept (Read PSD):** blend modes (multiply, screen, overlay, soft / hard light, darken, lighten
  and the rest; linear burn / dodge and the vivid / linear / pin lights get the closest the app has), **clipping
  masks** (a clipped layer shows only inside its base layer and hides with it), **vector masks**, **shape and
  solid colour fill layers** (drawn from their colour and outline; before they were skipped), and the opacity,
  fill opacity, blend mode and masks of **groups**. The blend modes and clipping also follow the layer's colour
  when you change it. Every PSD in the library is read once more after the update.
- **Rename or delete a library template from the app:** under the template list, *Rename* and *Delete* show for a
  template that is a file in `library/templates` (a JSON template, a folder with its masks, or a PSD). Renaming a
  PSD renames the file and keeps its converted copy, so it is not read again. Deleting asks first, and warns when
  the open kit uses that template's layer images.
- **No more leftovers:** the converted copy in `library/templates/.psd` is removed when its PSD is deleted or
  moved away (known issue #46).

- **DDS export confirmed:** a DDS from the app, turned into FTEX with a DDS → FTEX tool, loads in PES 2021. The
  known issue and the guide no longer call it untested.

## 0.4.0 — Stable: eraser per layer, text editing, reshaping stitch lines, update from the app

This release makes the 0.3.x features (PSD templates from the library, Import PNG, the Template tab) part of a
stable version, together with the changes below.

- **Guides:** the user guide (EN / ID), the README and *Help → Guide* describe the Template tab, Read PSD, Add PSD,
  Import PNG, the eraser per layer, text editing, zoom speed and updating from the app.

- **Eraser brush per layer:** select a layer first and the eraser (left bar, E) erases only that layer where you
  brush (a watermark, an unwanted logo in an imported PSD / PNG, or part of any other layer); with no layer
  selected it erases the patterns, as before. The bar shows what it erases; *Restore* and *Reset* work on that
  layer only. The erased spots stick to the layer: they move, turn and scale with it, also when it is turned into
  editable points or dragged to another part. The strokes are saved in the project and can be undone. Same in 2D,
  3D and the export.
- **Easier points:** the edit points of a shape are bigger and easier to grab, the "+" on very short sides is
  hidden, and a freehand shape keeps fewer points.
- **Stitch lines can be reshaped:** *Edit points* on a stitch line (Layer tab, Stitch lines): drag a point, click
  a "+" to add one, right-click a point to remove it.
- **Zoom speed:** View, *Zoom speed (scroll)*: slow, normal or fast, for the 2D canvas, the 3D view and the fontset
  preview.
- **Logo outline corners:** *Corners* round or sharp; sharp follows the logo's corners (traced as a vector).
- **Text:** *Add text* shows a live preview before it is added, and a text can be edited afterwards: the words,
  font, letter size, colour, outline and shadow. Dragging the corner of a text box scales the letters. The 2D view
  now shows exactly what the export draws (before, it always added a shadow, drew the outline over the letters
  and wrapped long text onto a second line, which the 3D view and the export did not).
- **Fontset generator:** the preview zooms (−, +, Fit, and the mouse wheel). Picking or moving a logo on the numbers
  is much quicker (the letters are no longer made again for every change), and a picked logo no longer jumps back
  to "(no logo)" (the cause of the flickering list).
- **Update from the app (Windows):** Help, *Check for updates*: *Download and install* fetches the new version from
  GitHub, closes the app, puts the new files in place (the library folder is left alone) and opens it again.
  *Include experimental releases* also offers pre-releases.
- **Translations:** the remaining Indonesian texts in English / Portuguese / Spanish were translated (fontset
  "Brightness cut", the shape end hints, a few labels).

## 0.3.3 (experimental) — PSD templates read from the library, PNG import that writes a PSD

- **No more Indonesian in the other languages:** missing translations were added (server messages, fontset
  sliders, the name and number preview on the canvas, drop-down group headings, layer names written by Import
  PNG such as "Colour 2 – Shorts", the default colour names in Import PNG). Checked by scanning the source and the
  English interface.
- **Explanations behind a ?:** the short explanations under options (Import PNG, the font sheet crop, the photo
  pattern, logo colour, pattern repeat and tint, the original-colour switch of a layer) moved into a ? next to
  the option; hover or click it to read.
- **Import PNG: merge colours, pick from the preview, clean up noise:** each colour has *Merge into…* (a shade that
  split off joins its colour instead of tuning the tolerance for everything); a click on the preview highlights
  the colour under it in the list and dims the rest, and *Enlarge preview* shows it full width. *Clean up noise*
  (on by default for WebP / JPG) smooths compression speckles before the colours are grouped. The conversion runs
  in the background, so the app stays usable meanwhile (three colourways at 2048 take about a minute and a half).
- **Import PNG: other colourways:** *Other colourways* takes up to two more pictures of the same template in other
  colours. Pixels that change colour together form one layer, so areas that share a colour in one version (two
  greens of a camo) are still told apart by the others.
- **Import PNG: smooth gradients:** with *Smooth gradient*, tick only the end colours of a gradient or blurred
  design; the shades in between become a blend of the two layers, so the gradient stays when a colour is changed
  (a teal zigzag turned red keeps its fades). Ticking *Smooth gradient* unticks the colours that are only a
  blend of two others, and each colour may now reach its whole part group, so a long fade is no longer cut into
  blocks halfway.
- **Import PNG makes a PSD:** *Split by colour* now saves the chosen colours as a layered PSD in
  `library/templates` (one flat layer per colour and part group, so a colour on the shirt and the shorts shows in both the Shirt
  and the Shorts group; the largest colour is *Base* and fills its whole group under the others; every group's *Base* is its own colour slot, so the shirt, shorts
  and socks can have different base colours). The colours are cut at 2048 px with
  soft edges taken from the picture (stripes and logos stay smooth), and a pixel between two colours is blended
  instead of being given to one of them, which is then read like any PSD:
  every colour is a colour slot, the base sits under the patterns, and the PSD can be cleaned up in Photoshop and
  saved again. Colours that sit almost only in the armband or credit area (template site watermarks) start
  unticked. *One file per layer* still makes a template directly.
- **Flat colour layers in a PSD are recolourable:** a layer that is one colour (not only a grey) becomes a colour
  slot with that colour as its default.
- **Smaller panel tabs:** the tabs on the right show only their icons; the open tab also shows its name.
- **Read PSD: PSD files in the library become templates by themselves:** put a `.psd` anywhere in
  `library/templates` and it is read in the background when the app opens or on *Reload* (the status shows
  *Reading PSD … (12/30)*), then listed under *Read PSD* in the template list. Save the PSD again in Photoshop and
  *Reload* reads it again; an open template takes the new layers and keeps its colours and choices. The converted
  copy is kept in `library/templates/.psd`, so a PSD is only read again when it changes.
- **Add PSD replaces Import PSD:** *Add PSD* copies the chosen file into `library/templates` (a file of the same
  name is replaced, like saving it again); it is then read like any PSD there and opened once it is ready. Pick
  layers by hiding or deleting them in the Layer tab, and *Save as template* makes an editable copy.
- **Template tab:** the template choice, *Kit base* and *Save as template* moved to their own *Template* tab, so
  the *Layer* tab holds only the layers, patterns and stitch lines.
- **The Base layer of a PSD sits under the patterns:** a full-size *Base* layer is drawn with the base colour of
  the parts, so pattern layers show on top of it (before, it covered them). With *Imported design* as the kit base
  it is not drawn, like the part colours.
- **Fix:** a layer that covers the whole kit (a PSD *Base* layer) now reaches the sleeves, shorts and socks too;
  before, a part only joined when it held 15% of the layer.
- **Grey-coded PSD templates: colour slots and variants:** in a PSD where every layer is one flat grey (the
  adidas / Nike / Puma template sets shared in the community), layers of the same grey now share one colour.
  *Colour slots* at the top of the Layer list changes them all at once, and changing one of those layers changes
  the rest too. Alternatives such as *Collar 1 / 2 / 13*, *Seams / Seams v2* or *Authentic 1 / 2* (one shown, the
  others hidden) become one choice each, with *None* to hide them all. Full-size *Base* and *Seams* layers are no
  longer unticked as backdrops, and the backdrop around a flat Base layer is dropped.
- **Regular patterns from a jersey photo become pattern layers:** *Pattern from a jersey photo* now recognises
  stripes at any angle (vertical, horizontal / hoops, slanted), a single band (a sash, a centre stripe) and plain
  shirts. It shows *Pattern recognised: …* with the stripe width and spacing, and *Use as a pattern layer* sets the
  base colours of the shirt and sleeves and adds the pattern as an editable pattern layer in the Shirt group (on the
  sleeves too when they are striped in the photo). Shading and folds that split a colour into a lit and a dark
  shade are joined first. Irregular patterns and patterns of three or more colours keep the colour-layer route.
  A model must also cover the pattern's own pixels, so a mostly plain shirt with a few strokes is not taken for a
  band. A colour that is only the blend of two others (the soft edge of a brush stroke) is no longer kept as a
  pattern colour.
- **One-colour logo on the numbers:** *Logo colour* in *Logo on the numbers* turns the badge into one colour of your
  choice, traced as a sharp vector shape. *One colour – silhouette* fills the whole logo; *One colour – detail* keeps
  its dark parts (the light parts become holes) with a *Brightness cut*, and *Invert* colours the light parts instead.
  A JPG logo on a plain background works too: only the background joined to the picture edge is left out, so a white
  centre or white letters inside the logo stay part of it.
- The letter size slider of the fontset generator is now called *Letter size %* (it had the same name as the logo
  size).
- **Pattern from a jersey photo no longer freezes the editor:** the pattern is worked out in the background (a web
  worker); *Processing…* shows next to *Result* meanwhile, and moving a box again drops the older run.
- **Letters from a font sheet keep their own width:** they were measured with the empty margin of their cut-out, so
  they were placed and squeezed as if wider than they are (they came out slimmer than in the picture). They are now
  measured by the letter itself, like font letters; letters wider than their slot are marked by the size warning.

## 0.3.2 (experimental) — sleeves from a jersey photo, letter size and outline position in the fontset generator

An experimental pre-release: the new parts work but still need refinement. Stay on 0.3.1 for a stable version.

- **Sleeves and shoulders from a jersey photo:** *Pattern from a jersey photo* now also takes the pattern of the
  sleeves and the shoulders (they only got the main colour before). Each photo gets two yellow sleeve boxes next to the
  body box, guessed from the shirt's outline; pick *Left sleeve in the picture* / *Right sleeve in the picture* above
  the photos to redraw one. The slanted sleeve is straightened (each row stretched from the outer to the inner edge of
  the shirt), the front photo fills the front half of each sleeve and the back photo the back half (without a back
  photo the front is used for both), and the shoulder strip up to the neck continues the top of the sleeve. The sleeves
  are read in the body's pattern colours. *Sleeves and shoulders from the photo* turns it off.
- **Letter size and outline position in the fontset generator:** *Size %* (50–150) makes the numbers or the name
  letters bigger or smaller on the baseline, for fonts that come out small in their slots. *Outline position* puts the
  outline outside the letter (as before), centred on its edge or inside it (inline). Letters that cross their slot box
  are marked with a yellow box and listed under the preview, and *Save to kit folder…* asks before saving them (in the
  game they would be squeezed or cut off).

## 0.3.1 — font sheets: vertical sheets and smoother letters

- **Smoother letters from small font sheets:** the automatic background separation cut the anti-aliased edge into hard pixel steps (the edge kept 66 of about 300 partly covered pixels on a 145 px digit), and enlarged three times the steps showed as jagged edges. An edge pixel now keeps the share of letter it holds (the mix between the measured background and letter colours), so the traced outline follows the real edge, and its colour has the old background taken out (no dark rim). The traced curves also lost two sources of small dents: the two handles at a curve point now keep one direction (they were turned apart on long segments, a small kink at each point), and a small letter that will be enlarged is smoothed a little more, since its picture carries no detail under half a pixel. Near-level / near-upright sides are straightened only when the straight line still lies on the outline.
- **A hole closed in letters from a picture:** a hole with one sharp corner (the lower hole of an 8 in some fonts) was traced as a flat line and filled in, with a dotted ring left at its edge. Single stray pixels at the edge of a badge no longer leave pinholes in the character either.
- **Recolouring a font sheet keeps its logos:** *Replace the picture's colour with the fill colour* now changes only the main colour of each character; colours that are clearly different (a club badge on the numbers, a second colour) stay as they are. The anti-aliased edge follows the new colour.
- **Vertical font sheets:** a font sheet picture with one character per row (a column of digits, read top to bottom) is now read as one row; before, every row was dropped as a lone mark and nothing was found. Dim sheets also read better: the threshold that separates the characters from the background now follows the picture's own contrast (dark grey digits on black are found).

## 0.3.0 — a tidier editor: patterns and objects in the layer groups

The Layer tab is reorganised: patterns and shape objects live in the shirt, shorts, socks and accessories groups and
are moved between them by dragging; explanations moved into **?** tips and *Help → Guide*. Also new: repeated
objects, a side panel for layer settings, a Settings dialog, keyboard shortcuts and the experimental pattern from a
jersey photo.

**Everything the editor does in 0.3.0**
- **Canvas and 3D:** 2D canvas and 3D preview with one shared renderer for 2D, 3D and export; real piece shapes,
  seam-free 3D texture, sleeve to the shoulder or without; free navigation, a part list to zoom onto a part, 3D tilt;
  split view.
- **Layer tab:** groups for shirt, shorts, socks and accessories, each with its template layers, **patterns** (type,
  colour, scale, thickness, opacity, offset, rotation, mirror / symmetry, parts of the group, order) and **objects**
  (stripe, panel, ellipse, triangle, with repeat); drag between groups, search, PSD helper layers in their own list;
  part colours with colour code, palette and *Match*; trims; background colour; part colours or an imported design as
  the base. Settings open under the row or in a resizable side panel.
- **Fabric:** fabric texture layers in the Fabric tab (built-in meshes or your own tiles from `library/textures`).
- **Tools:** stitch lines (points or freehand), freehand / point shapes, pattern eraser.
- **Logos, names and numbers:** logos from `library/logos`, upload or club-logo search, with outline, gradient,
  colour override, presets and *Auto Align*; player name, back number and shorts number.
- **Templates:** built-in templates (with an update notice for edited copies) and your own from a PSD or a PNG split
  by colour (experimental), kept in `library/templates`.
- **Import and export:** import a finished design (PNG / JPG / WebP / DDS); export PNG, DDS, FTEX (tested in
  PES 2021), project files and a showcase card at 1024 / 2048 px.
- **Tools menu (experimental):** pattern from a jersey photo, fontset generator for kitserver number and name fonts,
  kitserver config.txt editor.
- **Interface:** menu bar, tool rail, keyboard shortcuts, collapsible panels; Settings (language: English, Bahasa
  Indonesia, Português, Español; layer settings); guide, shortcut list, update check.
- **Windows build** with Electron; the library folder next to the exe starts empty.

**New**
- **Settings and a side panel for layers.** *Edit → Settings…* (`Ctrl+,`) holds the language and the layer settings: open under the row (as before) or in a side panel left of the layer list, so the list stays short; the side panel can be resized from its left and bottom edges (remembered). Duplicate and delete moved onto the layer row next to focus, and *Reset* to the top of the layer's settings, so there is no need to scroll down for them.
- **Objects next to patterns.** Each group of the Layer tab also has **+ Object** (stripe, panel, ellipse, triangle), replacing the *Add layer on* row. Objects can be dragged to another group like patterns (they are placed and resized onto the new part; `Ctrl` copies). New *Repeat* setting: one object drawn 2, 3 or more times in a row, with count, gap and direction, without extra layers; saved templates get the copies as real shapes.
- **Patterns in the layer groups.** The separate *Pattern layers* card is gone: each group of the Layer tab (Shirt, Shorts, Socks, Accessories) has **+ Pattern** and lists its patterns at the top. Drag a pattern row onto another group to move it, hold `Ctrl` when you drop it to copy it; the part checkboxes became buttons for the parts of the group.
- **A tidier editor.** The Layer tab groups layers by shirt, shorts, socks and accessories (big groups start closed), gathers PSD helper layers (mesh, guides, stitches, shadows, background) in their own closed list, and adds a search field when there are many layers; row buttons show on hover. Explanations moved from always-visible paragraphs into a **?** next to each heading and into *Help → Guide*. One accent colour: blue for what is active or selected, red only for the main action (Export), amber only for experimental / warnings; muted text has more contrast and nothing is smaller than 10 px. The menu bar is *File · Edit · View · Tools · Help*: colour presets are in *Edit*, the experimental tools (pattern from a photo, fontset generator, kitserver config.txt) in *Tools*, the language in *Edit → Settings*. The part strip under the canvas is replaced by a part list in the toolbar.
- **Keyboard shortcuts:** `V` `B` `P` `S` `J` `E` pick a tool, `1` / `2` / `3` switch 2D / Split / 3D, `Ctrl+S` opens the projects, `Ctrl+E` the export, `?` the shortcut list. *New kit* asks before replacing the kit. Keyboard focus is always visible, dialogs are announced as dialogs, and icon buttons have names for screen readers.
- **Pattern from a jersey photo (experimental)** (*Tools → Pattern from a jersey photo…*): take a product photo of a shirt (front, and the back if you have one) and get its body pattern as colour layers you can edit. The body area is found by itself and can be redrawn; the pattern colours are found with the lighting taken out, and when the pattern colours differ in hue only hue is used, so shading, folds and creases are ignored; each area bounded by sharp edges takes one colour (a fold across a stripe goes with the stripe); the colour areas are drawn as clean vector shapes; logos, sponsors, numbers and names are left out and their area is filled by continuing the pattern along its main direction. The back is read with the front's colours. The result opens in the PNG "split by colour" import. Sleeves get the main colour.
- **Sharp letters from a font sheet picture.** Letters that have to be enlarged (a small picture, or the big back number) are traced into vector outlines and drawn at the slot size, instead of enlarging the pixels. The outline is read from the anti-aliased edge with sub-pixel accuracy; corners in any direction keep the picture's own shape: sharp corners are where the straight edges meet, slightly rounded ones get a matching round, straight edges are exactly straight and nearly upright / level ones exactly upright / level, and curves are smooth. The picture's own colours stay inside the outline (two-colour letters and stripes are kept).
- **PNG import: a picture that is not square** can now be stretched (as before), fitted whole (the rest stays empty) or cropped to the square (the middle is kept), in both the "split by colour" and the "1 file = 1 layer" import.
- **Smaller template files:** the masks of imported PSD / PNG templates are saved as only the area they cover, with their position, instead of a full 1024 × 1024 picture each. Templates saved before keep working.
- **Shaded layers keep their shading:** a grey or shaded PSD / PNG layer that is recoloured with the zone colour now keeps its light and dark (the lightest part gets exactly the zone colour) instead of becoming one flat colour. Import the template again to get it; layers imported before stay flat.
- **Edited built-in templates are told about updates:** when a built-in template you changed gets a newer definition, the Template panel says so. *Use the new version* takes the new built-in zones and keeps your colours and the layers and seams you added yourself (shape changes to built-in zones are lost); *Ignore* hides the notice until the next update.
- **PSD / PNG import a little faster:** each layer is processed only inside its own box, masks are uploaded 4 at a time, and the page is given time to redraw only every 0.1 s (the PES 2019 PSD, 115 layers: about 27 → 23 s in the test browser). The result is the same as before.
- **3D preview: tilt the view.** Hold the middle mouse button (wheel button) and drag up / down to look at the kit from above or below; the view buttons bring the camera back level. Left drag still rotates, the wheel still zooms.

**Fixed**
- **Split view after 3D:** switching back from 3D to Split no longer leaves the 3D view full width with the 2D canvas pushed off screen.
- **Shorts zones of the built-in templates sat a quarter up the leg.** They used the 3D model's coordinates (hem at x 81) instead of the game's (hem at x 0): the shorts trims, side panels and stripes of the Classic, Polo, Raglan, Yoke, Three stripes and Side panels templates now start at the hem. Templates you already edited keep their own zones until you take the update (see below).
- **Nothing is lost on a reload or in a project file any more:** the fabric texture layers (Fabric tab) are kept in the autosave and in saved projects / `.peskit` files, and a project also holds its kitserver config.txt and the fontset generator settings (fonts, colours, outline, format, pattern, logo with its per-digit shifts). The imported font sheet picture and a logo picked from a file on the computer are not kept (import them again).
- **No more console warnings** about the removed three.js soft shadow type and about too many Konva layers (the 2D canvas now uses 5 layers).

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
