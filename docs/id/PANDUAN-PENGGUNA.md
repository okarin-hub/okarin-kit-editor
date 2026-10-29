# Panduan pengguna

[English](../en/USER-GUIDE.md) · [Kembali ke README](../../README.id.md)

## 1. Tampilan layar

```
┌─ Menu bar: File  Edit  Tampilan  Preset  Pengaturan  Bantuan ──── [Export Kit] ┐
│ Rail │  2D | Split | 3D                                          zoom         │
│ alat │ ┌────────── Canvas 2D ───────────┐ ┌────────── Preview 3D ────────┐ ┌ Panel kanan ┐
│      │ │ tekstur (1024 x 1024)          │ │ kit di model 3D              │ │ Warna       │
│      │ └────────────────────────────────┘ └──────────────────────────────┘ │ Layer       │
│      │ Pintasan part: Shirt Front · Shirt Back · Lengan · Celana · Kaus kaki │ Logo        │
└──────┴─────────────────────────────────────────────────────────────────────  │ Nama        │
```

- **Menu bar** – *File* (kit baru, buka / simpan proyek, import desain, export), *Edit* (undo, redo, reset),
  *Tampilan* (wireframe, label, overlay), *Preset* (kit awal), *Pengaturan* (bahasa), *Bantuan* (panduan ini,
  pintasan, cek pembaruan, kredit, tentang).
- **Rail alat (kiri)** – pilih / geser, bentuk bebas, bentuk titik, garis jahit titik, garis jahit bebas, kuas hapus
  pola. Satu alat aktif sekali waktu; klik alat yang aktif lagi untuk kembali ke *pilih*.
- **Canvas 2D** – scroll untuk zoom, seret untuk geser. Klik bagian untuk memilihnya. Pintasan part di bawah
  men-zoom ke bagian itu.
- **Preview 3D** – seret untuk memutar, scroll untuk zoom. Tombol mengganti kamera (depan, belakang, dada, bawah,
  penuh) dan panjang lengan (pendek / panjang).
- **Panel kanan** – tab **Kain**, **Layer**, **Logo**, **Nama**.

Teksturnya adalah tekstur kit PES 2021 (1024 × 1024). **Punggung baju disimpan terbalik** (ujung bawah di atas,
leher di tengah) dan celana disimpan diputar 90°. Editor sudah menanganinya untukmu.

## 2. Mulai cepat

1. Menu *Preset* → pilih kit awal.
2. Tab **Layer** → ubah warna *Base baju*, *Base celana*, dan *Base kaus kaki* (buka barisnya untuk warna per bagian).
3. Tambahkan **layer pola**, **lis**, warna **kerah**, lalu **logo** (tab Logo) dan **nama / nomor** (tab Nama).
4. Cek preview 3D. Pilih *File → Export kit…* kalau sudah puas.

## 3. Tab Layer

Tab ini berisi kartu yang bisa dilipat (status buka / tutupnya diingat).

### Template
Template menambah **zona** berwarna (piping kerah, panel samping, panel bahu, manset, strip …) di atas warna bagian.
Pilih dari daftar (bawaan, atau milikmu di `library/templates`). Pilih zona untuk menggeser, mengubah ukuran,
memutar, mengubah bentuk, atau mewarnainya, di canvas atau lewat kolom isian, lalu *Simpan sebagai template*.
Import template dari PSD / PNG masih **eksperimental** (lihat [Masalah yang diketahui](MASALAH-DIKETAHUI.md)).

### Dasar kit
- **Layer dasar** – *Warna* (tiap bagian dicat dengan warnanya) atau *Desain impor* (tekstur kit jadi menjadi
  dasar; lihat bagian 7). Dengan desain impor, warna bagian tetap bisa ditumpuk di atasnya: pakai **ikon mata** di
  baris *Base baju / celana / kaus kaki*, lalu atur **opasitas** di tiap layer bagian.
- **Bentuk lengan** – *Sampai pundak* mengikuti template PES (lengan naik sampai area leher, pundak ikut warna
  lengan). *Tanpa pundak* memakai potongan lengan yang lebih pendek; sisanya ikut warna baju.
- **Warna latar** – ruang kosong di sekitar bagian pada tekstur.

### Layer
Baris dasar baju, celana, dan kaus kaki (selalu paling bawah) serta aksesori: kerah, ban kapten, kotak kredit.
**Lis** (strip di manset, ujung bawah, atau karet kaus kaki) ditambahkan di bawah tiap bagian lewat *+ Tambah lis*;
mata menyembunyikannya, warna dan lebar diatur di barisnya. *Tambah layer* membuat strip, panel, elips, dan segitiga.
Klik nama bagian (atau tombol roda gigi) untuk membuka editornya di bawah baris: kode warna, palet, dan *Samakan*
(depan ↔ belakang, kiri ↔ kanan). Klik bagian di canvas atau tombol fokusnya juga membuka tab Layer, bukan tab lain.

