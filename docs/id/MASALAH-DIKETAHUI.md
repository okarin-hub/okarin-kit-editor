# Masalah yang diketahui dan keterbatasan

[English](../en/KNOWN-ISSUES.md) · [Kembali ke README](../../README.id.md)

Prioritas: **P1** mengganggu hasil, **P2** mengganggu pemakaian, **P3** penyempurnaan. Pull request yang memperbaiki
salah satunya sangat disambut (lihat [Berkontribusi](KONTRIBUSI.md)).

## Sudah dan belum diuji

- **Export FTEX terbukti terbaca di PES 2021** (diuji pembuat).
- **Export DDS berfungsi:** game sendiri hanya membaca FTEX, dan DDS dari aplikasi yang diubah ke FTEX dengan tool
  DDS → FTEX terbaca di PES 2021 (diuji pembuat). DDS disediakan untuk tool lain dan kit creator yang membutuhkannya.
- **Output 2048 px belum diuji di game.** Buka hasilnya di aplikasi gambar dulu.
- Hanya Chrome / Edge (dan build Electron) yang diuji. Layar sentuh dan ponsel kecil tidak didukung.

## Import template (PSD / PNG) — eksperimental

| # | Pri | Masalah | Ide |
|---|---|---|---|
| 1 | P2 | **Pemetaan bagian masih tebakan.** Bagian layer ditebak dari persentase piksel di tiap area; layer yang melintasi banyak area sering ditempel ke bagian yang salah. Setelah konversi, klik sebuah layer di laporan untuk mengubah bagiannya (langsung disimpan). | Tampilkan tebakan di pratinjau sebelum menyimpan. |
| 2 | P3 | **PSD template resmi berisi banyak layer yang hanya membantu desainer** (mesh, bayangan, jahitan titik-titik, panduan, mask, latar). Sekarang tidak dicentang secara bawaan (115 layer jadi 19 di PSD resmi 2019, dengan label alasannya); tombol *Semua* tetap memilihnya. Filter memakai nama (Inggris dan Jepang) dan ukuran, jadi nama yang tidak biasa bisa lolos atau layer berguna bisa ikut berlabel. | Pratinjau tiap layer. |
| 3 | P2 | **Sebagian efek PSD masih tidak terbawa:** layer style (drop / inner shadow, stroke, glow, bevel, overlay warna / pola), layer adjustment, dan layer isi gradasi / pola; layer teks tanpa piksel dilewati (rasterize dulu). Blend mode, clipping mask, layer mask dan vector mask, shape layer, serta opacity / mask grup sudah dibaca. Layer yang di-clip hanya berbaur dengan layer dasarnya, dan selama satu bagian difokuskan di tampilan 2D, layer ber-blend hanya berbaur dengan layer template (3D dan export tetap tepat). | Layer style (stroke dan drop shadow dulu). |
| 4 | P3 | Konversi PSD besar butuh waktu (115 layer ≈ 20 detik di browser uji) dan berjalan di main thread. Tiap layer kini hanya diproses di dalam kotaknya sendiri dan mask diunggah 4 sekaligus. | Web Worker. |
| 6 | P2 | Zona mask tidak bisa diedit titik demi titik atau diberi bentuk tepi. | "Ubah mask jadi poligon". |
| 8 | P2 | Pemisahan PNG per warna sudah lebih baik tetapi tetap perkiraan: tepi anti-alias dan warna noise diserap ke wilayah di sekitarnya, namun gradasi dan desain berbayang masih pecah menjadi beberapa warna, dan maksimal 80 zona. Sebuah zona warna ikut ke setiap bagian yang memuat beberapa puluh pikselnya, jadi daftar bagiannya bisa lebih banyak dari dugaan. | Penghalusan tepi per zona, pratinjau bagian. |
| 10 | P3 | Hanya layer piksel; grup tidak dipertahankan sebagai folder. Fill opacity PSD diabaikan. | |

## Template dan layer

| # | Pri | Masalah |
|---|---|---|
| 11 | P2 | Zona template bawaan dikalibrasi dari UV model. Zona celana kini memakai koordinat game (hem di x 0 / 1024); zona bahu dan lengan panjang belum dicek di game. |
| 12 | P2 | Satu layer = satu bentuk di semua bagian terpilih. Bagian punya posisi UV berbeda, jadi layer yang menempel ke banyak bagian bisa hanya mengenai sebagian. |
| 13 | P2 | Menggeser layer di model 3D bisa melompat di sambungan UV, dan arah geser tidak persis arah mouse di bahu. |
| 15 | P3 | Jahitan layer hanya mengikuti tepi persegi / poligon; layer mask tidak dijahit. Opsi per garis jahit (warna, tebal, sembunyi) belum ada. |
| 16 | P3 | Edit titik melebur transformasi dan bentuk sisi ke dalam poligon. |

