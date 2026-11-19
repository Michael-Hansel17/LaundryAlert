import { API_BASE_URL, API_MODE } from '../../../config/api';
import { logger } from '../../../shared/services/logger';
import { useDemo } from '../../../shared/state/DemoProvider';
import { AuthApi } from '../data/authApi';
import { clearSessionToken, saveSessionToken } from '../data/sessionToken';
import type { RegistrationInput } from '../domain/models';
import { validateLogin, validateRegistration } from '../domain/validation';

// Logs the outcome of an auth action (email only, never the password) and rethrows failures.
async function traced<T>(action: string, email: string, run: () => Promise<T>): Promise<T> {
  try {
    const result = await run();
    logger.info('auth', `${action} berhasil`, { email: email.trim().toLowerCase() });
    return result;
  } catch (error) {
    logger.warn('auth', `${action} gagal`, { email: email.trim().toLowerCase(), error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

// signIn / signUp / signOut work in both modes: backend accounts (http) or the in-memory demo (demo).
export function useAuth() {
  const { user, store } = useDemo();
  const api = new AuthApi(API_BASE_URL);
  return {
    user, store,
    signIn: (email: string, password: string) => traced('Masuk', email, async () => {
      validateLogin(email, password); // instant field validation before the network
      if (API_MODE !== 'http') return store.login(email, password);
      const session = await api.login(email, password);
      await saveSessionToken(session.token);
      store.signInRemote(session.user);
    }),
    signUp: (input: RegistrationInput) => traced('Registrasi', input.email, async () => {
      if (API_MODE !== 'http') return store.register(input);
      validateRegistration(input); // instant field validation before the network
      const session = await api.register(input);
      await saveSessionToken(session.token);
      store.signInRemote(session.user);
    }),
    async signOut() {
      logger.info('auth', 'Keluar', { userId: user?.id });
      await clearSessionToken();
      store.logout();
    },
  };
}
