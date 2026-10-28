# Okarin Kit Editor

[English](README.md) | **Bahasa Indonesia**

Editor kit untuk **PES 2021**. Desain kit di canvas tekstur 2D, lihat hasilnya langsung di model 3D, lalu export
tekstur (PNG, DDS, atau FTEX) untuk dipakai di game. Bisa dijalankan di browser (Next.js) dan sebagai aplikasi desktop
Windows (Electron).

> Okarin Kit Editor adalah alat fan tidak resmi. Tidak berafiliasi dengan Konami. PES / eFootball adalah merek dagang
> pemiliknya. Lihat [Kredit](docs/id/KREDIT.md).

## Unduh

Build Windows siap pakai ada di halaman [**Releases**](../../releases). Unduh `.zip`, ekstrak, lalu buka
`Okarin Kit Editor.exe` (tanpa instalasi). Windows SmartScreen bisa memberi peringatan karena aplikasi belum
ditandatangani: pilih *More info* → *Run anyway*.

Folder `library` di sebelah exe awalnya **kosong**: tambahkan logo, pola, font, dan template milikmu sendiri
(lihat [Menambah logo sendiri](docs/id/MENAMBAH-LOGO.md)).

## Fitur

- Canvas 2D (Konva) dan preview 3D (Three.js) berdampingan, dengan renderer yang sama untuk keduanya dan untuk export.
- Warna bagian, **layer pola** (boleh banyak per kit, masing-masing dengan ukuran, rotasi, geser, cermin, bagian),
  layer tekstur kain, lis, kerah, ban kapten, dan kotak kredit.
- **Pilihan layer dasar:** warna bagian, atau desain kit jadi yang di-import (warna bisa ditumpuk di atasnya).
- Bentuk lengan: sampai pundak (template PES) atau tanpa pundak.
- Logo dan teks dengan kunci rasio, posisi X/Y, ganti warna, gradasi, dan outline. Pustaka logo milikmu sendiri.
- Garis jahit (titik dengan opsi lengkung, atau bebas), bentuk bebas / titik, zona template, kuas hapus pola.
- Nama dan nomor pemain, nomor celana.
- Export: **PNG**, **DDS** (DXT1 / DXT5 / BGRA, mipmap), **FTEX** (ditulis langsung, sudah diuji di PES 2021),
  file proyek `.peskit`, kartu showcase. 1024 atau 2048 px.
- Bahasa: English, Bahasa Indonesia, Português, Español. Undo / redo, autosave, proyek tersimpan.

## Menjalankan dari source

Kebutuhan: Node.js 20+ dan npm.

```bash
git clone https://github.com/okarin-hub/okarin-kit-editor.git
cd okarin-kit-editor
npm install
npm run dev        # http://localhost:3000
```

Perintah lain: `npm run build` (build produksi), `npm run electron:dev` (shell desktop), `npm run pack:win`
(paket Windows). Detail di [Membangun](docs/id/MEMBANGUN.md).

## Dokumentasi

| English | Bahasa Indonesia |
|---|---|
| [User guide](docs/en/USER-GUIDE.md) | [Panduan pengguna](docs/id/PANDUAN-PENGGUNA.md) |
| [Adding your own logos](docs/en/ADDING-LOGOS.md) | [Menambah logo sendiri](docs/id/MENAMBAH-LOGO.md) |
| [Custom templates (JSON)](docs/en/TEMPLATES.md) | [Template sendiri (JSON)](docs/id/TEMPLATE.md) |
| [Known issues](docs/en/KNOWN-ISSUES.md) | [Masalah yang diketahui](docs/id/MASALAH-DIKETAHUI.md) |
| [Building and packaging](docs/en/BUILDING.md) | [Membangun dan mengemas](docs/id/MEMBANGUN.md) |
| [Contributing](docs/en/CONTRIBUTING.md) | [Berkontribusi](docs/id/KONTRIBUSI.md) |
| [Changelog](docs/en/CHANGELOG.md) | [Catatan rilis](docs/id/CATATAN-RILIS.md) |
| [Credits and third-party](docs/en/CREDITS.md) | [Kredit dan pihak ketiga](docs/id/KREDIT.md) |

## Struktur proyek

```
src/app            aplikasi Next.js (page.tsx adalah editor), API route untuk folder library
src/components     canvas (Konva), viewer 3D (Three.js), panel UI, menu
src/utils          renderer bersama (pola, kain, template, logo), generator tekstur, encoder DDS / FTEX
src/constants      tata letak bagian PES 2021 (outline), preset, pola
src/i18n           kamus terjemahan dan penerjemah di tempat
electron           shell desktop        scripts/pack-win.cjs   pengemas Windows
library            logo, pola, font, template milikmu (kosong di repositori)
public/model       model 3D untuk preview
```

## Kontribusi dan fork

Fork dan pull request dipersilakan. Baca dulu [Berkontribusi](docs/id/KONTRIBUSI.md). Jangan commit logo, template
kit, atau karya orang lain ke repositori: folder `library` sengaja diabaikan Git.

## Lisensi

[GPL-3.0](LICENSE). Aset pihak ketiga dan merek dagang tercatat di [Kredit](docs/id/KREDIT.md); semuanya tetap
memakai ketentuan masing-masing dan tidak tercakup lisensi ini.
