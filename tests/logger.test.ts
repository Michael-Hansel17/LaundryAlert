import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient } from '../src/features/laundry/data/apiClient';
import { installCrashHandlers } from '../src/shared/services/crashHandlers';
import { LOG_STORAGE_KEY, Logger, logger as appLogger, redact, type LogStorage } from '../src/shared/services/logger';

const at = new Date('2026-11-20T03:00:00Z');
function memoryStorage(initial: Record<string, string> = {}): LogStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: async (key) => data[key] ?? null, setItem: async (key, value) => { data[key] = value; } };
}

test('ring buffer menyimpan hanya entri terbaru', () => {
  const log = new Logger({ clock: () => at, maxEntries: 3 });
  for (let i = 1; i <= 5; i++) log.info('tes', `pesan ${i}`);
  assert.deepEqual(log.getEntries().map((e) => e.message), ['pesan 3', 'pesan 4', 'pesan 5']);
});

test('redaksi menyembunyikan sandi, token, Authorization, dan foto base64', () => {
  const out = redact({ email: 'a@b.com', password: 'demo123', nested: { token: 'abc', Authorization: 'Bearer x' }, photoUri: 'data:image/jpeg;base64,AAAA', note: 'data:image/png;base64,BBBB' }) as Record<string, unknown>;
  assert.equal(out.email, 'a@b.com');
  assert.equal(out.password, '[redacted]');
  assert.deepEqual(out.nested, { token: '[redacted]', Authorization: '[redacted]' });
  assert.equal(out.photoUri, '[redacted]');
  assert.equal(out.note, '[redacted]');
  const error = redact(new Error('boom')) as Record<string, unknown>;
  assert.equal(error.message, 'boom');
  assert.ok(typeof error.stack === 'string');
  assert.match(String(redact('x'.repeat(900))), /… \(900 karakter\)$/);
});

test('log dipersist ke storage dan dimuat lagi setelah restart', async () => {
  const storage = memoryStorage();
  const first = new Logger({ clock: () => at });
  await first.hydrate(storage);
  first.error('crash', 'Error fatal', { error: new Error('boom') });
  await first.flush();
  assert.ok(storage.data[LOG_STORAGE_KEY].includes('Error fatal'));

  const second = new Logger({ clock: () => at });
  second.info('app', 'sebelum hydrate');
  await second.hydrate(storage);
  assert.deepEqual(second.getEntries().map((e) => e.message), ['Error fatal', 'sebelum hydrate']);
  await second.clear();
  assert.equal(second.getEntries().length, 0);
  assert.equal(storage.data[LOG_STORAGE_KEY], '[]');
});

test('storage rusak tidak menggagalkan logger', async () => {
  const log = new Logger({ clock: () => at });
  await log.hydrate(memoryStorage({ [LOG_STORAGE_KEY]: '{bukan json' }));
  assert.equal(log.getEntries()[0].level, 'warn');
  log.info('tes', 'tetap jalan');
  assert.equal(log.getEntries().length, 2);
});

test('exportText memuat konteks perangkat dan setiap entri', () => {
  const log = new Logger({ clock: () => at });
  log.setContext({ platform: 'android 34', apiUrl: 'http://192.168.1.12:3001' });
  log.warn('api', 'GET /api/orders → 503', { reqId: 'r1' });
  const text = log.exportText();
  assert.match(text, /platform: android 34/);
  assert.match(text, /WARN  \[api\] GET \/api\/orders → 503 \{"reqId":"r1"\}/);
});

test('crash handler mencatat error lalu meneruskan ke handler bawaan', () => {
  const log = new Logger({ clock: () => at });
  const seen: unknown[] = [];
  let handler: (error: unknown, isFatal?: boolean) => void = (error) => { seen.push(error); };
  const target = { ErrorUtils: { getGlobalHandler: () => handler, setGlobalHandler: (next: typeof handler) => { handler = next; } } };
  installCrashHandlers(target, log);
  handler(new Error('meledak'), true);
  assert.equal(seen.length, 1);
  assert.equal(log.getEntries()[0].message, 'Error fatal tidak tertangani');
});

test('ApiClient mengirim X-Request-Id dan mencatat status, durasi, serta kegagalan jaringan', async () => {
  const before = appLogger.getEntries().length;
  let sentId = '';
  const ok = new ApiClient('http://api.test', null, { token: '', fetchImpl: async (_url, init) => {
    sentId = (init?.headers as Record<string, string>)['X-Request-Id'];
    return new Response('{"ok":true}', { status: 200 });
  } });
  await ok.request('/api/health', { method: 'GET' }, new AbortController().signal);
  const down = new ApiClient('http://api.test', null, { token: '', fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  await assert.rejects(down.request('/api/orders', { method: 'GET' }, new AbortController().signal));
  const [success, failure] = appLogger.getEntries().slice(before);
  assert.ok(sentId.length > 4);
  assert.equal(success.level, 'info');
  assert.equal((success.data as { reqId: string }).reqId, sentId);
  assert.equal((success.data as { status: number }).status, 200);
  assert.equal(typeof (success.data as { ms: number }).ms, 'number');
  assert.equal(failure.level, 'error');
  assert.match(failure.message, /GET \/api\/orders gagal terhubung/);
});
