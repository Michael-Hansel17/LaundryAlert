import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEMO_EMAILS, DEMO_PASSWORD } from '../src/config/constants';
import { DemoStore } from '../src/features/laundry/data/demoStore';
import { DemoLaundryRepository } from '../src/features/laundry/data/demoLaundryRepository';
import { LaundrySubmissionController } from '../src/features/laundry/state/LaundrySubmissionController';

function setup() {
  const store = new DemoStore(() => new Date('2026-10-02T03:00:00Z'));
  store.login(DEMO_EMAILS.resident, DEMO_PASSWORD);
  const repository = new DemoLaundryRepository(store, 'resident-demo', 5);
  return { store, repository, controller: new LaundrySubmissionController(repository) };
}

test('repository async: kegagalan muat sekali dapat retry tanpa menghapus data', async () => {
  const { repository, store } = setup(); const signal = new AbortController().signal;
  repository.failNextLoad();
  await assert.rejects(repository.load(signal), /gagal memuat/);
  assert.equal((await repository.load(signal)).quota.remainingKg, 6.5);
  assert.equal(store.visibleOrders().length, 3);
});

test('controller: double tap menulis hanya satu order dan memperbarui kuota/daftar', async () => {
  const { store, controller } = setup();
  const disconnect = controller.connect(); await controller.load();
  controller.setWeight('2,5'); controller.setNotes('Jaket');
  const first = controller.submit(); const second = controller.submit();
  assert.equal(controller.getSnapshot().submitStatus, 'submitting');
  await Promise.all([first, second]);
  assert.equal(store.visibleOrders().length, 4);
  assert.equal(store.quota().remainingKg, 4);
  assert.equal(controller.getSnapshot().data!.orders.length, 4);
  assert.equal(controller.getSnapshot().submitStatus, 'success');
  await controller.submit(); assert.equal(store.visibleOrders().length, 4);
  disconnect();
});

test('repository gagal submit tidak menulis/mengurangi kuota dan retry menulis sekali', async () => {
  const { repository, store, controller } = setup(); await controller.load();
  repository.failNextSubmit(); controller.setWeight('1');
  await controller.submit();
  assert.equal(controller.getSnapshot().submitStatus, 'error');
  assert.equal(controller.getSnapshot().weight, '1');
  assert.equal(store.quota().remainingKg, 6.5);
  await controller.submit();
  assert.equal(store.quota().remainingKg, 5.5);
  assert.equal(store.visibleOrders().length, 4);
});

test('keluar halaman saat submit membatalkan request sebelum commit', async () => {
  const { controller, store } = setup(); await controller.load();
  controller.setWeight('1'); const pending = controller.submit(); controller.dispose();
  await pending;
  assert.equal(store.visibleOrders().length, 3);
  assert.equal(store.quota().remainingKg, 6.5);
});

test('logout saat submit tidak dapat menulis data menggunakan sesi pengguna baru', async () => {
  const { repository, store } = setup();
  const pending = repository.submit({ weight: '1', notes: '' }, new AbortController().signal);
  store.logout(); store.login(DEMO_EMAILS.admin, DEMO_PASSWORD);
  await assert.rejects(pending, /Sesi penghuni/);
  assert.equal(store.visibleOrders().length, 4);
});

test('kuota diperiksa ulang saat commit, bukan hanya ketika data dimuat', async () => {
  const { controller, store } = setup(); await controller.load();
  controller.setWeight('6.5'); const pending = controller.submit();
  store.submit('1', 'Pengajuan lain');
  await pending;
  assert.equal(controller.getSnapshot().submitStatus, 'error');
  assert.match(controller.getSnapshot().submitError!, /melebihi/);
  assert.equal(store.quota().remainingKg, 5.5);
});
