import type { Notifier, NotifyPermission } from '../../../shared/services/notifier';
import { formatKg } from '../../../shared/utils/format';
import type { KeyValueStorage } from '../data/localLaundryStorage';
import type { LaundryOrder } from '../domain/models';

interface Saved { enabled: boolean; notified: string[] }
export interface NotifyState { permission: NotifyPermission; enabled: boolean }

// "Laundry selesai" alert. The user opts in (the system permission is asked only then); an order
// is announced once, and orders already finished when notifications are switched on are not replayed.
export class ReadyNotifier {
  private saved: Saved | null = null;
  constructor(private notifier: Notifier, private storage: KeyValueStorage, private key: string) {}

  private async load(): Promise<Saved> {
    if (this.saved) return this.saved;
    try {
      const raw = await this.storage.getItem(this.key);
      const data = raw ? JSON.parse(raw) as Partial<Saved> : {};
      this.saved = { enabled: data.enabled === true, notified: Array.isArray(data.notified) ? data.notified.filter((id) => typeof id === 'string') : [] };
    } catch { this.saved = { enabled: false, notified: [] }; }
    return this.saved;
  }
  private async persist() {
    try { await this.storage.setItem(this.key, JSON.stringify(this.saved)); } catch { /* preference is asked again next time */ }
  }

  async state(): Promise<NotifyState> {
    const saved = await this.load();
    const permission = await this.notifier.getPermission();
    return { permission, enabled: saved.enabled && permission === 'granted' };
  }
  async enable(orders: readonly LaundryOrder[]): Promise<NotifyState> {
    const saved = await this.load();
    const permission = await this.notifier.requestPermission();
    if (permission === 'granted') {
      saved.enabled = true;
      saved.notified = [...new Set([...saved.notified, ...orders.filter((o) => o.status === 'selesai').map((o) => o.id)])];
      await this.persist();
    }
    return { permission, enabled: permission === 'granted' };
  }
  async disable(): Promise<NotifyState> {
    const saved = await this.load();
    saved.enabled = false;
    await this.persist();
    return this.state();
  }
  // Called after every refresh from the backend. Returns the ids announced now.
  async check(orders: readonly LaundryOrder[]): Promise<string[]> {
    const saved = await this.load();
    if (!saved.enabled || (await this.notifier.getPermission()) !== 'granted') return [];
    const announced: string[] = [];
    for (const order of orders.filter((o) => o.status === 'selesai' && !saved.notified.includes(o.id))) {
      if (await this.notifier.notify('Laundry siap diambil', `Cucian ${formatKg(order.estimatedWeightKg)} (${order.id}) sudah selesai. Silakan ambil di petugas.`)) {
        saved.notified.push(order.id); announced.push(order.id);
      }
    }
    if (announced.length) await this.persist();
    return announced;
  }
}
