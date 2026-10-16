import type { LaundryOrder, LaundryStatus } from '../../laundry/domain/models';
export interface StatusUpdateInput { orderId: string; expectedStatus: LaundryStatus; target: LaundryStatus }
export interface AdminRepository {
  load(signal: AbortSignal): Promise<readonly LaundryOrder[]>;
  update(input: StatusUpdateInput, signal: AbortSignal): Promise<LaundryOrder>;
  subscribe(listener: (orders: readonly LaundryOrder[]) => void): () => void;
}
