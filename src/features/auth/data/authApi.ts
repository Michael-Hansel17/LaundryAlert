import { ApiClient, type ApiClientOptions } from '../../laundry/data/apiClient';
import { ApiError } from '../../laundry/data/orderDto';
import type { RegistrationInput, User } from '../domain/models';

export interface AuthSession { token: string; user: User }

// Same model boundary as orders: nothing from the network is trusted before it passes here.
export function parseUser(value: unknown): User {
  const u = value as Record<string, unknown> | null;
  if (!u || typeof u !== 'object' || ['id', 'name', 'email', 'roomNumber', 'createdAt'].some((k) => typeof u[k] !== 'string')
    || (u.role !== 'resident' && u.role !== 'admin') || typeof u.monthlyQuotaKg !== 'number') {
    throw new ApiError('model', 'Data akun dari server tidak sesuai format yang diharapkan.');
  }
  return u as unknown as User;
}
function parseSession(body: unknown): AuthSession {
  const b = body as { token?: unknown; user?: unknown } | null;
  if (!b || typeof b.token !== 'string' || !b.token) throw new ApiError('model', 'Respons masuk dari server tidak berisi token sesi.');
  return { token: b.token, user: parseUser(b.user) };
}

export class AuthApi {
  constructor(private baseUrl: string, private options: ApiClientOptions = {}) {}
  // token '' = send no Authorization header (never reuse a stale session on login/register).
  private client(token: string) { return new ApiClient(this.baseUrl, null, { ...this.options, token }); }
  async login(email: string, password: string, signal = new AbortController().signal): Promise<AuthSession> {
    return parseSession(await this.client('').request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, signal));
  }
  async register(input: RegistrationInput, signal = new AbortController().signal): Promise<AuthSession> {
    return parseSession(await this.client('').request('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }, signal));
  }
  // Validates a stored token: resolves the user, or rejects (ApiError status 401 = expired / invalid).
  async me(token: string, signal = new AbortController().signal): Promise<User> {
    const body = await this.client(token).request('/api/auth/me', { method: 'GET' }, signal);
    return parseUser((body as { user?: unknown } | null)?.user);
  }
}
