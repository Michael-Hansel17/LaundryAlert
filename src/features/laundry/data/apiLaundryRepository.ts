import { API_TIMEOUT_MS } from '../../../config/api';
import type { User } from '../../auth/domain/models';
import type { LaundryData, LaundryRepository, LaundrySubmissionInput } from '../domain/laundryRepository';
import type { LaundryOrder } from '../domain/models';
import { calculateQuota } from '../domain/rules';
import { ApiClient, type FetchLike } from './apiClient';
import { parseOrder, parseOrderList } from './orderDto';

export type { FetchLike };
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
  private client: ApiClient;
  private clock: () => Date;
  constructor(baseUrl: string, private user: User, private options: Options = {}) {
    this.client = new ApiClient(baseUrl, user, { fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs ?? API_TIMEOUT_MS });
    this.clock = options.clock ?? (() => new Date());
  }

  private snapshot(): LaundryData {
    const orders = [...this.orders].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return { orders, quota: calculateQuota(orders, this.user, this.clock()) };
  }

  async load(signal: AbortSignal): Promise<LaundryData> {
    const body = await this.client.request('/api/orders', { method: 'GET' }, signal);
    this.orders = parseOrderList(body).filter((order) => order.userId === this.user.id);
    return this.snapshot();
  }

  async submit(input: LaundrySubmissionInput, signal: AbortSignal): Promise<LaundryOrder> {
    const body = await this.client.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ weight: input.weight, notes: input.notes, photoUri: input.photoUri, userName: this.user.name, roomNumber: this.user.roomNumber }),
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
  failNextLoad() { this.client.failNext(); }
  failNextSubmit() { this.client.failNext(); }
}
