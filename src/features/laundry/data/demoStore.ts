import { authenticate, registerAccount, type DemoAccount } from '../../auth/data/authService';
import type { RegistrationInput, User } from '../../auth/domain/models';
import type { CompletionNotice, LaundryOrder, LaundryStatus } from '../domain/models';
import { calculateQuota, parseWeight, transitionOrder } from '../domain/rules';
import { createSeed } from './seed';
import { LocalLaundryStorage, type KeyValueStorage } from './localLaundryStorage';

interface DemoState {
  user: User | null;
  orders: readonly LaundryOrder[];
  notices: readonly CompletionNotice[];
}

// Firebase integration boundary: replace these in-memory operations with Auth
// and Firestore subscriptions. Both roles must keep using the same data source.
export class DemoStore {
  private accounts: DemoAccount[];
  private state: DemoState;
  private listeners = new Set<() => void>();
  private sequence = 0;
  private clock: () => Date;
  private local?: LocalLaundryStorage;
  private writes: Promise<void> = Promise.resolve();

  static async open(storage: KeyValueStorage, clock: () => Date = () => new Date()) {
    const store = new DemoStore(clock);
    store.local = new LocalLaundryStorage(storage);
    const saved = await store.local.read();
    if (saved) {
      store.sequence = saved.sequence;
      store.state = { ...store.state, orders: saved.orders, notices: saved.orders.filter((o) => o.status === 'selesai').map((o) => ({
        id: `notice-${o.id}`, orderId: o.id, userId: o.userId, createdAt: o.completedAt ?? o.updatedAt,
      })) };
    } else {
      await store.local.write({ version: 1, orders: [...store.state.orders], sequence: store.sequence });
    }
    return store;
  }

  // Serialize writes; disk commit precedes UI success. A failed save never
  // publishes the draft, so retry cannot duplicate an already-visible order.
  private commit<T>(change: (draft: DemoStore) => T, signal?: AbortSignal): Promise<T> {
    if (!this.local) {
      if (signal?.aborted) return Promise.reject(new Error('Operasi dibatalkan.'));
      try { return Promise.resolve(change(this)); } catch (error) { return Promise.reject(error); }
    }
    const owner = this.state.user?.id;
    const operation = this.writes.then(async () => {
      if (signal?.aborted) throw new Error('Operasi dibatalkan.');
      if (!owner || this.state.user?.id !== owner) throw new Error('Sesi telah berubah. Silakan masuk kembali.');
      const draft = new DemoStore(this.clock);
      draft.accounts = this.accounts;
      draft.state = this.state;
      draft.sequence = this.sequence;
      const result = change(draft);
      await this.local!.write({ version: 1, orders: [...draft.state.orders], sequence: draft.sequence });
      this.sequence = Math.max(this.sequence, draft.sequence);
      this.publish({ ...draft.state, user: this.state.user });
      return result;
    });
    this.writes = operation.then(() => undefined, () => undefined);
    return operation;
  }

  submitPersisted(weight: string, notes: string, signal?: AbortSignal) {
    return this.commit((draft) => draft.submit(weight, notes), signal);
  }
  updateStatusPersisted(orderId: string, expectedStatus: LaundryStatus, target: LaundryStatus, signal?: AbortSignal) {
    return this.commit((draft) => {
      const current = draft.visibleOrders().find((order) => order.id === orderId);
      if (!current) throw new Error('Laundry tidak ditemukan.');
      if (current.status !== expectedStatus) throw new Error('Status sudah berubah. Muat ulang data sebelum menyimpan.');
      draft.updateStatus(orderId, target);
      return draft.state.orders.find((order) => order.id === orderId)!;
    }, signal);
  }
  editPersisted(orderId: string, weightInput: string, notes: string) {
    return this.commit((draft) => {
      const order = draft.editableOrder(orderId);
      const weight = parseWeight(weightInput);
      const remaining = calculateQuota(draft.state.orders.filter((o) => o.id !== orderId), draft.session('resident'), order.submittedAt).remainingKg;
      if (Math.round(weight * 100) > Math.round(remaining * 100)) throw new Error('Berat melebihi sisa kuota pada bulan pengajuan.');
      const updated = { ...order, estimatedWeightKg: weight, notes: notes.trim(), updatedAt: draft.clock().toISOString() };
      draft.publish({ ...draft.state, orders: draft.state.orders.map((o) => o.id === orderId ? updated : o) });
      return updated;
    });
  }
  deletePersisted(orderId: string) {
    return this.commit((draft) => {
      draft.editableOrder(orderId);
      draft.publish({ ...draft.state, orders: draft.state.orders.filter((o) => o.id !== orderId), notices: draft.state.notices.filter((n) => n.orderId !== orderId) });
    });
  }
  private editableOrder(orderId: string) {
    const user = this.session('resident');
    const order = this.state.orders.find((o) => o.id === orderId && o.userId === user.id);
    if (!order) throw new Error('Laundry tidak ditemukan untuk akun ini.');
    if (order.status !== 'diterima') throw new Error('Hanya laundry berstatus Diterima yang dapat diedit atau dihapus.');
    return order;
  }

