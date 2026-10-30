import { Text, View } from 'react-native';
import { useResidentSync } from '../../features/laundry/state/ResidentSync';
import { theme, ui } from '../theme/theme';
import { Button } from './Button';

// Opt-in for "laundry selesai" alerts, with every permission outcome explained.
export function NotificationCard() {
  const { notifications: n } = useResidentSync();
  if (n.enabled) return <View style={ui.card}>
    <Text style={[ui.subtitle, { color: theme.colors.success }]}>Notifikasi laundry selesai aktif</Text>
    <Text style={ui.muted}>Kamu diberi tahu saat cucian selesai, selama aplikasi atau tab ini terbuka.</Text>
    <Button title="Matikan notifikasi" variant="ghost" onPress={() => { void n.disable(); }} />
  </View>;
  if (n.permission === 'unsupported') return <View style={ui.card}>
    <Text style={ui.subtitle}>Notifikasi tidak tersedia</Text>
    <Text style={ui.muted}>Perangkat atau browser ini tidak mendukung notifikasi. Pemberitahuan tetap muncul di halaman Beranda.</Text>
  </View>;
  return <View style={ui.card}>
    <Text style={ui.subtitle}>Dapatkan kabar saat cucian selesai</Text>
    <Text style={ui.muted}>Tidak perlu bolak-balik bertanya ke petugas: aplikasi memberi tahu begitu status berubah menjadi Selesai.</Text>
    {n.permission === 'denied' && <Text accessibilityRole="alert" style={ui.error}>Izin notifikasi diblokir. Aktifkan di pengaturan perangkat atau browser, lalu ketuk tombol di bawah. Sementara itu pemberitahuan tetap tampil di Beranda.</Text>}
    {n.permission === 'undetermined' && <Text style={ui.muted}>Izin akan diminta saat kamu mengetuk tombol. Kalau permintaannya ditutup, cukup ketuk lagi.</Text>}
    <Button title={n.permission === 'denied' ? 'Coba aktifkan lagi' : 'Aktifkan notifikasi'} variant="secondary" onPress={() => { void n.enable(); }} />
  </View>;
}
