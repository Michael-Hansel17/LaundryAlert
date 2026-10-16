# Demo Local Data & Persistence — 9 Oktober 2026

Satu fitur vertikal: **Pengajuan Laundry**, dari form dan detail React Native sampai AsyncStorage. CRUD dan persistence browser sudah dijalankan, bukan hanya direncanakan.

## Posisi kode untuk reviewer

| Bagian | File dan fungsi |
|---|---|
| Entity | [`models.ts`](../../src/features/laundry/domain/models.ts): `LaundryOrder`, berisi ID, pemilik, berat, catatan, status, tanggal, timeline |
| Model penyimpanan | [`localLaundryStorage.ts`](../../src/features/laundry/data/localLaundryStorage.ts): `LocalLaundryData`, `{ version: 1, orders: LaundryOrder[], sequence: number }` |
| Baca/tulis lokal | `LocalLaundryStorage.read()` / `write()`, key `@laundryalert/laundry/v1` |
| Hydration saat aplikasi dibuka | [`DemoProvider.tsx`](../../src/shared/state/DemoProvider.tsx): `DemoStore.open(AsyncStorage)`, loading dan error/retry sebelum navigator dibuka |
| Use case dan antrean commit | [`demoStore.ts`](../../src/features/laundry/data/demoStore.ts): `commit`, `submitPersisted`, `editPersisted`, `deletePersisted`, `updateStatusPersisted` |
| Create | [`SubmitLaundryView.tsx`](../../src/features/laundry/presentation/SubmitLaundryView.tsx) → `LaundrySubmissionController.submit()` → `DemoLaundryRepository.submit()` → `submitPersisted()` |
| Read | [`HistoryScreen.tsx`](../../src/features/laundry/presentation/HistoryScreen.tsx) / [`LaundryDetailScreen.tsx`](../../src/features/laundry/presentation/LaundryDetailScreen.tsx) → `useLaundry()` → snapshot yang sudah di-hydrate |
| Update/Delete dari UI | [`LaundryCrudView.tsx`](../../src/features/laundry/presentation/LaundryCrudView.tsx) → callback di `LaundryDetailScreen` → `editPersisted()` / `deletePersisted()` |
| Status admin tetap tersimpan | [`demoAdminRepository.ts`](../../src/features/admin/data/demoAdminRepository.ts): `update()` → `updateStatusPersisted()` |
| Tes persistence | [`localPersistence.test.ts`](../../tests/localPersistence.test.ts), tes disk serta validasi/error/concurrency |
| Tes UI | [`laundryCrud.test.tsx`](../../tests/ui/laundryCrud.test.tsx), [`localHydration.test.tsx`](../../tests/ui/localHydration.test.tsx) |

**Alur:** UI → controller/use case → draft perubahan → AsyncStorage `setItem` → publish snapshot → UI sukses. Pada startup: AsyncStorage `getItem` → validasi JSON/model/versi → snapshot → navigator. State management sebelumnya tetap dipakai.

