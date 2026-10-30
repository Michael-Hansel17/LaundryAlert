# HowToRun — LaundryAlert (MVP)

## Prasyarat

- Node.js 22.13 atau lebih baru (`node -v`)
- npm (ikut Node)
- Browser (Chrome/Edge) untuk mode web. Android Studio emulator atau aplikasi Expo Go bila ingin menjalankan di HP.

## 1. Instal

```bash
npm install
```

## 2. Jalankan (satu perintah)

```bash
npm run dev
```

Perintah ini menyalakan **backend API** (`http://localhost:3001`) dan **aplikasi web Expo** (`http://localhost:8081`) bersamaan. Buka `http://localhost:8081`. Ctrl+C menghentikan keduanya.

Android atau iOS: `npm run dev -- android` / `npm run dev -- ios`.
Android emulator perlu `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001`. HP fisik memakai IP LAN komputer, misalnya `http://192.168.1.10:3001`.

Data server disimpan di `server/data/` (diabaikan git). Hapus folder itu untuk mengembalikan data ke kondisi awal.

## 3. Akun demo

| Peran | Email | Kata sandi |
|---|---|---|
| Penghuni | `penghuni@laundryalert.test` | `demo123` |
| Admin | `admin@laundryalert.test` | `demo123` |

Tombol "Masuk demo penghuni/admin" di layar masuk mengisi akun ini dan tetap masuk lewat server. Akun baru bisa dibuat lewat "Belum punya akun? Daftar".

## 4. Alur demo end-to-end (±5 menit)

1. **Penghuni:** Masuk demo penghuni → Beranda menampilkan kuota dan laundry aktif. Ketuk **Aktifkan notifikasi** dan izinkan (browser/OS akan meminta izin).
2. **Ajukan:** `+ Ajukan laundry` → isi berat `2,5` (opsional catatan dan foto: **Ambil foto** atau **Pilih dari galeri**) → **Kirim pengajuan**. Kuota berkurang.
3. **Admin:** Keluar → Masuk demo admin → antrean berisi pengajuan tadi → buka detail → pilih tahap berikutnya → **Simpan status**. Ulangi sampai **Selesai**.
4. **Penghuni:** Masuk lagi sebagai penghuni (atau tunggu ±15 detik bila masih terbuka). Status menjadi **Selesai**, kartu "Cucian siap diambil" muncul dan notifikasi dikirim.
5. **Ubah/hapus:** Buka detail pengajuan berstatus Diterima → Edit pengajuan atau Hapus pengajuan.
6. **Persistensi:** Muat ulang halaman. Sesi login dan data tetap ada.

## 5. Mendemokan kondisi error, kosong, dan izin

| Kondisi | Cara |
|---|---|
| Loading | Terlihat saat membuka layar atau menyimpan |
| Error + retry | Matikan backend (Ctrl+C pada `npm run api`) lalu muat layar, atau pakai panel "Uji kondisi layanan" (server membalas 503 satu kali). Nyalakan lagi dan ketuk **Coba lagi**. |
| Kosong | Daftarkan akun baru: Beranda dan Riwayat kosong |
| Input tidak valid | Berat kosong, `abc`, `0`, `2,555`, atau melebihi kuota; email salah/kata sandi < 6 karakter saat daftar |
| Izin kamera ditolak / dibatalkan | Tolak izin kamera atau tutup pemilih foto: muncul pesan, form tetap bisa dikirim tanpa foto |
| Izin notifikasi ditolak | Blokir notifikasi di browser: kartu menampilkan petunjuk, pemberitahuan tetap muncul di Beranda |
| Sesi berakhir | Token kedaluwarsa atau tidak valid membuat aplikasi kembali ke layar masuk |

## 6. Tes

```bash
npm run typecheck   # TypeScript
npm test            # tes logika/backend (tsx) + tes UI (jest)
```

Hanya tes logika: `npm run test:logic`. Hanya UI: `npm run test:ui`.

## Perintah lain

| Perintah | Fungsi |
|---|---|
| `npm run api` | Backend saja |
| `npm run web` | Aplikasi web saja |
| `EXPO_PUBLIC_API_MODE=demo npm run web` | Aplikasi tanpa backend (data simulasi lokal) |

## Struktur singkat

```text
App.tsx, src/            aplikasi React Native (Expo)
  features/auth          login, register, sesi
  features/laundry       pengajuan, riwayat, edit/hapus, notifikasi
  features/admin         antrean dan perubahan status
  shared/services        kamera (photoPicker) dan notifikasi (notifier)
server/                  backend REST (Node http, JSON file)
tests/                   tes logika/backend dan tes UI
docs/                    dokumentasi per tugas
```
