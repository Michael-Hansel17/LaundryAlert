import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Text, View } from 'react-native';
import { API_BASE_URL, API_MODE } from '../../config/api';
import { AuthApi } from '../../features/auth/data/authApi';
import { clearSessionToken, loadSessionToken, setSessionExpiredHandler, setSessionToken } from '../../features/auth/data/sessionToken';
import { ApiError } from '../../features/laundry/data/orderDto';
import { DemoStore } from '../../features/laundry/data/demoStore';
import { Button } from '../components/Button';
import { ui } from '../theme/theme';

const DemoContext = createContext<DemoStore | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<DemoStore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [restoring, setRestoring] = useState(API_MODE === 'http');
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
  // A rejected token (expired / revoked) signs the user out instead of leaving a dead session.
  useEffect(() => {
    if (!store) return;
    setSessionExpiredHandler(() => { void clearSessionToken(); store.logout(); });
    return () => setSessionExpiredHandler(null);
  }, [store]);
  // Keep the user signed in after a restart: validate the stored token with the backend.
  useEffect(() => {
    if (!store || API_MODE !== 'http') return;
    let active = true;
    (async () => {
      try {
        const token = await loadSessionToken();
        if (!token) return;
        const user = await new AuthApi(API_BASE_URL).me(token);
        if (!active) return;
        setSessionToken(token);
        store.signInRemote(user);
      } catch (reason) {
        if (reason instanceof ApiError && reason.status === 401) await clearSessionToken(); // expired: sign in again
      } finally { if (active) setRestoring(false); }
    })();
    return () => { active = false; };
  }, [store]);
  if (store && restoring) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
    <ActivityIndicator /><Text style={ui.body}>Memulihkan sesi masuk...</Text>
  </View>;
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
