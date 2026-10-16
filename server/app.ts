import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { MONTHLY_QUOTA_KG } from '../src/config/constants';
import type { User } from '../src/features/auth/domain/models';
import { validOrder } from '../src/features/laundry/data/localLaundryStorage';
import type { LaundryOrder } from '../src/features/laundry/domain/models';
import { calculateQuota, parseWeight } from '../src/features/laundry/domain/rules';

// Small REST backend for the vertical slice. Identity is the X-User-Id header
// (no real authentication yet; Firebase Auth would replace it).
export function createApiServer(options: { file?: string; clock?: () => Date } = {}): Server {
  const clock = options.clock ?? (() => new Date());
  let orders: LaundryOrder[] = [];
  let sequence = 0;
  if (options.file && existsSync(options.file)) {
    const saved: unknown = JSON.parse(readFileSync(options.file, 'utf8'));
    if (Array.isArray(saved)) orders = saved.filter(validOrder);
  }
  const save = () => {
    if (!options.file) return;
    mkdirSync(dirname(options.file), { recursive: true });
    writeFileSync(options.file, JSON.stringify(orders, null, 2));
  };
  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Simulate-Failure',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end(status === 204 ? undefined : JSON.stringify(body));
  };
  const readBody = (req: IncomingMessage) => new Promise<string>((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; if (data.length > 100_000) reject(new Error('too large')); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (req.method === 'OPTIONS') return send(res, 204, null);
      if (url.pathname === '/api/health') return send(res, 200, { ok: true });
      if (url.pathname !== '/api/orders') return send(res, 404, { message: 'Endpoint tidak ditemukan.' });
      if (req.headers['x-simulate-failure']) return send(res, 503, { message: 'Server simulasi sedang gagal. Silakan coba lagi.' });
      const userId = req.headers['x-user-id'];
      if (typeof userId !== 'string' || !userId) return send(res, 401, { message: 'Header X-User-Id wajib diisi.' });

      if (req.method === 'GET') return send(res, 200, { orders: orders.filter((order) => order.userId === userId) });
      if (req.method === 'POST') {
        let input: { weight?: unknown; notes?: unknown; userName?: unknown; roomNumber?: unknown };
        try { input = JSON.parse(await readBody(req)); } catch { return send(res, 400, { message: 'Isi permintaan bukan JSON valid.' }); }
        let weight: number;
        try { weight = parseWeight(String(input.weight ?? '')); } catch (error) { return send(res, 422, { message: (error as Error).message }); }
        const now = clock().toISOString();
        const resident = { id: userId, monthlyQuotaKg: MONTHLY_QUOTA_KG } as User;
        const quota = calculateQuota(orders, resident, now);
        if (Math.round(weight * 100) > Math.round(quota.remainingKg * 100)) {
          return send(res, 422, { message: `Berat melebihi sisa kuota ${quota.remainingKg.toLocaleString('id-ID')} kg.` });
        }
        const order: LaundryOrder = {
          id: `LA-${clock().getTime()}-${++sequence}`, userId,
          userName: String(input.userName ?? 'Penghuni'), roomNumber: String(input.roomNumber ?? '-'),
          estimatedWeightKg: weight, notes: String(input.notes ?? '').trim(),
          submittedAt: now, updatedAt: now, status: 'diterima', statusHistory: [{ status: 'diterima', at: now }],
        };
        orders = [order, ...orders];
        save();
        return send(res, 201, { order });
      }
      return send(res, 405, { message: 'Metode tidak didukung.' });
    } catch {
      send(res, 500, { message: 'Terjadi kesalahan pada server.' });
    }
  });
}
