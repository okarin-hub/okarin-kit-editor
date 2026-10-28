# Catatan rilis

[English](../en/CHANGELOG.md) · [Kembali ke README](../../README.id.md)

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
