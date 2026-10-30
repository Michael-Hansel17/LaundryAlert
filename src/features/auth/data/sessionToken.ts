import AsyncStorage from '@react-native-async-storage/async-storage';

// The signed session token issued by the backend. In memory for requests, AsyncStorage so a
// restart keeps the user signed in. (Production: expo-secure-store; it has no web support.)
const KEY = '@laundryalert/session/v1';
let current: string | null = null;
// Called when the backend rejects the stored token (expired / revoked): the app signs the user out.
let onExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (handler: (() => void) | null) => { onExpired = handler; };
export const notifySessionExpired = () => onExpired?.();
export const getSessionToken = () => current;
export const setSessionToken = (token: string | null) => { current = token; };
export async function saveSessionToken(token: string) { current = token; await AsyncStorage.setItem(KEY, token); }
export async function loadSessionToken() { return AsyncStorage.getItem(KEY); }
export async function clearSessionToken() {
  current = null;
  try { await AsyncStorage.removeItem(KEY); } catch { /* the next sign-in overwrites it */ }
}
