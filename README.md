# LaundryAlert (Working Title)

Aplikasi mobile untuk membantu penghuni kos memantau status laundry secara real-time, sehingga tidak perlu menebak-nebak kapan cucian selesai.

## 📌 Deskripsi Masalah

Penghuni kos yang memiliki fasilitas laundry (biasanya kuota 10 kg/bulan) sering mengalami masalah **ketidakpastian waktu penyelesaian cucian**. Setelah mengantarkan pakaian ke tempat laundry, penghuni tidak memiliki informasi pasti kapan cucian selesai, sehingga muncul dua masalah utama:

1. **Terlalu cepat mengecek** → cucian belum selesai, penghuni harus bolak-balik atau menunggu tanpa kepastian.
2. **Terlalu lambat mengecek** → stok pakaian bersih habis lebih dulu sebelum cucian diambil, menyebabkan penghuni kehabisan pakaian layak pakai.

Selain itu, tidak ada sistem yang mencatat sisa kuota laundry (misalnya sisa dari 10 kg/bulan), sehingga penghuni juga kesulitan memantau penggunaan jatah laundry mereka.

## 👤 Profil Target Pengguna

- **Penghuni kos/asrama** yang mendapatkan fasilitas laundry dari pengelola (misalnya kuota 10 kg/bulan).
- Mahasiswa atau pekerja muda yang tinggal sendiri di kos, dengan jumlah pakaian terbatas sehingga sangat bergantung pada jadwal laundry yang jelas.
- Pengelola kos/laundry (pengguna sekunder) yang bertugas memperbarui status cucian.

## ✅ Manfaat Aplikasi

- Penghuni mendapat **notifikasi otomatis** saat status cucian berubah (diterima, diproses, selesai, siap diambil).
- Mengurangi ketidakpastian waktu tunggu sehingga penghuni bisa mengatur strategi pakaian (kapan harus hemat, kapan bisa santai).
- Membantu penghuni **memantau sisa kuota laundry bulanan** agar tidak melebihi batas.
- Mengurangi interaksi manual (bertanya langsung ke petugas laundry) yang memakan waktu bagi kedua pihak.

## 🧩 Daftar Fitur Inti (Realistis untuk 12 Pertemuan)

1. **Autentikasi sederhana** — login/register (email atau nomor kos, tanpa OAuth kompleks).
2. **Input pengajuan laundry** — penghuni mencatat kapan pakaian diantar & estimasi berat (kg).
3. **Update status laundry** oleh petugas/admin — status: *Diterima → Diproses → Selesai → Sudah Diambil*.
4. **Notifikasi push/lokal** saat status berubah menjadi "Selesai" (siap diambil).
5. **Tracking sisa kuota bulanan** (misal 10 kg/bulan), otomatis berkurang setiap kali ada input laundry.
6. **Riwayat laundry** — daftar transaksi laundry per pengguna (tanggal antar, berat, status).
7. **Dashboard sederhana untuk admin/petugas kos** — melihat daftar antrian laundry & mengubah status.

## 🚫 Fitur yang Tidak Dikerjakan (Out of Scope)

- Sistem pembayaran online/integrasi payment gateway.
- Estimasi otomatis waktu selesai berbasis AI/machine learning (akan menggunakan update manual dari petugas).
- Multi-cabang/multi-lokasi laundry dalam satu aplikasi.
- Fitur chat real-time antara penghuni dan petugas laundry.
- Rating/review laundry.
- Manajemen multi-role kompleks (misalnya beberapa admin dengan hak akses berbeda-beda).
- Integrasi dengan sistem pembayaran kos/sewa bulanan.

## 🎯 Kriteria Aplikasi Dinyatakan Berhasil

- Penghuni dapat **menginput data laundry** dan melihat status secara real-time tanpa perlu bertanya langsung ke petugas.
- Notifikasi terkirim secara **otomatis dan tepat waktu** setiap kali status laundry berubah menjadi "Selesai".
- Sistem kuota bulanan (10 kg) **terhitung otomatis dan akurat** berdasarkan input berat laundry.
- Admin/petugas dapat mengubah status laundry dengan mudah melalui dashboard, minimal untuk 4 tahap status.
- Aplikasi dapat diuji coba (demo) end-to-end: dari input laundry → update status oleh admin → notifikasi diterima penghuni.
