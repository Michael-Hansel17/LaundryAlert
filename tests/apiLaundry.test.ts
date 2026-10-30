import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApiServer } from '../server/app';
import { ApiLaundryRepository, type FetchLike } from '../src/features/laundry/data/apiLaundryRepository';
import { ApiError, parseOrder, parseOrderList } from '../src/features/laundry/data/orderDto';
import { createSeed } from '../src/features/laundry/data/seed';
import { LaundrySubmissionController } from '../src/features/laundry/state/LaundrySubmissionController';

const now = new Date('2026-10-10T03:00:00Z');
const user = createSeed(now).accounts[0].user;
const signal = () => new AbortController().signal;
const validDto = {
  id: 'LA-1', userId: user.id, userName: user.name, roomNumber: 'B-102', estimatedWeightKg: 2, notes: '',
  submittedAt: now.toISOString(), updatedAt: now.toISOString(), status: 'diterima',
  statusHistory: [{ status: 'diterima', at: now.toISOString() }],
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const repo = (fetchImpl: FetchLike) => new ApiLaundryRepository('http://api.test', user, { fetchImpl, clock: () => now });

test('model valid: JSON server diubah menjadi LaundryOrder', () => {
  assert.deepEqual(parseOrder(validDto), validDto);
});

test('model invalid: berat negatif, status asing, dan field hilang ditolak', () => {
  for (const bad of [{ ...validDto, estimatedWeightKg: -1 }, { ...validDto, status: 'hilang' }, { ...validDto, id: undefined }, null, 'x']) {
    assert.throws(() => parseOrder(bad), (error) => error instanceof ApiError && error.kind === 'model');
  }
  assert.throws(() => parseOrderList({ orders: [validDto, validDto] }), /ganda/);
});

test('API sukses: load mengisi order dan menghitung kuota', async () => {
  const requests: string[] = [];
  const data = await repo(async (url, init) => {
    requests.push(`${init?.method} ${url} ${(init?.headers as Record<string, string>)['X-User-Id']}`);
    return json({ orders: [validDto] });
  }).load(signal());
  assert.deepEqual(requests, ['GET http://api.test/api/orders resident-demo']);
  assert.equal(data.orders.length, 1);
  assert.equal(data.quota.remainingKg, 8);
});

test('data kosong: server tanpa order menghasilkan daftar kosong dengan kuota penuh', async () => {
  const data = await repo(async () => json({ orders: [] })).load(signal());
  assert.equal(data.orders.length, 0);
  assert.equal(data.quota.remainingKg, 10);
});

test('HTTP gagal: status 500 dan server mati menjadi pesan error, tanpa data', async () => {
  await assert.rejects(repo(async () => json({ message: 'Database down' }, 500)).load(signal()), /Database down/);
  await assert.rejects(repo(async () => new Response('<html>', { status: 502 })).load(signal()), /502/);
  await assert.rejects(repo(async () => { throw new TypeError('fetch failed'); }).load(signal()), (error) => error instanceof ApiError && error.kind === 'network');
});

test('JSON rusak: respons 200 yang bukan JSON ditolak sebagai error parse', async () => {
  await assert.rejects(repo(async () => new Response('{"orders": [', { status: 200 })).load(signal()),
    (error) => error instanceof ApiError && error.kind === 'parse');
  await assert.rejects(repo(async () => json({ data: [] })).load(signal()), (error) => error instanceof ApiError && error.kind === 'model');
});

test('submit: POST mengirim body dan memperbarui kuota serta listener', async () => {
  let body: Record<string, unknown> = {};
  const repository = repo(async (_url, init) => { body = JSON.parse(String(init?.body)); return json({ order: { ...validDto, id: 'LA-2', estimatedWeightKg: 2.5 } }, 201); });
  let pushed = 0;
  repository.subscribe((data) => { pushed = data.quota.usedKg; });
  const order = await repository.submit({ weight: '2,5', notes: 'Jaket' }, signal());
  assert.equal(order.id, 'LA-2');
  assert.equal(body.weight, '2,5');
  assert.equal(pushed, 2.5);
});

test('controller + API: loading -> error -> retry -> loaded', async () => {
  let fail = true;
  const controller = new LaundrySubmissionController(repo(async () => fail ? json({ message: 'Server sibuk' }, 503) : json({ orders: [] })));
  const loading = controller.load();
  assert.equal(controller.getSnapshot().loadStatus, 'loading');
  await loading;
  assert.equal(controller.getSnapshot().loadStatus, 'error');
  assert.match(controller.getSnapshot().loadError!, /Server sibuk/);
  fail = false;
  await controller.load();
  assert.equal(controller.getSnapshot().loadStatus, 'loaded');
  assert.equal(controller.getSnapshot().data!.orders.length, 0);
});

test('backend nyata: POST disimpan, GET membacanya, validasi dan kuota ditolak server', async () => {
  const server = createApiServer({ clock: () => now, allowHeaderAuth: true });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const repository = new ApiLaundryRepository(baseUrl, user, { clock: () => now });
    assert.equal((await repository.load(signal())).orders.length, 0);
    const created = await repository.submit({ weight: '4', notes: 'Seprai' }, signal());
    const reloaded = await new ApiLaundryRepository(baseUrl, user, { clock: () => now }).load(signal());
    assert.deepEqual(reloaded.orders.map((o) => o.id), [created.id]);
    assert.equal(reloaded.quota.remainingKg, 6);
    await assert.rejects(repository.submit({ weight: 'abc', notes: '' }, signal()), /angka positif/);
    await assert.rejects(repository.submit({ weight: '7', notes: '' }, signal()), /melebihi sisa kuota/);
    repository.failNextLoad();
    await assert.rejects(repository.load(signal()), /simulasi/);
  } finally {
    server.close();
  }
});
