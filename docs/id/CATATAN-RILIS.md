# Catatan rilis

[English](../en/CHANGELOG.md) · [Kembali ke README](../../README.id.md)

## 0.3.2 (eksperimental) — lengan dari foto jersey, ukuran huruf dan posisi outline di generator fontset

Pre-release eksperimental: bagian baru sudah berjalan tetapi masih perlu disempurnakan. Tetap pakai 0.3.1 untuk versi stabil.

- **Lengan dan bahu dari foto jersey:** *Pola dari foto jersey* kini juga mengambil pola lengan dan bahu (sebelumnya
  hanya diberi warna utama). Tiap foto mendapat dua kotak lengan kuning di samping kotak badan, ditebak dari garis luar
  baju; pilih *Lengan kiri gambar* / *Lengan kanan gambar* di atas foto untuk menggambar ulang salah satunya. Lengan yang
  miring diluruskan (tiap baris diregangkan dari tepi luar ke tepi dalam baju), foto depan mengisi setengah depan tiap
  lengan dan foto belakang setengah belakangnya (tanpa foto belakang, foto depan dipakai untuk keduanya), dan strip
  bahu sampai leher meneruskan bagian atas lengan. Lengan dibaca dengan warna pola badan. *Lengan dan bahu dari foto*
  mematikannya.
- **Ukuran huruf dan posisi outline di generator fontset:** *Ukuran %* (50–150) membesarkan atau mengecilkan nomor atau
  huruf nama di garis dasar, untuk font yang hasilnya kecil di slotnya. *Posisi outline* menaruh outline di luar huruf
  (seperti sebelumnya), di tengah tepinya, atau di dalamnya (inline). Huruf yang melewati kotak slotnya ditandai kotak
  kuning dan didaftar di bawah pratinjau, dan *Simpan ke folder kit…* bertanya dulu sebelum menyimpannya (di game huruf
  itu akan dipadatkan atau terpotong).

## 0.3.1 — gambar font: sheet vertikal dan huruf lebih mulus

- **Huruf lebih mulus dari gambar font kecil:** pemisahan latar otomatis memotong tepi anti-alias menjadi tangga piksel yang keras (dari sekitar 300 piksel tepi bercampur di angka setinggi 145 px hanya 66 yang tersisa), dan setelah diperbesar tiga kali tangga itu terlihat bergerigi. Piksel tepi kini mempertahankan bagian hurufnya (campuran antara warna latar dan warna huruf yang diukur), sehingga garis tepi hasil trace mengikuti tepi aslinya, dan warnanya dibersihkan dari warna latar lama (tidak ada pinggiran gelap). Lengkung hasil trace juga kehilangan dua sumber takik kecil: dua pegangan di satu titik lengkung kini searah (sebelumnya dibelokkan terpisah pada segmen panjang, membuat patahan kecil di tiap titik), dan huruf kecil yang akan diperbesar dihaluskan sedikit lebih kuat, karena gambarnya tidak membawa detail di bawah setengah piksel. Sisi yang hampir datar / tegak hanya diluruskan bila garis lurusnya tetap menempel di tepi.
- **Lubang huruf dari gambar tertutup:** lubang dengan satu sudut lancip (lubang bawah angka 8 di sebagian font) ter-trace sebagai garis datar dan ikut terisi, dengan cincin putus-putus di tepinya. Piksel tunggal di tepi badge juga tidak lagi meninggalkan lubang kecil di karakter.
- **Mewarnai ulang gambar font tetap menjaga logonya:** *Ganti warna gambar dengan warna isi* kini hanya mengganti warna utama tiap karakter; warna yang jelas berbeda (badge klub di nomor, warna kedua) tetap. Tepi anti-alias ikut warna baru.
- **Gambar font vertikal:** gambar font dengan satu karakter per baris (kolom angka, dibaca dari atas ke bawah) kini dibaca sebagai satu baris; sebelumnya setiap baris dibuang sebagai tanda tunggal dan tidak ada yang ditemukan. Gambar yang redup juga lebih terbaca: ambang pemisah karakter dari latar kini mengikuti kontras gambarnya sendiri (angka abu tua di latar hitam ditemukan).

## 0.3.0 — editor lebih rapi: pola dan objek di grup layer

