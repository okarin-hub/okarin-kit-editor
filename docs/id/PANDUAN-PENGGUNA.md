# Panduan pengguna

[English](../en/USER-GUIDE.md) · [Kembali ke README](../../README.id.md)

## 1. Tampilan layar

```
┌─ Menu bar: File  Edit  Tampilan  Alat  Bantuan ────────────────── [Export Kit] ┐
│ Rail │  2D | Split | 3D   [Semua bagian ▾]                       zoom         │
│ alat │ ┌────────── Canvas 2D ───────────┐ ┌────────── Preview 3D ────────┐ ┌ Panel kanan ┐
│      │ │ tekstur (1024 x 1024)          │ │ kit di model 3D              │ │ Warna       │
│      │ └────────────────────────────────┘ └──────────────────────────────┘ │ Layer       │
│      │                                                                       │ Logo        │
└──────┴─────────────────────────────────────────────────────────────────────  │ Nama        │
```

- **Menu bar** – *File* (kit baru, buka / simpan proyek, import desain, export), *Edit* (undo, redo, pengaturan, preset warna),
  *Tampilan* (garis bagian, label bagian, template PES asli), *Alat* (pola dari foto jersey, generator fontset,
  config.txt kitserver; semuanya eksperimental), *Bantuan* (panduan, pintasan, cek pembaruan, kredit, tentang).
  *Kit baru* bertanya dulu; *Undo* mengembalikan kit sebelumnya.
- **Rail alat (kiri)** – pilih / geser, bentuk bebas, bentuk titik, garis jahit titik, garis jahit bebas, kuas hapus
  pola (tombol `V`, `B`, `P`, `S`, `J`, `E`). Satu alat aktif sekali waktu; klik alat yang aktif lagi untuk kembali
  ke *pilih*.
- **Canvas 2D** – scroll untuk zoom, seret untuk geser. Klik bagian untuk memilihnya. Daftar *Semua bagian* di toolbar
  men-zoom canvas ke satu bagian.
- **Preview 3D** – seret untuk memutar, tahan tombol tengah mouse (tombol scroll) lalu geser ke atas / bawah untuk
  melihat dari atas atau bawah, scroll untuk zoom. Tombol mengganti kamera (depan, belakang, dada, bawah,
  penuh) dan panjang lengan (pendek / panjang).
- **Panel kanan** – tab **Kain**, **Layer**, **Logo**, **Nama**.

Teksturnya adalah tekstur kit PES 2021 (1024 × 1024). **Punggung baju disimpan terbalik** (ujung bawah di atas,
leher di tengah) dan celana disimpan diputar 90°. Editor sudah menanganinya untukmu.

## 2. Mulai cepat

1. Menu *Edit* → pilih preset warna.
2. Tab **Layer** → ubah warna *Base baju*, *Base celana*, dan *Base kaus kaki* (buka barisnya untuk warna per bagian).
3. Tambahkan **layer pola**, **lis**, warna **kerah**, lalu **logo** (tab Logo) dan **nama / nomor** (tab Nama).
4. Cek preview 3D. Pilih *File → Export kit…* kalau sudah puas.

## 3. Tab Layer

Tab ini berisi kartu yang bisa dilipat (status buka / tutupnya diingat). Ikon **?** di samping judul menjelaskan
pengaturan itu; *Bantuan → Panduan* menjelaskan semuanya.

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
mata menyembunyikannya, warna dan lebar diatur di barisnya. Tombol di baris layer (muncul saat hover): fokus, gandakan, dan hapus; *Reset* ada di atas pengaturan layer, di samping namanya. **+ Objek** di samping grup menambah strip, panel, elips, atau segitiga di sana. Seret baris objek ke grup lain untuk memindahkannya (ukurannya menyesuaikan bagian baru), tahan `Ctrl` saat melepas untuk menyalinnya. *Kembar* di pengaturannya menggambar bentuk itu 2, 3, atau lebih kali berjajar dalam satu layer, dengan jarak dan arah (ke bawah atau ke samping, mengikuti putaran bentuk); tiap salinan memakai lebar dan tinggi objek.
Layer dikelompokkan per baju, celana, kaus kaki, dan aksesoris; grup yang layernya banyak mulai tertutup dan kolom
cari muncul. Layer bantuan dari PSD (mesh, panduan, jahitan, bayangan, latar) dikumpulkan di *Layer bantuan PSD*.
Klik nama bagian (atau tombol roda gigi) untuk membuka editornya di bawah baris: kode warna, palet, dan *Samakan*
(depan ↔ belakang, kiri ↔ kanan). Klik bagian di canvas atau tombol fokusnya juga membuka tab Layer, bukan tab lain.

