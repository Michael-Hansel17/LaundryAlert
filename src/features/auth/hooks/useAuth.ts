import { API_BASE_URL, API_MODE } from '../../../config/api';
import { useDemo } from '../../../shared/state/DemoProvider';
import { AuthApi } from '../data/authApi';
import { registerAccount } from '../data/authService';
import { clearSessionToken, saveSessionToken } from '../data/sessionToken';
import type { RegistrationInput } from '../domain/models';

// signIn / signUp / signOut work in both modes: backend accounts (http) or the in-memory demo (demo).
export function useAuth() {
  const { user, store } = useDemo();
  const api = new AuthApi(API_BASE_URL);
  return {
    user, store,
    async signIn(email: string, password: string) {
      if (API_MODE !== 'http') return store.login(email, password);
      const session = await api.login(email, password);
      await saveSessionToken(session.token);
      store.signInRemote(session.user);
    },
    async signUp(input: RegistrationInput) {
      if (API_MODE !== 'http') return store.register(input);
      registerAccount([], input, 'check', new Date().toISOString()); // instant field validation before the network
      const session = await api.register(input);
      await saveSessionToken(session.token);
      store.signInRemote(session.user);
    },
    async signOut() {
      await clearSessionToken();
      store.logout();
    },
  };
}
