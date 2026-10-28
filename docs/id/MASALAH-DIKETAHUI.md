# Masalah yang diketahui dan keterbatasan

[English](../en/KNOWN-ISSUES.md) · [Kembali ke README](../../README.id.md)

Prioritas: **P1** mengganggu hasil, **P2** mengganggu pemakaian, **P3** penyempurnaan. Pull request yang memperbaiki
salah satunya sangat disambut (lihat [Berkontribusi](KONTRIBUSI.md)).

## Sudah dan belum diuji

- **Export FTEX terbukti terbaca di PES 2021** (diuji pembuat).
- **Export DDS dan output 2048 px belum diuji di game.** Buka hasilnya di aplikasi gambar dulu.
- Hanya Chrome / Edge (dan build Electron) yang diuji. Layar sentuh dan ponsel kecil tidak didukung.

## Import template (PSD / PNG) — eksperimental

| # | Pri | Masalah | Ide |
|---|---|---|---|
| 1 | P1 | **Pemetaan bagian hanya tebakan.** Bagian layer ditebak dari persentase piksel di tiap area; layer yang melintasi banyak area atau memenuhi 1024 × 1024 sering ditempel ke bagian yang salah atau ke banyak bagian. | Biarkan pengguna memperbaiki bagian di pratinjau sebelum menyimpan. |
| 2 | P1 | **PSD template resmi menghasilkan banyak layer tak berguna** (mesh, bayangan, garis jahit titik-titik, UV, background) yang jadi zona dan menutupi desain. | Filter layer penuh / opasitas rendah / bernama "mesh", "uv", "background". |
| 3 | P1 | **Efek PSD tidak terbawa:** mode blend, efek layer (bayangan, stroke, overlay warna), clipping mask, layer penyesuaian, smart object, teks dan bentuk vektor. | Dukung clipping mask dan mode blend dasar; rasterize otomatis. |
| 4 | P2 | Konversi PSD besar lambat (tiap layer diproses 1024 × 1024 di main thread). | Web Worker, crop mask ke kotak pembatas, unggah paralel. |
| 5 | P2 | Mask disimpan ukuran penuh walau isinya kecil (112 layer ≈ 3,4 MB). | Simpan mask yang di-crop dengan offset. |
| 6 | P2 | Zona mask tidak bisa diedit titik demi titik atau diberi bentuk tepi. | "Ubah mask jadi poligon". |
| 7 | P2 | Mask dicat satu warna, jadi layer abu-abu kehilangan nuansanya. | Mode "pertahankan luminansi". |
| 8 | P2 | PNG pisah-warna kasar: tepi bergerigi, gradasi pecah jadi banyak layer, maksimal 80 zona. | Penghalusan tepi, penggabungan cluster, pratinjau. |
| 9 | P2 | Gambar tidak persegi diregangkan ke 1024 × 1024 tanpa pilihan fit / crop. | Opsi fit / crop / regang. |
| 10 | P3 | Hanya layer piksel; grup tidak dipertahankan sebagai folder. Fill opacity PSD diabaikan. | |

## Template dan layer

| # | Pri | Masalah |
|---|---|---|
| 11 | P1 | Zona template bawaan dikalibrasi dari UV model; sebagian masih meleset di bahu, celana, dan lengan panjang. |
| 12 | P2 | Satu layer = satu bentuk di semua bagian terpilih. Bagian punya posisi UV berbeda, jadi layer yang menempel ke banyak bagian bisa hanya mengenai sebagian. |
| 13 | P2 | Menggeser layer di model 3D bisa melompat di sambungan UV, dan arah geser tidak persis arah mouse di bahu. |
| 14 | P2 | Template yang sudah kamu ubah tidak diperbarui otomatis saat definisi bawaannya berubah (memilih ulang mengembalikan ke awal). |
| 15 | P3 | Jahitan layer hanya mengikuti tepi persegi / poligon; layer mask tidak dijahit. Opsi per garis jahit (warna, tebal, sembunyi) belum ada. |
| 16 | P3 | Edit titik melebur transformasi dan bentuk sisi ke dalam poligon. |

## Penyimpanan

| # | Pri | Masalah |
|---|---|---|
| 17 | P2 | **Pengaturan layer tekstur kain belum tersimpan** di autosave atau `.peskit`; setelah dimuat ulang kembali ke bawaan. |
| 18 | P3 | Undo / redo belum mencakup pilihan zona, edit titik yang sedang berjalan, dan pergantian template. |

## Preview 3D

| # | Pri | Masalah |
|---|---|---|
| 19 | P2 | **Lengan panjang dibuat otomatis** (tabung meruncing): tanpa siku, tanpa lipatan, dan sambungan bahu bisa terlihat sempit dari sudut tertentu. Modelnya sendiri hanya punya lengan pendek. |
| 20 | P2 | **UV celana adalah perkiraan.** Model hanya memakai x 81–320 area celana, game memakai x 0–330. Preview meregangkan sisi luar (x 81 → 0, sekitar 1,34×) agar area 2D tampil di 3D; faktor itu bukan hasil ukur dari model game. |
| 21 | P3 | Material kain masih sederhana (tanpa normal map atau pencahayaan realistis). |
| 22 | P3 | Peringatan konsol: three.js `PCFSoftShadowMap has been removed`; Konva memperingatkan lebih dari 5 layer. |

## Aplikasi dan distribusi

| # | Pri | Masalah |
|---|---|---|
| 23 | P3 | Build Windows belum ditandatangani (peringatan SmartScreen) dan besar (sekitar 340 MB terurai, 130 MB zip) karena membawa Chromium dan Node. |
| 24 | P3 | Server dev bisa butuh 1–2 menit untuk kompilasi ulang di mesin lambat. Pakai `npm run build && npm start` untuk pemakaian harian. |
| 25 | P3 | **Terjemahan berupa kamus** (`src/i18n/dictionary.ts`) yang diterapkan pada teks layar. Teks UI baru yang belum ada di kamus tetap berbahasa Indonesia (bahasa sumber) di semua bahasa. Nama dari library-mu tidak pernah diterjemahkan. |
| 26 | P3 | *Bantuan → Cek pembaruan* butuh internet dan feed rilis yang bisa dijangkau. |
| 27 | P3 | Model 3D adalah aset pihak ketiga yang hak distribusinya tidak jelas (lihat [Kredit](KREDIT.md)). |
