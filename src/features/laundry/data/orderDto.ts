import type { LaundryOrder } from '../domain/models';
import { validOrder } from './localLaundryStorage';

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'parse' | 'model';
export class ApiError extends Error {
  constructor(readonly kind: ApiErrorKind, message: string, readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// Model boundary: JSON from the backend is untrusted until it passes here.
export function parseOrder(value: unknown): LaundryOrder {
  if (!validOrder(value)) throw new ApiError('model', 'Data laundry dari server tidak sesuai format yang diharapkan.');
  return value;
}

export function parseOrderList(body: unknown): LaundryOrder[] {
  const orders = typeof body === 'object' && body !== null ? (body as { orders?: unknown }).orders : undefined;
  if (!Array.isArray(orders)) throw new ApiError('model', 'Respons server tidak berisi daftar laundry yang valid.');
  const parsed = orders.map(parseOrder);
  if (new Set(parsed.map((order) => order.id)).size !== parsed.length) throw new ApiError('model', 'Server mengirim ID laundry ganda.');
  return parsed;
}
