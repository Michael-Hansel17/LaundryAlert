import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LoginScreen } from '../../src/features/auth/presentation/LoginScreen';
import { RegisterScreen } from '../../src/features/auth/presentation/RegisterScreen';
import { validateLogin, validateRegistration } from '../../src/features/auth/domain/validation';
import type { RegistrationInput } from '../../src/features/auth/domain/models';

// The repository side is mocked; validation runs for real, as in useAuth.
const mockSignIn = jest.fn(async (email: string, password: string) => { validateLogin(email, password); });
const mockSignUp = jest.fn(async (input: RegistrationInput) => { validateRegistration(input); });
jest.mock('../../src/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ signIn: mockSignIn, signUp: mockSignUp }) }));
// Screen needs a navigator header; the form content is what is under test here.
jest.mock('../../src/shared/components/Screen', () => {
  const { View } = jest.requireActual('react-native');
  return { Screen: ({ children }: { children: unknown }) => <View>{children}</View> };
});

const navigation = { navigate: jest.fn() } as never;
beforeEach(() => { mockSignIn.mockClear(); mockSignUp.mockClear(); });

test('login kosong menampilkan pesan validasi dan tombol kembali aktif', async () => {
  await render(<LoginScreen navigation={navigation} route={{ key: 'Login', name: 'Login' } as never} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Masuk' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Email dan kata sandi wajib diisi.');
  expect(screen.getByRole('button', { name: 'Masuk' })).toBeEnabled();
});

test('login menampilkan status memproses dan tidak mengirim dua kali', async () => {
  let finish!: () => void;
  mockSignIn.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  await render(<LoginScreen navigation={navigation} route={{ key: 'Login', name: 'Login' } as never} />);
  await fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.com');
  await fireEvent.changeText(screen.getByLabelText('Kata sandi'), 'rahasia');
  await fireEvent.press(screen.getByRole('button', { name: 'Masuk' }));
  expect(screen.getByText('Memeriksa akun...')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Masuk demo penghuni' }));
  expect(mockSignIn).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); });
});

test('daftar dengan sandi pendek menampilkan aturan validasi', async () => {
  await render(<RegisterScreen />);
  await fireEvent.changeText(screen.getByLabelText('Nama lengkap'), 'Sari');
  await fireEvent.changeText(screen.getByLabelText('Email'), 'sari@example.test');
  await fireEvent.changeText(screen.getByLabelText('Nomor kamar'), 'B-102');
  await fireEvent.changeText(screen.getByLabelText('Kata sandi'), '123');
  await fireEvent.changeText(screen.getByLabelText('Konfirmasi kata sandi'), '123');
  await fireEvent.press(screen.getByRole('button', { name: 'Daftar dan masuk' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Kata sandi minimal 6 karakter.');
  expect(mockSignUp).toHaveBeenCalledTimes(1);
});
