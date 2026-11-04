# Panduan pengguna

[English](../en/USER-GUIDE.md) · [Kembali ke README](../../README.id.md)

## 1. Tampilan layar

```
┌─ Menu bar: File  Edit  Tampilan  Alat  Bantuan ────────────────── [Export Kit] ┐
│ Rail │  2D | Split | 3D   [Semua bagian ▾]                       zoom         │
│ alat │ ┌────────── Canvas 2D ───────────┐ ┌────────── Preview 3D ────────┐ ┌ Panel kanan ┐
│      │ │ tekstur (1024 x 1024)          │ │ kit di model 3D              │ │ Kain        │
│      │ └────────────────────────────────┘ └──────────────────────────────┘ │ Template    │
│      │                                                                       │ Layer       │
│      │                                                                       │ Logo        │
└──────┴─────────────────────────────────────────────────────────────────────  │ Nama        │
```

- **Menu bar** – *File* (kit baru, buka / simpan proyek, import desain, export), *Edit* (undo, redo, pengaturan, preset warna),
  *Tampilan* (garis bagian, label bagian, template PES asli, *Kecepatan zoom (scroll)*), *Alat* (pola dari foto
  jersey, generator fontset, config.txt kitserver; semuanya eksperimental), *Bantuan* (panduan, pintasan, cek
  pembaruan, kredit, tentang). *Kit baru* bertanya dulu; *Undo* mengembalikan kit sebelumnya.
- **Rail alat (kiri)** – pilih / geser, bentuk bebas, bentuk titik, garis jahit titik, garis jahit bebas, kuas hapus
  (tombol `V`, `B`, `P`, `S`, `J`, `E`). Satu alat aktif sekali waktu; klik alat yang aktif lagi untuk kembali
  ke *pilih*.
- **Canvas 2D** – scroll untuk zoom, seret untuk geser. Klik bagian untuk memilihnya. Daftar *Semua bagian* di toolbar
  men-zoom canvas ke satu bagian.
- **Preview 3D** – seret untuk memutar, tahan tombol tengah mouse (tombol scroll) lalu geser ke atas / bawah untuk
  melihat dari atas atau bawah, scroll untuk zoom. Tombol mengganti kamera (depan, belakang, dada, bawah,
  penuh) dan panjang lengan (pendek / panjang).
- **Panel kanan** – tab **Kain**, **Template**, **Layer**, **Logo**, **Nama**. Tab hanya menampilkan ikonnya; tab
  yang terbuka juga menampilkan namanya.
- **Kecepatan zoom** – *Tampilan → Kecepatan zoom (scroll)*: pelan, normal, atau cepat, untuk canvas 2D, preview 3D,
  dan pratinjau fontset.

Teksturnya adalah tekstur kit PES 2021 (1024 × 1024). **Punggung baju disimpan terbalik** (ujung bawah di atas,
leher di tengah) dan celana disimpan diputar 90°. Editor sudah menanganinya untukmu.

## 2. Mulai cepat

1. Menu *Edit* → pilih preset warna.
2. Tab **Layer** → ubah warna *Base baju*, *Base celana*, dan *Base kaus kaki* (buka barisnya untuk warna per bagian).
3. Tambahkan **layer pola**, **lis**, warna **kerah**, lalu **logo** (tab Logo) dan **nama / nomor** (tab Nama).
4. Cek preview 3D. Pilih *File → Export kit…* kalau sudah puas.

## 3. Tab Template

Tab berisi kartu yang bisa dilipat (status buka / tutupnya diingat). Ikon **?** di samping judul atau opsi
menjelaskan pengaturan itu (arahkan mouse atau klik); *Bantuan → Panduan* menjelaskan semuanya.

### Template
Template menambah **zona** berwarna (piping kerah, panel samping, panel bahu, manset, strip …) di atas warna bagian.
Daftarnya berisi tiga jenis:

- Template **bawaan** dan template `.json` milikmu di `library/templates` (lihat [Template](TEMPLATE.md)).
- **Baca PSD** – setiap `.psd` di `library/templates` (termasuk sub-folder) menjadi template dengan sendirinya. File PSD
  dibaca di latar belakang saat aplikasi dibuka atau saat *Muat ulang* (statusnya menampilkan *Membaca PSD … (12/30)*);
  hasil konversinya disimpan di `library/templates/.psd`, jadi PSD hanya dibaca lagi kalau berubah. Simpan ulang PSD di
  Photoshop lalu tekan *Muat ulang*: template yang terbuka mengambil layer barunya dan tetap memakai warna serta
  pilihanmu. Layer berkode abu-abu menjadi **slot warna** (satu warna untuk semua layer di slot itu), dan layer yang
  dinamai sebagai varian menjadi pilihan opsi.
- **Tambah PSD** menyalin PSD yang kamu pilih ke `library/templates` (file dengan nama sama diganti) dan membukanya
  setelah selesai dibaca.

**Import PNG** (eksperimental) punya dua cara:

- *Satu PNG, pisah per warna* mengubah gambar template (idealnya 2048 × 2048 dengan tata letak PES) menjadi PSD
  berlayer di `library/templates`: satu layer per warna dan grup bagian, warna terluas menjadi *Base* tiap grup (slot
  warnanya sendiri), dengan tepi halus dari gambar. Opsi: *Toleransi warna*; daftar di samping tiap warna untuk
  menggabungkannya ke warna lain (bayangan yang terpisah ikut ke warnanya); klik pada pratinjau untuk mencari warnanya
  di daftar (*Perbesar pratinjau* menampilkannya selebar jendela); *Bersihkan noise* (untuk WebP / JPG); *Versi warna
  lain* (sampai dua gambar lagi dari template yang sama dengan warna lain, supaya area yang warnanya sama di satu
  gambar tetap bisa dipisah); *Gradasi halus* (centang hanya warna ujung gradasinya). Gambar yang tajam dengan warna
  bersih memberi hasil terbaik.
- *Banyak PNG (1 file = 1 layer)* membuat template dari gambar layer yang terpisah.

Pilih zona untuk menggeser, mengubah ukuran, memutar, mengubah bentuk, atau mewarnainya, di canvas atau lewat kolom
isian, lalu *Simpan sebagai template* membuat salinan yang bisa diedit. Import template dari PSD / PNG masih
**eksperimental** (lihat [Masalah yang diketahui](MASALAH-DIKETAHUI.md)).

### Dasar kit
- **Layer dasar** – *Warna* (tiap bagian dicat dengan warnanya) atau *Desain impor* (tekstur kit jadi menjadi
  dasar; lihat bagian 8). Dengan desain impor, warna bagian tetap bisa ditumpuk di atasnya: pakai **ikon mata** di
  baris *Base baju / celana / kaus kaki*, lalu atur **opasitas** di tiap layer bagian.
- **Bentuk lengan** – *Sampai pundak* mengikuti template PES (lengan naik sampai area leher, pundak ikut warna
  lengan). *Tanpa pundak* memakai potongan lengan yang lebih pendek; sisanya ikut warna baju.
- **Warna latar** – ruang kosong di sekitar bagian pada tekstur.

## 4. Tab Layer

### Layer
Baris dasar baju, celana, dan kaus kaki (selalu paling bawah) serta aksesori: kerah, ban kapten, kotak kredit.
**Lis** (strip di manset, ujung bawah, atau karet kaus kaki) ditambahkan di bawah tiap bagian lewat *+ Tambah lis*;
mata menyembunyikannya, warna dan lebar diatur di barisnya. Tombol di baris layer (muncul saat hover): fokus, gandakan, dan hapus; *Reset* ada di atas pengaturan layer, di samping namanya. **+ Objek** di samping grup menambah strip, panel, elips, atau segitiga di sana. Seret baris objek ke grup lain untuk memindahkannya (ukurannya menyesuaikan bagian baru), tahan `Ctrl` saat melepas untuk menyalinnya. *Kembar* di pengaturannya menggambar bentuk itu 2, 3, atau lebih kali berjajar dalam satu layer, dengan jarak dan arah (ke bawah atau ke samping, mengikuti putaran bentuk); tiap salinan memakai lebar dan tinggi objek.
Layer dikelompokkan per baju, celana, kaus kaki, dan aksesoris; grup yang layernya banyak mulai tertutup dan kolom
cari muncul. Layer bantuan dari PSD (mesh, panduan, jahitan, bayangan, latar) dikumpulkan di *Layer bantuan PSD*.
Klik nama bagian (atau tombol roda gigi) untuk membuka editornya di bawah baris: kode warna, palet, dan *Samakan*
(depan ↔ belakang, kiri ↔ kanan). Klik bagian di canvas atau tombol fokusnya juga membuka tab Layer, bukan tab lain.
*Edit titik bentuk* di pengaturan layer bentuk menampilkan titik-titiknya di canvas: seret titik, klik **+** di tengah
sisi untuk menambah titik, klik kanan titik untuk menghapusnya.

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
dan **lengkung**, dan *Edit titik* membentuknya ulang di canvas (seret titik, klik **+** untuk menambah, klik kanan
titik untuk menghapus). Opsi: tampil / sembunyi, gaya (alami, lembut, terlihat, ganda), kekuatan, ketebalan, warna
benang, dan jahitan di tepi tiap bagian.