## Penyimpanan

| # | Pri | Masalah |
|---|---|---|
| 18 | P3 | Undo / redo belum mencakup pilihan zona, edit titik yang sedang berjalan, dan pergantian template. |

## Preview 3D

| # | Pri | Masalah |
|---|---|---|
| 19 | P3 | **Panjang lengan dan kaus kaki di 3D hanya tombol preview.** Kerah, model celana, lengan Kappa, dan baju ketat mengikuti config kit, tapi game mengambil panjang lengan dan kaus kaki dari pemain, jadi preview tidak bisa tahu. (Lengan panjang kini memakai lengan panjang asli dari model, bukan tabung buatan lagi.) |
| 20 | P2 | **Hem baju menutupi bagian atas celana** di preview, jadi logo yang ditaruh dekat pinggang di area celana tersembunyi di bawah baju. Bagian kaki celana (ShortsModel 1–16) menampilkan sisi luar mulai x 17; x 0–17 tidak ada di model. |
| 21 | P3 | Material kain masih sederhana (tanpa normal map atau pencahayaan realistis). |
| 51 | P3 | **Beberapa kerah lebar berbagi piksel dengan celana** (mis. 63–67, 70, 71, 77, 79, 81–86, 90, 100, 102, 103, 106, 107, 110, 114, 125): modelnya membaca x 704–848 (atau 205–320) di y 967–972, tempat celana juga berada. Itu layout tekstur PES, jadi di game pun ujung kerah itu menampilkan desain celana di sana. |
| 49 | P3 | **Tidak ada di model 3D:** Collar 134–135 dan ShortsModel 0 / 17 tidak punya model di scene CometKIT; preview memakai model 1 untuk nilai itu. Kerah PS4 di scene itu salinan kerah PC, jadi tidak dimasukkan. Lengan kiper hanya ada sebagai lengan panjang dan tanpa potongan Kappa. |
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

## Kitserver dan fontset (ditambahkan di 0.2.0)

| # | Pri | Masalah |
|---|---|---|
| 37 | P3 | **Eksperimental:** preview 3D mengikuti *Kerah*, *Model celana*, *Model lengan pendek*, dan *Baju ketat* dari editor config.txt, juga nilai nama dan nomor (posisi, ukuran, regangan, jarak angka, nomor dada, sisi nomor celana) yang diatur di tab *Nama*. Penempatannya diukur di game memakai tekstur grid (masih bisa meleset beberapa piksel tekstur, dan ukuran font PES di game berbeda per font); *Model celana* 0 dan 1 sudah diukur, model celana lain memakai posisi model 1; *Tipe nomor punggung* belum dipratinjau. *Model baju* dan kerah musim dingin hanya ditulis ke file. Badge lengan hanya tampil sebagai penanda (game yang menggambar badge kompetisi); lengan pendek model 3D lebih pendek dari di game, jadi penandanya terlihat lebih pipih. Bila font PES dipilih di tab Nama, jarak antar karakternya masih perkiraan (nomor punggung dari satu pengukuran, nama dan nomor lain ditebak). |
| 38 | P3 | Output FTEX generator fontset sudah diuji di PES 2021 (nomor dan nama tampil di game); output DDS-nya belum diuji. Slot karakter diambil dari template modder (tiga fontset cocok sampai ±5 px), bukan dari file game; satu slot di file `_ex` (antara Ę dan Ğ) kosong di semua sampel dan dibiarkan kosong. |
| 39 | P3 | Karakter yang tidak ada di font yang dipilih digambar dengan font cadangan; pengecekannya membandingkan bentuk dan bisa terlewat kalau font cadangannya mirip. Huruf yang lebih lebar dari slotnya dipersempit ke samping. |
| 40 | P3 | Import gambar font: huruf yang menempel dipisah di kolom paling tipis, yang bisa memotong sedikit salah satunya; pengenalan membandingkan bentuk dengan font umum dan mengandalkan urutan alfabet di gambar, jadi huruf yang sangat dekoratif atau gambar yang urutannya acak perlu dikoreksi lewat teks baris. Pada latar yang sangat ramai (garis neon, cahaya) pemisahan otomatis masih bisa mengambil potongan latar: pakai *Pilih huruf* di jendela import. Pola juga menutupi outline. Huruf beraksen belum dirakit dari gambar (diambil dari font cadangan). |
| 41 | P3 | Huruf dari gambar font di-trace menjadi garis tepi vektor saat diperbesar, jadi tepinya tajam, tetapi gelombang atau penyok yang memang ada di gambar tetap terbawa, dan huruf yang sangat kecil (di bawah sekitar 40 px) bisa kehilangan detail terhalusnya. Pakai gambar terbesar dan terbersih yang kamu punya. |
| 42 | P2 | **Pola dari foto jersey ditunda dan masih perlu disempurnakan.** Fitur ini berjalan pada foto mockup produk (diuji dengan satu kit, depan dan belakang) tetapi masih perkiraan: perspektif, lengkung badan, dan lipatan membuat garis lurus melengkung; pada dua warna pola yang satu rona (biru muda / biru tua) sebagian bayangan masih terbawa; pola di balik logo atau nomor besar diteruskan sepanjang arah utamanya, jadi bisa putus di tempat pola berbelok; kotak badan otomatis tidak mengambil sisi badan (gambar ulang kotaknya untuk mengambil lebih banyak). Lengan dan bahu diambil dari foto (sejak 0.3.2) tetapi dipadatkan ke bentuk lengan PES: kotak lengan yang dimulai dari bahu membuat pola memendek sepanjang lengan, dan area lengan panjang tetap warna utama. Strip, hoops, strip miring, sash, dan baju polos dikenali lalu dibangun ulang sebagai layer pola (baru diuji dengan mockup buatan); chevron, kotak-kotak, pinstripe, dan pola tiga warna atau lebih belum. Motif bebas (marmer, sapuan kuas, cipratan cat) tidak dikenali dan hasil layer warnanya juga kurang baik: warna aksen yang tipis jatuh di bawah batas, dan pola yang ada di sisi badan berada di luar kotak badan bawaan. Yang masih harus dikerjakan: lebih banyak foto uji asli. Warna pola tipis di bawah batas (bawaan 8 %) dianggap logo. | Diuji ulang dengan tiga versi warna satu desain (sash diagonal, motif tone-on-tone, lengan raglan): gradasi satu warna kini jadi satu warna, dan sash bertepi pudar tetap ada (dikenali sebagai satu pita miring); sash ditemukan sendiri (tandai dengan *+ Warna pola* kalau tidak), dan lengan polos dengan warna sendiri (raglan) memakai warna itu; lengan bermotif dengan warna sendiri belum terbaca.

