import { useDemo } from '../../../shared/state/DemoProvider';

export function useLaundry() {
  const { store, user, notices } = useDemo();
  return {
    store, user,
    orders: user ? [...store.visibleOrders()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)) : [],
    quota: user?.role === 'resident' ? store.quota() : null,
    notices: notices.filter((notice) => notice.userId === user?.id),
  };
}
