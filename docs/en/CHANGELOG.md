# Changelog

[Bahasa Indonesia](../id/CATATAN-RILIS.md) · [Back to README](../../README.md)

## Unreleased

- **Auto fit for the letter size.** Next to *Letter size %* in the font generator, *Auto fit* finds the largest size
  (at most 100 %) at which every number, or every A–Z of the name font, fits its slot without being squeezed. Accented
  _ex letters that still touch their slot are named in the status line (they often come from the fallback font).
- **Fix: a letter of the font sheet could be skipped.** A shape far from the usual ones (a flat-topped A) was left out
  and then reported as *Not in the picture*. A lone skipped piece between two letters in order now gets the letter
  between them, marked unsure (yellow). *Not in the picture* also follows the row text when you correct it.
- **Font sheet previews keep their size.** The small previews under each row are drawn at the row's scale, so a dash
  shows as a small dash, not a dark block.
- **Fix: wide letters and digits looked squeezed in the font generator.** Every character box is now as wide as A
  (92 px) for letters and as 4 (134 px) for digits, around the same centre, so the 1 or I of a blocky font keeps its
  shape (the game showed a wider I whole). The glyphs keep their own size; only M, W, Æ and ß, already wider, and the
  marks stay as they were. The letter spacing of the kit preview does not change.
- **Fix: angular letters from a picture came out rounded.** Short 45° cuts (the chamfered corners of a block 0, the
  flag of a 1 where it meets the stem) were read as round corners when the picture is a little blurred, such as a
  screenshot or a JPG. They now stay sharp. The same tracer draws logos and photo patterns, so their sharp details
  are kept better too.

## 0.6.8 — Patterns up to the shoulder, version in the status bar, extended 2D canvas, tidier tabs

- **Reload says when it is done.** *Reload* in the pattern library and in My Logos shows for a moment how many there
  are and how many are new (*Loaded: 24 patterns (1 new)*).
- **Font sheets are read better** (Generate Font, *Import font sheet*):
  - digits written 1234567890 (0 at the end) are recognised, not only 0123456789;
  - the dash after Z (*… X Y Z -*) is recognised and goes to the name_ex font;
  - a row that goes on from the letters into the digits (*X Y Z - 1 2 3 …*) is read as such;
  - *Not in the picture* looks at the whole sheet, so a letter on another row is no longer listed.
