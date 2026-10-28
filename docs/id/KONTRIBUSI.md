# Berkontribusi

[English](../en/CONTRIBUTING.md) · [Kembali ke README](../../README.id.md)

Terima kasih sudah mau memperbaiki Okarin Kit Editor. Fork, issue, dan pull request dipersilakan.

## Aturan dasar

- **Jangan commit aset milik orang lain.** Tidak ada logo, template kit, gambar template resmi PES, file game, atau
  karya dari alat kit lain. Isi `library/` dan `public/templates/` diabaikan Git dengan sengaja; pertahankan itu.
- Jangan menyalin kode atau aset dari alat closed-source. Tulis implementasimu sendiri.
- Jaga aplikasi **ramah offline**: tidak ada panggilan jaringan tersembunyi. Satu-satunya yang ada adalah pencarian
  logo opsional dan cek pembaruan.
- Dengan berkontribusi, kamu setuju kontribusimu dirilis dengan lisensi proyek (GPL-3.0).

## Persiapan

```bash
git clone https://github.com/<kamu>/okarin-kit-editor.git
cd okarin-kit-editor
npm install
npm run dev
```

Periksa tipe sebelum membuka PR: `npx tsc --noEmit`.

## Susunan kode

- **Satu renderer, tiga keluaran.** Canvas 2D, tekstur 3D, dan export memanggil fungsi yang sama:
  `src/utils/textureGenerator.ts` (seluruh tekstur), `patternRenderer.ts`, `fabricRenderer.ts`,
  `templateRenderer.ts`, `logoStyle.ts`, `creditRenderer.ts`. Kalau menambah fitur visual, taruh penggambarannya di
  renderer bersama dan panggil dari `KitCanvas.tsx` (Konva) dan `textureGenerator.ts`; kalau tidak, 2D, 3D, dan
  export akan berbeda.
- **Tata letak bagian.** `src/constants/pes2021Parts.ts` mendefinisikan tiap bagian dengan persegi dan poligon
  outline-nya (`outline`). Pembantunya ada di `src/utils/partShape.ts`. Tekstur 1024 × 1024; punggung baju disimpan
  terbalik; celana diputar 90°.
- **State.** `src/app/page.tsx` memegang state editor; bundel template (`TemplateState`) menyimpan layer pola, warna
  latar, bentuk lengan, dan pengaturan jahitan sehingga ikut undo / redo dan file proyek.
- **API library.** `src/app/api/library/*` membaca folder `library` saat berjalan (`KIT_LIBRARY_DIR`).
- **Export.** `ddsEncoder.ts`, `ddsDecoder.ts`, `ftexEncoder.ts` (FTEX: header + info mip, mip ditulis dari yang
  terkecil, potongan zlib).
- **Menu dan panel.** `src/components/ui/` (menu bar `Navbar.tsx`, `ToolRail.tsx`, `Toolbar.tsx`, `TemplatePanel.tsx`
  dengan `PanelSection` yang bisa dilipat, …).

## Terjemahan

Teks UI ditulis dalam bahasa Indonesia di kode dan diterjemahkan di layar dari kamus:
`src/i18n/dictionary.ts`, satu entri per teks:

```ts
["Teks Indonesia", "English", "Português", "Español"],
```

Pakai `{1}`, `{2}` untuk nilai yang berubah (`"Diimpor dari {1} ({2} layer)."`). Saat menambah atau mengubah teks yang
terlihat, tambahkan entrinya; kalau tidak, teks itu tetap berbahasa Indonesia di semua bahasa. Untuk menambah bahasa,
tambahkan kolom di `src/i18n/engine.ts` (`LANGUAGES`, `COLUMN`) dan terjemahannya di kamus. Teks yang tidak boleh
diterjemahkan (nama, nama file) bisa dibungkus elemen dengan atribut `data-no-i18n`.

## Isu yang cocok untuk pemula

Lihat [Masalah yang diketahui](MASALAH-DIKETAHUI.md): menyimpan pengaturan kain di autosave, opsi per garis jahit,
pemetaan UV celana yang terukur, lengan panjang yang lebih baik, importer PSD / PNG yang lebih aman, tanda tangan
aplikasi, bahasa tambahan.

## Daftar periksa pull request

- `npx tsc --noEmit` lolos.
- 2D, 3D, dan PNG hasil export menampilkan hasil yang sama untuk perubahanmu.
- Teks UI baru ada di kamus.
- Tidak ada aset pihak ketiga yang ditambahkan.
