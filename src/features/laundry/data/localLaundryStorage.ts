import { LAUNDRY_STATUSES, type LaundryOrder } from '../domain/models';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface LocalLaundryData {
  version: 1;
  orders: LaundryOrder[];
  sequence: number;
}

export const LAUNDRY_STORAGE_KEY = '@laundryalert/laundry/v1';
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
function validOrder(value: unknown): value is LaundryOrder {
  if (!record(value)) return false;
  return ['id', 'userId', 'userName', 'roomNumber', 'notes'].every((key) => typeof value[key] === 'string')
    && !!value.id && !!value.userId
    && typeof value.estimatedWeightKg === 'number' && value.estimatedWeightKg > 0
    && Number.isSafeInteger(Math.round(value.estimatedWeightKg * 100))
    && date(value.submittedAt) && date(value.updatedAt)
    && LAUNDRY_STATUSES.includes(value.status as LaundryOrder['status'])
    && Array.isArray(value.statusHistory) && value.statusHistory.length > 0
    && value.statusHistory.every((event) => record(event) && LAUNDRY_STATUSES.includes(event.status as LaundryOrder['status']) && date(event.at))
    && (value.completedAt === undefined || date(value.completedAt))
    && (value.pickedUpAt === undefined || date(value.pickedUpAt));
}

// One versioned JSON document: deleting the last order saves [], never reseeds it.
// No password or active login session is stored in this feature.
export class LocalLaundryStorage {
  constructor(private storage: KeyValueStorage) {}
  async read(): Promise<LocalLaundryData | null> {
    const raw = await this.storage.getItem(LAUNDRY_STORAGE_KEY);
    if (raw === null) return null;
    try {
      const data: unknown = JSON.parse(raw);
      if (!record(data) || data.version !== 1 || !Number.isSafeInteger(data.sequence) || (data.sequence as number) < 0
        || !Array.isArray(data.orders) || !data.orders.every(validOrder)
        || new Set(data.orders.map((order) => order.id)).size !== data.orders.length) throw new Error();
      return data as unknown as LocalLaundryData;
    } catch {
      throw new Error('Data laundry lokal tidak valid atau versinya belum didukung. Data asli tetap disimpan.');
    }
  }
  async write(data: LocalLaundryData): Promise<void> {
    await this.storage.setItem(LAUNDRY_STORAGE_KEY, JSON.stringify(data));
  }
}
