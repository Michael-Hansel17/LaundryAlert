import type { DemoStore } from '../../laundry/data/demoStore';
import type { OrdersGateway } from '../../laundry/data/ordersGateway';
import type { AdminRepository, StatusUpdateInput } from '../domain/adminRepository';

// Backend boundary for the admin: the queue and status changes live on the server;
// the local store only mirrors them so every screen shows the same data.
export class ApiAdminRepository implements AdminRepository {
  constructor(private store: DemoStore, private gateway: OrdersGateway, private userId: string) {}
  private assertSession(signal?: AbortSignal) {
    const user = this.store.getSnapshot().user;
    if (signal?.aborted) throw new Error('Operasi dibatalkan.');
    if (user?.id !== this.userId || user.role !== 'admin') throw new Error('Sesi admin telah berubah. Silakan masuk kembali.');
  }
  private snapshot() {
    this.assertSession();
    return [...this.store.visibleOrders()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }
  async load(signal: AbortSignal) {
    this.assertSession(signal);
    const orders = await this.gateway.list(signal);
    this.assertSession(signal);
    await this.store.replaceOrders(orders);
    return this.snapshot();
  }
  async update(input: StatusUpdateInput, signal: AbortSignal) {
    this.assertSession(signal);
    const order = await this.gateway.updateStatus(input.orderId, input.expectedStatus, input.target, signal);
    this.assertSession();
    await this.store.upsertRemoteOrder(order);
    return order;
  }
  subscribe(listener: Parameters<AdminRepository['subscribe']>[0]) {
    return this.store.subscribe(() => {
      const user = this.store.getSnapshot().user;
      if (user?.id === this.userId && user.role === 'admin') listener(this.snapshot());
    });
  }
  failNextLoad() { this.gateway.failNext(); }
  failNextUpdate() { this.gateway.failNext(); }
}
