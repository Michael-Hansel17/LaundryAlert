import type { User } from '../../auth/domain/models';
import type { LaundryOrder, LaundryStatus } from '../domain/models';
import { ApiClient, type ApiClientOptions } from './apiClient';
import { ApiError, parseOrder, parseOrderList } from './orderDto';

// Typed access to the order endpoints used by the resident (list/edit/delete) and admin (list/status).
export class OrdersGateway {
  private client: ApiClient;
  constructor(baseUrl: string, user: User, options: ApiClientOptions = {}) {
    this.client = new ApiClient(baseUrl, user, options);
  }
  failNext() { this.client.failNext(); }

  async list(signal: AbortSignal): Promise<LaundryOrder[]> {
    return parseOrderList(await this.client.request('/api/orders', { method: 'GET' }, signal));
  }
  async edit(orderId: string, weight: string, notes: string, signal: AbortSignal): Promise<LaundryOrder> {
    const body = await this.client.request(`/api/orders/${encodeURIComponent(orderId)}`, { method: 'PUT', body: JSON.stringify({ weight, notes }) }, signal);
    return parseOrder((body as { order?: unknown } | null)?.order);
  }
  async remove(orderId: string, signal: AbortSignal): Promise<void> {
    const body = await this.client.request(`/api/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' }, signal);
    if ((body as { deleted?: unknown } | null)?.deleted !== orderId) throw new ApiError('model', 'Server tidak mengonfirmasi penghapusan laundry.');
  }
  async updateStatus(orderId: string, expectedStatus: LaundryStatus, target: LaundryStatus, signal: AbortSignal): Promise<LaundryOrder> {
    const body = await this.client.request(`/api/orders/${encodeURIComponent(orderId)}/status`, { method: 'PATCH', body: JSON.stringify({ expectedStatus, target }) }, signal);
    return parseOrder((body as { order?: unknown } | null)?.order);
  }
}