Tab Layer disusun ulang: pola dan objek bentuk ada di grup baju, celana, kaus kaki, dan aksesoris dan dipindah
antargrup dengan diseret; penjelasan pindah ke ikon **?** dan *Bantuan → Panduan*. Juga baru: objek kembar, panel
samping untuk pengaturan layer, dialog Pengaturan, pintasan keyboard, dan pola dari foto jersey (eksperimental).

**Semua yang bisa dilakukan editor di 0.3.0**
- **Canvas dan 3D:** canvas 2D dan pratinjau 3D dengan satu renderer yang sama untuk 2D, 3D, dan export; bentuk
  potongan asli, tekstur 3D tanpa sambungan, lengan sampai bahu atau tanpa bahu; navigasi bebas, daftar bagian untuk
  zoom ke satu bagian, kemiringan 3D; tampilan split.
- **Tab Layer:** grup baju, celana, kaus kaki, dan aksesoris, masing-masing berisi layer template, **pola** (jenis,
  warna, skala, ketebalan, opasitas, geser, rotasi, cermin / simetri, bagian grup, urutan) dan **objek** (strip,
  panel, elips, segitiga, dengan kembar); seret antargrup, cari, layer bantuan PSD di daftar sendiri; warna bagian
  dengan kode warna, palet, dan *Samakan*; lis; warna latar; warna bagian atau desain impor sebagai dasar. Pengaturan
  terbuka di bawah baris atau di panel samping yang bisa diubah ukurannya.
- **Kain:** layer tekstur kain di tab Kain (mesh bawaan atau tile sendiri dari `library/textures`).
- **Alat:** garis jahitan (titik atau bebas), bentuk bebas / titik, penghapus pola.
- **Logo, nama, dan nomor:** logo dari `library/logos`, unggah, atau cari logo klub, dengan outline, gradasi, ganti
  warna, preset, dan *Auto Align*; nama pemain, nomor punggung, dan nomor celana.
- **Template:** template bawaan (dengan pemberitahuan pembaruan untuk salinan yang diedit) dan template sendiri dari
  PSD atau PNG yang dipisah per warna (eksperimental), disimpan di `library/templates`.
- **Import dan export:** import desain jadi (PNG / JPG / WebP / DDS); export PNG, DDS, FTEX (sudah diuji di
  PES 2021), file proyek, dan kartu showcase di 1024 / 2048 px.
- **Menu Alat (eksperimental):** pola dari foto jersey, generator fontset untuk font nomor dan nama kitserver, editor
  config.txt kitserver.
- **Antarmuka:** menu bar, rel alat, pintasan keyboard, panel yang bisa dilipat; Pengaturan (bahasa: English, Bahasa
  Indonesia, Português, Español; pengaturan layer); panduan, daftar pintasan, cek pembaruan.
- **Build Windows** dengan Electron; folder library di sebelah exe awalnya kosong.

