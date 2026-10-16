import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEMO_EMAILS, DEMO_PASSWORD } from '../src/config/constants';
import { DemoStore } from '../src/features/laundry/data/demoStore';
import { monthInJakarta, parseWeight } from '../src/features/laundry/domain/rules';
import type { RegistrationInput } from '../src/features/auth/domain/models';

const NOW = new Date('2026-10-02T03:00:00.000Z');
const makeStore = () => new DemoStore(() => NOW);
const resident = (store: DemoStore) => store.login(DEMO_EMAILS.resident, DEMO_PASSWORD);
const admin = (store: DemoStore) => store.login(DEMO_EMAILS.admin, DEMO_PASSWORD);
const validRegistration: RegistrationInput = {
  name: 'Sari', email: 'sari@example.test', roomNumber: 'C-101', password: 'contoh123', confirmPassword: 'contoh123',
};

test('berat menerima koma/titik dan menolak angka tidak valid', () => {
  assert.equal(parseWeight(' 2,50 '), 2.5);
  assert.equal(parseWeight('0.01'), 0.01);
  for (const input of ['', 'abc', '0', '0,00', '-2', '1.234', '1e2', 'Infinity', '2 kg', '2,3.4', '99999999999999999999999']) {
    assert.throws(() => parseWeight(input), Error, input);
  }
});

test('kuota seed hanya menghitung pemilik dan bulan pengajuan', () => {
  const store = makeStore(); resident(store);
  assert.deepEqual(store.quota(), { month: '2026-10', limitKg: 10, usedKg: 3.5, remainingKg: 6.5 });
  assert.ok(store.visibleOrders().every((o) => o.userId === 'resident-demo'));
  assert.ok(store.visibleOrders().some((o) => o.status === 'diambil'));
});

test('batas kuota tepat diterima, kelebihan ditolak tanpa mengubah data', () => {
  const store = makeStore(); resident(store);
  const order = store.submit('6,50', '  Pisahkan jaket  ');
  assert.equal(order.notes, 'Pisahkan jaket');
  assert.equal(order.status, 'diterima');
  assert.equal(store.quota().remainingKg, 0);
  const snapshot = store.getSnapshot();
  assert.throws(() => store.submit('0.01', ''), /melebihi/);
  assert.equal(store.getSnapshot(), snapshot);
});

test('perhitungan desimal tidak menolak batas kuota karena galat floating point', () => {
  const store = makeStore(); store.register(validRegistration);
  store.submit('0.1', ''); store.submit('0.2', ''); store.submit('9.7', '');
  assert.equal(store.quota().usedKg, 10);
  assert.equal(store.quota().remainingKg, 0);
});

test('bulan menggunakan WIB, kuota berubah saat pergantian bulan', () => {
  assert.equal(monthInJakarta('2026-10-31T16:59:59Z'), '2026-10');
  assert.equal(monthInJakarta('2026-10-31T17:00:00Z'), '2026-11');
  let now = new Date('2026-10-31T16:59:59Z');
  const store = new DemoStore(() => now); resident(store);
  store.submit('1', '');
  assert.equal(store.quota().usedKg, 4.5);
  now = new Date('2026-10-31T17:00:00Z');
  assert.equal(store.quota().remainingKg, 10);
});

test('demo end-to-end mempertahankan data, progres dan pemberitahuan setelah logout', () => {
  const store = makeStore(); resident(store);
  const order = store.submit('2.5', 'Demo end-to-end');
  store.logout(); admin(store);
  assert.ok(store.visibleOrders().some((o) => o.id === order.id));
  store.updateStatus(order.id, 'diproses');
  store.updateStatus(order.id, 'selesai');
  store.logout(); resident(store);
  const updated = store.visibleOrders().find((o) => o.id === order.id)!;
  assert.equal(updated.status, 'selesai');
  assert.deepEqual(updated.statusHistory.map((s) => s.status), ['diterima', 'diproses', 'selesai']);
  assert.equal(updated.completedAt, NOW.toISOString());
  assert.equal(store.quota().remainingKg, 4);
  assert.equal(store.getSnapshot().notices.filter((n) => n.orderId === order.id).length, 1);
  store.dismissNotice(`notice-${order.id}`);
  assert.ok(!store.getSnapshot().notices.some((n) => n.orderId === order.id));
});

