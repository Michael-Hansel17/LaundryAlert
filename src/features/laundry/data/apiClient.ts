import { API_TIMEOUT_MS } from '../../../config/api';
import type { User } from '../../auth/domain/models';
import { getSessionToken, notifySessionExpired } from '../../auth/data/sessionToken';
import { logger } from '../../../shared/services/logger';
import { ApiError } from './orderDto';

let requestSequence = 0;
// Short id sent as X-Request-Id so an entry on the phone's Log screen matches the server log line.
export const newRequestId = () => `${Date.now().toString(36)}${(requestSequence++ % 1296).toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 6)}`;

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
    const reqId = newRequestId();
    headers['X-Request-Id'] = reqId;
    const method = init.method ?? 'GET';
    const started = Date.now();
    const meta = (extra: Record<string, unknown> = {}) => ({ reqId, method, path, ms: Date.now() - started, ...extra });
    try {
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers, signal: timeout.signal });
      } catch (error) {
        if (signal.aborted) { logger.debug('api', `${method} ${path} dibatalkan`, meta()); throw new Error('Operasi dibatalkan.'); }
        logger.error('api', timedOut ? `${method} ${path} timeout` : `${method} ${path} gagal terhubung`, meta({ baseUrl: this.baseUrl, error }));
        if (timedOut) throw new ApiError('timeout', 'Server tidak merespons tepat waktu. Periksa koneksi lalu coba lagi.');
        throw new ApiError('network', 'Tidak dapat terhubung ke server. Pastikan backend berjalan (npm run dev) lalu coba lagi.');
      }
      const text = await response.text();
      if (!response.ok) {
        let detail = '';
        try { detail = (JSON.parse(text) as { message?: string }).message ?? ''; } catch { /* non-JSON error body */ }
        logger.warn('api', `${method} ${path} → ${response.status}`, meta({ status: response.status, detail }));
        if (response.status === 401 && token && this.options.token === undefined) notifySessionExpired();
        throw new ApiError('http', detail || `Server menjawab dengan kesalahan ${response.status}. Silakan coba lagi.`, response.status);
      }
      logger.info('api', `${method} ${path} → ${response.status}`, meta({ status: response.status }));
      try { return JSON.parse(text); }
      catch { logger.error('api', `${method} ${path} respons bukan JSON`, meta({ status: response.status, body: text })); throw new ApiError('parse', 'Respons server rusak dan tidak dapat dibaca (bukan JSON valid).'); }
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
    }
  }
}
