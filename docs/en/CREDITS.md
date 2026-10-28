# Credits and third-party notices

[Bahasa Indonesia](../id/KREDIT.md) · [Back to README](../../README.md)

## Okarin Kit Editor

Created by **okarin-hub**. The source code is released under the [GPL-3.0](../../LICENSE).

> Okarin Kit Editor is an unofficial fan tool. It is **not affiliated with, endorsed by or sponsored by Konami**.
> PES, Pro Evolution Soccer and eFootball are trademarks of their owners. Club, league and sponsor names and logos are
> trademarks of their respective owners.

## Third-party assets that are shipped

| Asset | Where | Notes |
|---|---|---|
| **3D kit model** `public/model/pes_kit.glb` | 3D preview | Taken from the **CometKIT previewer** (a community kit-preview tool). It is **not** covered by the GPL and its original author's terms are not known to the maintainer. It is included so the preview works out of the box. If you are the rights holder and want it removed, please open an issue. You can replace it with your own model (keep the UV layout). |

Nothing else from other kit tools, game files or template packs is included. In particular the repository contains
**no logos, no kit templates and no official PES template images**: the `library` folder is empty on purpose and
`public/templates` is not shipped.

## Data sources

- **football-logos.cc** — the optional *Search Club Logos* feature downloads logos from this site on your computer.
  The site allows informative, editorial and fan (non-commercial) use only. Respect its licence. Nothing is bundled.

## Libraries

| Library | Use | License |
|---|---|---|
| [Next.js](https://nextjs.org/), [React](https://react.dev/) | app framework | MIT |
| [Konva](https://konvajs.org/), [react-konva](https://github.com/konvajs/react-konva), [use-image](https://github.com/konvajs/use-image) | 2D canvas | MIT |
| [Three.js](https://threejs.org/) | 3D preview | MIT |
| [Tailwind CSS](https://tailwindcss.com/), PostCSS, Autoprefixer | styling | MIT |
| [lucide-react](https://lucide.dev/) | icons | ISC |
| [ag-psd](https://github.com/Agamnentzar/ag-psd) | experimental PSD import | MIT |
| [Supabase JS](https://github.com/supabase/supabase-js) | optional cloud save | MIT |
| [Electron](https://www.electronjs.org/), [@electron/packager](https://github.com/electron/packager), [@electron/asar](https://github.com/electron/asar) | Windows desktop build | MIT |
| clsx, tailwind-merge | helpers | MIT |

The FTEX writer follows the file layout documented by **FtexTool** by Atvaark (MIT). The DDS reader / writer
implements the public DDS format.

Each library keeps its own license; see `package.json` and `node_modules/<name>/LICENSE`.

## Thanks

Everyone in the PES modding community who documented the texture layout and file formats, and everyone who tests and
reports issues.
