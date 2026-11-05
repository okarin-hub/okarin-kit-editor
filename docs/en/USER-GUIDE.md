# User guide

[Bahasa Indonesia](../id/PANDUAN-PENGGUNA.md) · [Back to README](../../README.md)

## 1. The screen

```
┌─ Menu bar: File  Edit  View  Tools  Help ──────────────────────── [Export Kit] ┐
│ Tool │  2D | Split | 3D   [All parts ▾]                          zoom         │
│ rail │ ┌────────── 2D canvas ───────────┐ ┌────────── 3D preview ────────┐ ┌ Side panel ┐
│      │ │ the texture (1024 x 1024)      │ │ the kit on the 3D model      │ │ Fabric     │
│      │ └────────────────────────────────┘ └──────────────────────────────┘ │ Template   │
│      │                                                                       │ Layer      │
│      │                                                                       │ Logo       │
└──────┴───────────────────────────────────────────────────────────────────── │ Name       │
```

- **Menu bar** – *File* (new kit, open / save project, import design, export), *Edit* (undo, redo, settings, colour presets),
  *View* (part outlines, part labels, original PES template, *Zoom speed (scroll)*), *Tools* (pattern from a jersey
  photo, fontset generator, kitserver config.txt; all experimental), *Help* (guide, shortcuts, update check,
  credits, about). *New kit* asks first; *Undo* brings the old kit back.
- **Tool rail (left)** – select / move, freehand shape, point shape, stitch line by points, stitch line freehand,
  eraser brush (keys `V`, `B`, `P`, `S`, `J`, `E`). One tool is active at a time; click the active tool again to go
  back to *select*.
- **2D canvas** – scroll to zoom, drag to pan. Click a part to select it. The *All parts* list in the toolbar zooms
  the canvas onto one part.
- **3D preview** – drag to rotate, hold the middle mouse button (wheel button) and drag up / down to look from
  above or below, scroll to zoom. Buttons switch the camera (front, back, chest, bottom, full) and
  the sleeve length (short / long).
- **Side panel** – tabs **Fabric**, **Template**, **Layer**, **Logo**, **Name**. The tabs show their icon; the open
  tab also shows its name.
- **Zoom speed** – *View → Zoom speed (scroll)*: slow, normal or fast, for the 2D canvas, the 3D preview and the
  fontset preview.

The texture is the PES 2021 kit texture (1024 × 1024). The **back of the shirt is stored upside-down** (hem at the
top, neck in the middle), and the shorts are stored rotated by 90°. The editor handles this for you.

## 2. Quick start

1. *Edit* menu → pick a colour preset.
2. **Layer** tab → change the colour of *Shirt base*, *Shorts base* and *Socks base* (open a row for per-part colours).
3. Add **pattern layers**, **trims**, a **collar** colour, then a **logo** (Logo tab) and the **name / number** (Name tab).
4. Check the 3D preview. *File → Export kit…* when you are happy.

## 3. The Template tab

The tabs are made of collapsible cards (their open / closed state is remembered). The **?** next to a heading or an
option explains that setting (hover or click it); *Help → Guide* explains them all.

### Template
A template adds coloured **zones** (collar piping, side panels, shoulder panels, cuffs, stripes …) on top of the part
colours. The list has three kinds:

- **Built-in** templates and your own `.json` templates from `library/templates` (see [Templates](TEMPLATES.md)).
- **Read PSD** – every `.psd` in `library/templates` (sub-folders too) becomes a template by itself. PSD files are
  read in the background when the app opens or on *Reload* (the status shows *Reading PSD … (12/30)*); the
  converted copy is kept in `library/templates/.psd`, so a PSD is only read again when it changes. Save the PSD again
  in Photoshop and press *Reload*: an open template takes the new layers and keeps its colours and choices.
  Grey-coded layers become **colour slots** (one colour for every layer of that slot), and layers named as
  variants become a choice of options.