- **Activity log:** colour changes are written now (the app's colour picker did not tell the log), and buttons or
  sliders without a label get a name from the text next to them or their icon.
- **Fix: a wide I looked squeezed in the name font.** The I slot was 29 px wide (the I of the sample fontsets is a thin
  bar), so the I of a font with a wider I was pressed together. The I, Ì, Í and İ slots are now 51 px wide, around the
  same centre.
- **Tidier Layer, Logo and Name tabs.**
  - Layer: the colour slots are grouped per part (Shirt, Shorts, Socks, Accessories) as small chips, and can be folded
    (then only their colours show, as dots).
  - Logo: *Upload*, *Text* and *Club logos* in one row; what is *On the kit* comes first, *My Logos* below it and can
    be folded.
  - Name: the preview switch sits in the title row; *Player data*, *Typography & colour* and *Size & position* (and
    each placement group in it) fold, only the player data is open at first. What is open is remembered.
- **Fix: a pattern stopped at the shoulder.** With *To the shoulder*, the sleeve piece runs up to the neck, but its
  pattern only filled the short sleeve box, so the shoulder part showed the plain sleeve colour over the shirt's
  pattern. Patterns now fill the whole piece (the shoulder, the long sleeve area, and the few px of the shorts, socks
  and collar that were left out), in the same place as before.
- **Version in the status bar.** A thin bar at the bottom shows the app version. At start the app checks once for a
  newer release (on the channel chosen in *Check for updates*); when there is one, *New version available* shows next
  to the version and opens the update dialog.
- **2D canvas area** (*Edit → Settings*): *Kit square* as before, or *Extended*: the canvas fills the whole panel with
  the kit in the middle, and what lies outside the kit is dimmed but still visible. *Show rulers* adds rulers in texture
  px along the top and left (0 and 1024, the kit's edges, in red).

## 0.6.7 — Tidier menus, Import PNG rework, gradient tool, activity log

- **Activity log.** The app writes what you do (buttons, menus, tabs, settings, shortcuts, messages and errors) to
  `library/logs/aktivitas-YYYY-MM-DD.log`, so a problem can be traced back step by step. Labels and setting values
  only, no pictures; files older than 14 days are removed.
- **Import PNG, cleaner and easier to read.**
  - The *split by colour* dialog is now wide: a big preview on the left, settings and colours on the right. The
    template name sits next to the buttons.
  - The basic settings (tolerance, clean up noise, fabric detail) are always shown; *Advanced* holds smooth
    gradient, split pieces and other colourways, and tells how many are on.
  - Each colour shows the parts it lands on (Shirt, Shorts, Socks, Details) and which one is the Base. *Parts* in
    the preview colours the picture by part, so you see before saving where each colour goes.
  - *All* / *Clear* for the colour list.
  - After saving, a short report lists the layers and their parts, the same as for *Many PNGs*.
  - The colours are worked out in the background, so the tolerance slider no longer stalls on a big picture.
  - An import that fails halfway no longer leaves an empty folder in `library/templates`.
  - **Motif can be recoloured** (under *Keep fabric detail*): a faint motif a shade off the base (camo, an embossed
    pattern) becomes *Dark motif* / *Light motif* layers per part, each with its own colour slot, instead of the
    fixed black / white detail.
  - Opening Import PNG again after an import starts a new one instead of showing the old report.
  - **A colour slot per part:** a colour now gets its own slot on the shirt, shorts, socks and details
    (*Colour 2 – Shirt*, *Colour 2 – Shorts*), so a shirt motif and a shorts panel that share a colour can be changed
    apart.
  - **Fix: an unticked colour came back.** With *Keep fabric detail* on, a colour you unticked (a white logo, a
    watermark) was left out of the colour layers but returned as a white or black shadow in the fabric detail
    layer. Unticked colours, with their soft edge, are now left out of the detail and motif layers too.
- **Fix: Reload in the Template tab** now also takes a template that was read again with different layers or colour
  slots, not only one whose file changed.
- The app's local server refuses requests from other websites open in the same browser.

- **Tidier menus.** Things that belong together now live together:
  - **Kit model** is one toolbar button that opens a thin row under the toolbar (sleeve shape, collar, sleeve model,
    tight kit, shorts). It does not cover the 3D view and stays open while you turn the model. Sleeve shape moved here from the Template tab.
  - **Import** is one list (finished kit design, PSD template, PNG to layers), the same in File and in the Template tab.
  - **Kitserver** is no longer experimental: it is one dialog with two tabs: config.txt and the number / name fonts (Tools > Kitserver).
  - **Name / number in the texture** is set only in Export now, and remembered with the kit.
  - The font tab's sliders are full width with their value on the right.
- **PES fonts from the library in the font generator.** *Load a PES font from the library* brings a font you saved
  before back in as the font image, so you can change it and save it again.
- **Photoshop-style Shift.** Hold Shift while dragging a layer, logo or point to move it straight along one axis; while
  turning, it snaps in 15° steps; while resizing an object, it keeps its proportions. While drawing (points or the
  gradient), Shift keeps the line at 45° steps. **Ctrl+J** duplicates the selected layer.
- **Pointed corners too.** The 4-corner picker now also works with *Pointed*: turn a corner off and that side of the
  end stays square.
- **Export the whole kit folder.** For a game texture, Export can also save `config.txt` and the number / name fonts
  (from Generate Font) in the same folder, with the file names written into the config.
- **File names stay in sync.** Changing the file prefix in Generate Font (or KitFile, when the prefix is empty) updates
  the font file names in the kitserver config right away (an unticked font is cleared, so the game uses its own), and
  Export starts with KitFile as the file name.

- **Choose which corners are rounded.** *Edge shape* > *Round* now has a 4-corner picker: click the corners to round,
  the rest stay sharp. Works on box objects and drawn shapes.
- **Gradient tool (G).** Pick it in the toolbar and drag on the 2D canvas from where the colour starts to where it
  fades. It makes an object you handle like any object: taper its ends, repeat it, move, turn and align it. Any object
  can have a *Gradient fill* too: end colour or fade to transparent, straight or radial, direction, reverse.
- **One-colour vector logos.** With *Colour* or *Gradient* in the Logo tab, a logo can be redrawn as a sharp vector
  shape: silhouette, or detail (only its dark or light parts, with a brightness cut), like the logo option of the
  fontset generator. A plain JPG background is dropped too.

## 0.6.6 — Stable patch: pattern library search and list, align buttons, follow the shoulder

- **Pattern library search and list view.** Search by name or folder, and switch between the grid and a list with the
  picture and the file name. Pictures load as you scroll, so big libraries stay quick.
- **Align left / centre / right** for objects and patterns in the Layer tab: one click puts the layer against the left
  or right edge of its part, or in its middle.
- **Follow the shoulder.** Layers on a sleeve have a *Follow the shoulder* box: the layer bends with the sleeve and
  shoulder piece, so a straight stripe curves and narrows toward the neck instead of running flat across the texture.

## 0.6.5 — Stable patch: Delete key in the Layer tab, New kit starts clean

- **Delete key in the Layer tab.** Press *Delete* to remove the selected layer, every picked layer (Ctrl / Shift +
  click), a whole group (click its name first), a merged layer or the open pattern. Undo brings them back.
- **File → New kit starts clean.** It now resets the layers, colours, patterns, logos and imported design to the
  defaults; before, the previous file's layers stayed on the canvas.

## 0.6.4 — Stable patch: name and number placement measured in game, sleeve badge markers

- **Sleeve logo preset at the badge spot.** *Right / Left sleeve* in the Logo tab (and a new logo on a sleeve) now
  centres on the spot where the game puts the competition badge, measured on the grid texture.
- **Name and number placement measured in game.** A grid texture in game gave texture positions for the back name
  and number, the chest number, name curves, back number spacing, the shorts number (models 0 and 1) and the sleeve badges
  (short and long sleeves); the preview now uses them.
- **Sleeve badge markers.** The Name tab has the eight sleeve badge values (right / left, short / long, X / Y) and a
  *Sleeve badges* box under *Show*: shields mark where the game puts the competition badges, so the values can be set
  before testing in game. They show in the 2D canvas and the 3D preview only, never in an export.

## 0.6.3 — Stable patch: logo settings like layers, replace logo, logo search, shorts number placement

- **Logo settings open like layers.** A logo's settings now open under its row in the list, or in the side panel,
  following the same layer editor setting as the Layer tab.
- **Replace logo.** Swap a logo's picture and keep its place: *Replace logo → From file…* or *From My Logos* (then
  click the new logo). Position, rotation, opacity and style stay; the new picture fits the old box, centred.
- **Logo size with the ratio locked.** Typing a width (or height) could leave the other side wrong: every keystroke
  applied, so typing 150 went through 15, the other side was clamped to 10 px and the ratio was lost. The ratio is now
  taken when the field gets focus.
- **Shorts number placed like the game.** Compared again with front views from the game: a lower *Shorts number X*
  moves the number toward the inner thigh (the preview had it backwards): X 6 sits on the front of the leg, X 16 at 45°
  toward the outer side. Its size and height on the leg now match the in-game shots.
- **Back number spacing widens from the middle.** A wider or narrower *Back number spacing* now keeps the number
  centred, as in the game; the preview used to keep the first digit in place.
- **Search in My Logos.** A search field above the categories finds logos by file or folder name.

## 0.6.2 — Stable patch: Name tab on the kitserver config, PES fonts in the preview, saved projects kept

- **Name tab follows the kitserver config.** Position and size are now the config.txt values (*Name shape*, *Name Y*, *Name size*,
  *Name stretch*, *Back number Y / size / spacing*, *Chest number X / Y / size*, *Shorts number side / X / Y / size*),
  the same values as in Kit Config, with kitserver's limits. The 2D canvas, the 3D preview and the export draw them
  where PES puts them, measured from in-game screenshots. The chest number shows in the preview too.
- **PES fonts in the Name tab.** The Fontset Generator has *Save to library*: it saves the five font textures as PNG
  in `library/fonts/font_pes/<name>`. Pick that font in the Name tab under *PES font* and the preview shows the
  generated font itself, with its colours, outline, logo and pattern.
- **Switch each one off.** *Show* has a box for the name, the back number, the chest number and the shorts number, for
  kits without a chest or shorts number. The name's box is the config value *Name*.
- **Saved projects stay in the app.** The app picked a new local address on every start, and projects saved in the
  browser storage of an earlier start went out of sight. It now keeps one address, and on the first start it brings
  back the projects saved by earlier starts.

## 0.6.1 — Stable patch: export matches the canvas, colour popup with hex paste, more for groups and stitches

- **New stitch style: Joined.** One unbroken line with a shadow along it, like two pieces of cloth sewn together. It
  works as the general style and on a single line.
- **Export matches the 2D canvas where parts touch.** A layer running across two parts (sleeve and shirt, say) got a
  line of base colour through it in the PNG, DDS and FTEX, and in the 3D preview's texture, because each part was painted in full before the next. The export
  now draws in the same order as the canvas. The faint hairline at those joins is gone from the canvas too.
- **New colour popup: paste a hex code.** Every colour swatch now opens the app's own popup with a code field: paste or
  type `#aa11cc`, `aa11cc` or `0F0`. It also has a colour square, a hue bar and a screen colour picker.
- **Groups: rename, duplicate, colour.** The folder row has a pencil (or double-click the name), a duplicate button and
  a swatch that sets the colour of everything in the group, including patterns placed above its layers.
- **Merged layer colour fixed.** Picking a colour on an image layer made by Merge came out darker than the colour
  picked. The whole layer now takes the exact colour; tick *Use the image's original colours* to get the originals back.
- **FTEX: a rare wrong chunk closed off.** A compressed chunk of exactly its original size would be read as raw data.
- **Moving the canvas while drawing.** With a drawing tool or the eraser on, the middle and right mouse buttons used to
  draw too. Now only the left button draws; hold the middle or right button and drag to move the canvas.
- **Quick clicks no longer end a stitch line.** Two fast clicks on different spots counted as a double click. A line
  now ends only on a double click on the same spot (shapes too).
- **Every stitch line has its own style.** Pick natural, soft, visible or double in the line's row; *General* follows
  the style below the list.
- **Double and natural work on drawn lines and on layer edges.** Double on a drawn line or a layer edge looked the same
  as visible, with no second row. It now draws a second row beside it, and natural's fine top-stitch on a drawn line
  runs beside the seam instead of on top of it.

## 0.6.0 — Stable: pick several layers, group and merge them

- **The selection box of a repeated layer covers all its copies.** It only framed the first copy. Resizing it along
  the copies keeps the gap between them (only the copies grow); moving and turning work as before.
- **Arrow keys move the selected layer** (Shift = 10 px), like a selected logo. Not while typing in a field.
- **Pick several layers, group them, merge them** (Layer tab, like Photoshop). Ctrl+click / Shift+click picks
  layers; one box on the canvas then moves, scales and turns them together, and the arrow keys move them all.
  *Group* (Ctrl+G) puts them in a folder of the list: fold it, show / hide it, drag it up or down as one, click it to
  pick everything in it, *Ungroup* (Ctrl+Shift+G). *Merge* (Ctrl+E while 2+ layers are picked; otherwise Ctrl+E
  still exports) makes one layer: shapes of one colour stay one editable shape, anything else becomes an image layer
  that looks exactly the same. Ctrl+Z undoes it. Saved templates keep folders and merged image layers.

## 0.5.2 — Stable patch: Photoshop-style layer order, outfit menu, interface size, collar fix

- **3D preview: captain's armband, goalkeeper sleeves, tucked-in shirt.** *GK* (goalkeeper long sleeves, normal or
  tight), *Captain* (the sleeve with the armband, which shows the *Captain Armband* area of your texture) and
  *Tucked in* (shorter shirt and the matching shorts). They work with every sleeve model and with the tight kit.