**Baru**
- **Pengaturan dan panel samping untuk layer.** *Edit → Pengaturan…* (`Ctrl+,`) berisi bahasa dan pengaturan layer: terbuka di bawah baris (seperti sebelumnya) atau di panel samping di kiri daftar layer, jadi daftarnya tetap pendek; ukuran panel samping bisa diubah dari tepi kiri dan bawahnya (diingat). Gandakan dan hapus pindah ke baris layer di samping fokus, dan *Reset* ke atas pengaturan layer, jadi tidak perlu scroll ke bawah.
- **Objek di samping pola.** Tiap grup di tab Layer juga punya **+ Objek** (strip, panel, elips, segitiga), menggantikan baris *Tambah layer di*. Objek bisa diseret ke grup lain seperti pola (posisi dan ukurannya menyesuaikan bagian baru; `Ctrl` menyalin). Pengaturan baru *Kembar*: satu objek digambar 2, 3, atau lebih kali berjajar, dengan jumlah, jarak, dan arah, tanpa menambah layer; template yang disimpan menyimpan salinannya sebagai bentuk biasa.
- **Pola di grup layer.** Kartu *Layer Pola* terpisah dihapus: tiap grup di tab Layer (Baju, Celana, Kaus kaki, Aksesoris) punya **+ Pola** dan menampilkan polanya paling atas. Seret baris pola ke grup lain untuk memindahkannya, tahan `Ctrl` saat melepas untuk menyalinnya; kotak centang bagian diganti tombol untuk bagian di grup itu.
- **Editor lebih rapi.** Tab Layer mengelompokkan layer per baju, celana, kaus kaki, dan aksesoris (grup besar mulai tertutup), mengumpulkan layer bantuan PSD (mesh, panduan, jahitan, bayangan, latar) di daftar tertutup sendiri, dan menambah kolom cari saat layernya banyak; tombol baris muncul saat hover. Penjelasan dipindah dari paragraf yang selalu tampil ke ikon **?** di samping tiap judul dan ke *Bantuan → Panduan*. Satu warna aksen: biru untuk yang aktif atau terpilih, merah hanya untuk aksi utama (Export), kuning hanya untuk eksperimental / peringatan; teks abu lebih kontras dan tidak ada teks di bawah 10 px. Menu bar kini *File · Edit · Tampilan · Alat · Bantuan*: preset warna ada di *Edit*, alat eksperimental (pola dari foto, generator fontset, config.txt kitserver) di *Alat*, bahasa di *Edit → Pengaturan*. Strip bagian di bawah canvas diganti daftar bagian di toolbar.
- **Pintasan keyboard:** `V` `B` `P` `S` `J` `E` memilih alat, `1` / `2` / `3` mengganti 2D / Split / 3D, `Ctrl+S` membuka proyek, `Ctrl+E` export, `?` daftar pintasan. *Kit baru* bertanya dulu sebelum mengganti kit. Fokus keyboard selalu terlihat, dialog diumumkan sebagai dialog, dan tombol ikon punya nama untuk pembaca layar.
- **Pola dari foto jersey (eksperimental)** (*Alat → Pola dari foto jersey…*): ambil foto produk sebuah baju (depan, dan belakang kalau ada) dan dapatkan pola badannya sebagai layer warna yang bisa diedit. Area badan dicari otomatis dan bisa digambar ulang; warna pola dicari dengan pencahayaan dinetralkan, dan kalau warna pola berbeda rona hanya rona yang dipakai sehingga bayangan, lipatan, dan kerutan diabaikan; setiap area yang dibatasi tepi tajam mendapat satu warna (lipatan yang melintasi garis pola ikut warna garis itu); area warna digambar sebagai bentuk vektor yang bersih; logo, sponsor, nomor, dan nama dibuang dan areanya diisi dengan meneruskan pola sepanjang arah utamanya. Bagian belakang dibaca dengan warna dari depan. Hasilnya dibuka di import PNG "pisah per warna". Lengan diberi warna utama.
- **Huruf tajam dari gambar font.** Huruf yang perlu diperbesar (gambar kecil, atau nomor punggung yang besar) di-trace menjadi garis tepi vektor lalu digambar di ukuran slot, bukan memperbesar pikselnya. Garis tepi dibaca dari tepi anti-alias dengan ketelitian sub-piksel; sudut ke arah mana pun mengikuti bentuk aslinya: sudut tajam di titik pertemuan sisi-sisi lurus, sudut yang sedikit membulat mendapat lengkung yang sama, sisi lurus benar-benar lurus dan yang hampir tegak / datar dibuat tegak / datar sempurna, dan lengkungan mulus. Warna asli gambar tetap ada di dalam garis tepi (huruf dua warna dan garis-garis tetap terjaga).
- **Import PNG: gambar yang tidak persegi** kini bisa diregangkan (seperti sebelumnya), dipaskan utuh (sisanya kosong), atau dipotong ke persegi (bagian tengah dipakai), di import "pisah per warna" maupun "1 file = 1 layer".
- **File template lebih kecil:** mask dari template hasil import PSD / PNG disimpan hanya seluas area yang ditutupinya beserta posisinya, bukan gambar penuh 1024 × 1024 per mask. Template yang disimpan sebelumnya tetap berfungsi.
- **Layer berbayang tetap berbayang:** layer PSD / PNG abu-abu atau berbayang yang diwarnai dengan warna zona kini mempertahankan terang-gelapnya (bagian paling terang tepat berwarna zona), bukan jadi satu warna rata. Import ulang templatenya untuk mendapatkannya; layer yang diimpor sebelumnya tetap rata.
- **Template bawaan yang sudah diedit diberi tahu soal pembaruan:** saat template bawaan yang kamu ubah punya definisi lebih baru, panel Template memberi tahu. *Pakai versi baru* mengambil zona bawaan yang baru dan mempertahankan warna serta layer dan jahitan yang kamu tambahkan sendiri (perubahan bentuk pada zona bawaan hilang); *Abaikan* menyembunyikan pemberitahuan sampai pembaruan berikutnya.
- **Import PSD / PNG sedikit lebih cepat:** tiap layer hanya diproses di dalam kotaknya sendiri, mask diunggah 4 sekaligus, dan halaman diberi waktu menggambar ulang hanya tiap 0,1 detik (PSD PES 2019, 115 layer: sekitar 27 → 23 detik di browser uji). Hasilnya sama seperti sebelumnya.
- **Preview 3D: miringkan tampilan.** Tahan tombol tengah mouse (tombol scroll) lalu geser ke atas / bawah untuk melihat kit dari atas atau dari bawah; tombol tampilan mengembalikan kamera ke posisi datar. Seret kiri tetap memutar, scroll tetap zoom.

