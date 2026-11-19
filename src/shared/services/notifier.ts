import { Platform } from 'react-native';
import { logger } from './logger';

export type NotifyPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';
export interface Notifier {
  getPermission(): Promise<NotifyPermission>;
  requestPermission(): Promise<NotifyPermission>;
  notify(title: string, body: string): Promise<boolean>;
}

// Local notifications: expo-notifications on Android/iOS, the browser Notification API on web.
// Nothing leaves the device; there is no push server in this MVP.
interface WebNotification {
  permission: string;
  requestPermission(): Promise<string>;
  new (title: string, options?: { body?: string }): unknown;
}
const webApi = () => (globalThis as { Notification?: WebNotification }).Notification;
const fromWeb = (value: string): NotifyPermission => value === 'granted' ? 'granted' : value === 'denied' ? 'denied' : 'undetermined';
const fromNative = (p: { granted: boolean; canAskAgain: boolean }): NotifyPermission => p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';

async function native() {
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Status laundry', importance: Notifications.AndroidImportance.HIGH });
  }
  return Notifications;
}

// Logs permission results and delivery failures without changing the notifier's behaviour.
function traced(inner: Notifier): Notifier {
  return {
    getPermission: inner.getPermission,
    requestPermission: async () => {
      const result = await inner.requestPermission();
      logger.info('notifikasi', `Izin notifikasi: ${result}`);
      return result;
    },
    notify: async (title, body) => {
      const sent = await inner.notify(title, body);
      if (sent) logger.info('notifikasi', 'Notifikasi dikirim', { title });
      else logger.warn('notifikasi', 'Notifikasi tidak terkirim (izin belum diberikan atau tidak didukung)', { title });
      return sent;
    },
  };
}

export function createNotifier(): Notifier { return traced(createPlatformNotifier()); }

function createPlatformNotifier(): Notifier {
  if (Platform.OS === 'web') return {
    getPermission: async () => { const api = webApi(); return api ? fromWeb(api.permission) : 'unsupported'; },
    requestPermission: async () => {
      const api = webApi();
      if (!api) return 'unsupported';
      try { return fromWeb(await api.requestPermission()); } catch { return 'undetermined'; }
    },
    notify: async (title, body) => {
      const api = webApi();
      if (!api || api.permission !== 'granted') return false;
      try { new api(title, { body }); return true; } catch { return false; }
    },
  };
  return {
    getPermission: async () => { try { return fromNative(await (await native()).getPermissionsAsync()); } catch { return 'unsupported'; } },
    requestPermission: async () => { try { return fromNative(await (await native()).requestPermissionsAsync()); } catch { return 'unsupported'; } },
    notify: async (title, body) => {
      try {
        const Notifications = await native();
        await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
        return true;
      } catch (error) { logger.error('notifikasi', 'Gagal menjadwalkan notifikasi', { error }); return false; }
    },
  };
}
