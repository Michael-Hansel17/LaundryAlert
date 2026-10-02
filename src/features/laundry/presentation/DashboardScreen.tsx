import { Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ResidentStackParams, ResidentTabParams } from '../../../navigation/types';
import { Button } from '../../../shared/components/Button';
import { EmptyState } from '../../../shared/components/EmptyState';
import { LaundryCard } from '../../../shared/components/LaundryCard';
import { QuotaCard } from '../../../shared/components/QuotaCard';
import { Screen } from '../../../shared/components/Screen';
import { theme, ui } from '../../../shared/theme/theme';
import { useLaundry } from '../hooks/useLaundry';

type Props = CompositeScreenProps<BottomTabScreenProps<ResidentTabParams, 'Dashboard'>, NativeStackScreenProps<ResidentStackParams>>;

export function DashboardScreen({ navigation }: Props) {
  const { user, orders, quota, notices, store } = useLaundry();
  const active = orders.filter((order) => order.status !== 'diambil');
  return <Screen>
    <View style={ui.section}>
      <Text style={ui.title}>Halo, {user?.name.split(' ')[0]}!</Text>
      <Text style={ui.muted}>Kamar {user?.roomNumber} · {active.length} laundry aktif</Text>
    </View>
    {notices.map((notice) => <View key={notice.id} style={[ui.card, { borderColor: theme.colors.success }]}>
      <Text style={[ui.subtitle, { color: theme.colors.success }]}>{orders.find((o) => o.id === notice.orderId)?.status === 'diambil' ? 'Laundry telah selesai' : 'Cucian siap diambil'}</Text>
      <Text style={ui.body}>Laundry {notice.orderId} sudah selesai{orders.find((o) => o.id === notice.orderId)?.status === 'diambil' ? ' dan telah diambil' : ''}.</Text>
      <Text style={ui.muted}>Pemberitahuan simulasi dalam aplikasi.</Text>
      <Button title="Lihat laundry" variant="secondary" onPress={() => navigation.navigate('LaundryDetail', { orderId: notice.orderId })} />
      <Button title="Tutup pemberitahuan" variant="ghost" onPress={() => store.dismissNotice(notice.id)} />
    </View>)}
    {quota && <QuotaCard quota={quota} />}
    <Button title="+ Ajukan laundry" onPress={() => navigation.navigate('SubmitLaundry')} />
    <View style={ui.section}>
      <Text style={ui.subtitle}>Laundry aktif</Text>
      {active.length === 0 && <EmptyState title="Belum ada laundry aktif" message="Ajukan laundry untuk mulai memantau cucianmu." />}
      {active.map((order) => <LaundryCard key={order.id} order={order} onPress={() => navigation.navigate('LaundryDetail', { orderId: order.id })} />)}
    </View>
    <Button title="Lihat semua riwayat" variant="secondary" onPress={() => navigation.navigate('History')} />
  </Screen>;
}