**Diperbaiki**
- **Tampilan Split setelah 3D:** kembali dari 3D ke Split tidak lagi membuat preview 3D tetap lebar penuh dan mendorong canvas 2D keluar layar.
- **Zona celana di template bawaan berada seperempat kaki di atas hem.** Zona itu memakai koordinat model 3D (hem di x 81), bukan koordinat game (hem di x 0): lis, panel samping, dan garis celana di template Klasik, Polo, Raglan, Yoke, Tiga garis, dan Panel samping kini mulai dari hem. Template yang sudah kamu edit tetap memakai zonanya sendiri sampai kamu mengambil pembaruannya (lihat di bawah).
- **Tidak ada lagi yang hilang saat reload atau di file proyek:** layer tekstur kain (tab Kain) tersimpan di autosave dan di proyek / file `.peskit`, dan sebuah proyek juga menyimpan config.txt kitserver serta pengaturan generator fontset (font, warna, outline, format, pola, logo beserta geser per angka). Gambar font yang diimpor dan logo yang diambil dari file di komputer tidak ikut tersimpan (impor ulang saja).
- **Tidak ada lagi peringatan konsol** soal tipe bayangan lembut three.js yang sudah dihapus dan soal jumlah layer Konva yang terlalu banyak (canvas 2D kini memakai 5 layer).

## 0.2.0 — kitserver: config.txt, fontset, dan tab Layer yang lebih ringkas

Font nomor dan nama dari generator fontset sudah diuji di PES 2021 dalam format FTEX dan tampil di game. Output
DDS dari generator belum diuji di game.

**Semua yang bisa dilakukan editor di 0.2.0**
- **Canvas dan 3D:** canvas 2D dan pratinjau 3D dengan satu renderer yang sama untuk 2D, 3D, dan export; bentuk
  potongan asli, tekstur 3D tanpa sambungan, lengan sampai bahu atau tanpa bahu; navigasi bebas dan pintasan bagian;
  tampilan split.
- **Bagian dan warna:** tab Layer berisi setiap bagian dengan editor warnanya (kode warna, palet, *Samakan* depan ↔
  belakang / kiri ↔ kanan) dan lisnya; warna latar; warna bagian atau desain impor sebagai dasar.
- **Pola dan kain:** layer pola (jenis, warna, skala, ketebalan, opasitas, geser, rotasi, cermin / simetri, bagian,
  urutan) dan layer tekstur kain di tab Kain (mesh bawaan atau tile sendiri dari `library/textures`).
- **Layer dan alat:** garis jahitan (titik atau bebas), bentuk bebas / titik, zona template, penghapus pola.
- **Logo, nama, dan nomor:** logo dari `library/logos`, unggah, atau cari logo klub, dengan outline, gradasi, ganti
  warna, preset, dan *Auto Align* untuk dada, punggung, lengan, celana, dan kaus kaki; nama pemain, nomor punggung,
  dan nomor celana.
- **Template:** template sendiri dari PSD atau PNG yang dipisah per warna (eksperimental), disimpan di
  `library/templates`.
- **Import dan export:** import desain jadi (PNG / JPG / WebP / DDS); export PNG, DDS, FTEX (sudah diuji di
  PES 2021), file proyek, dan kartu showcase di 1024 / 2048 px.
