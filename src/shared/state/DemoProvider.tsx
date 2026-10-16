import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Text, View } from 'react-native';
import { DemoStore } from '../../features/laundry/data/demoStore';
import { Button } from '../components/Button';
import { ui } from '../theme/theme';

const DemoContext = createContext<DemoStore | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<DemoStore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Keep one hydration promise across development StrictMode effect replays.
  const opening = useRef<Promise<DemoStore> | null>(null);
  useEffect(() => {
    let active = true;
    setError(null);
    opening.current ??= DemoStore.open(AsyncStorage);
    opening.current.then((loaded) => { if (active) setStore(loaded); }, (reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Penyimpanan lokal tidak dapat dibuka.');
    });
    return () => { active = false; };
  }, [attempt]);
  if (!store) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
    {error ? <><Text accessibilityRole="alert" style={ui.error}>{error}</Text>
      <Button title="Coba baca data lokal lagi" onPress={() => { opening.current = null; setAttempt((value) => value + 1); }} />
    </> : <><ActivityIndicator /><Text style={ui.body}>Membaca data laundry lokal...</Text></>}
  </View>;
  return <DemoContext.Provider value={store}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const store = useContext(DemoContext);
  if (!store) throw new Error('DemoProvider belum dipasang.');
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { ...state, store };
}
