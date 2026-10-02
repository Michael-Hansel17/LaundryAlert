import type { LaundryOrder, QuotaInfo } from './models';

export interface LaundryData {
  orders: readonly LaundryOrder[];
  quota: QuotaInfo;
}
export interface LaundrySubmissionInput { weight: string; notes: string }
export interface LaundryRepository {
  load(signal: AbortSignal): Promise<LaundryData>;
  submit(input: LaundrySubmissionInput, signal: AbortSignal): Promise<LaundryOrder>;
  subscribe(listener: (data: LaundryData) => void): () => void;
}