- **3D preview: one *Outfit* button** in the corner of the 3D view instead of the row of buttons. It shows what is
  picked (e.g. *GK · Mid · Captain*) and opens a small menu with sleeves, sock length, captain's armband and tucked-in
  shirt; a click outside or Esc closes it.
- **Interface size** (Windows app): *View → Interface size* with *Automatic*, *Small* 90 %, *Normal* 100 %, *Large*
  115 % and *Extra large* 130 %. *Automatic* is 100 % on screens around 1366 px and 115 % on 1920 px and wider. It
  works like the browser's zoom, so the canvases and the mouse stay exact, and it is kept for the next start. In a
  browser use Ctrl + / Ctrl −.
- **Layer tab: the list is the stacking order, and patterns can go above objects.** The objects of a group were
  listed bottom-first (the last one in the list was the one drawn on top), dragging an object within its group did
  nothing, and a pattern (like the stripes of a preset) could never go above an object. Now the top of the list is
  the front of the kit; objects, patterns and PSD layers that are not clipped can be dragged above any row of their
  group, and a pattern's up / down arrows pass objects too. A raised pattern is drawn right above that object in 2D,
  3D and the export. Base layers (a PSD's *Base*, the colour layer of Import PNG) are the group's background, like
  Photoshop's: listed at the bottom, under the patterns, and not draggable. Before, the base colour of an imported
  PNG showed at the top of the list while it was drawn at the bottom.
- **Collar and shorts no longer overlap.** The shorts areas reached into both ends of the *Collar Strip* (x 336–340
  and 684–688) and down to y 982, while the shorts on the model only read up to x 320 / from x 704 and down to y 972.
  The shorts now end at x 330 / 694 and y 977. The *Collar Strip* also covers the rows the collar models read below
  it (down to y 1024, and x 200–850 under the shorts): 71 collars used to pick up the dark background colour there.
  Measured over all 133 collars: 73 % of their texture points now land on the Collar Strip (54 % before), the rest
  on the shirt neck as before.
- The 3D model now has 179 parts (5.1 MB); the PS4 collars of the CometKIT scene are copies of the PC collars and
  are not included.

## 0.5.1 — Stable patch: smooth colour picker

- **Dragging in a colour picker is smooth again.** Every step of the drag rebuilt the 3D texture: the whole kit
  rendered, encoded to PNG and decoded again (about 100–190 ms each, so the picker stuttered). The 3D texture is now
  rebuilt at most every 150 ms while a value keeps changing, goes to the 3D view as a canvas without the PNG round
  trip, and is not built at all in the 2D-only view. Measured in the packed app, 40 colour steps: Split 5.6 s → 1.8 s
  and 2D 4.2 s → 1.4 s, with no main-thread block over 50 ms left (32 before).

## 0.5.0 — Stable: the real 3D model parts, true 3D colours, undo / redo fixed

Stable release: it also brings everything from 0.4.1 and 0.4.2 (below) to the stable channel. Still marked
*Experimental* in the app: *Pattern from a jersey photo*, *Import PNG* and the *Kitserver config.txt* editor.

- **Fontset generator is no longer experimental:** its FTEX output loads in PES 2021 (numbers and name show in the
  game). The DDS output is still untested.
- **3D preview: the model's own parts.** The 3D model now carries all 133 collars, the 16 shorts models (the leg
  piece), normal and Kappa sleeves, the tight kit and three sock lengths from the CometKIT model. Collar, shorts
  model, Kappa sleeves and the tight kit follow the kit config (*Kitserver config.txt…* in the Tools menu), so the preview shows what you
  set. In Split and 3D the workspace toolbar (next to the zoom) has *Collar*, *Sleeve model*, *Tight kit* and
  *Shorts*: they write the kit config, so the 3D view and the config dialog always agree. Sleeve length and sock
  length are one small bar inside the 3D view.
