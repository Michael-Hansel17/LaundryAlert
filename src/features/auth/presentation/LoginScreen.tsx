import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DEMO_EMAILS, DEMO_PASSWORD } from '../../../config/constants';
import type { AuthStackParams } from '../../../navigation/types';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';
import { Screen } from '../../../shared/components/Screen';
import { theme, ui } from '../../../shared/theme/theme';
import { useFormSubmit } from '../../../shared/hooks/useFormSubmit';
import { useAuth } from '../hooks/useAuth';

export function LoginScreen({ navigation }: NativeStackScreenProps<AuthStackParams, 'Login'>) {
  const { signIn } = useAuth();
  const { busy, error, submit } = useFormSubmit(signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);
  const login = (address = email, secret = password) => submit(address, secret);
  return <Screen>
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={[ui.title, { color: theme.colors.primary }]}>LaundryAlert</Text>
      <Text style={ui.subtitle}>Cucian terpantau, hari lebih tenang.</Text>
      <Text style={ui.muted}>Pantau progres dan sisa kuota laundry kos dalam satu tempat.</Text>
    </View>
    <View style={ui.card}>
      <Text style={ui.subtitle}>Coba prototype</Text>
      <Text style={ui.muted}>Tombol ini mengisi akun demo, lalu masuk lewat server. Gunakan data dan kata sandi contoh saja.</Text>
      <Button title="Masuk demo penghuni" disabled={busy} onPress={() => { void login(DEMO_EMAILS.resident, DEMO_PASSWORD); }} />
      <Button title="Masuk demo admin" variant="secondary" disabled={busy} onPress={() => { void login(DEMO_EMAILS.admin, DEMO_PASSWORD); }} />
    </View>
    <View style={ui.section}>
      <Text style={ui.subtitle}>Masuk dengan akun sementara</Text>
      <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="nama@contoh.com" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordRef.current?.focus()} />
      <Input ref={passwordRef} label="Kata sandi" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" placeholder="Minimal 6 karakter" returnKeyType="go" onSubmitEditing={() => { void login(); }} />
      {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{error}</Text>}
      <Button title="Masuk" loading={busy} loadingTitle="Memeriksa akun..." onPress={() => { void login(); }} />
      <Button title="Belum punya akun? Daftar" variant="ghost" onPress={() => navigation.navigate('Register')} />
    </View>
    <Text style={ui.muted}>Sesi masuk disimpan di perangkat ini; tombol Keluar menghapusnya. Kata sandi disimpan server dalam bentuk hash.</Text>
  </Screen>;
}
