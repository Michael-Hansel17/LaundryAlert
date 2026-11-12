import type { RegistrationInput } from './models';

// Input rules for the auth forms. Pure functions: no storage, no network, no UI.
// Used by the screens (instant feedback), the demo store and the backend, so every layer agrees.

export const MIN_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateLogin(email: string, password: string) {
  if (!email.trim() || !password) throw new Error('Email dan kata sandi wajib diisi.');
  return { email: normalizeEmail(email), password };
}

// Returns the cleaned input (trimmed name/room, normalized email) or throws the first rule broken.
export function validateRegistration(input: RegistrationInput): RegistrationInput {
  const name = input.name.trim();
  const roomNumber = input.roomNumber.trim();
  const email = normalizeEmail(input.email);
  if (!name || !roomNumber) throw new Error('Nama dan nomor kamar wajib diisi.');
  if (!EMAIL_PATTERN.test(email)) throw new Error('Masukkan alamat email yang valid.');
  if (input.password.length < MIN_PASSWORD_LENGTH) throw new Error(`Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`);
  if (input.password !== input.confirmPassword) throw new Error('Konfirmasi kata sandi tidak cocok.');
  return { ...input, name, roomNumber, email };
}
