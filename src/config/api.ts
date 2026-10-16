// Backend REST API (server/). Android emulator: EXPO_PUBLIC_API_URL=http://10.0.2.2:3001
// EXPO_PUBLIC_API_MODE=demo keeps the old in-app simulated repository.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
export const API_MODE: 'http' | 'demo' = process.env.EXPO_PUBLIC_API_MODE === 'demo' ? 'demo' : 'http';
export const API_TIMEOUT_MS = 8000;
