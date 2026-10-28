# Changelog

[Bahasa Indonesia](../id/CATATAN-RILIS.md) · [Back to README](../../README.md)

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