  constructor(clock: () => Date = () => new Date()) {
    this.clock = clock;
    const seed = createSeed(clock());
    this.accounts = seed.accounts;
    this.state = {
      user: null, orders: seed.orders,
      notices: seed.orders.filter((o) => o.status === 'selesai').map((o) => ({
        id: `notice-${o.id}`, orderId: o.id, userId: o.userId, createdAt: o.completedAt!,
      })),
    };
  }

  getSnapshot = (): DemoState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(state: DemoState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  private session(role?: User['role']): User {
    const user = this.state.user;
    if (!user || (role && user.role !== role)) throw new Error('Sesi tidak memiliki akses untuk tindakan ini.');
    return user;
  }

  login(email: string, password: string) {
    this.publish({ ...this.state, user: authenticate(this.accounts, email, password) });
  }
  register(input: RegistrationInput) {
    const account = registerAccount(this.accounts, input, `user-${++this.sequence}`, this.clock().toISOString());
    this.accounts = [...this.accounts, account];
    this.publish({ ...this.state, user: account.user });
  }
  logout() { this.publish({ ...this.state, user: null }); }

  visibleOrders(): readonly LaundryOrder[] {
    const user = this.session();
    return user.role === 'admin' ? this.state.orders : this.state.orders.filter((o) => o.userId === user.id);
  }
  quota() {
    return calculateQuota(this.state.orders, this.session('resident'), this.clock());
  }
  submit(weightInput: string, notes: string): LaundryOrder {
    const user = this.session('resident');
    const weight = parseWeight(weightInput);
    const now = this.clock().toISOString();
    const quota = calculateQuota(this.state.orders, user, now);
    if (Math.round(weight * 100) > Math.round(quota.remainingKg * 100)) {
      throw new Error(`Berat melebihi sisa kuota ${quota.remainingKg.toLocaleString('id-ID')} kg.`);
    }
    const order: LaundryOrder = {
      id: `LA-${this.clock().getTime()}-${++this.sequence}`, userId: user.id,
      userName: user.name, roomNumber: user.roomNumber, estimatedWeightKg: weight,
      notes: notes.trim(), submittedAt: now, updatedAt: now, status: 'diterima',
      statusHistory: [{ status: 'diterima', at: now }],
    };
    this.publish({ ...this.state, orders: [order, ...this.state.orders] });
    return order;
  }
  updateStatus(orderId: string, target: LaundryStatus) {
    this.session('admin');
    const order = this.state.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Laundry tidak ditemukan.');
    const now = this.clock().toISOString();
    const updated = transitionOrder(order, target, now);
    const notices = target === 'selesai'
      ? [...this.state.notices, { id: `notice-${orderId}`, orderId, userId: order.userId, createdAt: now }]
      : this.state.notices;
    this.publish({ ...this.state, orders: this.state.orders.map((o) => o.id === orderId ? updated : o), notices });
  }
  dismissNotice(id: string) {
    const user = this.session('resident');
    this.publish({ ...this.state, notices: this.state.notices.filter((n) => n.id !== id || n.userId !== user.id) });
  }
}