AsyncStorage 2.2.0 dipasang lewat `expo install`. Di browser, implementasi web paket memakai `localStorage`; perangkat native memakai AsyncStorage. Referensi instalasi: [dokumentasi Expo](https://docs.expo.dev/versions/latest/sdk/async-storage/).

## Demo singkat yang sudah dijalankan

Browser Edge, profil khusus demo, ukuran 1280 × 1000. Data storage diperiksa pada setiap langkah selain memeriksa tampilan. Browser context ditutup seluruhnya dan dibuka ulang memakai profil disk yang sama pada langkah 4.

1. **Create:** masuk demo penghuni → Ajukan laundry → berat `1.25`, catatan `Demo CRUD lokal 9 Oktober` → Kirim → Lihat detail. [Screenshot create](01-created.png).
2. **Read + refresh:** refresh browser → masuk demo penghuni yang sama → buka order yang baru dibuat. ID, berat, dan catatan tetap sama. [Screenshot setelah refresh](02-after-refresh.png).
3. **Update:** Edit pengajuan → berat `2`, catatan `Catatan diubah dan tersimpan` → Simpan perubahan. [Screenshot form edit](03-edit-form.png).
4. **Buka ulang browser:** tutup browser context → buka lagi dengan profil disk yang sama → login dan buka order. Berat 2 kg dan catatan baru tetap ada. [Screenshot setelah reopen](04-updated-after-reopen.png).
5. **Delete:** Hapus pengajuan → konfirmasi Ya, hapus pengajuan. [Screenshot konfirmasi](05-delete-confirmation.png).
6. **Refresh setelah delete:** login lagi → Riwayat. Order yang dihapus tidak muncul kembali dan jumlah order kembali ke baseline. [Screenshot setelah delete + refresh](06-deleted-after-refresh.png).

Hasil aktual: [`browser-demo-results.txt`](browser-demo-results.txt). Script untuk mengulang demo: [`scripts/demo-local-persistence.cjs`](../../scripts/demo-local-persistence.cjs), memerlukan Playwright dan Edge. Jalankan aplikasi di `http://localhost:8087` atau tentukan `DEMO_URL`. Script memakai profil baru terpisah sehingga tidak menghapus data browser pribadi.

## Pengujian

- TypeScript: lulus.
- Tes logika/repository/persistence: 33 lulus, termasuk 6 tes baru. Tes CRUD menggunakan file disk di direktori sementara dan `DemoStore.open` baru pada setiap reopen.
- Tes UI: 32 lulus, termasuk 4 tes edit/delete dan 2 tes hydration/retry.
- Demo browser nyata: create/read/update/delete, refresh setelah create/delete, dan close/reopen setelah update lulus.
- Bundle JavaScript Android/iOS/web: `expo export --platform all --no-bytecode` lulus. Export default sempat gagal pada compiler bytecode Hermes dengan `spawn UNKNOWN` di Windows ini; output tanpa bytecode adalah pemeriksaan bundling, bukan bukti build native produksi atau uji perangkat.
- Android/iOS: implementasi menggunakan adapter AsyncStorage yang sama, tetapi tutup/buka ulang aplikasi pada HP/emulator belum diuji.

## Aturan dan batas fitur

- Penghuni hanya boleh mengedit/menghapus order sendiri yang masih **Diterima**. Status yang sudah diproses tidak dapat diubah/dihapus oleh penghuni.
- Berat wajib positif, maksimal dua desimal. Edit memeriksa kuota bulan pengajuan awal, termasuk bila pengajuan berasal dari bulan sebelumnya. Delete mengembalikan kuota bulan terkait.
- Write dijalankan berurutan dalam satu instance agar dua perubahan tidak saling menimpa. Jika `setItem` gagal, snapshot UI tetap sebelumnya, input dipertahankan, dan pengguna bisa mencoba lagi.
- Abort/sesi diperiksa sebelum commit. Setelah `setItem` dimulai, penulisan storage tidak dapat dibatalkan; menutup halaman pada titik tersebut tidak membatalkan perubahan yang sudah dikirim ke storage.
- Seed hanya dibuat bila key belum pernah ada. Array order kosong yang tersimpan tetap kosong setelah reopen. JSON rusak atau versi tidak didukung menghasilkan error/retry, tanpa menimpa data asli.
- Yang dipersist adalah **order laundry beserta ID sequence**. Sesi login, credential akun registrasi sementara, dan penutupan pemberitahuan bukan bagian persistence ini. Gunakan **akun demo penghuni/admin** yang sama untuk demo lintas restart; akun registrasi tetap sementara. Tidak ada password atau sesi login dalam JSON lokal.
- Data scoped pada instalasi perangkat atau origin/profil browser. Tidak ada sinkronisasi lintas perangkat atau tab yang sedang terbuka. Penghapusan data aplikasi/browser menghapus data lokal.

## Penjelasan singkat kepada reviewer

“Kode Local Data & Persistence ada di `src/features/laundry/data/localLaundryStorage.ts`. Entity yang disimpan adalah `LaundryOrder` di `domain/models.ts`. `DemoProvider` membaca data AsyncStorage sebelum menampilkan aplikasi. Create lewat form pengajuan, Read lewat riwayat/detail, Update dan Delete lewat detail laundry. Use case di `demoStore.ts` menunggu penulisan lokal berhasil sebelum memperbarui UI. Demo menunjukkan data tetap ada setelah refresh dan browser dibuka ulang, serta data yang dihapus tidak muncul kembali.”
