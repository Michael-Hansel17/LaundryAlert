import { useEffect, useMemo } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { DemoAdminRepository } from '../data/demoAdminRepository';
import { AdminStatusController } from '../state/AdminStatusController';
export function useAdminStatus(orderId: string | null = null) {
  const { store, user } = useAuth();
  const feature = useMemo(() => {
    const repository = new DemoAdminRepository(store, user?.id ?? '');
    return { repository, controller: new AdminStatusController(repository, orderId) };
  }, [store, user?.id, orderId]);
  useEffect(() => feature.controller.connect(), [feature]);
  return feature;
}
