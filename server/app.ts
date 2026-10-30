import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { MONTHLY_QUOTA_KG } from '../src/config/constants';
import { normalizeEmail, registerAccount, type DemoAccount } from '../src/features/auth/data/authService';
import type { RegistrationInput, User } from '../src/features/auth/domain/models';
import { hashPassword, signToken, verifyPassword, verifyToken } from './auth';
import { isPhotoUri, validOrder } from '../src/features/laundry/data/localLaundryStorage';
import { LAUNDRY_STATUSES, type LaundryOrder, type LaundryStatus } from '../src/features/laundry/domain/models';
import { calculateQuota, parseWeight, transitionOrder } from '../src/features/laundry/domain/rules';

interface ServerOptions {
  file?: string;
  clock?: () => Date;
  // Orders used when there is no saved file yet (demo data so the admin queue is not empty).
  seed?: LaundryOrder[];
  // Accounts (plain passwords are hashed on load). accountsFile persists registered accounts.
  seedAccounts?: DemoAccount[];
  accountsFile?: string;
  tokenSecret?: string;
  tokenTtlMs?: number;
  // Test-only shortcut: trust X-User-Id / X-User-Role instead of a Bearer token. Never enable in main.ts.
  allowHeaderAuth?: boolean;
}

interface StoredAccount { user: User; salt: string; hash: string }

