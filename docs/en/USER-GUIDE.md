# User guide

[Bahasa Indonesia](../id/PANDUAN-PENGGUNA.md) · [Back to README](../../README.md)

## 1. The screen

```
┌─ Menu bar: File  Edit  View  Preset  Settings  Help ───────────── [Export Kit] ┐
│ Tool │  2D | Split | 3D                                          zoom         │
│ rail │ ┌────────── 2D canvas ───────────┐ ┌────────── 3D preview ────────┐ ┌ Side panel ┐
│      │ │ the texture (1024 x 1024)      │ │ the kit on the 3D model      │ │ Colour     │
│      │ └────────────────────────────────┘ └──────────────────────────────┘ │ Layer      │
│      │ Part shortcuts: Shirt Front · Shirt Back · Sleeves · Shorts · Socks … │ Logo       │
└──────┴───────────────────────────────────────────────────────────────────── │ Name       │
```

- **Menu bar** – *File* (new kit, open / save project, import design, export), *Edit* (undo, redo, reset),
  *View* (wireframe, labels, overlay), *Preset* (starter kits), *Settings* (language), *Help* (this guide,
  shortcuts, update check, credits, about).
- **Tool rail (left)** – select / move, freehand shape, point shape, stitch line by points, stitch line freehand,
  pattern eraser. One tool is active at a time; click the active tool again to go back to *select*.
- **2D canvas** – scroll to zoom, drag to pan. Click a part to select it. The part shortcuts at the bottom zoom to a part.
- **3D preview** – drag to rotate, scroll to zoom. Buttons switch the camera (front, back, chest, bottom, full) and
  the sleeve length (short / long).
- **Side panel** – tabs **Fabric**, **Layer**, **Logo**, **Name**.

The texture is the PES 2021 kit texture (1024 × 1024). The **back of the shirt is stored upside-down** (hem at the
top, neck in the middle), and the shorts are stored rotated by 90°. The editor handles this for you.

## 2. Quick start

1. *Preset* menu → pick a starter kit.
2. **Layer** tab → change the colour of *Shirt base*, *Shorts base* and *Socks base* (open a row for per-part colours).
3. Add **pattern layers**, **trims**, a **collar** colour, then a **logo** (Logo tab) and the **name / number** (Name tab).
4. Check the 3D preview. *File → Export kit…* when you are happy.

## 3. The Layer tab

The tab is made of collapsible cards (their open / closed state is remembered).

### Template
A template adds coloured **zones** (collar piping, side panels, shoulder panels, cuffs, stripes …) on top of the part
colours. Pick one from the list (built-in, or your own from `library/templates`). Select a zone to move, resize,
rotate, reshape or recolour it, on the canvas or with the fields, then *Save as template*.
Importing a template from PSD / PNG is **experimental** (see [Known issues](KNOWN-ISSUES.md)).

### Kit base
- **Base layer** – *Colour* (each part is painted with its colour) or *Imported design* (a finished kit texture is
  the base; see section 7). With an imported design you can still stack a part colour on top: use the **eye** on the
  *Shirt / Shorts / Socks base* row, then set the **opacity** per part layer.
- **Sleeve shape** – *To the shoulder* follows the PES template (the sleeve runs up to the neck area, the shoulder takes
  the sleeve colour). *Without shoulder* uses the shorter sleeve piece; the rest takes the shirt colour.
- **Background colour** – the empty space around the parts in the texture.

### Layer
Base rows for shirt, shorts and socks (always the lowest layer) and the accessories: collar, captain's armband,
credit box. **Trims** (the stripe at a cuff, hem or sock top) are added under each part with *+ Add trim*; the eye
hides a trim, the colour and the width are set on the row. *Add layer* creates stripes, panels, ellipses and triangles.
Click a part's name (or its gear button) to open its editor under the row: colour code, palette and *Match* (front ↔ back,
left ↔ right). Clicking a part on the canvas or its focus button also opens the Layer tab, never another tab.

### Pattern layers
Each pattern is its own layer: type (14 built-in or an image from `library/patterns`), colour, scale, line
thickness, opacity, X / Y offset, **rotation**, mirror / symmetry, **Repeating** on / off (off = one motif in the
middle), and the parts it is used on. Layers higher in the list are drawn in front. The pattern is drawn over the
base colour and under trims, logos and fabric.

