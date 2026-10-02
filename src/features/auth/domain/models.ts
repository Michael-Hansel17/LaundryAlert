export type UserRole = 'resident' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  roomNumber: string;
  role: UserRole;
  monthlyQuotaKg: number;
  createdAt: string;
}

export interface RegistrationInput {
  name: string;
  email: string;
  roomNumber: string;
  password: string;
  confirmPassword: string;
}
