import { useLaundry } from '../../laundry/hooks/useLaundry';
import type { AdminQueueFilter } from '../domain/models';

export function useAdminQueue(filter: AdminQueueFilter) {
  const { orders, store } = useLaundry();
  return {
    store,
    activeCount: orders.filter((o) => o.status !== 'diambil').length,
    orders: filter === 'semua' ? orders : orders.filter((o) => o.status === filter),
  };
}
