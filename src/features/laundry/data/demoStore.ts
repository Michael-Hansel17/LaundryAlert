import { authenticate, registerAccount, type DemoAccount } from '../../auth/data/authService';
import type { RegistrationInput, User } from '../../auth/domain/models';
import type { CompletionNotice, LaundryOrder, LaundryStatus } from '../domain/models';
import { calculateQuota, parseWeight, transitionOrder } from '../domain/rules';
import { createSeed } from './seed';

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
