export const LAUNDRY_STATUSES = ['diterima', 'diproses', 'selesai', 'diambil'] as const;
export type LaundryStatus = typeof LAUNDRY_STATUSES[number];
export const STATUS_LABELS: Record<LaundryStatus, string> = {
  diterima: 'Diterima', diproses: 'Diproses', selesai: 'Selesai', diambil: 'Sudah diambil',
};

export interface LaundryOrder {
  id: string;
  userId: string;
  userName: string;
  roomNumber: string;
  estimatedWeightKg: number;
  notes: string;
  submittedAt: string;
  updatedAt: string;
  status: LaundryStatus;
  statusHistory: { status: LaundryStatus; at: string }[];
  // Optional photo of the laundry (data URI, taken with the camera or chosen from the gallery).
  photoUri?: string;
  completedAt?: string;
  pickedUpAt?: string;
}

export interface QuotaInfo {
  month: string;
  limitKg: number;
  usedKg: number;
  remainingKg: number;
}

export interface CompletionNotice {
  id: string;
  orderId: string;
  userId: string;
  createdAt: string;
}
