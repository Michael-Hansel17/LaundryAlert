import { useState } from 'react';
import { Text } from 'react-native';
import type { RegistrationInput } from '../domain/models';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';
import { Screen } from '../../../shared/components/Screen';
import { ui } from '../../../shared/theme/theme';
import { errorMessage } from '../../../shared/utils/format';

export function RegisterScreen() {
  const { signUp } = useAuth();
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState<RegistrationInput>({ name: '', email: '', roomNumber: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const set = (key: keyof RegistrationInput) => (value: string) => setInput((current) => ({ ...current, [key]: value }));
  return <Screen>
    <Text style={ui.title}>Daftar penghuni</Text>
    <Text style={ui.muted}>Akun disimpan di server. Kata sandi disimpan dalam bentuk hash dan tidak dapat dibaca kembali.</Text>
    <Input label="Nama lengkap" value={input.name} onChangeText={set('name')} autoComplete="name" />
    <Input label="Email" value={input.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
    <Input label="Nomor kamar" value={input.roomNumber} onChangeText={set('roomNumber')} placeholder="Contoh: B-102" autoCapitalize="characters" />
    <Input label="Kata sandi" hint="Minimal 6 karakter" value={input.password} onChangeText={set('password')} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
    <Input label="Konfirmasi kata sandi" value={input.confirmPassword} onChangeText={set('confirmPassword')} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    <Button title="Daftar dan masuk" loading={busy} loadingTitle="Mendaftarkan..." onPress={() => {
      if (busy) return;
      setBusy(true); setError('');
      signUp(input).catch((e: unknown) => { setError(errorMessage(e)); setBusy(false); });
    }} />
  </Screen>;
}
