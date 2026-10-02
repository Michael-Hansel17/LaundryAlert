import { APP_TIME_ZONE } from '../../../config/constants';
import type { User } from '../../auth/domain/models';
import { LAUNDRY_STATUSES, type LaundryOrder, type LaundryStatus, type QuotaInfo } from './models';

export function monthInJakarta(date: Date | string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit',
  }).formatToParts(new Date(date));
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}`;
}

export function parseWeight(input: string): number {
  const value = input.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) {
    throw new Error('Berat harus berupa angka positif dengan maksimal 2 angka desimal.');
  }
  const hundredths = Math.round(Number(value.replace(',', '.')) * 100);
  if (!Number.isSafeInteger(hundredths) || hundredths <= 0) {
    throw new Error('Berat harus lebih dari nol dan berupa angka yang valid.');
  }
  return hundredths / 100;
}

export function calculateQuota(orders: readonly LaundryOrder[], user: User, now: Date | string): QuotaInfo {
  const month = monthInJakarta(now);
  const used = orders
    .filter((order) => order.userId === user.id && monthInJakarta(order.submittedAt) === month)
    .reduce((sum, order) => sum + Math.round(order.estimatedWeightKg * 100), 0);
  const limit = Math.round(user.monthlyQuotaKg * 100);
  return { month, limitKg: limit / 100, usedKg: used / 100, remainingKg: Math.max(0, limit - used) / 100 };
}

export function nextStatus(status: LaundryStatus): LaundryStatus | undefined {
  return LAUNDRY_STATUSES[LAUNDRY_STATUSES.indexOf(status) + 1];
}

export function transitionOrder(order: LaundryOrder, target: LaundryStatus, now: string): LaundryOrder {
  if (nextStatus(order.status) !== target) {
    throw new Error('Status harus maju satu tahap sesuai urutan.');
  }
  return {
    ...order, status: target, updatedAt: now,
    statusHistory: [...order.statusHistory, { status: target, at: now }],
    ...(target === 'selesai' ? { completedAt: now } : {}),
    ...(target === 'diambil' ? { pickedUpAt: now } : {}),
  };
}
