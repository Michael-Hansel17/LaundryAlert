import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { API_BASE_URL, API_MODE } from '../../config/api';
import { installCrashHandlers } from './crashHandlers';
import { logger } from './logger';

let started = false;

// Called once from App.tsx before the first render.
export function setupAppLogging() {
  if (started) return;
  started = true;
  logger.configure({ console: true });
  installCrashHandlers();
  logger.setContext({
    versiAplikasi: Constants.expoConfig?.version ?? 'tidak diketahui',
    platform: `${Platform.OS} ${String(Platform.Version ?? '')}`.trim(),
    apiUrl: API_BASE_URL,
    apiMode: API_MODE,
  });
  void logger.hydrate(AsyncStorage).then(() => {
    logger.info('app', 'Aplikasi dimulai', logger.getContext());
  });
}
