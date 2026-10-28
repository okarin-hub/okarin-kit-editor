LIBRARY / PUSTAKA ASET
======================

EN  Put your own files in the sub-folders here. The app reads this folder by itself and shows them in the editor.
    No code changes and no rebuild are needed. This folder is EMPTY on purpose: the project does not ship any logos,
    patterns, fonts or templates. Your files stay on your computer (Git ignores them).

ID  Taruh file milikmu di sub-folder di sini. Aplikasi membaca folder ini sendiri dan menampilkannya di editor.
    Tidak perlu mengubah kode atau build ulang. Folder ini SENGAJA KOSONG: proyek tidak membawa logo, pola, font,
    atau template. File milikmu tetap di komputermu (diabaikan Git).

  logos/       logos, sponsors, badges      (PNG, JPG, WebP, SVG, GIF)
  patterns/    pattern tiles                (PNG, JPG, WebP, SVG, GIF)
  fonts/       fonts                        (TTF, OTF, WOFF, WOFF2)
  templates/   your own templates           (.json)

Tips
- Sub-folders inside logos/ or patterns/ are CATEGORIES.
  Example: logos/sponsor/acme-bank.png -> category "sponsor", name "Acme Bank".
  (Sub-folder di dalam logos/ atau patterns/ dipakai sebagai KATEGORI.)
- The file name becomes the display name (underscores and dashes become spaces).
  (Nama file jadi nama tampil.)
- After adding files press "Reload" in the panel (or refresh the page).
  (Setelah menambah file, klik "Muat ulang" di panel atau refresh halaman.)
- Patterns: use a tile that repeats. Single-colour / transparent images can be tinted with "Pattern colour".
  (Pola: pakai gambar yang bisa diulang; gambar satu warna bisa diwarnai dengan "Warna Pola".)
- Fonts: the file name (without extension) is the font name.
  (Font: nama file tanpa ekstensi menjadi nama font.)

Full guide / Panduan lengkap: docs/en/ADDING-LOGOS.md  |  docs/id/MENAMBAH-LOGO.md
Do not commit logos or other people's artwork to the repository. / Jangan commit logo atau karya orang lain ke repositori.
