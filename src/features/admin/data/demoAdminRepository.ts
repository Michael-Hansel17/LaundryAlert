import type { DemoStore } from '../../laundry/data/demoStore';
import type { AdminRepository, StatusUpdateInput } from '../domain/adminRepository';
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new Error('Operasi dibatalkan.')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}
// Both roles share the same simulated backend. Recheck authorization and status
// after the delay, immediately before committing; no write on failure or abort.
export class DemoAdminRepository implements AdminRepository {
  private failLoad = false;
  private failUpdate = false;
  constructor(private store: DemoStore, private userId: string, private delayMs = 1500) {}
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
    const fail = this.failLoad; this.failLoad = false;
    await wait(this.delayMs, signal);
    this.assertSession(signal);
    if (fail) throw new Error('Layanan simulasi gagal memuat antrean. Silakan coba lagi.');
    return this.snapshot();
  }
  async update(input: StatusUpdateInput, signal: AbortSignal) {
    this.assertSession(signal);
    const fail = this.failUpdate; this.failUpdate = false;
    await wait(this.delayMs, signal);
    this.assertSession(signal);
    if (fail) throw new Error('Status belum tersimpan. Silakan coba kirim lagi.');
    const current = this.snapshot().find((order) => order.id === input.orderId);
    if (!current) throw new Error('Laundry tidak ditemukan.');
    if (current.status !== input.expectedStatus) throw new Error('Status sudah berubah. Muat ulang data sebelum menyimpan.');
    return this.store.updateStatusPersisted(input.orderId, input.expectedStatus, input.target, signal);
  }
  subscribe(listener: Parameters<AdminRepository['subscribe']>[0]) {
    return this.store.subscribe(() => {
      const user = this.store.getSnapshot().user;
      if (user?.id === this.userId && user.role === 'admin') listener(this.snapshot());
    });
  }
  failNextLoad() { this.failLoad = true; }
  failNextUpdate() { this.failUpdate = true; }
}