- **Undo / redo:** changes to the kit config (the toolbar's *Collar*, *Sleeve model*, *Tight kit*, *Shorts*, and the
  *Kitserver config.txt* dialog) are now part of Ctrl+Z / Ctrl+Y. Also fixed: a second Ctrl+Z in a row did nothing
  and Ctrl+Y never worked, because every undo was recorded as a new edit.
- **Sock colour no longer shows on the shorts in 3D:** the socks area in 2D reached into the top rows of the shorts
  area (and the leg piece of the shorts reads those rows). Socks now end at y 577, the shorts start at 579.5.
- **Shorts hem accent** sits on the outer edge of the shorts leg (x 16 / 1008) where the model actually shows it,
  no longer at x 0 where nothing reads it.
- **3D colours match the texture:** the 3D view no longer darkens dark colours (navy shorts and sleeves came out
  black, reds turned darker). Checked against the CometKIT Blender scene with the same texture: the texture lands
  in the same place on every part and the colours now match closely. The cloth is also more matte, so bright
  colours no longer get a whitish shine.
- **Real long sleeves in 3D:** the generated tube is gone; long sleeves use the model's own long sleeve, with elbow
  and folds, mapped to the long sleeve area of the template.
- **Shorts in 3D no longer stretched:** the leg piece of the shorts shows the outer side of the shorts area (x 17–81)
  the way the game does, instead of stretching the upper part.