### Layer pola
Tiap pola adalah layer sendiri: jenis (14 bawaan atau gambar dari `library/patterns`), warna, skala, ketebalan
garis, opasitas, geser X / Y, **rotasi**, cermin / simetris, **Berulang** nyala / mati (mati = satu motif di
tengah), dan bagian yang memakainya. Layer yang lebih atas di daftar digambar di depan. Pola digambar di atas warna
dasar dan di bawah lis, logo, dan kain.

### Garis jahit
Garis jahit adalah layer yang kamu gambar (lihat alat). Kartu ini mendaftarnya; tiap garis bisa diganti antara lurus
dan **lengkung**. Opsi: tampil / sembunyi, gaya (alami, lembut, terlihat, ganda), kekuatan, ketebalan, warna
benang, dan jahitan di tepi tiap bagian.

## 4. Alat gambar

| Alat | Fungsi |
|---|---|
| Pilih / geser | default; memilih bagian, menggeser logo |
| Bentuk bebas | menggambar layer dengan menyeret mouse |
| Bentuk titik | klik titik; klik titik pertama atau tekan Enter untuk menutup |
| Garis jahit (titik) | klik titik; **Lengkung ON** menyambung titik dengan kurva halus (butuh 3+ titik); Enter atau klik dua kali untuk selesai |
| Garis jahit (bebas) | seret untuk menggambar garis jahit |
| Kuas hapus pola | menghapus pola, misalnya agar logo bawaan desain impor tetap bersih |

`Backspace` menghapus titik terakhir, `Esc` membatalkan.

## 5. Tab Kain

Tab ini berisi **layer tekstur kain** (micro-mesh, honeycomb, twill, ribbing, tiga jersey mesh): tiap layer punya ukuran,
intensitas, dan bagian sendiri. Layer juga bisa memakai gambar tile milikmu dari `library/textures`. Kain digambar di
atas warna, pola, dan zona, dan juga di atas desain impor.

## 6. Tab Logo dan Nama

**Logo** – *Upload Logo*, *Tambah Teks*, *Cari Logo Klub* (football-logos.cc, hanya pemakaian fan / non-komersial)
dan **Logo Saya** (semua isi `library/logos`, dengan filter kategori). Pilih logo di canvas untuk menggeser, mengubah
ukuran (dengan kunci rasio), dan memutarnya, atau pakai kolom X / Y / lebar / tinggi dan preset posisi (dada,
lengan, celana, punggung). Warna logo: *Original*, *Warna* (mengganti warna logo; bagian transparan tetap
transparan), atau *Gradasi*; *List / Outline* menambah outline di dalam, tengah, atau luar.

**Nama** – nama dan nomor pemain di punggung serta nomor celana: font, warna, outline, ukuran, posisi. Keduanya
hanya digambar di tekstur bila opsinya dicentang; game biasanya memakai font bawaannya sendiri.

## 7. Import desain jadi

*File → Import desain…* memuat tekstur kit PNG / JPG / WebP / DDS (DXT1 / DXT3 / DXT5 / BGRA), idealnya
1024 × 1024 atau 2048 × 2048 dengan tata letak PES. *Ganti Desain* menjadikannya layer dasar; *Overlay* menggambarnya
di atas bagian dengan opasitas. Kamu bisa berpindah antara *Warna* dan *Desain impor* kapan saja di
**Layer → Dasar kit**.

## 8. Export

*File → Export kit…* (atau tombol merah):

| Format | Kegunaan |
|---|---|
| **PNG** | edit atau preview (1024 atau 2048 px) |
| **DDS** | DXT1 / DXT5 / BGRA dengan mipmap, untuk tool mod |
| **FTEX** | ditulis langsung (satu file `.ftex`, mipmap di dalamnya, format FtexTool); sudah diuji di PES 2021 |
| **Proyek (.peskit)** | menyimpan dan membagikan seluruh kit |
| **Kartu showcase** | gambar kit |

Simpan salinan file yang kamu ganti di game sebelum mencoba yang baru. Output DDS dan 2048 px belum diuji di game.

## 9. Proyek, autosave, bahasa

- Pekerjaanmu disimpan otomatis di penyimpanan browser / aplikasi. *File → Simpan proyek…* menyimpan proyek
  bernama atau mengunduh file `.peskit`; *Buka proyek…* memuatnya.
- *Pengaturan → Bahasa*: English, Bahasa Indonesia, Português, Español.
- *Edit → Undo / Redo* (`Ctrl+Z`, `Ctrl+Y`).

## 10. Pintasan

`Ctrl+Z` undo · `Ctrl+Y` redo · scroll = zoom · seret = geser · `Enter` selesai menggambar · `Esc` batal ·
`Backspace` hapus titik terakhir · panah / `Shift`+panah menggeser logo terpilih 1 / 10 px · `Delete` menghapusnya.