### Layer pola
Pola ada di grup daftar layer. **+ Pola** di samping grup (Baju, Celana, Kaus kaki, Aksesoris) menambah pola di sana;
pola tampil paling atas di grupnya. **Seret** baris pola ke grup lain untuk memindahkannya, atau tahan `Ctrl` saat
melepas untuk menyalinnya. Klik baris untuk membuka pengaturannya: jenis (14 bawaan atau gambar dari
`library/patterns`), warna, skala, ketebalan garis, opasitas, geser X / Y, **rotasi**, cermin / simetris,
**Berulang** nyala / mati (mati = satu motif di tengah), dan bagian grup yang ditutupinya (misalnya badan tanpa
lengan). Pola yang lebih atas digambar di depan pola di bawahnya. Pola digambar di atas warna dasar dan di bawah layer
template, lis, logo, dan kain.

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

### Kitserver (config.txt) – eksperimental

Fitur ini hanya mengatur file config: pratinjau 2D/3D belum mengikuti nilainya.

*Alat → Kitserver config.txt…* mengedit `config.txt` yang dibaca kserv.lua (Sider) untuk satu kit. Form mengikuti
menu dan batas nilai kserv; *Edit sebagai teks* menampilkan isi filenya langsung. *Impor config.txt* memuat config yang
sudah ada dan menjaga komentar serta key yang tidak ada di form. Nama file ditulis tanpa `.ftex`: kserv hanya memakai
file di folder kit itu sendiri, dan nama kosong atau file yang tidak ada berarti game memakai file bawaannya.

*Simpan ke folder kit…* meminta folder kit (misalnya `content/kit-server/<tim>/p1`) lalu menulis `config.txt` dan
`<KitFile>.ftex` ke sana, dengan konfirmasi sebelum menimpa. Kit tidak otomatis ditambahkan ke `order.ini` atau
`map.txt`; tambahkan sendiri.

### Generator fontset – eksperimental

*Alat → Generator fontset…* membuat file font nomor dan nama yang dibaca kitserver. Pilih font, warna isi, dan outline
untuk nomor dan untuk nama; pratinjau menampilkan setiap tekstur dengan slot karakter (biru) serta batas atas huruf dan
garis dasar (merah). *Simpan ke folder kit…* menulis file `<awalan>_back`, `_chest`, `_leg`, `_name`, dan `_name_ex`
`.ftex`, dan dengan *Tulis config.txt juga*, config yang sudah berisi nama-nama itu. Awalan bawaannya nama KitFile.

*Import gambar font…* memakai gambar huruf dan/atau angka sebagai pengganti font (PNG, JPG…). Jendela import
menampilkan gambarnya dulu: tarik kotak di bagian yang dipakai, centang *Lihat hasil pemisahan* untuk mengecek
potongannya, dan pada latar yang ramai pilih warna latar dan warna huruf. Gambar boleh mendatar (baris) atau menurun (satu karakter per
baris, dibaca dari atas ke bawah sebagai satu baris). Setiap karakter dikenali dan barisnya
dicocokkan dengan urutan alfabet; baris menampilkan setiap potongan dengan hasil bacaannya (kuning = kurang yakin atau
dilewati). Koreksi lewat teks baris: satu karakter per potongan, `_` untuk melewati. Karakter yang tidak ada di gambar
(titik, huruf beraksen) diambil dari font yang dipilih di bawahnya. *Logo di nomor* menaruh badge di setiap angka.

## 9. Proyek, autosave, bahasa

- Pekerjaanmu disimpan otomatis di penyimpanan browser / aplikasi. *File → Buka / simpan proyek…* (`Ctrl+S`) menyimpan
  proyek bernama, mengunduh file `.peskit`, atau memuatnya.
- *Edit → Pengaturan…* (`Ctrl+,`): bahasa (English, Bahasa Indonesia, Português, Español) dan tempat pengaturan layer
  terbuka: *di bawah baris* dalam daftar, atau di *panel samping* di kiri daftar layer (ditutup dengan ✕ atau `Esc`). Seret tepi kiri, tepi bawah, atau sudut
  kiri-bawah panel samping untuk mengubah ukurannya; ukurannya diingat, klik dua kali di tepinya untuk ukuran awal.
- *Edit → Undo / Redo* (`Ctrl+Z`, `Ctrl+Y`).

## 10. Pintasan

`Ctrl+Z` undo · `Ctrl+Y` redo · `Ctrl+S` buka / simpan proyek · `Ctrl+E` export · `Ctrl+,` pengaturan · `1` / `2` / `3` 2D / Split / 3D ·
alat `V` `B` `P` `S` `J` `E` · `?` daftar pintasan · scroll = zoom · seret = geser · `Enter` selesai menggambar · `Esc` batal ·
`Backspace` hapus titik terakhir · panah / `Shift`+panah menggeser logo terpilih 1 / 10 px · `Delete` menghapusnya.