## 5. Alat gambar

| Alat | Fungsi |
|---|---|
| Pilih / geser | default; memilih bagian, menggeser logo |
| Bentuk bebas | menggambar layer dengan menyeret mouse |
| Bentuk titik | klik titik; klik titik pertama atau tekan Enter untuk menutup |
| Garis jahit (titik) | klik titik; **Lengkung ON** menyambung titik dengan kurva halus (butuh 3+ titik); Enter atau klik dua kali untuk selesai |
| Garis jahit (bebas) | seret untuk menggambar garis jahit |
| Kuas hapus | dengan layer dipilih: hanya menghapus layer itu di area yang disapu (watermark atau logo yang tidak diinginkan di PSD / PNG impor); tanpa layer dipilih: menghapus pola |

`Backspace` menghapus titik terakhir, `Esc` membatalkan.

Bar di atas canvas menampilkan target kuas hapus (*Layer: …* atau *Pola*). *Pulihkan* mengecat kembali, *Reset*
mengembalikan semua yang dihapus di layer itu (atau semua pola). Area yang dihapus menempel ke layer: ikut tergeser,
terputar, dan berubah ukuran bersamanya. Hapusan tersimpan di proyek dan bisa di-undo.

## 6. Tab Kain

Tab ini berisi **layer tekstur kain** (micro-mesh, honeycomb, twill, ribbing, tiga jersey mesh): tiap layer punya ukuran,
intensitas, dan bagian sendiri. Layer juga bisa memakai gambar tile milikmu dari `library/textures`. Kain digambar di
atas warna, pola, dan zona, dan juga di atas desain impor.

## 7. Tab Logo dan Nama

**Logo** – *Upload Logo*, *Tambah Teks*, *Cari Logo Klub* (football-logos.cc, hanya pemakaian fan / non-komersial)
dan **Logo Saya** (semua isi `library/logos`, dengan filter kategori). Pilih logo di canvas untuk menggeser, mengubah
ukuran (dengan kunci rasio), dan memutarnya, atau pakai kolom X / Y / lebar / tinggi dan preset posisi (dada,
lengan, celana, punggung). Warna logo: *Original*, *Warna* (mengganti warna logo; bagian transparan tetap
transparan), atau *Gradasi*; *List / Outline* menambah outline di dalam, tengah, atau luar, dengan *Sudut*
**tumpul** atau **tajam** (tajam mengikuti sudut logo).

*Tambah Teks* menampilkan pratinjau langsung sebelum teks ditambahkan: isi teks, font, ukuran huruf, warna, outline
(warna dan tebal), dan bayangan. Pilih teksnya nanti untuk mengubah semuanya; menarik sudut kotak teks mengubah
ukuran hurufnya.

**Nama** – nama dan nomor pemain di punggung serta nomor celana: font, warna, outline, ukuran, posisi. Keduanya
hanya digambar di tekstur bila opsinya dicentang; game biasanya memakai font bawaannya sendiri.

## 8. Import desain jadi

