import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoStore } from '../src/features/laundry/data/demoStore';
import { DemoAdminRepository } from '../src/features/admin/data/demoAdminRepository';
import { AdminStatusController } from '../src/features/admin/state/AdminStatusController';
import { DEMO_EMAILS, DEMO_PASSWORD } from '../src/config/constants';
const input = { orderId: 'LA-DEMO-001', expectedStatus: 'diterima', target: 'diproses' } as const;
function fixture() {
  const store = new DemoStore(() => new Date('2026-10-02T03:00:00Z'));
  store.login(DEMO_EMAILS.admin, DEMO_PASSWORD);
  return { store, repository: new DemoAdminRepository(store, store.getSnapshot().user!.id, 10) };
}
const signal = () => new AbortController().signal;
test('admin repository: gagal muat sekali lalu retry berhasil', async () => {
  const { repository } = fixture(); repository.failNextLoad();
  await assert.rejects(repository.load(signal()), /gagal memuat/);
  assert.equal((await repository.load(signal())).length, 4);
});
test('admin controller: double tap menulis sekali, subscription memperbarui antrean', async () => {
  const { store, repository } = fixture();
  const controller = new AdminStatusController(repository, input.orderId);
  const disconnect = controller.connect(); await controller.load();
  controller.setTarget('diproses');
  await Promise.all([controller.submit(), controller.submit()]);
  assert.equal(controller.getSnapshot().submitStatus, 'success');
  assert.equal(store.visibleOrders().find((o) => o.id === input.orderId)!.statusHistory.length, 2);
  store.updateStatus(input.orderId, 'selesai');
  assert.equal(controller.getSnapshot().orders.find((o) => o.id === input.orderId)!.status, 'selesai');
  assert.equal(store.getSnapshot().notices.filter((n) => n.orderId === input.orderId).length, 1);
  disconnect();
});
test('admin repository: gagal simpan tidak menulis, retry mengubah status satu kali', async () => {
  const { repository, store } = fixture(); repository.failNextUpdate();
  await assert.rejects(repository.update(input, signal()), /belum tersimpan/);
  assert.equal(store.visibleOrders().find((o) => o.id === input.orderId)!.status, 'diterima');
  await repository.update(input, signal());
  assert.equal(store.visibleOrders().find((o) => o.id === input.orderId)!.statusHistory.length, 2);
});
test('admin controller: keluar halaman membatalkan pending submit tanpa menulis', async () => {
  const { store, repository } = fixture(); const controller = new AdminStatusController(repository, input.orderId);
  await controller.load(); controller.setTarget('diproses');
  const pending = controller.submit(); controller.dispose(); await pending;
  assert.equal(store.visibleOrders().find((o) => o.id === input.orderId)!.status, 'diterima');
});
test('admin repository: logout saat pending menolak penulisan sesi lama', async () => {
  const { repository, store } = fixture(); const pending = repository.update(input, signal());
  store.logout(); store.login(DEMO_EMAILS.resident, DEMO_PASSWORD);
  await assert.rejects(pending, /Sesi admin/);
  assert.equal(store.visibleOrders().find((o) => o.id === input.orderId)!.status, 'diterima');
});
test('admin repository: status berubah selama pending ditolak saat commit', async () => {
  const { repository, store } = fixture(); const pending = repository.update(input, signal());
  store.updateStatus(input.orderId, 'diproses');
  await assert.rejects(pending, /Status sudah berubah/);
  assert.equal(store.visibleOrders().find((o) => o.id === input.orderId)!.statusHistory.length, 2);
});
test('admin repository: akses penghuni dan status melompat ditolak', async () => {
  const { repository, store } = fixture();
  await assert.rejects(repository.update({ ...input, target: 'selesai' }, signal()), /maju satu tahap/);
  store.logout(); store.login(DEMO_EMAILS.resident, DEMO_PASSWORD);
  await assert.rejects(repository.load(signal()), /Sesi admin/);
});
test('admin repository: order hilang dan abort tidak mengubah data', async () => {
  const { repository, store } = fixture();
  await assert.rejects(repository.update({ ...input, orderId: 'missing' }, signal()), /tidak ditemukan/);
  const abort = new AbortController(); const pending = repository.update(input, abort.signal); abort.abort();
  await assert.rejects(pending, /dibatalkan/);
  assert.equal(store.visibleOrders().find((o) => o.id === input.orderId)!.status, 'diterima');
});
