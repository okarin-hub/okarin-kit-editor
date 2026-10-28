# Custom templates (JSON)

[Bahasa Indonesia](../id/TEMPLATE.md) · [Back to README](../../README.md)

A **template** adds coloured zones (collar piping, side panels, cuffs, stripes …) and extra stitch lines on top of the
part colours. Put a `.json` file in `library/templates/` (sub-folders are fine), press **Reload** in the Layer tab →
*Template* card and pick it from *My templates*.

You can also build one in the app (add layers, edit them, *Save as template*) and let the app write the file.
Importing a template from PSD / PNG is experimental (see [Known issues](KNOWN-ISSUES.md)).

## File shape

```json
{
  "id": "unique-name",
  "name": "Name shown in the list",
  "description": "Short text (optional)",
  "zones": [],
  "seams": []
}
```

`id` is optional (taken from the file name). A full example is in [`../examples/example-template.json`](../examples/example-template.json).

## Zones

```json
{
  "id": "side-front",
  "name": "Front side panel",
  "part": "front",
  "parts": ["back", "leftSleeve"],
  "rects": [[x, y, width, height]],
  "polygons": [[[x, y], [x, y], [x, y]]],
  "ellipses": [[x, y, width, height]],
  "mask": "mask/panel.png",
  "defaultColor": "#1d4ed8",
  "defaultVisible": true
}
```

- Coordinates are texture pixels (1024 × 1024).
- Fill at least one of `rects`, `polygons` (3+ points; a polygon inside a polygon is a hole), `ellipses` (bounding box)
  or `mask` (a 1024 × 1024 image, white / opaque = zone, path relative to the `.json` file).
- `part` is the part that bounds the zone; the zone is clipped to the part's shape so it never paints over another
  piece. `parts` is optional: extra parts where the same shape is also drawn.
- Masks created by the importers also use `"maskBox": [x, y, w, h]`, `"keepColor": true` (use the image's own colours)
  and `"initial": {"opacity": 0.6}`.

### Part names

| Name | Part |
|---|---|
| `front`, `back` | shirt front / back (**the back is stored upside-down**: hem at y = 0, neck at y = 452) |
| `leftSleeve` | sleeve on the **left** of the image (= the player's right sleeve), x 222–380, y 333–605 |
| `rightSleeve` | sleeve on the **right** of the image (= the player's left sleeve) |
| `leftShorts`, `rightShorts` | shorts on the left / right of the image |
| `leftSock`, `rightSock` | socks on the left / right of the image |
| `collar`, `armband` | collar band at the bottom, captain's armband |

**Shorts are rotated 90°:** the x axis runs along the leg (hem at the outer edge of the image, waist towards the
centre) and the y axis runs around the leg. Socks and sleeves use the normal direction.

## Extra stitch lines

```json
"seams": [ { "part": "front", "points": [[380, 452], [380, 938]], "smooth": false } ]
```

A straight or bent line; add `"closed": true` for a closed shape and `"smooth": true` for a curve through the
points. Stitching along the edge of each piece and zone is generated automatically (turn it on in *Stitch lines*).

## Tip: reading coordinates

Use **View → Overlay** to draw a labelled template guide over the canvas if you have one (put the image at
`public/templates/pes2021_template_labeled.png`; it is not shipped). The numbers in *Info UV Map* of the Colour tab
give the bounds of the selected part.