## Tab Layer (ditambahkan di 0.3.0)

| # | Pri | Masalah |
|---|---|---|
| 43 | P3 | Memindah pola atau objek ke grup lain dan mengubah ukuran panel samping perlu mouse; dengan keyboard, tombol panah hanya mengubah urutan di dalam grup. |
| 44 | P3 | Pola tampil paling atas di grupnya tetapi selalu digambar di bawah layer template grup itu, jadi urutan daftar antara pola dan layer template bukan urutan gambarnya. |
| 45 | P3 | Semua salinan objek kembar berukuran sama. Mengedit titik objek kembar yang diputar membuat arah kembarnya lurus lagi (mengikuti sumbu tekstur). |
| 46 | P3 | **Baca PSD:** PSD dikonversi oleh app selama app terbuka (PSD 30 layer butuh sekitar 10 sampai 30 detik). Template baca-PSD yang sudah kamu ubah di editor (layer ditambah, dihapus, atau dipindah bagian) tidak diperbarui saat PSD disimpan ulang; pilih ulang dari daftar. Slot warna menggabungkan layer berdasarkan abu-abu yang persis sama, jadi dua layer yang kebetulan abu-abunya sama juga berbagi warna, dan satu layer belum bisa dilepas dari slotnya. |
| 52 | P3 | **Grup layer dan Merge (0.6.0):** layer gambar hasil merge disimpan di dalam proyek / template (beberapa ratus KB per gabungan). Proyek dari 0.6.0 yang dibuka di versi lama tidak menampilkan folder (layernya tetap lengkap), dan hasil merge satu warna dari bentuk yang bertumpuk bisa berlubang di bagian tumpukannya. |

## Ditambahkan di 0.4.0

| # | Pri | Masalah |
|---|---|---|
| 47 | P3 | **Pembaruan dari aplikasi** baru ada mulai 0.4.0: pengguna 0.3.3 ke bawah perlu mengunduh 0.4.0 manual sekali. Updater 0.4.0 bisa gagal dengan "ZIP decompression failed" (diperbaiki di 0.4.1): coba lagi atau unduh zip-nya manual. Fitur ini butuh internet ke GitHub dan hanya jalan di aplikasi Windows (tidak dari source, tidak di browser). Kalau penyalinan gagal di tengah (file dikunci program lain), unduh zip-nya manual; folder `library` tidak pernah disentuh. |
| 48 | P3 | Kuas hapus menyimpan area hapus tiap layer di 1024 px dalam ruang layer itu sendiri; layer yang diperbesar jauh menampilkannya sedikit lebih lembut. *Simpan sebagai template* tidak membawa area hapusnya (tetap tersimpan di proyek). |
