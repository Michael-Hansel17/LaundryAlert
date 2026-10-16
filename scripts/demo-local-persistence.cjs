// Run with the app served at DEMO_URL (default http://localhost:8087).
// PLAYWRIGHT_MODULE_PATH may point to an installed Playwright package.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const url = process.env.DEMO_URL || 'http://localhost:8087';
const key = '@laundryalert/laundry/v1';
const output = path.resolve(__dirname, '../docs/local-persistence');
const steps = [];
let context;
async function main() {
  await fs.mkdir(output, { recursive: true });
  // Isolated profile; closing and reopening this profile tests actual disk data.
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'laundry-browser-demo-'));
  const launch = () => chromium.launchPersistentContext(profile, {
    channel: 'msedge', headless: true, viewport: { width: 1280, height: 1000 },
  });
  context = await launch(); let page = await context.newPage();
  page.setDefaultTimeout(20000);
  const login = async () => {
    await page.getByRole('button', { name: 'Masuk demo penghuni', exact: true }).click();
    await page.getByRole('button', { name: '+ Ajukan laundry', exact: true }).waitFor();
  };
  const snapshot = async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
  const screenshot = async (name) => { await page.screenshot({ path: path.join(output, name), fullPage: true }); };
  const openOrder = async (id) => {
    await page.getByRole('button', { name: `Detail laundry ${id}, diterima`, exact: true }).click();
    await page.getByRole('button', { name: 'Edit pengajuan', exact: true }).waitFor();
  };
  await page.goto(url); await login();
  const baseline = await snapshot();
  await page.getByRole('button', { name: '+ Ajukan laundry', exact: true }).click();
  await page.getByLabel('Estimasi berat (kg)', { exact: true }).fill('1.25');
  await page.getByLabel('Catatan (opsional)', { exact: true }).fill('Demo CRUD lokal 9 Oktober');
  await page.getByRole('button', { name: 'Kirim pengajuan', exact: true }).click();
  await page.getByRole('button', { name: 'Lihat detail laundry', exact: true }).click();
  await page.getByRole('button', { name: 'Edit pengajuan', exact: true }).waitFor();
  const created = (await snapshot()).orders.find((o) => !baseline.orders.some((old) => old.id === o.id));
  assert.ok(created); assert.equal(created.estimatedWeightKg, 1.25);
  steps.push(`CREATE: ${created.id}, 1.25 kg, tersimpan di localStorage melalui AsyncStorage.`);
  await screenshot('01-created.png');
  await page.reload(); await login(); await openOrder(created.id);
  await page.getByText('Catatan: Demo CRUD lokal 9 Oktober', { exact: true }).waitFor();
  steps.push('READ + REFRESH: order yang sama terlihat setelah refresh dan login kembali.');
  await screenshot('02-after-refresh.png');
  await page.getByRole('button', { name: 'Edit pengajuan', exact: true }).click();
  await page.getByLabel('Ubah berat (kg)', { exact: true }).fill('2');
  await page.getByLabel('Ubah catatan', { exact: true }).fill('Catatan diubah dan tersimpan');
  await screenshot('03-edit-form.png');
  await page.getByRole('button', { name: 'Simpan perubahan', exact: true }).click();
  await page.getByText('Perubahan tersimpan di perangkat.', { exact: true }).waitFor();
  assert.equal((await snapshot()).orders.find((o) => o.id === created.id).estimatedWeightKg, 2);
  await context.close(); context = await launch(); page = await context.newPage();
  page.setDefaultTimeout(20000); await page.goto(url); await login(); await openOrder(created.id);
  await page.getByText('Catatan: Catatan diubah dan tersimpan', { exact: true }).waitFor();
  assert.equal((await snapshot()).orders.find((o) => o.id === created.id).estimatedWeightKg, 2);
  steps.push('UPDATE + BROWSER REOPEN: 2 kg dan catatan baru tetap tersedia setelah context/browser ditutup lalu dibuka dari profil disk yang sama.');
  await screenshot('04-updated-after-reopen.png');
  await page.getByRole('button', { name: 'Hapus pengajuan', exact: true }).click();
  await page.getByRole('button', { name: 'Ya, hapus pengajuan', exact: true }).waitFor();
  await screenshot('05-delete-confirmation.png');
  await page.getByRole('button', { name: 'Ya, hapus pengajuan', exact: true }).click();
  await page.getByText('Riwayat laundry', { exact: true }).waitFor();
  assert.ok(!(await snapshot()).orders.some((o) => o.id === created.id));
  await page.reload(); await login();
  await page.getByRole('button', { name: 'Lihat semua riwayat', exact: true }).click();
  await page.getByText('Riwayat laundry', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: `Detail laundry ${created.id}, diterima`, exact: true }).count(), 0);
  assert.equal((await snapshot()).orders.length, baseline.orders.length);
  steps.push('DELETE + REFRESH: order dihapus, tidak muncul kembali sesudah refresh; jumlah order kembali ke baseline.');
  await screenshot('06-deleted-after-refresh.png');
  await fs.writeFile(path.join(output, 'browser-demo-results.txt'), `Demo browser Edge / ${new Date().toISOString()}\n${steps.join('\n')}\nPASS CRUD + refresh + browser reopen\n`);
  console.log(steps.join('\n')); console.log('PASS CRUD + refresh + browser reopen');
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { if (context) await context.close(); });
