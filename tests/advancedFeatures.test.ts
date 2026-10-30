import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApiServer } from '../server/app';
import { ApiLaundryRepository } from '../src/features/laundry/data/apiLaundryRepository';
import { DemoStore } from '../src/features/laundry/data/demoStore';
import { DemoLaundryRepository } from '../src/features/laundry/data/demoLaundryRepository';
import { MAX_PHOTO_CHARS, type KeyValueStorage } from '../src/features/laundry/data/localLaundryStorage';
import { createSeed } from '../src/features/laundry/data/seed';
import { LaundrySubmissionController } from '../src/features/laundry/state/LaundrySubmissionController';
import { ReadyNotifier } from '../src/features/laundry/state/ReadyNotifier';
import type { LaundryOrder } from '../src/features/laundry/domain/models';
import type { Notifier, NotifyPermission } from '../src/shared/services/notifier';
import { createPhotoPicker, toPhotoResult, type PhotoPicker, type PhotoResult } from '../src/shared/services/photoPicker';

const now = new Date('2026-10-10T03:00:00Z');
const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

// ---------- Kamera ----------
const fakeModule = (permission: { granted: boolean; canAskAgain: boolean }, result: unknown) => ({
  requestCameraPermissionsAsync: async () => permission,
  launchCameraAsync: async () => result,
  launchImageLibraryAsync: async () => result,
}) as unknown as Parameters<typeof createPhotoPicker>[0];

test('kamera: izin diberikan + foto diambil menjadi data URI', async () => {
  const picker = createPhotoPicker(fakeModule({ granted: true, canAskAgain: true }, { canceled: false, assets: [{ base64: '/9j/4AAQSkZJRg==', mimeType: 'image/jpeg' }] }));
  assert.deepEqual(await picker.takePhoto(), { status: 'ok', uri: PHOTO });
});

test('kamera: izin ditolak tidak membuka kamera dan menyampaikan canAskAgain', async () => {
  const denied = createPhotoPicker(fakeModule({ granted: false, canAskAgain: false }, { canceled: false, assets: [] }));
  assert.deepEqual(await denied.takePhoto(), { status: 'denied', canAskAgain: false });
});

test('kamera: dibatalkan, foto terlalu besar, dan kegagalan perangkat ditangani', async () => {
  assert.deepEqual(toPhotoResult({ canceled: true, assets: null }), { status: 'cancelled' });
  assert.deepEqual(toPhotoResult({ canceled: false, assets: [{ base64: 'A'.repeat(MAX_PHOTO_CHARS) } as never] }), { status: 'too-large' });
  assert.equal(toPhotoResult({ canceled: false, assets: [{ uri: 'x' } as never] }).status, 'error');
  const broken = createPhotoPicker({ requestCameraPermissionsAsync: async () => { throw new Error('no camera'); } } as never);
  assert.equal((await broken.takePhoto()).status, 'error');
});

function controllerWith(result: PhotoResult) {
  const store = new DemoStore(() => now);
  store.login('penghuni@laundryalert.test', 'demo123');
  const picker: PhotoPicker = { takePhoto: async () => result, pickFromLibrary: async () => result };
  return { store, controller: new LaundrySubmissionController(new DemoLaundryRepository(store, 'resident-demo', 1), picker) };
}

test('controller foto: sukses, batal tidak mengubah foto, izin ditolak memberi petunjuk, hapus foto', async () => {
  const { controller, store } = controllerWith({ status: 'ok', uri: PHOTO });
  await controller.load();
  await controller.attachPhoto('camera');
  assert.equal(controller.getSnapshot().photo, PHOTO);
  controller.setWeight('1');
  await controller.submit();
  assert.equal(store.visibleOrders().find((o) => o.photoUri)?.photoUri, PHOTO);

  const cancelled = controllerWith({ status: 'cancelled' }); await cancelled.controller.load();
  await cancelled.controller.attachPhoto('camera');
  assert.equal(cancelled.controller.getSnapshot().photo, null);
  assert.match(cancelled.controller.getSnapshot().photoMessage!.text, /dibatalkan/);

  const denied = controllerWith({ status: 'denied', canAskAgain: false }); await denied.controller.load();
  await denied.controller.attachPhoto('camera');
  assert.equal(denied.controller.getSnapshot().photoMessage!.kind, 'error');
  assert.match(denied.controller.getSnapshot().photoMessage!.text, /pengaturan/);
  assert.match(denied.controller.getSnapshot().photoMessage!.text, /tanpa foto/);

  const ok = controllerWith({ status: 'ok', uri: PHOTO }); await ok.controller.load();
  await ok.controller.attachPhoto('library'); ok.controller.removePhoto();
  assert.equal(ok.controller.getSnapshot().photo, null);
});

