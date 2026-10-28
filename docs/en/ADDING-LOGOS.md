# Adding your own logos (and patterns, fonts)

[Bahasa Indonesia](../id/MENAMBAH-LOGO.md) · [Back to README](../../README.md)

Okarin Kit Editor ships **without any logos, patterns, fonts or templates**. Everything you add lives in the
`library` folder. The app reads that folder by itself: no code changes, no rebuild.

## 1. Where is the library folder?

| How you run the app | Library folder |
|---|---|
| **Windows exe** (release zip) | the `library` folder **next to** `Okarin Kit Editor.exe` (created on first start) |
| **From source** (`npm run dev`) | `library/` in the project root |
| **Custom location** | set the environment variable `KIT_LIBRARY_DIR` to any folder before starting |

Inside it:

```
library/
├─ logos/       logos, sponsors, badges      (PNG, JPG, WebP, SVG, GIF)
├─ patterns/    pattern tiles                (PNG, JPG, WebP, SVG, GIF)
├─ fonts/       fonts                        (TTF, OTF, WOFF, WOFF2)
└─ templates/   your own templates           (.json, see TEMPLATES.md)
```

## 2. Add a logo

1. Copy the logo image into `library/logos/`.
2. In the app open the **Logo** tab and press **Reload** (or refresh the page).
3. The logo appears under **My Logos**. Click it to add it to the kit, then move, resize, rotate and recolour it on
   the canvas.

Tips:

- **Sub-folders are categories.** `library/logos/sponsor/acme-bank.png` shows up in the category *sponsor*
  with the name *Acme Bank*. Suggested folders: `brand/` (apparel makers), `sponsor/`, `klub/` or `club/` (crests).
  Use any names you like; the category chips in the tab are built from them.
- **The file name is the display name.** Underscores and dashes become spaces and words are capitalised
  (`my_club-crest.png` → *My Club Crest*).
- **Best formats:** PNG or WebP with a transparent background, or SVG. Around 500–1000 px is plenty.
- **Single-colour logos** (black, white or transparent) can be recoloured: select the logo → *Logo Colour* →
  *Colour* or *Gradient*, and add an outline if you want one.
- Logos are embedded in your project (`.peskit` file) as data, so a project stays portable even if the file is
  removed from the library.
- Files and folders starting with `.` are ignored.

## 3. Search club logos from the internet (optional)

*Logo tab → Search Club Logos* looks up clubs, leagues and tournaments on football-logos.cc and downloads a logo
into `library/logos/football-logos/`. Those logos are trademarks of their owners and the site allows **informative,
editorial and fan (non-commercial) use only**; follow their licence. This folder is ignored by Git.

## 4. Add a pattern tile

Copy a tile image into `library/patterns/`, press **Reload** in the *Pattern layers* card, add a pattern layer and pick
the image as its type. A tile should repeat seamlessly. Single-colour or transparent tiles can be tinted with the
*Pattern colour*; coloured tiles are used as they are. Scale, offset, rotation, mirror and opacity work as for
built-in patterns.

## 5. Add a font

Copy `.ttf` / `.otf` / `.woff` / `.woff2` into `library/fonts/`. The file name (without extension) becomes the font
name, for example `Bebas Neue.ttf` → *Bebas Neue*. Fonts installed on Windows can also be loaded with *Load fonts
installed on the PC* in the font picker (Chrome / Edge ask for permission).

## 6. Add a template

See [Custom templates](TEMPLATES.md).

## 7. For people who fork the repository

The contents of `library/` (except the `README.txt` files) are listed in `.gitignore` **on purpose**. Do not commit
logos, kit templates or other people's artwork: they are usually trademarks or copyrighted. Keep them on your own
machine, or share them in a separate repository / release that you have the rights to publish.
