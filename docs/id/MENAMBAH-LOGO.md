# Menambah logo sendiri (dan pola, tekstur kain, font)

[English](../en/ADDING-LOGOS.md) · [Kembali ke README](../../README.id.md)

Okarin Kit Editor dibagikan **tanpa logo, pola, font, atau template bawaan**. Semua yang kamu tambahkan ada di folder
`library`. Aplikasi membaca folder itu sendiri: tidak perlu mengubah kode dan tidak perlu build ulang.

## 1. Di mana folder library?

| Cara menjalankan | Folder library |
|---|---|
| **Exe Windows** (zip rilis) | folder `library` **di sebelah** `Okarin Kit Editor.exe` (dibuat saat pertama dijalankan) |
| **Dari source** (`npm run dev`) | `library/` di root proyek |
| **Lokasi lain** | isi variabel lingkungan `KIT_LIBRARY_DIR` dengan folder mana pun sebelum aplikasi dijalankan |

Isinya:

```
library/
├─ logos/       logo, sponsor, badge        (PNG, JPG, WebP, SVG, GIF)
├─ patterns/    tile pola                   (PNG, JPG, WebP, SVG, GIF)
├─ textures/    tile tekstur kain           (PNG, JPG, WebP, SVG, GIF)
├─ fonts/       font                        (TTF, OTF, WOFF, WOFF2)
└─ templates/   template milikmu            (.json, lihat TEMPLATE.md)
```

## 2. Menambah logo

1. Salin gambar logo ke `library/logos/`.
2. Di aplikasi buka tab **Logo**, lalu tekan **Muat ulang** (atau refresh halaman).
3. Logo muncul di **Logo Saya**. Klik untuk menambahkannya ke kit, lalu geser, ubah ukuran, putar, dan ganti
   warnanya di canvas.

Tips:

- **Sub-folder = kategori.** `library/logos/sponsor/acme-bank.png` tampil di kategori *sponsor* dengan nama
  *Acme Bank*. Folder yang disarankan: `brand/` (merek apparel), `sponsor/`, `klub/` (crest). Boleh memakai nama
  apa pun; tombol kategori di tab dibuat dari nama-nama itu.
- **Nama file = nama tampil.** Garis bawah dan strip menjadi spasi, tiap kata berhuruf kapital
  (`my_club-crest.png` → *My Club Crest*).
- **Format terbaik:** PNG atau WebP dengan latar transparan, atau SVG. Ukuran sekitar 500–1000 px sudah cukup.
- **Logo satu warna** (hitam, putih, atau transparan) bisa diganti warnanya: pilih logo → *Warna Logo* →
  *Warna* atau *Gradasi*, dan tambah outline bila perlu.
- Logo ditanam di proyek (file `.peskit`) sebagai data, jadi proyek tetap portabel walau file-nya dihapus dari
  library.
- File dan folder yang namanya diawali `.` diabaikan.

## 3. Cari logo klub dari internet (opsional)

*Tab Logo → Cari Logo Klub* mencari klub, liga, dan turnamen di football-logos.cc lalu mengunduh logonya ke
`library/logos/football-logos/`. Logo itu adalah merek dagang pemiliknya dan situsnya hanya mengizinkan pemakaian
**informatif, editorial, dan fan (non-komersial)**; ikuti lisensi mereka. Folder ini diabaikan Git.

## 4. Menambah tile pola

Salin gambar tile ke `library/patterns/`, tekan **Muat ulang** di kartu *Layer Pola*, tambah layer pola lalu pilih
gambarnya sebagai jenis. Tile sebaiknya bisa diulang mulus. Tile satu warna atau transparan bisa diwarnai dengan
*Warna Pola*; tile berwarna dipakai apa adanya. Skala, geser, rotasi, cermin, dan opasitas bekerja seperti pola
bawaan.

## 5. Menambah tekstur kain

Salin gambar tile (swatch mesh, rajutan, atau tenunan) ke `library/textures/`, tekan **Muat ulang** di kartu *Layer Tekstur
Kain*, buka sebuah layer lalu pilih gambarnya di *Tekstur dari Pustaka*. Gambar diulang (tile) di bagian yang dipakai
layer dan tampil di canvas 2D, preview 3D, dan semua hasil export. *Ukuran Pori / Serat* mengatur ukuran tile (1,0 = 64 px
dari tekstur 1024 px) dan *Intensitas* mengatur kekuatannya. Tile sebaiknya bisa diulang mulus. Pola terang atau gelap
di latar transparan paling cocok.

## 6. Menambah font

Salin `.ttf` / `.otf` / `.woff` / `.woff2` ke `library/fonts/`. Nama file (tanpa ekstensi) menjadi nama font,
misalnya `Bebas Neue.ttf` → *Bebas Neue*. Font yang terpasang di Windows juga bisa dimuat lewat *Muat font terpasang
di PC* di pemilih font (Chrome / Edge meminta izin).

## 7. Menambah template

Lihat [Template sendiri](TEMPLATE.md).

## 8. Untuk yang mem-fork repositori

Isi `library/` (kecuali file `README.txt`) **sengaja** ada di `.gitignore`. Jangan commit logo, template kit, atau
karya orang lain: biasanya itu merek dagang atau berhak cipta. Simpan di komputermu sendiri, atau bagikan lewat
repositori / rilis terpisah yang memang kamu berhak menerbitkannya.