- `npm run build:model` rebuilds `public/model/pes_kit.glb` from a local CometKIT export (see the script header).

## 0.4.2 (experimental) — fabric detail for Import PNG, sashes and raglan sleeves from jersey photos

- **Pattern from a jersey photo: raglan sleeves in their own colour:** when most of the sleeve boxes are one colour
  the body does not have (navy sleeves on a white shirt), the sleeves, long sleeve part included, get that colour
  instead of the body's, also with *Use as a pattern layer*. A patterned sleeve in colours of its own is not read
  yet.

- **Pattern from a jersey photo: mark colours yourself:** *+ Pattern colour* and *− Not a pattern colour* next to the
  box buttons; click on the front photo. A marked colour is always a pattern colour even when it is small (a thin
  sash), or never one (a sponsor word); *Clear marks* removes them.
- **Pattern from a jersey photo: a sash with a soft edge stays:** a band that fades into the shirt was joined to it
  and painted over in the clean-up step; a large second colour in an area is now kept.
- **Pattern from a jersey photo finds a sash by itself:** a colour split by the light into a lit and a shaded half
  counts with both halves, and a smaller colour that forms one solid band across the body is a pattern colour (a
  word across the chest is not: its strokes are much thinner than its height). The diagonal sash of the three test
  photos is recognised as *One slanted band* without marking it; the synthetic test set (stripes, hoops, diagonal,
  sash, plain) still reads the same.

