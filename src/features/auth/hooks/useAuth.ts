import { useDemo } from '../../../shared/state/DemoProvider';

export function useAuth() {
  const { user, store } = useDemo();
  return { user, store };
}
