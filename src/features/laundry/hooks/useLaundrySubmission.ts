import { useEffect, useMemo } from 'react';
import { API_BASE_URL, API_MODE } from '../../../config/api';
import { useAuth } from '../../auth/hooks/useAuth';
import { ApiLaundryRepository } from '../data/apiLaundryRepository';
import { DemoLaundryRepository } from '../data/demoLaundryRepository';
import { LaundrySubmissionController } from '../state/LaundrySubmissionController';

export function useLaundrySubmission() {
  const { store, user } = useAuth();
  const feature = useMemo(() => {
    const repository = API_MODE === 'http' && user
      ? new ApiLaundryRepository(API_BASE_URL, user, { onSubmitted: (order) => store.mirrorRemoteOrder(order) })
      : new DemoLaundryRepository(store, user?.id ?? '');
    return { repository, controller: new LaundrySubmissionController(repository) };
  }, [store, user]);
  useEffect(() => feature.controller.connect(), [feature]);
  return feature;
}
