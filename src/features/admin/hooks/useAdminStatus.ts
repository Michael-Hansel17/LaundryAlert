import { useEffect, useMemo } from 'react';
import { API_BASE_URL, API_MODE } from '../../../config/api';
import { useAuth } from '../../auth/hooks/useAuth';
import { OrdersGateway } from '../../laundry/data/ordersGateway';
import { ApiAdminRepository } from '../data/apiAdminRepository';
import { DemoAdminRepository } from '../data/demoAdminRepository';
import { AdminStatusController } from '../state/AdminStatusController';
export function useAdminStatus(orderId: string | null = null) {
  const { store, user } = useAuth();
  const feature = useMemo(() => {
    const repository = API_MODE === 'http' && user
      ? new ApiAdminRepository(store, new OrdersGateway(API_BASE_URL, user), user.id)
      : new DemoAdminRepository(store, user?.id ?? '');
    return { repository, controller: new AdminStatusController(repository, orderId) };
  }, [store, user, orderId]);
  useEffect(() => feature.controller.connect(), [feature]);
  return feature;
}
