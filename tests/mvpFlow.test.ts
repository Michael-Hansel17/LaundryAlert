import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { DEMO_EMAILS, DEMO_PASSWORD } from '../src/config/constants';
import { createApiServer } from '../server/app';
import { ApiAdminRepository } from '../src/features/admin/data/apiAdminRepository';
import { AdminStatusController } from '../src/features/admin/state/AdminStatusController';
import { ApiLaundryRepository } from '../src/features/laundry/data/apiLaundryRepository';
import { DemoStore } from '../src/features/laundry/data/demoStore';
import { OrdersGateway } from '../src/features/laundry/data/ordersGateway';
import { createSeed } from '../src/features/laundry/data/seed';
import { LaundrySubmissionController } from '../src/features/laundry/state/LaundrySubmissionController';

const now = new Date('2026-10-10T03:00:00Z');
const signal = () => new AbortController().signal;

async function startBackend() {
  const server = createApiServer({ clock: () => now, seed: createSeed(now).orders, allowHeaderAuth: true });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const client = (email: string) => {
    const store = new DemoStore(() => now);
    store.login(email, DEMO_PASSWORD);
    return { store, user: store.getSnapshot().user! };
  };
  return { server, baseUrl, client };
}

test('alur MVP: penghuni ajukan -> admin lihat & ubah status 4 tahap -> penghuni lihat Selesai + notifikasi', async () => {
  const { server, baseUrl, client } = await startBackend();
  try {
    const resident = client(DEMO_EMAILS.resident);
    const admin = client(DEMO_EMAILS.admin);

    // 1. Penghuni mengajukan lewat controller (UI state) -> backend.
    const submitRepo = new ApiLaundryRepository(baseUrl, resident.user, { clock: () => now, onSubmitted: (o) => resident.store.upsertRemoteOrder(o) });
    const submission = new LaundrySubmissionController(submitRepo);
    await submission.load();
    submission.setWeight('2,5'); submission.setNotes('Jaket');
    await submission.submit();
    assert.equal(submission.getSnapshot().submitStatus, 'success');
    const orderId = submission.getSnapshot().submittedOrder!.id;

    // 2. Admin memuat antrean dari backend: order baru tampil di antara order seed.
    const adminGateway = new OrdersGateway(baseUrl, admin.user);
    const queue = new AdminStatusController(new ApiAdminRepository(admin.store, adminGateway, admin.user.id), orderId);
    await queue.load();
    assert.equal(queue.getSnapshot().loadStatus, 'loaded');
    assert.ok(queue.getSnapshot().orders.some((o) => o.id === orderId));
    assert.ok(queue.getSnapshot().orders.length >= 5);

    // 3. Admin memajukan status satu tahap demi satu tahap sampai Sudah diambil.
    for (const target of ['diproses', 'selesai', 'diambil'] as const) {
      queue.setTarget(target);
      await queue.submit();
      assert.equal(queue.getSnapshot().submitStatus, 'success', queue.getSnapshot().submitError ?? '');
      queue.setTarget(target); // reset sukses lewat pilihan baru
      await queue.load();
      if (target === 'selesai') {
        // 4. Penghuni memuat ulang: status Selesai dan pemberitahuan muncul.
        await resident.store.replaceOrders(await new OrdersGateway(baseUrl, resident.user).list(signal()));
        assert.equal(resident.store.visibleOrders().find((o) => o.id === orderId)!.status, 'selesai');
        assert.ok(resident.store.getSnapshot().notices.some((n) => n.orderId === orderId));
      }
    }
    await resident.store.replaceOrders(await new OrdersGateway(baseUrl, resident.user).list(signal()));
    assert.equal(resident.store.visibleOrders().find((o) => o.id === orderId)!.status, 'diambil');
  } finally { server.close(); }
});

test('backend: penghuni hanya melihat order sendiri, admin melihat semua', async () => {
  const { server, baseUrl, client } = await startBackend();
  try {
    const resident = client(DEMO_EMAILS.resident); const admin = client(DEMO_EMAILS.admin);
    const own = await new OrdersGateway(baseUrl, resident.user).list(signal());
    const all = await new OrdersGateway(baseUrl, admin.user).list(signal());
    assert.ok(own.length > 0 && own.every((o) => o.userId === resident.user.id));
    assert.ok(all.length > own.length);
  } finally { server.close(); }
});

test('backend: status tidak boleh loncat, basi, atau diubah penghuni', async () => {
  const { server, baseUrl, client } = await startBackend();
  try {
    const resident = client(DEMO_EMAILS.resident); const admin = client(DEMO_EMAILS.admin);
    const adminApi = new OrdersGateway(baseUrl, admin.user);
    await assert.rejects(adminApi.updateStatus('LA-DEMO-001', 'diterima', 'selesai', signal()), /satu tahap/);
    await assert.rejects(adminApi.updateStatus('LA-DEMO-001', 'diproses', 'selesai', signal()), /Status sudah berubah/);
    await assert.rejects(adminApi.updateStatus('LA-TIDAK-ADA', 'diterima', 'diproses', signal()), /tidak ditemukan/);
    await assert.rejects(new OrdersGateway(baseUrl, resident.user).updateStatus('LA-DEMO-001', 'diterima', 'diproses', signal()), /Hanya admin/);
    assert.equal((await adminApi.updateStatus('LA-DEMO-001', 'diterima', 'diproses', signal())).status, 'diproses');
  } finally { server.close(); }
});

test('backend: edit dan hapus hanya untuk pemilik saat Diterima; kuota diperiksa', async () => {
  const { server, baseUrl, client } = await startBackend();
  try {
    const resident = client(DEMO_EMAILS.resident);
    const api = new OrdersGateway(baseUrl, resident.user);
    assert.equal((await api.edit('LA-DEMO-001', '3', 'ubah', signal())).estimatedWeightKg, 3);
    await assert.rejects(api.edit('LA-DEMO-001', '99', '', signal()), /melebihi sisa kuota/);
    await assert.rejects(api.edit('LA-DEMO-001', 'abc', '', signal()), /angka positif/);
    await assert.rejects(api.edit('LA-DEMO-002', '1', '', signal()), /berstatus Diterima/);
    await assert.rejects(api.remove('LA-DEMO-003', signal()), /tidak ditemukan untuk akun ini/);
    await api.remove('LA-DEMO-001', signal());
    assert.ok(!(await api.list(signal())).some((o) => o.id === 'LA-DEMO-001'));
  } finally { server.close(); }
});

test('store: replaceOrders membentuk pemberitahuan dan tidak memunculkan lagi yang sudah ditutup', async () => {
  const store = new DemoStore(() => now);
  store.login(DEMO_EMAILS.resident, DEMO_PASSWORD);
  const orders = [...store.visibleOrders()];
  await store.replaceOrders(orders);
  const notice = store.getSnapshot().notices.find((n) => n.orderId === 'LA-DEMO-002')!;
  assert.ok(notice);
  store.dismissNotice(notice.id);
  await store.replaceOrders(orders);
  assert.equal(store.getSnapshot().notices.some((n) => n.orderId === 'LA-DEMO-002'), false);
});
