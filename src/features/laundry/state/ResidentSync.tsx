import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { API_BASE_URL, API_MODE } from '../../../config/api';
import { useAuth } from '../../auth/hooks/useAuth';
import { createNotifier } from '../../../shared/services/notifier';
import { OrdersGateway } from '../data/ordersGateway';
import type { LaundryOrder } from '../domain/models';
import { ReadyNotifier, type NotifyState } from './ReadyNotifier';

const POLL_MS = 15000; // no push server: poll so a finished order arrives without a manual refresh

export type SyncStatus = 'loading' | 'loaded' | 'error';
interface ResidentSync {
  status: SyncStatus;
  error: string | null;
  reload: () => Promise<void>;
  edit: (orderId: string, weight: string, notes: string) => Promise<unknown>;
  remove: (orderId: string) => Promise<void>;
  notifications: NotifyState & { enable: () => Promise<void>; disable: () => Promise<void> };
}
const Context = createContext<ResidentSync | null>(null);
const message = (e: unknown) => e instanceof Error ? e.message : 'Terjadi masalah pada layanan. Silakan coba lagi.';

// Loads the resident's orders from the backend (loading / error / retry) and routes
// edit / delete through it. In demo mode it stays inert and uses the local store.
export function ResidentSyncProvider({ children }: { children: ReactNode }) {
  const { store, user } = useAuth();
  const http = API_MODE === 'http' && !!user;
  const gateway = useMemo(() => http && user ? new OrdersGateway(API_BASE_URL, user) : null, [http, user]);
  const [status, setStatus] = useState<SyncStatus>(http ? 'loading' : 'loaded');
  const [error, setError] = useState<string | null>(null);
  const readyNotifier = useMemo(() => user && http ? new ReadyNotifier(createNotifier(), AsyncStorage, `@laundryalert/notify/${user.id}`) : null, [http, user]);
  const [notify, setNotify] = useState<NotifyState>({ permission: 'undetermined', enabled: false });
  const latest = useRef<readonly LaundryOrder[]>([]);
  const abort = useRef<AbortController | null>(null);
  const version = useRef(0);

  const reload = useCallback(async () => {
    if (!gateway) return;
    abort.current?.abort();
    const controller = abort.current = new AbortController();
    const mine = ++version.current;
    setStatus((current) => current === 'loaded' ? current : 'loading'); // background refresh keeps data visible
    setError(null);
    try {
      const orders = await gateway.list(controller.signal);
      if (controller.signal.aborted || mine !== version.current) return;
      await store.replaceOrders(orders);
      latest.current = orders;
      if (mine === version.current) setStatus('loaded');
      await readyNotifier?.check(orders);
    } catch (reason) {
      if (controller.signal.aborted || mine !== version.current) return;
      setError(message(reason)); setStatus('error');
    }
  }, [gateway, store, readyNotifier]);

  useEffect(() => { void readyNotifier?.state().then(setNotify); }, [readyNotifier]);
  useEffect(() => {
    if (!gateway) return;
    const timer = setInterval(() => { void reload(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [gateway, reload]);

  useEffect(() => {
    if (gateway) { setStatus('loading'); void reload(); }
    return () => { abort.current?.abort(); version.current += 1; };
  }, [gateway, reload]);

  const value = useMemo<ResidentSync>(() => ({
    status, error, reload,
    notifications: {
      ...notify,
      enable: async () => { if (readyNotifier) setNotify(await readyNotifier.enable(latest.current)); },
      disable: async () => { if (readyNotifier) setNotify(await readyNotifier.disable()); },
    },
    edit: async (orderId, weight, notes) => {
      if (!gateway) return store.editPersisted(orderId, weight, notes);
      const order = await gateway.edit(orderId, weight, notes, new AbortController().signal);
      await store.upsertRemoteOrder(order);
      return order;
    },
    remove: async (orderId) => {
      if (!gateway) { await store.deletePersisted(orderId); return; }
      await gateway.remove(orderId, new AbortController().signal);
      await store.removeRemoteOrder(orderId);
    },
  }), [status, error, reload, gateway, store, notify, readyNotifier]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useResidentSync(): ResidentSync {
  const value = useContext(Context);
  if (!value) throw new Error('useResidentSync harus dipakai di dalam ResidentSyncProvider.');
  return value;
}
