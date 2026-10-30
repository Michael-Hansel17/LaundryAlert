# Checklist MVP — LaundryAlert

Lingkup mengikuti "Daftar Fitur Inti" dan "Kriteria Aplikasi Dinyatakan Berhasil" di [README.md](README.md). Cara menjalankan: [HowToRun.md](HowToRun.md).

**Hasil pengujian otomatis** (`npm run typecheck && npm test`): TypeScript lulus, **62 tes logika/backend PASSED**, **35 tes UI PASSED** (total 97).
Legenda: ✅ lulus · 🟡 lulus sebagian / ada batasan · ❌ belum.

## A. Fitur inti MVP

| # | Fitur | Implementasi | Unit test | Uji manual (browser) |
|---|---|---|---|---|
| 1 | Autentikasi: login, register, logout | Backend `/api/auth/*`, kata sandi di-hash (scrypt), token HMAC bertanda tangan, sesi tersimpan | ✅ `tests/auth.test.ts` (6) | ✅ login, validasi form kosong, sesi pulih setelah reload |
| 2 | Input pengajuan laundry | Form berat + catatan + foto → `POST /api/orders` | ✅ `apiLaundry`, `laundryRepository`, UI `laundrySubmission` | ✅ pengajuan 1,5 kg tersimpan di server |
| 3 | Admin ubah status 4 tahap | `PATCH /api/orders/:id/status`, hanya maju satu tahap, hanya admin | ✅ `mvpFlow` (alur 4 tahap, status basi, loncat, akses penghuni) | ✅ Diterima → Diproses tersimpan di server |
| 4 | Notifikasi saat Selesai | Notifikasi lokal (opt-in, izin, sekali per order) + kartu di Beranda + polling 15 detik | ✅ `advancedFeatures` (3 tes notifikasi), `mvpFlow` | 🟡 kondisi izin ditolak terverifikasi; pengiriman notifikasi setelah izin diberikan belum diuji manual |
| 5 | Kuota bulanan 10 kg | Dihitung di klien dan divalidasi ulang oleh server | ✅ `demoStore`, `apiLaundry`, `mvpFlow` | ✅ kuota 6,5 → 5 kg setelah pengajuan |
| 6 | Riwayat laundry | `GET /api/orders` per pengguna | ✅ `mvpFlow` (penghuni hanya melihat miliknya) | ✅ |
| 7 | Dashboard admin | Antrean semua penghuni + filter status | ✅ `adminStatus` (UI), `adminRepository`, `mvpFlow` | ✅ antrean menampilkan pengajuan penghuni |
| 8 | Edit dan hapus pengajuan | `PUT`/`DELETE`, hanya pemilik, hanya status Diterima | ✅ `mvpFlow`, `laundryCrud` (UI), `localPersistence` | 🟡 diuji pada tugas persistence sebelumnya (mode lokal); lewat backend diuji otomatis |

## B. Advanced feature (minimal 3)

| Fitur | Manfaat bagi pengguna | Izin / pembatalan yang ditangani | Status |
|---|---|---|---|
| **Autentikasi** (server, hash, token, sesi tersimpan) | Hanya pemilik akun yang melihat dan mengubah cucian; peran admin tidak bisa dipalsukan klien; tidak perlu login ulang setiap buka aplikasi | Sandi salah, email ganda, token palsu/kedaluwarsa → pesan jelas, token kedaluwarsa otomatis keluar | ✅ 6 tes + manual |
| **Notifikasi lokal** | Penghuni tahu cucian selesai tanpa bertanya ke petugas | Belum diminta / diblokir / ditutup tanpa memilih / tidak didukung; bisa dimatikan; pesan tidak diulang | ✅ 3 tes + 🟡 manual (lihat A4) |
| **Kamera** (foto cucian) | Bukti kondisi pakaian saat diantar, mengurangi selisih saat pengambilan | Izin ditolak (bisa/tidak bisa diminta lagi), dibatalkan, foto terlalu besar, perangkat tanpa kamera; pengajuan tetap bisa dikirim tanpa foto | ✅ 9 tes + 🟡 manual (lihat catatan) |

## C. Kondisi UI

| Kondisi | Layar | Status |
|---|---|---|
| Loading | Muat pengajuan, Beranda/Riwayat, antrean admin, masuk/daftar, pulihkan sesi, buka kamera | ✅ |
| Empty | Pengajuan, Beranda aktif, Riwayat, antrean admin | ✅ (UI test + `data kosong` API) |
| Error + retry | Muat dan kirim pengajuan, Beranda/Riwayat (banner Coba lagi), antrean admin, simpan status | ✅ |
| Success | Pengajuan terkirim, perubahan tersimpan, status admin tersimpan | ✅ |
| Input tidak valid | Berat (kosong, huruf, 0, >2 desimal, melebihi kuota), email/sandi/konfirmasi saat daftar, status loncat | ✅ klien dan server |
| HTTP gagal / JSON rusak | Pesan jelas, tidak ada data parsial | ✅ `apiLaundry` |

## D. Integrasi dan regresi

| Pemeriksaan | Status |
|---|---|
| UI → controller → repository → REST → file JSON | ✅ |
| Alur penghuni → admin → penghuni (Selesai + pemberitahuan) lewat backend | ✅ `mvpFlow` |
| Penyimpanan lokal (AsyncStorage) tetap berjalan; tes persistence sebelumnya masih lulus | ✅ |
| Mode `EXPO_PUBLIC_API_MODE=demo` tanpa backend | ✅ (dipakai tes UI) |
| TypeScript tanpa error | ✅ |

## E. Belum diuji / batasan

- Kamera sungguhan (pengambilan foto) dan notifikasi sungguhan setelah izin diberikan belum diuji di browser ini; di sana pemilih foto berakhir "dibatalkan" dan izin notifikasi diblokir. Jalur izin ditolak/dibatalkan terverifikasi manual dan otomatis.
- Belum diuji di HP fisik atau emulator Android/iOS. Notifikasi native memakai `expo-notifications` (lokal, bukan push).
- Notifikasi hanya muncul saat aplikasi/tab terbuka (polling 15 detik); push server (FCM/APNs) di luar lingkup MVP.
- Token sesi disimpan di AsyncStorage (di web: `localStorage`). Produksi sebaiknya `expo-secure-store` dan HTTPS.
- Backend memakai file JSON dan satu proses; tanpa rate-limit atau kontrol konkurensi lintas proses.
- Dokumen persistence dan API per tugas: [docs/local-persistence/README.md](docs/local-persistence/README.md), [docs/api-integration/README.md](docs/api-integration/README.md).