*File → Import desain…* memuat tekstur kit PNG / JPG / WebP / DDS (DXT1 / DXT3 / DXT5 / BGRA), idealnya
1024 × 1024 atau 2048 × 2048 dengan tata letak PES. *Ganti Desain* menjadikannya layer dasar; *Overlay* menggambarnya
di atas bagian dengan opasitas. Kamu bisa berpindah antara *Warna* dan *Desain impor* kapan saja di
**Template → Dasar kit**.

## 9. Export

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
garis dasar (merah); zoom pratinjau dengan −, +, *Pas*, atau scroll mouse. *Simpan ke folder kit…* menulis file `<awalan>_back`, `_chest`, `_leg`, `_name`, dan `_name_ex`
`.ftex`, dan dengan *Tulis config.txt juga*, config yang sudah berisi nama-nama itu. Awalan bawaannya nama KitFile.

*Ukuran huruf %* membesarkan atau mengecilkan huruf (tetap di garis dasar), dan *Posisi outline* menaruh outline di luar
tepi huruf, di tengah tepinya, atau di dalamnya (inline). Huruf yang melewati kotak slotnya diberi kotak kuning dan
peringatan di bawah pratinjau: di game huruf itu akan dipadatkan atau terpotong. Menyimpan akan bertanya dulu selama
masih ada huruf seperti itu.

*Import gambar font…* memakai gambar huruf dan/atau angka sebagai pengganti font (PNG, JPG…). Jendela import
menampilkan gambarnya dulu: tarik kotak di bagian yang dipakai, centang *Lihat hasil pemisahan* untuk mengecek
potongannya, dan pada latar yang ramai pilih warna latar dan warna huruf. Gambar boleh mendatar (baris) atau menurun (satu karakter per
baris, dibaca dari atas ke bawah sebagai satu baris). Setiap karakter dikenali dan barisnya
dicocokkan dengan urutan alfabet; baris menampilkan setiap potongan dengan hasil bacaannya (kuning = kurang yakin atau
dilewati). Koreksi lewat teks baris: satu karakter per potongan, `_` untuk melewati. Karakter yang tidak ada di gambar
(titik, huruf beraksen) diambil dari font yang dipilih di bawahnya. *Logo di nomor* menaruh badge di setiap angka; *Warna logo* bisa menjadikannya satu warna, di-trace jadi bentuk
vektor yang tajam: seluruh bentuknya (*siluet*) atau hanya bagian gelapnya (*detail*, dengan batas terang dan *Balik*).

## 10. Proyek, autosave, bahasa, pembaruan

- Pekerjaanmu disimpan otomatis di penyimpanan browser / aplikasi. *File → Buka / simpan proyek…* (`Ctrl+S`) menyimpan
  proyek bernama, mengunduh file `.peskit`, atau memuatnya.
- *Edit → Pengaturan…* (`Ctrl+,`): bahasa (English, Bahasa Indonesia, Português, Español) dan tempat pengaturan layer
  terbuka: *di bawah baris* dalam daftar, atau di *panel samping* di kiri daftar layer (ditutup dengan ✕ atau `Esc`). Seret tepi kiri, tepi bawah, atau sudut
  kiri-bawah panel samping untuk mengubah ukurannya; ukurannya diingat, klik dua kali di tepinya untuk ukuran awal.
- *Edit → Undo / Redo* (`Ctrl+Z`, `Ctrl+Y`).
- *Bantuan → Cek pembaruan* membandingkan versimu dengan rilis di GitHub. Di aplikasi Windows, *Unduh dan pasang*
  mengambil versi baru, menutup aplikasi, memasang file baru (folder `library` milikmu tidak disentuh), lalu
  membukanya lagi. Centang *Ikut rilis eksperimental* untuk juga ditawari rilis eksperimental.

## 11. Pintasan

`Ctrl+Z` undo · `Ctrl+Y` redo · `Ctrl+S` buka / simpan proyek · `Ctrl+E` export · `Ctrl+,` pengaturan · `1` / `2` / `3` 2D / Split / 3D ·
alat `V` `B` `P` `S` `J` `E` · `?` daftar pintasan · scroll = zoom · seret = geser · `Enter` selesai menggambar · `Esc` batal ·
`Backspace` hapus titik terakhir · panah / `Shift`+panah menggeser logo terpilih 1 / 10 px · `Delete` menghapusnya.
