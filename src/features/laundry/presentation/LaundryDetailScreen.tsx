import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ResidentStackParams } from '../../../navigation/types';
import { EmptyState } from '../../../shared/components/EmptyState';
import { OrderDetails } from '../../../shared/components/OrderDetails';
import { Screen } from '../../../shared/components/Screen';
import { ui } from '../../../shared/theme/theme';
import { useLaundry } from '../hooks/useLaundry';
import { LaundryCrudView } from './LaundryCrudView';

export function LaundryDetailScreen({ route, navigation }: NativeStackScreenProps<ResidentStackParams, 'LaundryDetail'>) {
  const { orders, store } = useLaundry();
  const order = orders.find((entry) => entry.id === route.params.orderId);
  return <Screen>
    {order ? <><OrderDetails order={order} />
      <LaundryCrudView key={order.id} order={order} onSave={(weight, notes) => store.editPersisted(order.id, weight, notes)}
        onDelete={async () => { await store.deletePersisted(order.id); navigation.popTo('ResidentTabs', { screen: 'History' }); }} />
      <Text style={ui.muted}>Data laundry tersimpan di perangkat/browser ini. Masuk kembali setelah refresh untuk melihat data.</Text></>
      : <EmptyState title="Laundry tidak ditemukan" message="Data sudah dihapus atau tidak tersedia untuk akun ini." />}
  </Screen>;
}
