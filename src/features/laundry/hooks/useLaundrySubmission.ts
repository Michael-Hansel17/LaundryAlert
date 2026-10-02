import { useEffect, useMemo } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { DemoLaundryRepository } from '../data/demoLaundryRepository';
import { LaundrySubmissionController } from '../state/LaundrySubmissionController';

export function useLaundrySubmission() {
  const { store, user } = useAuth();
  const feature = useMemo(() => {
    const repository = new DemoLaundryRepository(store, user?.id ?? '');
    return { repository, controller: new LaundrySubmissionController(repository) };
  }, [store, user?.id]);
  useEffect(() => feature.controller.connect(), [feature]);
  return feature;
}
