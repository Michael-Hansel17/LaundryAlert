import { DEMO_EMAILS, DEMO_PASSWORD, MONTHLY_QUOTA_KG } from '../../../config/constants';
import type { DemoAccount } from '../../auth/data/authService';
import { LAUNDRY_STATUSES, type LaundryOrder, type LaundryStatus } from '../domain/models';
import { monthInJakarta } from '../domain/rules';

export function createSeed(now: Date): { accounts: DemoAccount[]; orders: LaundryOrder[] } {
  const createdAt = now.toISOString();
  const accounts: DemoAccount[] = [
    { user: { id: 'resident-demo', name: 'Alya Putri', email: DEMO_EMAILS.resident, roomNumber: 'B-102', role: 'resident', monthlyQuotaKg: MONTHLY_QUOTA_KG, createdAt }, password: DEMO_PASSWORD },
    { user: { id: 'admin-demo', name: 'Petugas Laundry', email: DEMO_EMAILS.admin, roomNumber: '-', role: 'admin', monthlyQuotaKg: MONTHLY_QUOTA_KG, createdAt }, password: DEMO_PASSWORD },
    { user: { id: 'resident-other', name: 'Bima Pratama', email: 'bima@laundryalert.test', roomNumber: 'B-103', role: 'resident', monthlyQuotaKg: MONTHLY_QUOTA_KG, createdAt }, password: DEMO_PASSWORD },
  ];
  const [year, month] = monthInJakarta(now).split('-').map(Number);
  const previousMonth = new Date(Date.UTC(year, month - 2, 15, 3)).toISOString();
  function order(id: string, userIndex: number, weight: number, status: LaundryStatus, at: string): LaundryOrder {
    const user = accounts[userIndex].user;
    return {
      id, userId: user.id, userName: user.name, roomNumber: user.roomNumber,
      estimatedWeightKg: weight, status, notes: '', submittedAt: at, updatedAt: at,
      statusHistory: LAUNDRY_STATUSES.slice(0, LAUNDRY_STATUSES.indexOf(status) + 1).map((stage) => ({ status: stage, at })),
      ...(['selesai', 'diambil'].includes(status) ? { completedAt: at } : {}),
      ...(status === 'diambil' ? { pickedUpAt: at } : {}),
    };
  }
  return { accounts, orders: [
    order('LA-DEMO-001', 0, 2, 'diterima', createdAt),
    order('LA-DEMO-002', 0, 1.5, 'selesai', createdAt),
    order('LA-DEMO-003', 2, 3, 'diproses', createdAt),
    order('LA-DEMO-004', 0, 4, 'diambil', previousMonth),
  ] };
}
