# Membangun dan mengemas

[English](../en/BUILDING.md) · [Kembali ke README](../../README.id.md)

Kebutuhan: **Node.js 20+** dan npm. Paket Windows dibuat di Windows (PowerShell dipakai untuk membuat zip).

## Menjalankan saat pengembangan

```bash
npm install
npm run dev        # http://localhost:3000 (kompilasi pertama bisa butuh semenit)
```

## Build produksi di browser

```bash
npm run build
npm start          # http://localhost:3000
```

## Shell desktop (Electron) dari source

```bash
npm run electron:dev
```

Proses utama Electron (`electron/main.cjs`) menjalankan server Next.js di port lokal bebas (`127.0.0.1`) dan membuka
jendela. Ia mengisi `KIT_LIBRARY_DIR` dengan folder `library` di sebelah exe (atau `library/` proyek saat dev).

## Mengemas build Windows

1. Hentikan `npm run dev` (berbagi folder `.next` dengan build).
2. `npm run build` — membuat `.next/standalone` (`output: 'standalone'` di `next.config.ts`).
3. `npm run pack:win` — menjalankan `scripts/pack-win.cjs`:
   - menyalin server standalone, file statis, dan model 3D ke folder sementara,
   - membuat *library template* dari **file yang dilacak Git** di `library/` (README saja), sehingga logo dan template
     milikmu tidak pernah ikut ke build,
   - mengemas semuanya dengan `@electron/packager`,
   - menambahkan `README.md`, `README.id.md`, `LICENSE`, dan `docs/`,
   - membuat zip.

Hasil: `release/Okarin Kit Editor-win32-x64/` dan `release/Okarin-Kit-Editor-<versi>-win-x64.zip`.

Ujilah: buka exe, pastikan canvas 2D dan model 3D tampil dan logo yang ditaruh di folder `library` di sebelah exe
muncul setelah *Muat ulang*. Kosongkan variabel lingkungan `ELECTRON_RUN_AS_NODE` kalau exe berjalan sebagai proses
Node biasa.

## Konfigurasi

Salin `.env.example` menjadi `.env.local` untuk mengubah pengaturan opsional: simpan cloud Supabase, URL feed
pembaruan, folder library (`KIT_LIBRARY_DIR`). Tidak ada yang wajib.

## Merilis

1. Naikkan `version` di `package.json` (tampil di *Bantuan → Tentang* dan *Cek pembaruan*).
2. Perbarui [CATATAN-RILIS](CATATAN-RILIS.md) dan kembarannya dalam bahasa Inggris.
3. Build dan kemas seperti di atas.
4. Buat rilis GitHub dengan tag `v<versi>` dan lampirkan zip-nya.
