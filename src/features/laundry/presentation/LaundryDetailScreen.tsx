import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ResidentStackParams } from '../../../navigation/types';
import { EmptyState } from '../../../shared/components/EmptyState';
import { OrderDetails } from '../../../shared/components/OrderDetails';
import { Screen } from '../../../shared/components/Screen';
import { ui } from '../../../shared/theme/theme';
import { useLaundry } from '../hooks/useLaundry';

export function LaundryDetailScreen({ route }: NativeStackScreenProps<ResidentStackParams, 'LaundryDetail'>) {
  const { orders } = useLaundry();
  const order = orders.find((entry) => entry.id === route.params.orderId);
  return <Screen>
    {order ? <><OrderDetails order={order} /><Text style={ui.muted}>Status diperbarui oleh petugas. Data ini berasal dari simulasi pada aplikasi yang sama.</Text></>
      : <EmptyState title="Laundry tidak ditemukan" message="Data tidak tersedia untuk akun ini atau sesi demo telah dimulai ulang." />}
  </Screen>;
}
