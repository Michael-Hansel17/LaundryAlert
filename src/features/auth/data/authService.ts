import { MONTHLY_QUOTA_KG } from '../../../config/constants';
import type { RegistrationInput, User } from '../domain/models';

// Simulation only: replace credential handling with Firebase Authentication.
// Plain text demo passwords live only in memory; never use real passwords here.
export interface DemoAccount {
  user: User;
  password: string;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function authenticate(accounts: readonly DemoAccount[], email: string, password: string): User {
  const account = accounts.find((entry) => entry.user.email === normalizeEmail(email));
  if (!account || account.password !== password) {
    throw new Error('Email atau kata sandi tidak sesuai.');
  }
  return account.user;
}

export function registerAccount(
  accounts: readonly DemoAccount[], input: RegistrationInput, id: string, now: string,
): DemoAccount {
  const email = normalizeEmail(input.email);
  if (!input.name.trim() || !input.roomNumber.trim()) {
    throw new Error('Nama dan nomor kamar wajib diisi.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Masukkan alamat email yang valid.');
  }
  if (accounts.some((entry) => entry.user.email === email)) {
    throw new Error('Email sudah terdaftar dalam sesi demo ini.');
  }
  if (input.password.length < 6) throw new Error('Kata sandi minimal 6 karakter.');
  if (input.password !== input.confirmPassword) throw new Error('Konfirmasi kata sandi tidak cocok.');
  return {
    password: input.password,
    user: {
      id, email, name: input.name.trim(), roomNumber: input.roomNumber.trim(),
      role: 'resident', monthlyQuotaKg: MONTHLY_QUOTA_KG, createdAt: now,
    },
  };
}
