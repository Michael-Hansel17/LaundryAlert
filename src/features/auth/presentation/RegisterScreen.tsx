import { useRef, useState } from 'react';
import { Text, TextInput } from 'react-native';
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
  const refs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const next = (i: number) => () => refs[i]?.current?.focus();
  const set = (key: keyof RegistrationInput) => (value: string) => setInput((current) => ({ ...current, [key]: value }));
  return <Screen>
    <Text style={ui.title}>Daftar penghuni</Text>
    <Text style={ui.muted}>Akun disimpan di server. Kata sandi disimpan dalam bentuk hash dan tidak dapat dibaca kembali.</Text>
    <Input label="Nama lengkap" returnKeyType="next" submitBehavior="submit" onSubmitEditing={next(0)} value={input.name} onChangeText={set('name')} autoComplete="name" />
    <Input ref={refs[0]} label="Email" returnKeyType="next" submitBehavior="submit" onSubmitEditing={next(1)} value={input.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
    <Input ref={refs[1]} label="Nomor kamar" returnKeyType="next" submitBehavior="submit" onSubmitEditing={next(2)} value={input.roomNumber} onChangeText={set('roomNumber')} placeholder="Contoh: B-102" autoCapitalize="characters" />
    <Input ref={refs[2]} label="Kata sandi" returnKeyType="next" submitBehavior="submit" onSubmitEditing={next(3)} hint="Minimal 6 karakter" value={input.password} onChangeText={set('password')} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
    <Input ref={refs[3]} label="Konfirmasi kata sandi" returnKeyType="done" value={input.confirmPassword} onChangeText={set('confirmPassword')} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    <Button title="Daftar dan masuk" loading={busy} loadingTitle="Mendaftarkan..." onPress={() => {
      if (busy) return;
      setBusy(true); setError('');
      signUp(input).catch((e: unknown) => { setError(errorMessage(e)); setBusy(false); });
    }} />
  </Screen>;
}