- **Kitserver (baru):** editor config.txt dan generator fontset untuk font nomor dan nama (di bawah).
- **Antarmuka:** menu bar, rel alat, panel yang bisa dilipat; English, Bahasa Indonesia, Português, Español; bantuan,
  pintasan, cek pembaruan.
- **Build Windows** dengan Electron; folder library di samping exe awalnya kosong.

**Baru**
- **Generator fontset (eksperimental)** (*File → Generator fontset…*): membuat tekstur font nomor dan nama kitserver dari font apa pun (bawaan, `library/fonts`, atau yang terpasang di PC) dengan warna isi dan outline. Nomor punggung 4096×512, nomor dada dan celana 2048×256, font nama 2048×512, dan file `_ex` berisi huruf beraksen 2048×1024. Setiap karakter ditaruh di slot tetap yang diukur dari template modder, dengan skala dan garis dasar yang sama; aksen yang lebih tinggi dari ruang di atas huruf dipadatkan, tidak dipotong. Karakter yang tidak ada di font ditampilkan. *Simpan ke folder kit…* menulis file `.ftex` (atau DDS / PNG untuk diedit di aplikasi lain) dan mengisi namanya ke config.txt.
  - **Dari gambar font:** import gambar huruf dan/atau angka — PNG, JPG, atau gambar apa pun. Sebelum dibaca, jendela import menampilkan gambarnya: tarik kotak untuk mengambil area yang diinginkan saja, dan lihat hasil pemisahan huruf dari latar (latar polos dikenali sendiri; untuk latar gradasi atau ramai pilih warna latar dan warna huruf lalu atur toleransi; bintik noise JPG dibuang). Dengan *Pilih huruf* tepi huruf tetap halus (setiap piksel tepi dibaca sebagai campuran warna huruf dan latar, tanpa sisa warna latar), dan huruf dari gambar kecil diperbesar dengan mulus tanpa tangga piksel. Baris dan karakter dicari otomatis (huruf yang menempel dipisah) dan setiap karakter **dikenali**: bentuknya dibandingkan dengan A–Z / 0–9 dari font umum lalu barisnya disejajarkan dengan urutan alfabet, sehingga huruf ganda dilewati dan huruf yang hilang dilaporkan tanpa menggeser sisanya. Setiap baris menampilkan karakternya dengan hasil bacaan di bawahnya (yang kurang yakin berwarna kuning) dan bisa dikoreksi; karakter yang tidak ada di gambar diambil dari font yang dipilih dengan warna gambar. Bisa ganti warna dan outline.
  - **Logo di nomor:** badge klub atau liga (dari `library/logos` atau file) di setiap angka, dengan ukuran, posisi, opasitas, geser per angka (untuk angka yang tengahnya tidak simetris seperti 4 atau 7), dan opsi dipotong mengikuti bentuk angka; untuk nomor punggung, dada, dan/atau celana.
  - **Pola di dalam huruf:** tile dari `library/patterns` di atas nomor dan/atau nama, diwarnai ulang atau dengan warna aslinya, dengan ukuran dan opasitas.
- **Editor config.txt kitserver (eksperimental)** (*File → Kitserver (config.txt)…*): semua pengaturan yang dibaca kserv.lua (model baju dan kerah, posisi nama dan nomor, nomor celana, warna kit, badge lengan, nama file tekstur) dengan batas nilai dari kserv 1.13; nilai di luar batas ditandai. *Impor config.txt* membuka config yang sudah ada dan menjaga komentar, urutan, dan key yang tidak dikenal; *Ambil warna dari kit* mengisi warna dari warna bagian kit. *Simpan ke folder kit…* menulis `config.txt` dan tekstur kit (FTEX DXT5 dengan mipmap, tanpa nama/nomor) ke folder kit yang kamu pilih, dengan konfirmasi sebelum menimpa file; browser tanpa pemilih folder mengunduh kedua file itu.
- **Tab Warna kini menjadi tab Kain** dan hanya berisi layer tekstur kain. Warna, palet, dan *Samakan* sebuah bagian terbuka di editor di bawah barisnya di tab Layer (klik nama atau roda gigi); klik bagian di canvas atau tombol fokusnya tetap di tab Layer, tidak lagi pindah ke tab lain.
- **Nomor celana:** ditaruh di sisi kaki yang menghadap depan di bawah hem baju dan diputar 90° supaya terbaca tegak (kaki celana disimpan miring di tekstur, hem di x 0). Proyek yang masih memakai posisi bawaan lama dipindahkan otomatis. Ada slider baru *Ukuran Nomor Celana*.
- **Nomor punggung:** slider ukuran sampai 220 px (sebelumnya 130) dan nomor bisa ditaruh lebih ke bawah di punggung (Y sampai 400).

