import type { LaundryData, LaundryRepository, LaundrySubmissionInput } from '../domain/laundryRepository';
import type { DemoStore } from './demoStore';

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new Error('Operasi dibatalkan.')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

// Firebase boundary: replace delay + store calls with Firebase requests.
// Both roles keep using the same underlying data source.
export class DemoLaundryRepository implements LaundryRepository {
  private failLoad = false;
  private failSubmit = false;
  constructor(private store: DemoStore, private userId: string, private delayMs = 1500) {}

  private assertSession(signal?: AbortSignal) {
    if (signal?.aborted) throw new Error('Operasi dibatalkan.');
    const user = this.store.getSnapshot().user;
    if (user?.id !== this.userId || user.role !== 'resident') throw new Error('Sesi penghuni telah berubah. Silakan masuk kembali.');
  }
  private snapshot(): LaundryData {
    this.assertSession();
    return { orders: [...this.store.visibleOrders()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)), quota: this.store.quota() };
  }
  async load(signal: AbortSignal): Promise<LaundryData> {
    this.assertSession(signal);
    const fail = this.failLoad; this.failLoad = false;
    await wait(this.delayMs, signal);
    this.assertSession(signal);
    if (fail) throw new Error('Layanan simulasi gagal memuat data laundry. Silakan coba lagi.');
    return this.snapshot();
  }
  async submit(input: LaundrySubmissionInput, signal: AbortSignal) {
    this.assertSession(signal);
    const fail = this.failSubmit; this.failSubmit = false;
    await wait(this.delayMs, signal);
    this.assertSession(signal);
    if (fail) throw new Error('Pengajuan belum terkirim karena layanan simulasi gagal. Silakan coba lagi.');
    // Validate quota again at commit to reject stale data. No write until success.
    return this.store.submit(input.weight, input.notes);
  }
  subscribe(listener: (data: LaundryData) => void) {
    return this.store.subscribe(() => {
      if (this.store.getSnapshot().user?.id === this.userId) listener(this.snapshot());
    });
  }
  // One-shot repository failures for demo: UI doesn't force an error state.
  failNextLoad() { this.failLoad = true; }
  failNextSubmit() { this.failSubmit = true; }
}