### Stitch lines
Stitch lines are layers you draw (see tools). The card lists them; each can be switched between straight and
**curved**. Options: show / hide, style (natural, soft, visible, double), strength, thickness, thread colour, and
stitching along the edge of every part.

## 4. Drawing tools

| Tool | What it does |
|---|---|
| Select / move | default; select parts, move logos |
| Freehand shape | draw a layer by dragging the mouse |
| Point shape | click points; click the first point or press Enter to close |
| Stitch line (points) | click points; **Curve ON** joins them with a smooth curve (needs 3+ points); Enter or double-click to finish |
| Stitch line (freehand) | drag to draw a stitch line |
| Pattern eraser | paint away patterns, for example to keep a built-in logo of an imported design clean |

`Backspace` removes the last point, `Esc` cancels.

## 5. Fabric tab

The tab holds the **fabric texture layers** (micro-mesh, honeycomb, twill, ribbing, three jersey meshes): each layer has its own size,
intensity and parts. A layer can also use your own tile image from `library/textures`. Fabric is drawn on top of
colours, patterns and zones, and also over an imported design.

## 6. Logo and Name tabs

**Logo** – *Upload Logo*, *Add Text*, *Search Club Logos* (football-logos.cc, fan / non-commercial use only) and
**My Logos** (everything in `library/logos`, filtered by category). Select a logo on the canvas to move, resize
(with the ratio lock) and rotate it, or use the X / Y / width / height fields and the position presets
(chest, sleeve, shorts, back). Logo colour: *Original*, *Colour* (replaces the logo colour; transparent areas stay
transparent) or *Gradient*; *Trim / Outline* adds an inside, centre or outside outline.

**Name** – the player name and number on the back, and the shorts number: font, colour, outline, size, position.
They are drawn in the texture only when you tick the option; the game normally uses its own fonts.

## 7. Importing a finished design

*File → Import design…* loads a PNG / JPG / WebP / DDS (DXT1 / DXT3 / DXT5 / BGRA) kit texture, ideally
1024 × 1024 or 2048 × 2048 in the PES layout. *Replace design* makes it the base layer; *Overlay* draws it over the
parts with an opacity. You can switch between *Colour* and *Imported design* any time in **Layer → Kit base**.

## 8. Exporting

*File → Export kit…* (or the red button):

| Format | Use |
|---|---|
| **PNG** | editing or preview (1024 or 2048 px) |
| **DDS** | DXT1 / DXT5 / BGRA with mipmaps, for mod tools |
| **FTEX** | written directly (one `.ftex` file, mipmaps inside, FtexTool layout); tested in PES 2021 |
| **Project (.peskit)** | save and share the whole kit |
| **Showcase card** | a picture of the kit |

Keep a copy of the file you replace in your game before testing a new one. DDS and 2048 px output has not been
tested in the game yet.

### Kitserver (config.txt) – experimental

This only edits the config file: the 2D/3D preview does not follow its values yet.

*File → Kitserver (config.txt)…* edits the `config.txt` that kserv.lua (Sider) reads for one kit. The form follows
kserv's own menu and limits; *Edit as text* shows the file itself. *Import config.txt* loads an existing config and
keeps its comments and any key the form does not show. File names are written without `.ftex`: kserv only uses files
inside the kit's own folder, and an empty name or a missing file means the game's own file.

*Save to kit folder…* asks for the kit folder (for example `content/kit-server/<team>/p1`) and writes `config.txt` and
`<KitFile>.ftex` there. It asks before overwriting. The kit is not added to `order.ini` or `map.txt`; do that yourself.

## 9. Projects, autosave, languages

- Your work is autosaved in the browser / app storage. *File → Save project…* keeps named projects or downloads a
  `.peskit` file; *Open project…* loads one.
- *Settings → Language*: English, Bahasa Indonesia, Português, Español.
- *Edit → Undo / Redo* (`Ctrl+Z`, `Ctrl+Y`).

## 10. Shortcuts

`Ctrl+Z` undo · `Ctrl+Y` redo · scroll = zoom · drag = pan · `Enter` finish drawing · `Esc` cancel ·
`Backspace` remove last point · arrows / `Shift`+arrows nudge the selected logo by 1 / 10 px · `Delete` removes it.
