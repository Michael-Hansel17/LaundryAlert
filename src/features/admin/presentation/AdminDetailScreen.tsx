import { useState } from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParams } from '../../../navigation/types';
import { Button } from '../../../shared/components/Button';
import { EmptyState } from '../../../shared/components/EmptyState';
import { OrderDetails } from '../../../shared/components/OrderDetails';
import { Screen } from '../../../shared/components/Screen';
import { ui } from '../../../shared/theme/theme';
import { errorMessage } from '../../../shared/utils/format';
import { STATUS_LABELS } from '../../laundry/domain/models';
import { nextStatus } from '../../laundry/domain/rules';
import { useLaundry } from '../../laundry/hooks/useLaundry';

export function AdminDetailScreen({ route }: NativeStackScreenProps<AdminStackParams, 'AdminDetail'>) {
  const { orders, store } = useLaundry();
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const order = orders.find((entry) => entry.id === route.params.orderId);
  if (!order) return <Screen><EmptyState title="Laundry tidak ditemukan" message="Kembali ke antrean dan pilih pengajuan yang tersedia." /></Screen>;
  const target = nextStatus(order.status);
  return <Screen>
    <OrderDetails order={order} />
    {!!feedback && <Text accessibilityLiveRegion="polite" style={ui.body}>{feedback}</Text>}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {target ? <Button title={`Ubah menjadi ${STATUS_LABELS[target]}`} onPress={() => {
      try {
        setError(''); store.updateStatus(order.id, target);
        setFeedback(target === 'selesai' ? 'Status diperbarui. Pemberitahuan simulasi tersedia saat penghuni masuk.' : `Status diperbarui menjadi ${STATUS_LABELS[target]}.`);
      } catch (e) { setError(errorMessage(e)); }
    }} /> : <Text style={ui.body}>Laundry sudah diambil. Tidak ada perubahan status berikutnya.</Text>}
    <Text style={ui.muted}>Status hanya maju satu tahap. Saat selesai, aplikasi membuat pemberitahuan simulasi untuk penghuni; tidak mengirim push notification.</Text>
  </Screen>;
}
