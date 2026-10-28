# Kredit dan pemberitahuan pihak ketiga

[English](../en/CREDITS.md) · [Kembali ke README](../../README.id.md)

## Okarin Kit Editor

Dibuat oleh **okarin-hub**. Kode sumbernya dirilis dengan lisensi [GPL-3.0](../../LICENSE).

> Okarin Kit Editor adalah alat fan tidak resmi. **Tidak berafiliasi, tidak didukung, dan tidak disponsori Konami.**
> PES, Pro Evolution Soccer, dan eFootball adalah merek dagang pemiliknya. Nama dan logo klub, liga, dan sponsor adalah
> merek dagang pemilik masing-masing.

## Aset pihak ketiga yang disertakan

| Aset | Lokasi | Catatan |
|---|---|---|
| **Model 3D kit** `public/model/pes_kit.glb` | preview 3D | Diambil dari **CometKIT previewer** (alat preview kit dari komunitas). Model ini **tidak** tercakup GPL dan ketentuan dari pembuat aslinya tidak diketahui pengelola. Disertakan agar preview langsung jalan. Kalau kamu pemegang haknya dan ingin ini dihapus, buka issue. Kamu bisa menggantinya dengan modelmu sendiri (tata letak UV harus sama). |

Tidak ada yang lain dari alat kit lain, file game, atau paket template yang disertakan. Khususnya repositori ini
**tidak berisi logo, template kit, maupun gambar template resmi PES**: folder `library` sengaja kosong dan
`public/templates` tidak disertakan.

## Sumber data

- **football-logos.cc** — fitur opsional *Cari Logo Klub* mengunduh logo dari situs ini ke komputermu. Situsnya hanya
  mengizinkan pemakaian informatif, editorial, dan fan (non-komersial). Hormati lisensinya. Tidak ada yang disertakan.

## Pustaka

| Pustaka | Kegunaan | Lisensi |
|---|---|---|
| [Next.js](https://nextjs.org/), [React](https://react.dev/) | kerangka aplikasi | MIT |
| [Konva](https://konvajs.org/), [react-konva](https://github.com/konvajs/react-konva), [use-image](https://github.com/konvajs/use-image) | canvas 2D | MIT |
| [Three.js](https://threejs.org/) | preview 3D | MIT |
| [Tailwind CSS](https://tailwindcss.com/), PostCSS, Autoprefixer | gaya tampilan | MIT |
| [lucide-react](https://lucide.dev/) | ikon | ISC |
| [ag-psd](https://github.com/Agamnentzar/ag-psd) | import PSD eksperimental | MIT |
| [Supabase JS](https://github.com/supabase/supabase-js) | simpan cloud opsional | MIT |
| [Electron](https://www.electronjs.org/), [@electron/packager](https://github.com/electron/packager), [@electron/asar](https://github.com/electron/asar) | build desktop Windows | MIT |
| clsx, tailwind-merge | pembantu | MIT |

Penulis FTEX mengikuti tata letak file yang didokumentasikan oleh **FtexTool** karya Atvaark (MIT). Pembaca / penulis
DDS mengimplementasikan format DDS yang terbuka.

Tiap pustaka memakai lisensinya sendiri; lihat `package.json` dan `node_modules/<nama>/LICENSE`.

## Terima kasih

Semua orang di komunitas modding PES yang mendokumentasikan tata letak tekstur dan format file, dan semua yang
menguji serta melaporkan masalah.
