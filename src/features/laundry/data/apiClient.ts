import { API_TIMEOUT_MS } from '../../../config/api';
import type { User } from '../../auth/domain/models';
import { getSessionToken, notifySessionExpired } from '../../auth/data/sessionToken';
import { ApiError } from './orderDto';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export interface ApiClientOptions { fetchImpl?: FetchLike; timeoutMs?: number; token?: string | null }

// Shared HTTP layer: timeout, cancellation and mapping of network / HTTP / bad JSON failures to ApiError.
export class ApiClient {
  private fetchImpl: FetchLike;
  private timeoutMs: number;
  private simulateFailure = false;
  constructor(private baseUrl: string, private user: User | null, private options: ApiClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
    this.timeoutMs = options.timeoutMs ?? API_TIMEOUT_MS;
  }
  // Dev panel: the next request asks the server for a 503.
  failNext() { this.simulateFailure = true; }

  async request(path: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
    if (signal.aborted) throw new Error('Operasi dibatalkan.');
    const timeout = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; timeout.abort(); }, this.timeoutMs);
    const cancel = () => timeout.abort();
    signal.addEventListener('abort', cancel, { once: true });
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = this.options.token ?? getSessionToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (this.user) { headers['X-User-Id'] = this.user.id; headers['X-User-Role'] = this.user.role; } // only honoured by a test-mode server
    if (this.simulateFailure) { headers['X-Simulate-Failure'] = '1'; this.simulateFailure = false; }
    if (init.body) headers['Content-Type'] = 'application/json';
    try {
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers, signal: timeout.signal });
      } catch {
        if (signal.aborted) throw new Error('Operasi dibatalkan.');
        if (timedOut) throw new ApiError('timeout', 'Server tidak merespons tepat waktu. Periksa koneksi lalu coba lagi.');
        throw new ApiError('network', 'Tidak dapat terhubung ke server. Pastikan backend berjalan (npm run dev) lalu coba lagi.');
      }
      const text = await response.text();
      if (!response.ok) {
        let detail = '';
        try { detail = (JSON.parse(text) as { message?: string }).message ?? ''; } catch { /* non-JSON error body */ }
        if (response.status === 401 && token && this.options.token === undefined) notifySessionExpired();
        throw new ApiError('http', detail || `Server menjawab dengan kesalahan ${response.status}. Silakan coba lagi.`, response.status);
      }
      try { return JSON.parse(text); }
      catch { throw new ApiError('parse', 'Respons server rusak dan tidak dapat dibaca (bukan JSON valid).'); }
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
    }
  }
}
