import { useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DEMO_EMAILS, DEMO_PASSWORD } from '../../../config/constants';
import type { AuthStackParams } from '../../../navigation/types';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';
import { Screen } from '../../../shared/components/Screen';
import { theme, ui } from '../../../shared/theme/theme';
import { errorMessage } from '../../../shared/utils/format';
import { useAuth } from '../hooks/useAuth';

export function LoginScreen({ navigation }: NativeStackScreenProps<AuthStackParams, 'Login'>) {
  const { store } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  function login(address = email, secret = password) {
    try { setError(''); store.login(address, secret); } catch (e) { setError(errorMessage(e)); }
  }
  return <Screen>
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={[ui.title, { color: theme.colors.primary }]}>LaundryAlert</Text>
      <Text style={ui.subtitle}>Cucian terpantau, hari lebih tenang.</Text>
      <Text style={ui.muted}>Pantau progres dan sisa kuota laundry kos dalam satu tempat.</Text>
    </View>
    <View style={ui.card}>
      <Text style={ui.subtitle}>Coba prototype</Text>
      <Text style={ui.muted}>Autentikasi masih simulasi. Pilihan peran demo bukan rancangan keamanan aplikasi produksi. Gunakan data dan kata sandi contoh saja.</Text>
      <Button title="Masuk demo penghuni" onPress={() => login(DEMO_EMAILS.resident, DEMO_PASSWORD)} />
      <Button title="Masuk demo admin" variant="secondary" onPress={() => login(DEMO_EMAILS.admin, DEMO_PASSWORD)} />
    </View>
    <View style={ui.section}>
      <Text style={ui.subtitle}>Masuk dengan akun sementara</Text>
      <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="nama@contoh.com" />
      <Input label="Kata sandi" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" placeholder="Minimal 6 karakter" />
      {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{error}</Text>}
      <Button title="Masuk" onPress={() => login()} />
      <Button title="Belum punya akun? Daftar" variant="ghost" onPress={() => navigation.navigate('Register')} />
    </View>
    <Text style={ui.muted}>Pengajuan laundry tersimpan di perangkat ini meskipun aplikasi dibuka ulang. Gunakan akun demo yang sama setelah refresh. Akun registrasi sementara dan sesi login tidak disimpan.</Text>
  </Screen>;
}
