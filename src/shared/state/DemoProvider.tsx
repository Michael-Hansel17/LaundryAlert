import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { DemoStore } from '../../features/laundry/data/demoStore';

const DemoContext = createContext<DemoStore | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new DemoStore());
  return <DemoContext.Provider value={store}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const store = useContext(DemoContext);
  if (!store) throw new Error('DemoProvider belum dipasang.');
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { ...state, store };
}
