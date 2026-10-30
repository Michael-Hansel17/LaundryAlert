import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { DEMO_EMAILS, DEMO_PASSWORD } from '../src/config/constants';
import { createApiServer } from '../server/app';
import { hashPassword, signToken, verifyPassword, verifyToken } from '../server/auth';
import { AuthApi } from '../src/features/auth/data/authApi';
import { OrdersGateway } from '../src/features/laundry/data/ordersGateway';
import { ApiError } from '../src/features/laundry/data/orderDto';
import { createSeed } from '../src/features/laundry/data/seed';

const now = new Date('2026-10-10T03:00:00Z');
async function start(options: { tokenTtlMs?: number } = {}) {
  const seed = createSeed(now);
  const server = createApiServer({ clock: () => now, seed: seed.orders, seedAccounts: seed.accounts, tokenSecret: 'test-secret', ...options });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, baseUrl, auth: new AuthApi(baseUrl) };
}
const signal = () => new AbortController().signal;
const form = { name: 'Sari Demo', email: 'sari@contoh.com', roomNumber: 'C-201', password: 'rahasia1', confirmPassword: 'rahasia1' };

test('password di-hash (salt), token ditandatangani dan kedaluwarsa', () => {
  const record = hashPassword('demo123');
  assert.notEqual(record.hash, 'demo123');
  assert.ok(verifyPassword('demo123', record) && !verifyPassword('salah', record));
  const token = signToken('u1', 's', 1000, 500);
  assert.equal(verifyToken(token, 's', 1200), 'u1');
  assert.equal(verifyToken(token, 's', 1600), null);
  assert.equal(verifyToken(token, 'secret-lain', 1200), null);
  assert.equal(verifyToken(`${token}x`, 's', 1200), null);
});

test('login berhasil mengembalikan token + user, dan /me memvalidasi token', async () => {
  const { server, auth } = await start();
  try {
    const session = await auth.login(DEMO_EMAILS.resident, DEMO_PASSWORD);
    assert.equal(session.user.role, 'resident');
    assert.equal((await auth.me(session.token)).email, DEMO_EMAILS.resident);
  } finally { server.close(); }
});

test('login gagal: sandi salah, email tidak ada, dan body kosong ditolak 401', async () => {
  const { server, auth } = await start();
  try {
    for (const [email, password] of [[DEMO_EMAILS.resident, 'salah'], ['tidak@ada.com', DEMO_PASSWORD], ['', '']]) {
      await assert.rejects(auth.login(email, password), (e) => e instanceof ApiError && e.status === 401 && /tidak sesuai/.test(e.message));
    }
  } finally { server.close(); }
});

test('register: akun baru bisa login; email ganda dan input tidak valid ditolak server', async () => {
  const { server, auth } = await start();
  try {
    const session = await auth.register(form);
    assert.equal(session.user.role, 'resident');
    assert.equal((await auth.login('SARI@contoh.com', 'rahasia1')).user.id, session.user.id);
    await assert.rejects(auth.register(form), /sudah terdaftar/);
    await assert.rejects(auth.register({ ...form, email: 'bukan-email' }), /email yang valid/);
    await assert.rejects(auth.register({ ...form, email: 'b@c.com', password: '123', confirmPassword: '123' }), /minimal 6/);
  } finally { server.close(); }
});

test('endpoint order menolak tanpa token / token palsu / token kedaluwarsa', async () => {
  const { server, baseUrl, auth } = await start({ tokenTtlMs: -1 });
  try {
    const expired = await auth.login(DEMO_EMAILS.resident, DEMO_PASSWORD);
    const user = expired.user;
    for (const token of [undefined, 'palsu.palsu', expired.token]) {
      const gateway = new OrdersGateway(baseUrl, user, { token: token ?? '' });
      await assert.rejects(gateway.list(signal()), (e) => e instanceof ApiError && e.status === 401);
    }
    await assert.rejects(auth.me(expired.token), (e) => e instanceof ApiError && e.status === 401);
  } finally { server.close(); }
});

test('peran diambil dari akun di server, bukan dari klien: penghuni tidak bisa menjadi admin', async () => {
  const { server, baseUrl, auth } = await start();
  try {
    const resident = await auth.login(DEMO_EMAILS.resident, DEMO_PASSWORD);
    const spoof = new OrdersGateway(baseUrl, { ...resident.user, role: 'admin' }, { token: resident.token });
    const orders = await spoof.list(signal());
    assert.ok(orders.every((o) => o.userId === resident.user.id));
    await assert.rejects(spoof.updateStatus('LA-DEMO-001', 'diterima', 'diproses', signal()), /Hanya admin/);
    const admin = await auth.login(DEMO_EMAILS.admin, DEMO_PASSWORD);
    const all = await new OrdersGateway(baseUrl, admin.user, { token: admin.token }).list(signal());
    assert.ok(all.length > orders.length);
  } finally { server.close(); }
});