- **Import PNG keeps the fabric detail:** with *Keep fabric detail* (on by default), the mesh lines, folds and
  shading of the picture become two layers over the colours: *Fabric detail – dark* (black, multiply) and
  *Fabric detail – light* (white, screen). On the picture's own colours they bring back its brightness; after a
  colour change the detail stays on the new colour. Edges between colours and tiny differences (compression
  noise) are left out, and so are the armband and credit boxes (template site watermarks). A logo whose colour is
  not ticked ends up as a shade in the detail layer; tick its colour to keep it as its own layer.
- **Pattern from a jersey photo: shades of one colour are one colour:** the lit and the shaded side of a shirt
  and a faint tone-on-tone print (same hue, similar lightness) are no longer split into several pattern colours
  (a yellow shirt came out as three yellows). Light and dark colours of one hue (sky blue and navy) stay apart.
- **Fix:** a layer whose main part is the credit box was missing from the Layer tab (it had no group).
- **Fix: Import PNG lost small pieces of a colour:** a colour layer was only drawn on the parts holding a large
  share of it, so the three stripes on the sleeves and chest of a design whose colour mostly sits elsewhere (a
  dark gradient on the back) disappeared. A layer from Import PNG now keeps every part of its own group (shirt,
  shorts, socks, details) that holds its pixels, and no longer spills onto a neighbouring group where the part boxes
  overlap. PSDs made by Import PNG are read once more after the update.
- **Smooth gradient keeps the main colours:** ticking *Smooth gradient* no longer unticks a colour that is the main
  colour of the shirt, shorts or socks, even when it lies between two others (the light grey shorts of a
  white / black design were taken for a shade of the gradient and came out pinkish).
- **Import PNG picks cleaner colours:** a layer's colour is the most common colour of its group instead of the
  average, which counted the edges of logos too (a light grey next to maroon came out pinkish).

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

- **Fix: update from the app could fail** with "ZIP decompression failed": while the disk was busy, parts of the
  downloaded zip ended up in the wrong place. The download is now written in order and checked against the
  SHA-256 GitHub lists for the file; a download that does not match is never installed. The 0.4.0 updater has
  the bug: if updating from 0.4.0 fails, try again or download the zip by hand.
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