// REST backend for the MVP. Identity is the X-User-Id / X-User-Role headers
// (no real authentication yet; Firebase Auth would replace it).
//   POST   /api/auth/login|register, GET /api/auth/me   (Bearer token)
//   GET    /api/orders            resident: own orders, admin: all orders
//   POST   /api/orders            resident creates an order (quota checked)
//   PUT    /api/orders/:id        resident edits own order while status = diterima
//   DELETE /api/orders/:id        resident deletes own order while status = diterima
//   PATCH  /api/orders/:id/status admin moves an order one step forward
export function createApiServer(options: ServerOptions = {}): Server {
  const clock = options.clock ?? (() => new Date());
  let orders: LaundryOrder[] = [];
  let sequence = 0;
  if (options.file && existsSync(options.file)) {
    const saved: unknown = JSON.parse(readFileSync(options.file, 'utf8'));
    if (Array.isArray(saved)) orders = saved.filter(validOrder);
  } else if (options.seed) {
    orders = [...options.seed];
  }
  let accounts: StoredAccount[] = [];
  if (options.accountsFile && existsSync(options.accountsFile)) {
    const saved: unknown = JSON.parse(readFileSync(options.accountsFile, 'utf8'));
    if (Array.isArray(saved)) accounts = saved as StoredAccount[];
  } else {
    accounts = (options.seedAccounts ?? []).map((account) => ({ user: account.user, ...hashPassword(account.password) }));
  }
  const secret = options.tokenSecret ?? randomBytes(32).toString('hex');
  const ttl = options.tokenTtlMs ?? 7 * 24 * 60 * 60 * 1000;
  const saveAccounts = () => {
    if (!options.accountsFile) return;
    mkdirSync(dirname(options.accountsFile), { recursive: true });
    writeFileSync(options.accountsFile, JSON.stringify(accounts, null, 2));
  };
  const save = () => {
    if (!options.file) return;
    mkdirSync(dirname(options.file), { recursive: true });
    writeFileSync(options.file, JSON.stringify(orders, null, 2));
  };
  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-User-Role, X-Simulate-Failure',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    });
    res.end(status === 204 ? undefined : JSON.stringify(body));
  };
  const readJson = (req: IncomingMessage) => new Promise<Record<string, unknown>>((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; if (data.length > 1_000_000) reject(new Error('too large')); });
    req.on('end', () => {
      try {
        const parsed: unknown = JSON.parse(data || '{}');
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error();
        resolve(parsed as Record<string, unknown>);
      } catch { reject(new Error('Isi permintaan bukan JSON valid.')); }
    });
    req.on('error', reject);
  });
  const resident = (userId: string) => ({ id: userId, monthlyQuotaKg: MONTHLY_QUOTA_KG }) as User;
  // Weight must fit in the quota of the month the order was submitted in.
  const checkWeight = (raw: unknown, others: LaundryOrder[], userId: string, at: string) => {
    const weight = parseWeight(String(raw ?? ''));
    const quota = calculateQuota(others, resident(userId), at);
    if (Math.round(weight * 100) > Math.round(quota.remainingKg * 100)) {
      throw new Error(`Berat melebihi sisa kuota ${quota.remainingKg.toLocaleString('id-ID')} kg.`);
    }
    return weight;
  };

  function identify(req: IncomingMessage): StoredAccount | null {
    const bearer = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''))?.[1];
    if (bearer) {
      const id = verifyToken(bearer, secret, Date.now());
      return accounts.find((entry) => entry.user.id === id) ?? null;
    }
    const headerId = req.headers['x-user-id'];
    if (options.allowHeaderAuth && typeof headerId === 'string' && headerId) {
      const role = req.headers['x-user-role'] === 'admin' ? 'admin' : 'resident';
      return accounts.find((entry) => entry.user.id === headerId) ?? { user: { id: headerId, role } as User, salt: '', hash: '' };
    }
    return null;
  }

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (req.method === 'OPTIONS') return send(res, 204, null);
      if (url.pathname === '/api/health') return send(res, 200, { ok: true });
      if (url.pathname.startsWith('/api/auth/')) {
        if (req.headers['x-simulate-failure']) return send(res, 503, { message: 'Server simulasi sedang gagal. Silakan coba lagi.' });
        const session = (account: StoredAccount) => ({ token: signToken(account.user.id, secret, Date.now(), ttl), user: account.user });
        if (url.pathname === '/api/auth/login' && req.method === 'POST') {
          const input = await readJson(req);
          const account = accounts.find((entry) => entry.user.email === normalizeEmail(String(input.email ?? '')));
          if (!account || !verifyPassword(String(input.password ?? ''), account)) return send(res, 401, { message: 'Email atau kata sandi tidak sesuai.' });
          return send(res, 200, session(account));
        }
        if (url.pathname === '/api/auth/register' && req.method === 'POST') {
          const input = await readJson(req);
          const form: RegistrationInput = {
            name: String(input.name ?? ''), email: String(input.email ?? ''), roomNumber: String(input.roomNumber ?? ''),
            password: String(input.password ?? ''), confirmPassword: String(input.confirmPassword ?? ''),
          };
          let created: DemoAccount;
          try {
            created = registerAccount(accounts.map((entry) => ({ user: entry.user, password: '' })), form, `user-${randomBytes(6).toString('hex')}`, clock().toISOString());
          } catch (error) { return send(res, 422, { message: (error as Error).message }); }
          const account: StoredAccount = { user: created.user, ...hashPassword(created.password) };
          accounts = [...accounts, account];
          saveAccounts();
          return send(res, 201, session(account));
        }
        if (url.pathname === '/api/auth/me' && req.method === 'GET') {
          const account = identify(req);
          return account ? send(res, 200, { user: account.user }) : send(res, 401, { message: 'Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.' });
        }
        return send(res, 404, { message: 'Endpoint tidak ditemukan.' });
      }
      const match = /^\/api\/orders(?:\/([^/]+)(\/status)?)?$/.exec(url.pathname);
      if (!match) return send(res, 404, { message: 'Endpoint tidak ditemukan.' });
      if (req.headers['x-simulate-failure']) return send(res, 503, { message: 'Server simulasi sedang gagal. Silakan coba lagi.' });
      const identity = identify(req);
      if (!identity) return send(res, 401, { message: 'Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.' });
      const userId = identity.user.id;
      const isAdmin = identity.user.role === 'admin';
      const [, id, statusPath] = match;

      if (!id) {
        if (req.method === 'GET') return send(res, 200, { orders: isAdmin ? orders : orders.filter((order) => order.userId === userId) });
        if (req.method === 'POST') {
          if (isAdmin) return send(res, 403, { message: 'Admin tidak dapat membuat pengajuan laundry.' });
          const input = await readJson(req);
          const now = clock().toISOString();
          const weight = checkWeight(input.weight, orders, userId, now);
          if (input.photoUri !== undefined && input.photoUri !== null && !isPhotoUri(input.photoUri)) return send(res, 422, { message: 'Foto tidak valid atau terlalu besar. Gunakan foto JPEG/PNG/WebP yang lebih kecil.' });
          const order: LaundryOrder = {
            id: `LA-${clock().getTime()}-${++sequence}`, userId,
            userName: String(input.userName ?? 'Penghuni'), roomNumber: String(input.roomNumber ?? '-'),
            estimatedWeightKg: weight, notes: String(input.notes ?? '').trim(),
            ...(isPhotoUri(input.photoUri) ? { photoUri: input.photoUri } : {}),
            submittedAt: now, updatedAt: now, status: 'diterima', statusHistory: [{ status: 'diterima', at: now }],
          };
          orders = [order, ...orders];
          save();
          return send(res, 201, { order });
        }
        return send(res, 405, { message: 'Metode tidak didukung.' });
      }

      const current = orders.find((order) => order.id === decodeURIComponent(id));
      if (!current) return send(res, 404, { message: 'Laundry tidak ditemukan.' });

      if (statusPath) {
        if (req.method !== 'PATCH') return send(res, 405, { message: 'Metode tidak didukung.' });
        if (!isAdmin) return send(res, 403, { message: 'Hanya admin yang dapat mengubah status laundry.' });
        const input = await readJson(req);
        const target = input.target as LaundryStatus;
        if (!LAUNDRY_STATUSES.includes(target)) return send(res, 422, { message: 'Status tujuan tidak dikenal.' });
        if (input.expectedStatus !== current.status) return send(res, 409, { message: 'Status sudah berubah. Muat ulang data sebelum menyimpan.' });
        let updated: LaundryOrder;
        try { updated = transitionOrder(current, target, clock().toISOString()); } catch (error) { return send(res, 422, { message: (error as Error).message }); }
        orders = orders.map((order) => order.id === current.id ? updated : order);
        save();
        return send(res, 200, { order: updated });
      }

      // PUT / DELETE: only the owner, only while still "diterima".
      if (req.method !== 'PUT' && req.method !== 'DELETE') return send(res, 405, { message: 'Metode tidak didukung.' });
      if (isAdmin || current.userId !== userId) return send(res, 403, { message: 'Laundry tidak ditemukan untuk akun ini.' });
      if (current.status !== 'diterima') return send(res, 409, { message: 'Hanya laundry berstatus Diterima yang dapat diedit atau dihapus.' });
      if (req.method === 'DELETE') {
        orders = orders.filter((order) => order.id !== current.id);
        save();
        return send(res, 200, { deleted: current.id });
      }
      const input = await readJson(req);
      const weight = checkWeight(input.weight, orders.filter((order) => order.id !== current.id), userId, current.submittedAt);
      const updated: LaundryOrder = { ...current, estimatedWeightKg: weight, notes: String(input.notes ?? '').trim(), updatedAt: clock().toISOString() };
      orders = orders.map((order) => order.id === current.id ? updated : order);
      save();
      return send(res, 200, { order: updated });
    } catch (error) {
      const known = error instanceof Error && /JSON|Berat|kuota|Foto/.test(error.message);
      send(res, known ? (/JSON/.test((error as Error).message) ? 400 : 422) : 500, { message: known ? (error as Error).message : 'Terjadi kesalahan pada server.' });
    }
  });
}