- **Add PSD** copies a PSD you pick into `library/templates` (a file with the same name is replaced) and opens it
  once it has been read.
- A template that is a file in `library/templates` shows its path under the list, with **Rename** and **Delete**.
  Deleting asks first and cannot be undone.

PSD blend modes, clipping masks, layer and vector masks, shape layers and group opacity are kept; layer styles
(shadow, stroke, glow, bevel, overlays) and adjustment layers are not.

**Import PNG** (experimental) has two ways:

- *One PNG, split by colour* turns a picture of a template (ideally 2048 × 2048 in the PES layout) into a layered PSD
  in `library/templates`: one layer per colour and part group, the largest colour as the *Base* of each group (its
  own colour slot), soft edges from the picture. Options: *Colour tolerance*; the list next to each colour to merge
  it into another (a shade that split off joins its colour); a click on the preview finds a colour in the list
  (*Enlarge preview* shows it full width); *Clean up noise* (for WebP / JPG); *Other colourways* (up to two more
  pictures of the same template in other colours, so areas that share a colour in one picture are still told
  apart); *Smooth gradient* (tick only the end colours of a fade). A sharp picture with clean colours gives the
  best result.
- *Many PNGs (1 file = 1 layer)* makes a template from separate layer pictures.

Select a zone to move, resize, rotate, reshape or recolour it, on the canvas or with the fields, then *Save as
template* makes an editable copy. Importing templates from PSD / PNG is **experimental** (see
[Known issues](KNOWN-ISSUES.md)).

### Kit base
- **Base layer** – *Colour* (each part is painted with its colour) or *Imported design* (a finished kit texture is
  the base; see section 8). With an imported design you can still stack a part colour on top: use the **eye** on the
  *Shirt / Shorts / Socks base* row, then set the **opacity** per part layer.
- **Sleeve shape** – *To the shoulder* follows the PES template (the sleeve runs up to the neck area, the shoulder takes
  the sleeve colour). *Without shoulder* uses the shorter sleeve piece; the rest takes the shirt colour.
- **Background colour** – the empty space around the parts in the texture.

## 4. The Layer tab

### Layer
Base rows for shirt, shorts and socks (always the lowest layer) and the accessories: collar, captain's armband,
credit box. **Trims** (the stripe at a cuff, hem or sock top) are added under each part with *+ Add trim*; the eye
hides a trim, the colour and the width are set on the row. The buttons on a layer row (shown on hover): focus, duplicate and delete; *Reset* is at the top of the layer's settings, next to its name. **+ Object** next to a group adds a stripe, panel, ellipse or triangle there. Drag an object row onto another group to move it (it is resized to the new part), hold `Ctrl` when you drop it to copy it. *Repeat* in its settings draws the shape 2, 3 or more times in a row inside the same layer, with a gap and a direction (downwards or sideways, following the shape's rotation); each copy has the object's width and height.
Layers are grouped by shirt, shorts, socks and accessories; a group with many layers starts closed, and a search
field appears. Helper layers from a PSD (mesh, guides, stitches, shadows, background) are gathered under
*PSD helper layers*. Click a part's name (or its gear button) to open its editor under the row: colour code, palette and *Match* (front ↔ back,
left ↔ right). Clicking a part on the canvas or its focus button also opens the Layer tab, never another tab.
*Edit shape points* in a shape layer's settings shows its points on the canvas: drag a point, click a **+** in the
middle of a side to add one, right-click a point to remove it.

### Pattern layers
Patterns live in the groups of the layer list. **+ Pattern** next to a group (Shirt, Shorts, Socks, Accessories) adds
one there; it is listed at the top of the group. **Drag** a pattern row onto another group to move it there, or hold
`Ctrl` when you drop it to copy it. Click a row to open its settings: type (14 built-in or an image from
`library/patterns`), colour, scale, line thickness, opacity, X / Y offset, **rotation**, mirror / symmetry,
**Repeating** on / off (off = one motif in the middle) and which parts of the group it covers (for example the body
without the sleeves). Higher patterns are drawn in front of lower ones. Patterns are drawn over the base colour and
under the template layers, trims, logos and fabric.