test('status tidak dapat melompat, mundur, diulang, atau maju setelah diambil', () => {
  const store = makeStore(); admin(store);
  assert.throws(() => store.updateStatus('LA-DEMO-001', 'selesai'), /satu tahap/);
  store.updateStatus('LA-DEMO-001', 'diproses');
  assert.throws(() => store.updateStatus('LA-DEMO-001', 'diterima'), /satu tahap/);
  store.updateStatus('LA-DEMO-001', 'selesai');
  const noticeCount = store.getSnapshot().notices.length;
  assert.throws(() => store.updateStatus('LA-DEMO-001', 'selesai'), /satu tahap/);
  assert.equal(store.getSnapshot().notices.length, noticeCount);
  store.updateStatus('LA-DEMO-001', 'diambil');
  assert.equal(store.getSnapshot().orders.find((o) => o.id === 'LA-DEMO-001')?.pickedUpAt, NOW.toISOString());
  assert.throws(() => store.updateStatus('LA-DEMO-001', 'diproses'), /satu tahap/);
  store.logout(); resident(store);
  assert.equal(store.quota().usedKg, 3.5);
});

test('tindakan admin/penghuni dibatasi sesi dan order hilang ditangani', () => {
  const store = makeStore();
  assert.throws(() => store.submit('1', ''), /akses/);
  resident(store);
  assert.throws(() => store.updateStatus('LA-DEMO-001', 'diproses'), /akses/);
  admin(store);
  assert.throws(() => store.submit('1', ''), /akses/);
  assert.throws(() => store.updateStatus('missing', 'diproses'), /tidak ditemukan/);
});

test('registrasi akun sementara bisa login lagi, email dinormalisasi, kuota awal 10 kg', () => {
  const store = makeStore();
  store.register({ ...validRegistration, email: ' SARI@Example.Test ' });
  const uid = store.getSnapshot().user!.id;
  assert.equal(store.getSnapshot().user!.role, 'resident');
  assert.equal(store.visibleOrders().length, 0);
  assert.equal(store.quota().remainingKg, 10);
  store.submit('1', ''); store.logout();
  store.login('SARI@example.test', validRegistration.password);
  assert.equal(store.getSnapshot().user!.id, uid);
  assert.equal(store.visibleOrders().length, 1);
  assert.equal(store.quota().remainingKg, 9);
  assert.throws(() => store.register(validRegistration), /sudah terdaftar/);
  assert.throws(() => makeStore().login(validRegistration.email, validRegistration.password), /tidak sesuai/);
});

test('registrasi menolak input kosong, email salah, sandi pendek dan konfirmasi salah', () => {
  for (const input of [
    { ...validRegistration, name: ' ' }, { ...validRegistration, roomNumber: '' },
    { ...validRegistration, email: 'email-salah' }, { ...validRegistration, password: '123' },
    { ...validRegistration, confirmPassword: 'tidakcocok' },
  ]) {
    const store = makeStore(); assert.throws(() => store.register(input), Error);
    assert.equal(store.getSnapshot().user, null);
  }
});

test('login salah tidak membuat sesi dan pemberitahuan milik pengguna lain tidak dapat ditutup', () => {
  const store = makeStore();
  assert.throws(() => store.login(DEMO_EMAILS.resident, 'salah'), /tidak sesuai/);
  assert.equal(store.getSnapshot().user, null);
  store.register(validRegistration);
  store.dismissNotice('notice-LA-DEMO-002');
  assert.ok(store.getSnapshot().notices.some((n) => n.id === 'notice-LA-DEMO-002'));
});

test('subscription mengabarkan perubahan dan dapat dihentikan', () => {
  const store = makeStore(); let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  resident(store); store.submit('1', ''); store.logout();
  assert.equal(calls, 3);
  unsubscribe(); admin(store);
  assert.equal(calls, 3);
});

test('store unit tanpa adapter storage hanya memakai memori; aplikasi memakai DemoStore.open', () => {
  const store = makeStore(); resident(store); const order = store.submit('1', '');
  const restarted = makeStore(); resident(restarted);
  assert.ok(!restarted.visibleOrders().some((o) => o.id === order.id));
  assert.equal(restarted.quota().remainingKg, 6.5);
});
