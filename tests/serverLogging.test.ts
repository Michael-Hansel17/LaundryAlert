import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { DEMO_EMAILS, DEMO_PASSWORD } from '../src/config/constants';
import { createApiServer } from '../server/app';
import { fileLogger, memoryLogger } from '../server/logger';
import { createSeed } from '../src/features/laundry/data/seed';

const now = new Date('2026-11-20T03:00:00Z');
async function start() {
  const { logger, entries } = memoryLogger();
  const seed = createSeed(now);
  const server = createApiServer({ clock: () => now, seed: seed.orders, seedAccounts: seed.accounts, tokenSecret: 'test-secret', logger });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // 'finish' fires after the client has the response; give the event loop a turn before asserting.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
  return { server, baseUrl, entries, settle };
}

test('setiap request dicatat dengan reqId dari aplikasi, status, durasi, dan userId', async () => {
  const { server, baseUrl, entries, settle } = await start();
  try {
    const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'abc123' }, body: JSON.stringify({ email: DEMO_EMAILS.resident, password: DEMO_PASSWORD }) });
    assert.equal(login.headers.get('x-request-id'), 'abc123');
    const { token } = await login.json() as { token: string };
    await fetch(`${baseUrl}/api/orders`, { headers: { Authorization: `Bearer ${token}` } });
    await fetch(`${baseUrl}/api/health`);
    await settle();
    const lines = entries.filter((e) => typeof e.status === 'number');
    assert.equal(lines.length, 2, 'health check tidak dicatat');
    assert.deepEqual({ reqId: lines[0].reqId, status: lines[0].status, level: lines[0].level }, { reqId: 'abc123', status: 200, level: 'info' });
    assert.equal(typeof lines[0].ms, 'number');
    assert.ok(lines[1].userId, 'userId tercatat untuk request yang terautentikasi');
    assert.match(String(lines[1].reqId), /^[0-9a-f]{8}$/);
  } finally { server.close(); }
});

test('login gagal dicatat sebagai warn tanpa kata sandi', async () => {
  const { server, baseUrl, entries, settle } = await start();
  try {
    await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', body: JSON.stringify({ email: DEMO_EMAILS.admin, password: 'sandi-rahasia-salah' }) });
    await settle();
    const text = JSON.stringify(entries);
    assert.ok(!text.includes('sandi-rahasia-salah'));
    assert.ok(entries.some((e) => e.msg === 'Login gagal' && e.email === DEMO_EMAILS.admin && e.level === 'warn'));
    assert.ok(entries.some((e) => e.status === 401 && e.error === 'Email atau kata sandi tidak sesuai.'));
  } finally { server.close(); }
});

test('reqId tidak valid diganti dan error 5xx dicatat sebagai error', async () => {
  const { server, baseUrl, entries, settle } = await start();
  try {
    const res = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'X-Request-Id': 'bad id\n', 'X-Simulate-Failure': '1' }, body: '{}' });
    assert.equal(res.status, 503);
    await settle();
    const line = entries.find((e) => e.status === 503)!;
    assert.equal(line.level, 'error');
    assert.match(String(line.reqId), /^[0-9a-f]{8}$/);
  } finally { server.close(); }
});

test('file logger menulis JSON per baris dan menghapus file lebih tua dari masa simpan', () => {
  const dir = mkdtempSync(join(tmpdir(), 'la-log-'));
  try {
    writeFileSync(join(dir, 'server-2026-10-01.log'), 'lama\n');
    writeFileSync(join(dir, 'server-2026-11-15.log'), 'baru\n');
    const log = fileLogger({ dir, retentionDays: 14, console: false, clock: () => now });
    log.log('info', 'GET /api/orders 200', { reqId: 'r1', token: 'rahasia' });
    assert.ok(!existsSync(join(dir, 'server-2026-10-01.log')));
    assert.ok(existsSync(join(dir, 'server-2026-11-15.log')));
    const line = JSON.parse(readFileSync(join(dir, 'server-2026-11-20.log'), 'utf8').trim()) as Record<string, unknown>;
    assert.deepEqual({ level: line.level, msg: line.msg, reqId: line.reqId, token: line.token }, { level: 'info', msg: 'GET /api/orders 200', reqId: 'r1', token: '[redacted]' });
    assert.equal(readdirSync(dir).length, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
