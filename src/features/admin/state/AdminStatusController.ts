import type { LaundryOrder, LaundryStatus } from '../../laundry/domain/models';
import { nextStatus } from '../../laundry/domain/rules';
import type { AdminQueueFilter } from '../domain/models';
import type { AdminRepository } from '../domain/adminRepository';
interface AdminState {
  loadStatus: 'loading' | 'loaded' | 'error';
  orders: readonly LaundryOrder[];
  loadError: string | null;
  filter: AdminQueueFilter;
  orderId: string | null;
  target: LaundryStatus | null;
  validationError: string | null;
  submitStatus: 'idle' | 'submitting' | 'success' | 'error';
  submitError: string | null;
}
const message = (e: unknown) => e instanceof Error ? e.message : 'Layanan gagal. Silakan coba lagi.';
export class AdminStatusController {
  private state: AdminState;
  private listeners = new Set<() => void>();
  private loadAbort?: AbortController;
  private submitAbort?: AbortController;
  private version = 0;
  constructor(private repository: AdminRepository, orderId: string | null = null) {
    this.state = { loadStatus: 'loading', orders: [], loadError: null, filter: 'semua', orderId,
      target: null, validationError: null, submitStatus: 'idle', submitError: null };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private patch(update: Partial<AdminState>) {
    this.state = { ...this.state, ...update };
    this.listeners.forEach((listener) => listener());
  }
  connect() {
    const unsubscribe = this.repository.subscribe((orders) => {
      if (this.state.loadStatus === 'loaded') this.patch({ orders });
    });
    void this.load();
    return () => { unsubscribe(); this.dispose(); };
  }
  async load() {
    if (this.state.submitStatus === 'submitting') return;
    this.loadAbort?.abort();
    const abort = this.loadAbort = new AbortController();
    const version = ++this.version;
    this.patch({ loadStatus: 'loading', loadError: null, target: null, validationError: null, submitStatus: 'idle', submitError: null });
    try {
      const orders = await this.repository.load(abort.signal);
      if (!abort.signal.aborted && version === this.version) this.patch({ loadStatus: 'loaded', orders });
    } catch (e) {
      if (!abort.signal.aborted && version === this.version) this.patch({ loadStatus: 'error', orders: [], loadError: message(e) });
    }
  }
  setFilter(filter: AdminQueueFilter) { if (this.state.submitStatus !== 'submitting') this.patch({ filter }); }
  setTarget(target: LaundryStatus) {
    if (this.state.submitStatus !== 'submitting') this.patch({ target, validationError: null, submitError: null, submitStatus: 'idle' });
  }
  async submit() {
    const state = this.state;
    // Lock synchronously before await; UI disabled state alone is insufficient.
    if (state.submitStatus === 'submitting' || state.submitStatus === 'success' || state.loadStatus !== 'loaded') return;
    const order = state.orders.find((entry) => entry.id === state.orderId);
    if (!order || !state.target || nextStatus(order.status) !== state.target) {
      this.patch({ validationError: !order ? 'Pilih laundry yang tersedia.' : !state.target ? 'Pilih status tujuan terlebih dahulu.' : 'Status harus maju satu tahap sesuai urutan.' });
      return;
    }
    const abort = this.submitAbort = new AbortController();
    this.patch({ submitStatus: 'submitting', submitError: null, validationError: null });
    try {
      const updated = await this.repository.update({ orderId: order.id, expectedStatus: order.status, target: state.target }, abort.signal);
      if (!abort.signal.aborted) this.patch({ orders: this.state.orders.map((entry) => entry.id === updated.id ? updated : entry), submitStatus: 'success', target: null });
    } catch (e) {
      if (!abort.signal.aborted) this.patch({ submitStatus: 'error', submitError: message(e) });
    }
  }
  dispose() { this.loadAbort?.abort(); this.submitAbort?.abort(); this.version += 1; }
}