**Diperbaiki**
- **Menyimpan font atau folder kit gagal** dengan *Must be handling a user gesture to show a file picker* saat
  pembuatan tekstur lebih lama dari beberapa detik (laptop lambat atau panas). Sekarang folder ditanyakan dulu, baru
  file dibuat.
- **Import gambar font berlatar ramai** (garis neon, cahaya) menggabungkan satu baris menjadi satu potongan dan angka
  besar hilang. Sekarang bentuk dicari satu per satu, garis latar dibuang berdasarkan bentuknya, angka besar di samping
  huruf kecil tetap diambil, dan baris sejenis dibaca bersama sehingga huruf yang tidak biasa di akhir baris tidak
  lagi tertukar dengan huruf pertama baris berikutnya.
- **Huruf outline (berongga)** terbuang sebagai latar dan **huruf dua warna** kehilangan warna keduanya di mode
  otomatis.
- **Huruf bergerigi dari gambar:** huruf yang diperbesar dari gambar kecil dan tepi hasil *Pilih huruf* lebih halus
  (belum mulus sepenuhnya, lihat masalah 41).
- **Pratinjau fontset ikut ter-scroll** bersama pengaturan; sekarang pengaturan dan pratinjau di-scroll terpisah.
- **Tombol fokus dan klik bagian** pindah ke tab lain, tidak tetap di tab Layer.
- **Nomor celana** memakai posisi tebakan lama yang tertutup hem baju.
- Peringatan nilai di editor config.txt tidak diterjemahkan.

## 0.1.1 — perbaikan dan tekstur dari pustaka

**Baru**
- **Tekstur kain dari pustaka.** Taruh gambar tile (swatch mesh, rajutan, atau tenunan) di `library/textures` dan pakai di layer tekstur kain; tampil di 2D, 3D, dan semua export. Lihat [Menambah logo sendiri](MENAMBAH-LOGO.md).
- **Import PSD lebih sedikit sampah.** Layer yang hanya membantu desainer (mesh, jahitan, bayangan, panduan, mask, garis tipis, seukuran kanvas) tidak dicentang secara bawaan dan diberi label alasan (115 layer jadi 19 di PSD resmi 2019). Setelah konversi, klik sebuah layer untuk mengubah bagiannya; perubahan langsung disimpan. ZIP yang dinamai `.psd` kini memberi pesan yang jelas.
- **Import PNG (pisah per warna) lebih cerdas.** Area kecil sebuah warna tidak lagi hilang: tulisan sponsor putih di dada dulu terbuang karena putih yang sama di kaus kaki dan cuff lebih besar, sehingga zonanya hanya ditempel ke bagian itu. Sekarang sebuah zona ikut ke setiap bagian yang memuat beberapa puluh pikselnya. Latar kosong dikenali dari posisinya (hampir tidak ada piksel di bagian kit), bukan dari ukurannya, jadi kit berwarna navy tidak lagi memulai dengan warna utamanya dimatikan. Campuran anti-alias dan warna noise diserap ke wilayah yang berbatasan dan bintik digabung (pada uji sintetis daftar warna turun dari 21 ke 4 dan bintik dari 2382 ke 204).
- **Ratakan Otomatis** punya tombol Kaus Kaki Kanan / Kiri.

