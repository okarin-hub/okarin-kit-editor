# Template sendiri (JSON)

[English](../en/TEMPLATES.md) · [Kembali ke README](../../README.id.md)

**Template** menambah zona berwarna (piping kerah, panel samping, manset, strip …) dan garis jahit tambahan di atas
warna bagian. Taruh file `.json` di `library/templates/` (boleh dalam sub-folder), tekan **Muat ulang** di tab Layer →
kartu *Template*, lalu pilih dari *Template saya*.

Kamu juga bisa membuatnya di aplikasi (tambah layer, edit, *Simpan sebagai template*) dan membiarkan aplikasi
menulis filenya. Import template dari PSD / PNG masih eksperimental (lihat [Masalah yang diketahui](MASALAH-DIKETAHUI.md)).

## Bentuk file

```json
{
  "id": "nama-unik",
  "name": "Nama yang tampil di daftar",
  "description": "Keterangan singkat (opsional)",
  "zones": [],
  "seams": []
}
```

`id` opsional (diambil dari nama file). Contoh lengkap ada di [`../examples/example-template.json`](../examples/example-template.json).

## Zona

```json
{
  "id": "side-front",
  "name": "Panel samping depan",
  "part": "front",
  "parts": ["back", "leftSleeve"],
  "rects": [[x, y, lebar, tinggi]],
  "polygons": [[[x, y], [x, y], [x, y]]],
  "ellipses": [[x, y, lebar, tinggi]],
  "mask": "mask/panel.png",
  "defaultColor": "#1d4ed8",
  "defaultVisible": true
}
```

- Koordinat dalam piksel tekstur (1024 × 1024).
- Isi minimal salah satu dari `rects`, `polygons` (3+ titik; poligon di dalam poligon = lubang), `ellipses` (kotak
  pembatas), atau `mask` (gambar 1024 × 1024, putih / buram = zona, path relatif terhadap file `.json`).
- `part` adalah bagian yang membatasi zona; zona dipotong mengikuti bentuk bagian itu sehingga tidak menimpa
  potongan lain. `parts` opsional: bagian tambahan tempat bentuk yang sama juga digambar.
- Mask hasil importer juga memakai `"maskBox": [x, y, l, t]`, `"keepColor": true` (pakai warna asli gambar) dan
  `"initial": {"opacity": 0.6}`.

### Nama bagian

| Nama | Bagian |
|---|---|
| `front`, `back` | baju depan / belakang (**belakang disimpan terbalik**: ujung bawah di y = 0, leher di y = 452) |
| `leftSleeve` | lengan di sisi **kiri** gambar (= lengan kanan pemain), x 222–380, y 333–605 |
| `rightSleeve` | lengan di sisi **kanan** gambar (= lengan kiri pemain) |
| `leftShorts`, `rightShorts` | celana sisi kiri / kanan gambar |
| `leftSock`, `rightSock` | kaus kaki sisi kiri / kanan gambar |
| `collar`, `armband` | pita kerah di bagian bawah, ban kapten |

**Celana diputar 90°:** sumbu x searah kaki (ujung bawah di tepi luar gambar, pinggang ke arah tengah) dan sumbu y
mengelilingi kaki. Kaus kaki dan lengan memakai arah biasa.

## Garis jahit tambahan

```json
"seams": [ { "part": "front", "points": [[380, 452], [380, 938]], "smooth": false } ]
```

Garis lurus atau patah; tambahkan `"closed": true` untuk bentuk tertutup dan `"smooth": true` untuk kurva melewati
titik-titik. Jahitan di sepanjang tepi tiap potongan dan zona dibuat otomatis (nyalakan di *Garis Jahitan*).

## Tip: membaca koordinat

Pakai **Tampilan → Overlay** untuk menggambar panduan template berlabel di atas canvas kalau kamu punya gambarnya
(taruh di `public/templates/pes2021_template_labeled.png`; file ini tidak disertakan).
