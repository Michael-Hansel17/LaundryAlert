import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEMO_EMAILS, DEMO_PASSWORD } from '../src/config/constants';
import { DemoStore } from '../src/features/laundry/data/demoStore';
import { LAUNDRY_STORAGE_KEY, type KeyValueStorage } from '../src/features/laundry/data/localLaundryStorage';
import { DemoLaundryRepository } from '../src/features/laundry/data/demoLaundryRepository';
const clock = () => new Date('2026-10-09T03:00:00Z');
const login = (store: DemoStore) => store.login(DEMO_EMAILS.resident, DEMO_PASSWORD);
function memoryStorage() {
  const values = new Map<string, string>();
  let fail = false;
  return {
    values, fail: () => { fail = true; },
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { if (fail) { fail = false; throw new Error('Disk penuh'); } values.set(key, value); },
  };
}

test('CRUD memakai file disk: create/read/update/delete bertahan pada instance baru', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'laundry-persistence-'));
  const path = join(dir, 'data.json');
  const storage: KeyValueStorage = {
    getItem: async () => { try { return await readFile(path, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; } },
    setItem: async (_key, value) => { await writeFile(path, value, 'utf8'); },
  };
  try {
    const first = await DemoStore.open(storage, clock); login(first);
    const repo = new DemoLaundryRepository(first, first.getSnapshot().user!.id, 0);
    const created = await repo.submit({ weight: '1.25', notes: 'Demo persistence' }, new AbortController().signal);
    const reopened = await DemoStore.open(storage, clock);
    assert.equal(reopened.getSnapshot().user, null); login(reopened);
    assert.equal(reopened.visibleOrders().find((o) => o.id === created.id)?.notes, 'Demo persistence');
    await reopened.editPersisted(created.id, '2', 'Catatan diperbarui');
    const third = await DemoStore.open(storage, clock); login(third);
    assert.equal(third.visibleOrders().find((o) => o.id === created.id)?.estimatedWeightKg, 2);
    assert.equal(third.visibleOrders().find((o) => o.id === created.id)?.notes, 'Catatan diperbarui');
    assert.equal(third.quota().remainingKg, 4.5);
    await third.deletePersisted(created.id);
    const fourth = await DemoStore.open(storage, clock); login(fourth);
    assert.ok(!fourth.visibleOrders().some((o) => o.id === created.id));
    assert.equal(fourth.quota().remainingKg, 6.5);
    assert.ok(!(await readFile(path, 'utf8')).includes(DEMO_PASSWORD));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('gagal create/update/delete tidak mengubah UI atau disk; retry create hanya satu order', async () => {
  const storage = memoryStorage(); const store = await DemoStore.open(storage, clock); login(store);
  const before = store.getSnapshot(); const saved = storage.values.get(LAUNDRY_STORAGE_KEY);
  storage.fail(); await assert.rejects(store.submitPersisted('1', 'gagal'), /Disk penuh/);
  assert.equal(store.getSnapshot(), before); assert.equal(storage.values.get(LAUNDRY_STORAGE_KEY), saved);
  const order = await store.submitPersisted('1', 'retry');
  assert.equal(store.visibleOrders().filter((o) => o.notes === 'retry').length, 1);
  const after = store.getSnapshot(); const diskAfter = storage.values.get(LAUNDRY_STORAGE_KEY);
  storage.fail(); await assert.rejects(store.editPersisted(order.id, '2', 'gagal'), /Disk penuh/);
  assert.equal(store.getSnapshot(), after); assert.equal(storage.values.get(LAUNDRY_STORAGE_KEY), diskAfter);
  storage.fail(); await assert.rejects(store.deletePersisted(order.id), /Disk penuh/);
  assert.equal(store.getSnapshot(), after); assert.equal(storage.values.get(LAUNDRY_STORAGE_KEY), diskAfter);
});

test('storage rusak, versi asing, model tidak valid tidak ditimpa seed; read error diteruskan', async () => {
  for (const raw of ['{invalid', JSON.stringify({ version: 2, orders: [], sequence: 0 }), JSON.stringify({ version: 1, orders: [{}], sequence: 0 })]) {
    const storage = memoryStorage(); storage.values.set(LAUNDRY_STORAGE_KEY, raw);
    await assert.rejects(DemoStore.open(storage, clock), /tidak valid/);
    assert.equal(storage.values.get(LAUNDRY_STORAGE_KEY), raw);
  }
  await assert.rejects(DemoStore.open({ getItem: async () => { throw new Error('Read gagal'); }, setItem: async () => { assert.fail('Tidak boleh menulis'); } }, clock), /Read gagal/);
});

test('empty yang tersimpan tidak diisi seed lagi; IDs tetap unik sesudah reopen', async () => {
  const storage = memoryStorage(); storage.values.set(LAUNDRY_STORAGE_KEY, JSON.stringify({ version: 1, orders: [], sequence: 0 }));
  const first = await DemoStore.open(storage, clock); login(first);
  assert.equal(first.visibleOrders().length, 0);
  const a = await first.submitPersisted('1', 'A');
  const second = await DemoStore.open(storage, clock); login(second);
  const b = await second.submitPersisted('1', 'B'); assert.notEqual(a.id, b.id);
  await second.deletePersisted(a.id); await second.deletePersisted(b.id);
  const last = await DemoStore.open(storage, clock); login(last); assert.equal(last.visibleOrders().length, 0);
});

test('validasi edit/hapus: kuota, pemilik, status dan order hilang', async () => {
  const storage = memoryStorage(); const store = await DemoStore.open(storage, clock); login(store);
  await assert.rejects(store.editPersisted('LA-DEMO-001', '9', ''), /kuota/);
  await assert.rejects(store.editPersisted('LA-DEMO-001', '0', ''), /lebih dari nol/);
  await assert.rejects(store.deletePersisted('LA-DEMO-002'), /Diterima/);
  await assert.rejects(store.deletePersisted('LA-DEMO-003'), /akun ini/);
  await assert.rejects(store.deletePersisted('missing'), /tidak ditemukan/);
  store.logout(); store.login(DEMO_EMAILS.admin, DEMO_PASSWORD);
  await assert.rejects(store.deletePersisted('LA-DEMO-001'), /akses/);
  await store.updateStatusPersisted('LA-DEMO-001', 'diterima', 'diproses');
  const reopened = await DemoStore.open(storage, clock); reopened.login(DEMO_EMAILS.admin, DEMO_PASSWORD);
  assert.equal(reopened.visibleOrders().find((o) => o.id === 'LA-DEMO-001')?.status, 'diproses');
  await assert.rejects(reopened.updateStatusPersisted('LA-DEMO-001', 'diterima', 'diproses'), /berubah/);
});

test('write queue tidak kehilangan dua pengajuan dan memeriksa kuota saat commit', async () => {
  const storage = memoryStorage(); const store = await DemoStore.open(storage, clock); login(store);
  const result = await Promise.allSettled([store.submitPersisted('4', 'A'), store.submitPersisted('4', 'B')]);
  assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
  const reopened = await DemoStore.open(storage, clock); login(reopened);
  assert.equal(reopened.quota().remainingKg, 2.5);
  await Promise.all([store.submitPersisted('1', 'C'), store.submitPersisted('1', 'D')]);
  const last = await DemoStore.open(storage, clock); login(last); assert.equal(last.quota().remainingKg, 0.5);
});
