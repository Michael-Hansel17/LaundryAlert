import { MONTHLY_QUOTA_KG } from '../../../config/constants';
import type { RegistrationInput, User } from '../domain/models';
import { normalizeEmail, validateRegistration } from '../domain/validation';

// Simulation only: replace credential handling with Firebase Authentication.
// Plain text demo passwords live only in memory; never use real passwords here.
export interface DemoAccount {
  user: User;
  password: string;
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
  const { name, email, roomNumber, password } = validateRegistration(input);
  if (accounts.some((entry) => entry.user.email === email)) {
    throw new Error('Email sudah terdaftar dalam sesi demo ini.');
  }
  return {
    password,
    user: { id, email, name, roomNumber, role: 'resident', monthlyQuotaKg: MONTHLY_QUOTA_KG, createdAt: now },
  };
}
