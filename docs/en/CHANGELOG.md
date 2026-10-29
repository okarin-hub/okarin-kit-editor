# Changelog

[Bahasa Indonesia](../id/CATATAN-RILIS.md) · [Back to README](../../README.md)

## Unreleased

- **Kitserver config.txt editor (experimental)** (*File → Kitserver (config.txt)…*): every setting kserv.lua reads (shirt and collar model, name and number positions, shorts number, kit colours, sleeve badges, texture file names) with kserv 1.13's own limits; values outside them are flagged. *Import config.txt* opens an existing one and keeps its comments, order and unknown keys; *Take colours from the kit* fills the colour keys from the part colours. *Save to kit folder…* writes `config.txt` and the kit texture (FTEX DXT5 with mipmaps, without names/numbers) into the kit folder you pick, asking before it overwrites a file; browsers without a folder picker download the two files instead.
- **The Colour tab is now the Fabric tab** and only holds the fabric texture layers. A part's colour, palette and *Match* open in an editor under its row in the Layer tab (click the name or the gear); clicking a part on the canvas or its focus button stays in the Layer tab instead of jumping to another tab.
- **Shorts number:** placed where the leg faces the front below the shirt hem and turned 90° so it reads upright (the leg is stored sideways in the texture, hem at x 0). Projects that still have the old default position are moved automatically. New *Shorts Number Size* slider.
- **Back number:** the size slider goes up to 220 px (was 130) and the number can sit lower on the back (Y up to 400).

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
