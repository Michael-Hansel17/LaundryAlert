import { APP_TIME_ZONE } from '../../config/constants';

export const formatDate = (date: string | Date) => new Intl.DateTimeFormat('id-ID', {
  timeZone: APP_TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
}).format(new Date(date));

export const formatKg = (weight: number) => `${weight.toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg`;
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Terjadi masalah. Silakan coba lagi.';
