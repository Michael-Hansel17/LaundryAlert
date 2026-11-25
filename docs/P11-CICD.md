# Tugas P11: CI/CD

- Branch kerja: `v1.0_dev`. Setiap push menjalankan `.github/workflows/ci.yml`.
- Unit test: 222 (120 sebelumnya + 102 di `tests/rulesAndFormat.test.ts`), semuanya lulus.
- Alur: typecheck, `npm test`, lalu (hanya jika hijau) build web dan unggah sebagai artifact (deploy). APK EAS ikut dibuat jika secret `EXPO_TOKEN` ada.

## Jika unit test gagal
Commit "DEMO: sengaja membuat 1 unit test gagal" membuat job *Unit tests* merah.
Job *Build and deploy* berstatus **skipped** (`needs: test`), jadi versi live tidak berubah.
Setelah test diperbaiki (commit revert), pipeline kembali hijau.

## Bukti
- `docs/screenshots/1-pipeline-hijau.jpg`: semua job sukses.
- `docs/screenshots/2-pipeline-merah.jpg`: test gagal, deploy dilewati.

## Branch V1.1
Rilis berikutnya dikerjakan di branch `V1.1`, dibuat dari `v1.0_dev` yang sudah hijau.