### Stitch lines
Stitch lines are layers you draw (see tools). The card lists them; each can be switched between straight and
**curved**, and *Edit points* reshapes it on the canvas (drag a point, click a **+** to add one, right-click a point
to remove it). Options: show / hide, style (natural, soft, visible, double), strength, thickness, thread colour, and
stitching along the edge of every part.

## 5. Drawing tools

| Tool | What it does |
|---|---|
| Select / move | default; select parts, move logos |
| Freehand shape | draw a layer by dragging the mouse |
| Point shape | click points; click the first point or press Enter to close |
| Stitch line (points) | click points; **Curve ON** joins them with a smooth curve (needs 3+ points); Enter or double-click to finish |
| Stitch line (freehand) | drag to draw a stitch line |
| Eraser brush | with a layer selected: erases that layer only where you brush (a watermark or an unwanted logo in an imported PSD / PNG); with no layer selected: erases the patterns |

`Backspace` removes the last point, `Esc` cancels.

The bar above the canvas shows what the eraser brush works on (*Layer: …* or *Pattern*). *Restore* paints back,
*Reset* brings back everything erased on that layer (or all patterns). The erased spots stick to the layer: they
move, turn and scale with it. Erasing is saved in the project and can be undone.

## 6. Fabric tab

The tab holds the **fabric texture layers** (micro-mesh, honeycomb, twill, ribbing, three jersey meshes): each layer has its own size,
intensity and parts. A layer can also use your own tile image from `library/textures`. Fabric is drawn on top of
colours, patterns and zones, and also over an imported design.

## 7. Logo and Name tabs

