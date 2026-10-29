# Catatan rilis

[English](../en/CHANGELOG.md) · [Kembali ke README](../../README.id.md)

## Belum dirilis

- **Tab Warna kini menjadi tab Kain** dan hanya berisi layer tekstur kain. Warna, palet, dan *Samakan* sebuah bagian terbuka di editor di bawah barisnya di tab Layer (klik nama atau roda gigi); klik bagian di canvas atau tombol fokusnya tetap di tab Layer, tidak lagi pindah ke tab lain.
- **Nomor celana:** ditaruh di sisi kaki yang menghadap depan di bawah hem baju dan diputar 90° supaya terbaca tegak (kaki celana disimpan miring di tekstur, hem di x 0). Proyek yang masih memakai posisi bawaan lama dipindahkan otomatis. Ada slider baru *Ukuran Nomor Celana*.
- **Nomor punggung:** slider ukuran sampai 220 px (sebelumnya 130) dan nomor bisa ditaruh lebih ke bawah di punggung (Y sampai 400).

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