**Diperbaiki**
- **Logo yang dipindah ke bagian lain hilang dari model 3D dan export.** Logo dipotong mengikuti bagian tempat ia dibuat, jadi logo yang dibuat di dada lalu diseret ke celana atau lengan tampil di 2D tetapi terpotong habis di 3D. Sekarang bagiannya adalah yang berada di bawah titik tengah logo.
- **Penempatan logo di lengan, celana, dan kaus kaki.** Logo baru dan tombol *Ratakan Otomatis* sekarang mendarat di sisi yang menghadap depan pada model 3D, diputar supaya terbaca tegak (celana dan lengan disimpan miring di tekstur). Sebelumnya logo di celana ditaruh di tengah area, yang tertutup hem baju (hanya x 0-148 dari area celana 336 px yang terlihat di preview), dan kaus kaki tidak punya posisi awal sama sekali (logonya masuk ke dada).
- **Logo yang diputar salah tempat di canvas 2D.** Logo yang punya rotasi (semua logo di punggung baju mulai dari 180°) berputar di pojok kiri atasnya di 2D, tetapi di titik tengahnya di preview 3D dan export, jadi tampilan 2D menggesernya sejauh satu lebar / tinggi logo.
- **Konversi PNG / PSD gagal** dengan pesan *part harus salah satu dari ...* saat sebuah warna atau layer jatuh di area credit. `credit` sekarang diterima di template.
- **Pindah antara tampilan 2D, 3D, dan split** tidak lagi membangun ulang scene 3D: kamera dan mode lengan tetap, dan konteks WebGL tidak lagi bocor, yang dulu bisa mengosongkan tampilan 3D setelah banyak pindah.

## 0.1.0 — rilis publik pertama

Okarin Kit Editor (sebelumnya proyek pribadi) kini open source dengan lisensi GPL-3.0, lengkap dengan build Windows.

**Canvas dan 3D**
- Canvas 2D (Konva) dan preview 3D (Three.js) dengan satu renderer bersama untuk 2D, 3D, dan export.
- Bentuk potongan asli untuk baju depan / belakang, lengan, celana, dan kaus kaki; tekstur tanpa celah di model 3D.
- **Bentuk lengan:** sampai pundak (mengikuti template PES, pundak ikut warna lengan) atau tanpa pundak.
- Navigasi bebas di canvas 2D (scroll untuk zoom, seret untuk geser); pintasan part memfokuskan satu bagian.

**Warna, pola, kain**
- **Layer pola:** banyak per kit, masing-masing dengan jenis, warna, skala, ketebalan, opasitas, geser, rotasi,
  cermin / simetris, berulang nyala / mati, pilihan bagian, dan urutan. Pola tunggal lama dipindahkan otomatis.
- **Layer tekstur kain** (micro-mesh, honeycomb, twill, ribbing, dan tiga jersey mesh) per bagian, digambar di atas
  warna, pola, dan zona, dan juga di atas desain impor.
- Lis (manset, ujung bawah, kerah, karet kaus kaki) sebagai layer dengan mata; lis celana di sisi yang benar.
- Warna latar, terpisah dari warna bagian.
- **Pilihan layer dasar:** warna bagian atau desain impor; warna bagian bisa ditumpuk di atas desain dengan opasitas
  per bagian.

**Layer, alat, jahitan**
- Garis jahit sebagai layer: titik (opsi lengkung) atau bebas; bisa dihapus; jahitan tepi mati secara bawaan.
- Bentuk bebas dan titik, zona template, kuas hapus pola, semua dari rail alat bergaya Photoshop.

**Logo dan teks**
- Logo dari `library/logos` milikmu (tanpa logo bawaan), upload, pencarian logo klub, kunci rasio, posisi X / Y,
  preset posisi, ganti warna, gradasi, outline di dalam / tengah / luar.

**Import dan export**
- Import desain jadi (PNG / JPG / WebP / DDS) sebagai dasar atau overlay.
- Export PNG, DDS, **FTEX** (ditulis langsung; diuji di PES 2021), file proyek, dan kartu showcase 1024 / 2048 px.

**Antarmuka**
- Menu bar (File, Edit, Tampilan, Preset, Pengaturan, Bantuan), rail alat di kiri, kartu panel yang bisa dilipat.
- Bahasa: English (bawaan), Bahasa Indonesia, Português, Español.
- Bantuan: dokumentasi, pintasan, cek pembaruan, kredit, tentang.

**Pengemasan**
- Build Windows dengan Electron; folder library di sebelah exe awalnya kosong.

Lihat [Masalah yang diketahui](MASALAH-DIKETAHUI.md) untuk yang belum ada.

## 0.0.1 — build privat pertama

Build Windows dari editor pertama yang berfungsi (warna, pola, template, logo, export PNG / DDS / FTEX).