**Logo** – *Upload Logo*, *Add Text*, *Search Club Logos* (football-logos.cc, fan / non-commercial use only) and
**My Logos** (everything in `library/logos`, filtered by category). Select a logo on the canvas to move, resize
(with the ratio lock) and rotate it, or use the X / Y / width / height fields and the position presets
(chest, sleeve, shorts, back). Logo colour: *Original*, *Colour* (replaces the logo colour; transparent areas stay
transparent) or *Gradient*; *Trim / Outline* adds an inside, centre or outside outline, with **round** or **sharp**
corners (sharp follows the logo's corners).

*Add Text* shows a live preview before the text is added: the words, font, letter size, colour, outline (colour
and width) and shadow. Select a text later to change any of them; dragging a corner of the text box scales the
letters.

**Name** – the player name and number on the back, and the shorts number: font, colour, outline, size, position.
They are drawn in the texture only when you tick the option; the game normally uses its own fonts.

## 8. Importing a finished design

*File → Import design…* loads a PNG / JPG / WebP / DDS (DXT1 / DXT3 / DXT5 / BGRA) kit texture, ideally
1024 × 1024 or 2048 × 2048 in the PES layout. *Replace design* makes it the base layer; *Overlay* draws it over the
parts with an opacity. You can switch between *Colour* and *Imported design* any time in **Template → Kit base**.

## 9. Exporting

*File → Export kit…* (or the red button):

| Format | Use |
|---|---|
| **PNG** | editing or preview (1024 or 2048 px) |
| **DDS** | DXT1 / DXT5 / BGRA with mipmaps, for mod tools; the game reads FTEX, so convert it with a DDS → FTEX tool (tested) |
| **FTEX** | written directly (one `.ftex` file, mipmaps inside, FtexTool layout); tested in PES 2021 |
| **Project (.peskit)** | save and share the whole kit |
| **Showcase card** | a picture of the kit |

Keep a copy of the file you replace in your game before testing a new one. 2048 px output has not been
tested in the game yet.

### Kitserver (config.txt) – experimental

This only edits the config file: the 2D/3D preview does not follow its values yet.

*Tools → Kitserver config.txt…* edits the `config.txt` that kserv.lua (Sider) reads for one kit. The form follows
kserv's own menu and limits; *Edit as text* shows the file itself. *Import config.txt* loads an existing config and
keeps its comments and any key the form does not show. File names are written without `.ftex`: kserv only uses files
inside the kit's own folder, and an empty name or a missing file means the game's own file.

*Save to kit folder…* asks for the kit folder (for example `content/kit-server/<team>/p1`) and writes `config.txt` and
`<KitFile>.ftex` there. It asks before overwriting. The kit is not added to `order.ini` or `map.txt`; do that yourself.

### Fontset generator – experimental

*Tools → Fontset generator…* makes the number and name font files kitserver reads. Pick a font, fill colour and
outline for the numbers and for the name; the preview shows each texture with its character slots (blue) and the
letter top and baseline (red); zoom the preview with −, +, *Fit* or the mouse wheel. *Save to kit folder…* writes `<prefix>_back`, `_chest`, `_leg`, `_name` and `_name_ex`
`.ftex` files and, with *Also write config.txt*, the config with those names filled in. The prefix defaults to the
KitFile name.

*Letter size %* makes the letters bigger or smaller (they stay on the baseline), and *Outline position* puts the outline
outside the letter edge, across it (centre) or inside it (inline). A letter that crosses its slot box gets a yellow
box and a warning under the preview: in the game it would be squeezed or cut off. Saving asks first while any letter
does.

*Import font sheet…* takes a picture of the letters and/or digits instead of a font (PNG, JPG…). A dialog first
shows the picture: drag a box around the part to use, tick *See the separation* to check the cut-out, and on a busy
background pick the background and letter colours. A sheet may run across (rows) or down (one character per row, read top to
bottom as one row). Each character is recognised and the row
is matched to the alphabet order; the row shows every piece with its reading (yellow = unsure or skipped). Fix a reading
in the row's text: one character per piece, `_` to skip one. Characters the picture does not have
(the full stop, accented letters) come from the font chosen below it. *Logo on the numbers* puts a badge on every digit; *Logo colour* can turn it into one colour, traced as a sharp
vector shape: the whole shape (*silhouette*) or only its dark parts (*detail*, with a brightness cut and *Invert*).

## 10. Projects, autosave, languages, updates

- Your work is autosaved in the browser / app storage. *File → Open / save project…* (`Ctrl+S`) keeps named projects,
  downloads a `.peskit` file or loads one.
- *Edit → Settings…* (`Ctrl+,`): the language (English, Bahasa Indonesia, Português, Español) and where a layer's settings
  open: *under the row* in the list, or in a *side panel* left of the layer list (closed with ✕ or `Esc`). Drag the side panel's left edge, bottom edge or
  bottom-left corner to resize it; the size is remembered, a double click on the edge brings back the default size.
- *Edit → Undo / Redo* (`Ctrl+Z`, `Ctrl+Y`).
- *Help → Check for updates* compares your version with the releases on GitHub. In the Windows app, *Download and
  install* fetches the new version, closes the app, puts the new files in place (your `library` folder is left
  alone) and opens it again. Tick *Include experimental releases* to be offered pre-releases too.

## 11. Shortcuts

`Ctrl+Z` undo · `Ctrl+Y` redo · `Ctrl+S` open / save project · `Ctrl+E` export · `Ctrl+,` settings · `1` / `2` / `3` 2D / Split / 3D ·
`V` `B` `P` `S` `J` `E` tools · `?` shortcut list · scroll = zoom · drag = pan · `Enter` finish drawing · `Esc` cancel ·
`Backspace` remove last point · arrows / `Shift`+arrows nudge the selected logo by 1 / 10 px · `Delete` removes it.
