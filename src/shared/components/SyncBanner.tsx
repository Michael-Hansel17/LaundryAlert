import { ActivityIndicator, Text, View } from 'react-native';
import { useResidentSync } from '../../features/laundry/state/ResidentSync';
import { theme, ui } from '../theme/theme';
import { Button } from './Button';

// Loading / error + retry for data that comes from the backend. Renders nothing when loaded.
export function SyncBanner() {
  const { status, error, reload } = useResidentSync();
  if (status === 'loading') return <View style={ui.card}>
    <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Sedang memuat data laundry" />
    <Text style={ui.muted}>Memuat data laundry dari server...</Text>
  </View>;
  if (status === 'error') return <View style={ui.card}>
    <Text style={ui.subtitle}>Data laundry gagal dimuat</Text>
    <Text accessibilityRole="alert" style={ui.error}>{error}</Text>
    <Button title="Coba lagi" onPress={() => { void reload(); }} />
  </View>;
  return null;
}
