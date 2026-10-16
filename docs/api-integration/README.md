# Integrasi API — Vertical Slice "Pengajuan Laundry"

Satu fitur dari UI sampai backend: layar **Ajukan laundry** memuat daftar order + kuota dari REST API (`GET /api/orders`) dan menyimpan pengajuan baru ke backend (`POST /api/orders`).

## Untuk reviewer

| Pertanyaan | Jawaban |
|---|---|
| Sudah ada koneksi ke API? | **Ya.** [`apiLaundryRepository.ts`](../../src/features/laundry/data/apiLaundryRepository.ts) memakai `fetch` ke backend [`server/app.ts`](../../server/app.ts) (Node `http`, data disimpan di `server/data/orders.json`). |
| Sudah ada unit test? | **Ya.** [`tests/apiLaundry.test.ts`](../../tests/apiLaundry.test.ts), 9 tes (syarat minimal 6). |

## Posisi kode

| Lapisan | File |
|---|---|
| Model | [`domain/models.ts`](../../src/features/laundry/domain/models.ts) (`LaundryOrder`) |
| Validasi JSON → model, `ApiError` | [`data/orderDto.ts`](../../src/features/laundry/data/orderDto.ts) (`parseOrder`, `parseOrderList`) |
| Repository (kontrak) | [`domain/laundryRepository.ts`](../../src/features/laundry/domain/laundryRepository.ts) |
| Repository HTTP | [`data/apiLaundryRepository.ts`](../../src/features/laundry/data/apiLaundryRepository.ts): `load()`, `submit()`, timeout, error jaringan/HTTP/JSON |
| State loading/error/success/retry | [`state/LaundrySubmissionController.ts`](../../src/features/laundry/state/LaundrySubmissionController.ts) |
| UI | [`presentation/SubmitLaundryView.tsx`](../../src/features/laundry/presentation/SubmitLaundryView.tsx) |
| Pemilihan repository | [`hooks/useLaundrySubmission.ts`](../../src/features/laundry/hooks/useLaundrySubmission.ts), konfigurasi di [`config/api.ts`](../../src/config/api.ts) |
| Backend | [`server/app.ts`](../../server/app.ts), [`server/main.ts`](../../server/main.ts) |

Alur: UI → `LaundrySubmissionController` → `ApiLaundryRepository` → `fetch` → backend → `parseOrder` → UI.

## Kondisi UI

| Kondisi | Tampil |
|---|---|
| Loading | spinner "Memuat data laundry..." |
| Success | kuota + pengajuan terbaru, "Pengajuan berhasil dikirim" setelah submit |
| Empty | "Belum ada pengajuan laundry" bila server mengembalikan daftar kosong |
| Error | pesan dari server/jaringan/JSON rusak + tombol **Coba lagi** (muat) atau **Coba kirim lagi** (submit); input tidak hilang |

## Menjalankan

```bash
npm run dev     # satu perintah: backend + aplikasi web
```

Masuk sebagai demo penghuni → Ajukan laundry. Untuk melihat error: matikan backend lalu buka layar itu, atau pakai panel "Uji kondisi layanan" (server membalas 503 satu kali). Nyalakan backend dan klik **Coba lagi**.

- Android emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001`. HP fisik memakai IP LAN komputer.
- `EXPO_PUBLIC_API_MODE=demo` memakai repository simulasi lama tanpa backend.

## Unit test

```bash
npm run test:logic
```

| Syarat | Tes |
|---|---|
| Model valid | `model valid: JSON server diubah menjadi LaundryOrder` |
| Model invalid | `model invalid: berat negatif, status asing, dan field hilang ditolak` |
| API sukses | `API sukses: load mengisi order dan menghitung kuota`, `submit: POST ...` |
| Data kosong | `data kosong: ...` |
| HTTP gagal | `HTTP gagal: status 500 dan server mati ...` |
| JSON rusak | `JSON rusak: respons 200 yang bukan JSON ditolak ...` |
| Tambahan | `controller + API: loading -> error -> retry -> loaded`, `backend nyata: POST disimpan, GET membacanya ...` (server sungguhan di port acak) |

## Batasan

- Identitas hanya header `X-User-Id`, belum autentikasi sungguhan. Firebase Auth/Firestore adalah tahap berikutnya.
- Hanya fitur pengajuan yang terhubung ke backend. Edit/hapus, status admin, dan login masih lokal.
- Setelah submit berhasil, order disalin ke penyimpanan lokal agar Dashboard/Riwayat menampilkannya. Backend tetap sumber data untuk layar Ajukan laundry.
- Belum diuji di HP/emulator, dan belum ada rekaman layar atau screenshot demo.
