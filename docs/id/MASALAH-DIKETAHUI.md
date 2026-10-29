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
| 1 | P2 | **Pemetaan bagian masih tebakan.** Bagian layer ditebak dari persentase piksel di tiap area; layer yang melintasi banyak area sering ditempel ke bagian yang salah. Setelah konversi, klik sebuah layer di laporan untuk mengubah bagiannya (langsung disimpan). | Tampilkan tebakan di pratinjau sebelum menyimpan. |
| 2 | P3 | **PSD template resmi berisi banyak layer yang hanya membantu desainer** (mesh, bayangan, jahitan titik-titik, panduan, mask, latar). Sekarang tidak dicentang secara bawaan (115 layer jadi 19 di PSD resmi 2019, dengan label alasannya); tombol *Semua* tetap memilihnya. Filter memakai nama (Inggris dan Jepang) dan ukuran, jadi nama yang tidak biasa bisa lolos atau layer berguna bisa ikut berlabel. | Pratinjau tiap layer. |
| 3 | P1 | **Efek PSD tidak terbawa:** mode blend, efek layer (bayangan, stroke, overlay warna), clipping mask, layer penyesuaian, smart object, teks dan bentuk vektor. | Dukung clipping mask dan mode blend dasar; rasterize otomatis. |
| 4 | P2 | Konversi PSD besar lambat (tiap layer diproses 1024 × 1024 di main thread). | Web Worker, crop mask ke kotak pembatas, unggah paralel. |
| 5 | P2 | Mask disimpan ukuran penuh walau isinya kecil (112 layer ≈ 3,4 MB). | Simpan mask yang di-crop dengan offset. |
| 6 | P2 | Zona mask tidak bisa diedit titik demi titik atau diberi bentuk tepi. | "Ubah mask jadi poligon". |
| 7 | P2 | Mask dicat satu warna, jadi layer abu-abu kehilangan nuansanya. | Mode "pertahankan luminansi". |
| 8 | P2 | Pemisahan PNG per warna sudah lebih baik tetapi tetap perkiraan: tepi anti-alias dan warna noise diserap ke wilayah di sekitarnya, namun gradasi dan desain berbayang masih pecah menjadi beberapa warna, dan maksimal 80 zona. Sebuah zona warna ikut ke setiap bagian yang memuat beberapa puluh pikselnya, jadi daftar bagiannya bisa lebih banyak dari dugaan. | Penghalusan tepi per zona, pratinjau bagian. |
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
| 20 | P2 | **UV celana adalah perkiraan.** Model hanya memakai x 81–320 area celana, game memakai x 0–330. Preview meregangkan sisi luar (x 81 → 0, sekitar 1,34×) agar area 2D tampil di 3D; faktor itu bukan hasil ukur dari model game. Di preview, hem baju juga menutupi bagian atas celana, jadi hanya sekitar x 0-148 dari area celana 336 px (celana kanan: 876-1024) yang terlihat; logo yang ditaruh lebih ke dalam tersembunyi di bawah baju. |
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

## Logo, impor, dan kain (ditambahkan di 0.1.1)

| # | Pri | Masalah |
|---|---|---|
| 28 | P3 | Canvas 2D menampilkan logo utuh, tetapi preview 3D dan export memotongnya ke bagian yang ada di bawah titik tengahnya. Logo yang melintasi dua bagian hanya tampil potongan di dalam bagian itu di 3D. |
| 29 | P3 | Logo yang kamu seret ke celana atau lengan tetap memakai rotasinya. Bagian itu disimpan miring di tekstur, jadi atur rotasi ke 90° / -90° (tombol *Ratakan Otomatis* dan logo baru melakukannya sendiri). |
| 30 | P3 | Posisi anchor logo dan lengan berasal dari model CometKIT, bukan dari game. Di game hem baju bisa menutupi celana dengan cara berbeda, jadi periksa kit yang sudah jadi di PES. |
| 31 | P3 | Pola dan tekstur kain dari pustaka disimpan di proyek lewat path file (logo ditanam di proyek). Kalau filenya dihapus dari `library`, layernya kosong setelah dimuat ulang. |
| 32 | P3 | PSD dari template PES 2019 punya tata letak berbeda dari tekstur 2021, sehingga banyak layer jatuh di bagian yang salah; perbaiki dari laporan setelah konversi. |
| 33 | P3 | Impor PSD / PNG yang gagal di tengah meninggalkan folder kosong di `library/templates`; hapus manual. |
| 34 | P3 | Pemisahan PNG per warna pada desain bermotif halftone atau dither masih bisa menghasilkan banyak potongan kecil. Naikkan toleransi warna. |

## Kitserver (belum dirilis)

| # | Pri | Masalah |
|---|---|---|
| 35 | P2 | Config kitserver dan *Simpan ke folder kit* baru diuji di browser, belum dengan kserv di dalam game atau dialog folder di aplikasi desktop. |
| 36 | P3 | config.txt disimpan per browser/aplikasi, bukan di file proyek: membuka proyek lain tetap memakai config yang sekarang. |
| 37 | P3 | **Eksperimental:** editor config.txt hanya menulis file. Nilainya (posisi nama/nomor, badge, model kerah dan baju) tidak tampil di pratinjau 2D/3D: posisi memakai satuan game yang masih perlu dikalibrasi dari screenshot di game, dan model kerah/baju adalah mesh game yang tidak dimiliki app. |
| 38 | P2 | **Eksperimental:** generator fontset belum diuji di game. Slot karakter diambil dari template modder (tiga fontset cocok sampai ±5 px), bukan dari file game; satu slot di file `_ex` (antara Ę dan Ğ) kosong di semua sampel dan dibiarkan kosong. |
| 39 | P3 | Karakter yang tidak ada di font yang dipilih digambar dengan font cadangan; pengecekannya membandingkan bentuk dan bisa terlewat kalau font cadangannya mirip. Huruf yang lebih lebar dari slotnya dipersempit ke samping. |
