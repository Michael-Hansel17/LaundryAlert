import { Text } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ResidentStackParams, ResidentTabParams } from '../../../navigation/types';
import { EmptyState } from '../../../shared/components/EmptyState';
import { LaundryCard } from '../../../shared/components/LaundryCard';
import { Screen } from '../../../shared/components/Screen';
import { ui } from '../../../shared/theme/theme';
import { useLaundry } from '../hooks/useLaundry';

type Props = CompositeScreenProps<BottomTabScreenProps<ResidentTabParams, 'History'>, NativeStackScreenProps<ResidentStackParams>>;

export function HistoryScreen({ navigation }: Props) {
  const { orders } = useLaundry();
  return <Screen>
    <Text style={ui.title}>Riwayat laundry</Text>
    <Text style={ui.muted}>Semua pengajuanmu, termasuk cucian yang sudah diambil. Terbaru di atas.</Text>
    {orders.length === 0 && <EmptyState title="Riwayat masih kosong" message="Pengajuan pertama akan muncul di sini." />}
    {orders.map((order) => <LaundryCard key={order.id} order={order} onPress={() => navigation.navigate('LaundryDetail', { orderId: order.id })} />)}
  </Screen>;
}
