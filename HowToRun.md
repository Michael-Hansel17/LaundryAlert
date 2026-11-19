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

## 7. Log diagnostik (saat aplikasi berjalan)

Log dipakai untuk melacak masalah ketika aplikasi sedang berjalan, termasuk di APK pada HP.

**Di aplikasi:** ketuk **Log** di kanan atas, tersedia di setiap layar termasuk layar masuk. Isinya:

- Info perangkat: versi aplikasi, platform, URL API, mode API.
- 500 entri terakhir: setiap request ke server (method, path, status, durasi, `reqId`), login/registrasi berhasil atau gagal, sesi dipulihkan atau kedaluwarsa, izin kamera/notifikasi, dan error yang tidak tertangani (crash).
- Filter Semua/Info/Peringatan/Error. Ketuk entri untuk melihat detailnya.
- **Bagikan log** mengirim seluruh log sebagai teks lewat WhatsApp, email, atau aplikasi lain. **Hapus log** mengosongkannya.

Log tersimpan di perangkat, jadi tetap ada setelah aplikasi ditutup atau crash. Kata sandi, token, dan foto tidak pernah dicatat. Saat dev, log yang sama juga muncul di terminal Metro / devtools browser, dan di HP lewat `adb logcat`.

**Di server:** setiap request dan error ditulis ke `server/data/logs/server-YYYY-MM-DD.log` (satu objek JSON per baris, tanggal UTC, disimpan 14 hari) dan juga ke terminal.

**Mencocokkan HP dengan server:** setiap request membawa `reqId`. Salin `reqId` dari detail entri di layar Log, lalu cari di file server:

```powershell
Select-String -Path server\data\logs\*.log -Pattern "<reqId>"
```

## 8. Build APK (Android)

APK dibuild di cloud oleh **EAS Build** (gratis), sehingga Android Studio/Java tidak perlu dipasang. Rilis ke Play Store di luar lingkup.

**Sekali saja:**

1. Buat akun di https://expo.dev, lalu login dari folder proyek: `npx eas-cli@latest login`.
2. `npx eas-cli@latest init`. Perintah ini menautkan proyek ke akun Expo dan menambahkan `extra.eas.projectId` di `app.json`.

**Setiap build:**

1. Cari IP Wi-Fi laptop. `npm run api` menampilkannya saat start ("Untuk HP/APK di Wi-Fi yang sama: ..."), atau jalankan `ipconfig` dan lihat *Wireless LAN adapter Wi-Fi → IPv4 Address*.
2. Isi IP itu di `eas.json` → `build.preview.env.EXPO_PUBLIC_API_URL`, misalnya `http://192.168.1.12:3001`. Nilai ini ditanam ke APK saat build. Bila IP laptop berubah, ubah nilainya lalu build ulang.
3. `npm run build:apk`. Pada build pertama, pilih **Generate a new Android Keystore**. Keystore disimpan EAS, jadi build berikutnya memakai tanda tangan yang sama.
4. Setelah selesai (±10–20 menit), EAS menampilkan link dan QR code. Buka link di HP, unduh `.apk`, lalu pasang (izinkan "Instal aplikasi tidak dikenal").

**Menjalankan APK dengan backend laptop:**

1. HP dan laptop harus terhubung ke Wi-Fi yang sama.
2. Di laptop: `npm run api`.
3. Pertama kali, Windows Firewall menanyakan izin untuk Node.js. Pilih **Private networks**. Bila terlewat, jalankan PowerShell sebagai administrator: `New-NetFirewallRule -DisplayName "LaundryAlert API" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Private`.
4. Cek dari browser HP: `http://<IP-laptop>:3001/api/health` harus menampilkan `{"ok":true}`.
5. Buka aplikasi LaundryAlert di HP. Bila muncul "Tidak dapat terhubung ke server", buka **Log**: entri `gagal terhubung` menampilkan URL yang dicoba.

**APK tanpa backend** (untuk demo offline): `npm run build:apk:demo`. Data tersimpan hanya di HP itu.

Catatan: APK memakai HTTP biasa ke IP lokal (`usesCleartextTraffic` di `app.json`). Ini cukup untuk uji di jaringan sendiri, tetapi bukan untuk produksi.

## Perintah lain

| Perintah | Fungsi |
|---|---|
| `npm run api` | Backend saja |
| `npm run web` | Aplikasi web saja |
| `EXPO_PUBLIC_API_MODE=demo npm run web` | Aplikasi tanpa backend (data simulasi lokal) |
| `npm run build:apk` | Build APK Android lewat EAS (backend dari `eas.json`) |
| `npm run build:apk:demo` | Build APK tanpa backend |

## Struktur singkat

```text
App.tsx, src/            aplikasi React Native (Expo)
  features/auth          login, register, sesi
  features/laundry       pengajuan, riwayat, edit/hapus, notifikasi
  features/admin         antrean dan perubahan status
  shared/services        kamera (photoPicker), notifikasi (notifier), log (logger, crashHandlers)
  shared/presentation    layar Log diagnostik
server/                  backend REST (Node http, JSON file), log request di server/data/logs
tests/                   tes logika/backend dan tes UI
docs/                    dokumentasi per tugas
```