test('controller foto: tanpa picker (perangkat tanpa kamera) menampilkan pesan, form tetap bisa dikirim', async () => {
  const store = new DemoStore(() => now); store.login('penghuni@laundryalert.test', 'demo123');
  const controller = new LaundrySubmissionController(new DemoLaundryRepository(store, 'resident-demo', 1));
  await controller.load();
  await controller.attachPhoto('camera');
  assert.match(controller.getSnapshot().photoMessage!.text, /tidak tersedia/);
  controller.setWeight('1'); await controller.submit();
  assert.equal(controller.getSnapshot().submitStatus, 'success');
});

test('backend: foto disimpan bersama order, foto palsu atau terlalu besar ditolak', async () => {
  const seed = createSeed(now);
  const server = createApiServer({ clock: () => now, seed: seed.orders, allowHeaderAuth: true });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const repo = new ApiLaundryRepository(baseUrl, seed.accounts[0].user, { clock: () => now });
    const signal = new AbortController().signal;
    const order = await repo.submit({ weight: '1', notes: '', photoUri: PHOTO }, signal);
    assert.equal(order.photoUri, PHOTO);
    assert.equal((await repo.load(signal)).orders.find((o) => o.id === order.id)!.photoUri, PHOTO);
    await assert.rejects(repo.submit({ weight: '1', notes: '', photoUri: 'javascript:alert(1)' }, signal), /Foto tidak valid/);
    await assert.rejects(repo.submit({ weight: '1', notes: '', photoUri: `data:image/png;base64,${'A'.repeat(MAX_PHOTO_CHARS)}` }, signal), /Foto tidak valid/);
  } finally { server.close(); }
});

// ---------- Notifikasi ----------
function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => { data.set(k, v); } };
}
function fakeNotifier(initial: NotifyPermission, onRequest: NotifyPermission = 'granted') {
  const sent: string[] = [];
  let permission = initial;
  const notifier: Notifier = {
    getPermission: async () => permission,
    requestPermission: async () => { if (permission !== 'unsupported') permission = onRequest; return permission; },
    notify: async (_title, body) => { sent.push(body); return true; },
  };
  return { notifier, sent };
}
const order = (id: string, status: LaundryOrder['status']): LaundryOrder => ({ ...createSeed(now).orders[0], id, status });

test('notifikasi: izin diminta hanya saat opt-in; yang sudah selesai sebelumnya tidak diumumkan ulang', async () => {
  const { notifier, sent } = fakeNotifier('undetermined');
  const ready = new ReadyNotifier(notifier, memoryStorage(), 'k');
  assert.deepEqual(await ready.state(), { permission: 'undetermined', enabled: false });
  assert.deepEqual(await ready.check([order('A', 'selesai')]), []); // belum opt-in
  const state = await ready.enable([order('A', 'selesai')]);
  assert.equal(state.enabled, true);
  assert.deepEqual(await ready.check([order('A', 'selesai'), order('B', 'diproses')]), []);
  assert.deepEqual(await ready.check([order('A', 'selesai'), order('B', 'selesai')]), ['B']);
  assert.deepEqual(await ready.check([order('B', 'selesai')]), []); // hanya sekali
  assert.equal(sent.length, 1);
  assert.match(sent[0], /sudah selesai/);
});

test('notifikasi: izin ditolak / ditutup / tidak didukung tidak mengaktifkan apa pun', async () => {
  for (const [initial, answer, expected] of [['undetermined', 'denied', 'denied'], ['undetermined', 'undetermined', 'undetermined'], ['unsupported', 'granted', 'unsupported']] as const) {
    const { notifier, sent } = fakeNotifier(initial, answer);
    const ready = new ReadyNotifier(notifier, memoryStorage(), 'k');
    const state = await ready.enable([]);
    assert.deepEqual(state, { permission: expected, enabled: false });
    assert.deepEqual(await ready.check([order('A', 'selesai')]), []);
    assert.equal(sent.length, 0);
  }
});

test('notifikasi: pengaturan bertahan setelah restart dan bisa dimatikan; izin dicabut menonaktifkan', async () => {
  const storage = memoryStorage();
  const first = fakeNotifier('undetermined');
  await new ReadyNotifier(first.notifier, storage, 'k').enable([]);
  const second = fakeNotifier('granted');
  const restarted = new ReadyNotifier(second.notifier, storage, 'k');
  assert.equal((await restarted.state()).enabled, true);
  assert.deepEqual(await restarted.check([order('C', 'selesai')]), ['C']);
  assert.equal((await restarted.disable()).enabled, false);
  assert.deepEqual(await restarted.check([order('D', 'selesai')]), []);
  const revoked = new ReadyNotifier(fakeNotifier('denied').notifier, storage, 'k');
  assert.equal((await revoked.state()).enabled, false);
});
