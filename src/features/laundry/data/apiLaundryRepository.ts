import { API_TIMEOUT_MS } from '../../../config/api';
import type { User } from '../../auth/domain/models';
import type { LaundryData, LaundryRepository, LaundrySubmissionInput } from '../domain/laundryRepository';
import type { LaundryOrder } from '../domain/models';
import { calculateQuota } from '../domain/rules';
import { ApiError, parseOrder, parseOrderList } from './orderDto';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
interface Options {
  fetchImpl?: FetchLike;
  clock?: () => Date;
  timeoutMs?: number;
  // Called after the backend accepted a new order (e.g. to mirror it in the local cache).
  onSubmitted?: (order: LaundryOrder) => void | Promise<void>;
}

// Backend boundary: UI -> controller -> this repository -> REST (GET/POST /api/orders).
export class ApiLaundryRepository implements LaundryRepository {
  private orders: LaundryOrder[] = [];
  private listeners = new Set<(data: LaundryData) => void>();
  private simulateFailure = false;
  private fetchImpl: FetchLike;
  private clock: () => Date;
  private timeoutMs: number;
  constructor(private baseUrl: string, private user: User, private options: Options = {}) {
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
    this.clock = options.clock ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? API_TIMEOUT_MS;
  }

  private async request(path: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
    if (signal.aborted) throw new Error('Operasi dibatalkan.');
    const timeout = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; timeout.abort(); }, this.timeoutMs);
    const cancel = () => timeout.abort();
    signal.addEventListener('abort', cancel, { once: true });
    const headers: Record<string, string> = { Accept: 'application/json', 'X-User-Id': this.user.id };
    if (this.simulateFailure) { headers['X-Simulate-Failure'] = '1'; this.simulateFailure = false; }
    if (init.body) headers['Content-Type'] = 'application/json';
    try {
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers, signal: timeout.signal });
      } catch {
        if (signal.aborted) throw new Error('Operasi dibatalkan.');
        if (timedOut) throw new ApiError('timeout', 'Server tidak merespons tepat waktu. Periksa koneksi lalu coba lagi.');
        throw new ApiError('network', 'Tidak dapat terhubung ke server. Pastikan backend berjalan (npm run api) lalu coba lagi.');
      }
      const text = await response.text();
      if (!response.ok) {
        let detail = '';
        try { detail = (JSON.parse(text) as { message?: string }).message ?? ''; } catch { /* non-JSON error body */ }
        throw new ApiError('http', detail || `Server menjawab dengan kesalahan ${response.status}. Silakan coba lagi.`, response.status);
      }
      try { return JSON.parse(text); }
      catch { throw new ApiError('parse', 'Respons server rusak dan tidak dapat dibaca (bukan JSON valid).'); }
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
    }
  }

  private snapshot(): LaundryData {
    const orders = [...this.orders].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return { orders, quota: calculateQuota(orders, this.user, this.clock()) };
  }

  async load(signal: AbortSignal): Promise<LaundryData> {
    const body = await this.request('/api/orders', { method: 'GET' }, signal);
    this.orders = parseOrderList(body).filter((order) => order.userId === this.user.id);
    return this.snapshot();
  }

  async submit(input: LaundrySubmissionInput, signal: AbortSignal): Promise<LaundryOrder> {
    const body = await this.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ weight: input.weight, notes: input.notes, userName: this.user.name, roomNumber: this.user.roomNumber }),
    }, signal);
    const order = parseOrder((body as { order?: unknown } | null)?.order);
    this.orders = [order, ...this.orders.filter((existing) => existing.id !== order.id)];
    try { await this.options.onSubmitted?.(order); } catch { /* backend already has the order */ }
    const data = this.snapshot();
    this.listeners.forEach((listener) => listener(data));
    return order;
  }

  subscribe(listener: (data: LaundryData) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  // Dev panel: the next request asks the server for a 503.
  failNextLoad() { this.simulateFailure = true; }
  failNextSubmit() { this.simulateFailure = true; }
}
