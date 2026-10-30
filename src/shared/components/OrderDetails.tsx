import { Image, Text, View } from 'react-native';
import { LAUNDRY_STATUSES, STATUS_LABELS, type LaundryOrder } from '../../features/laundry/domain/models';
import { theme, ui } from '../theme/theme';
import { formatDate, formatKg } from '../utils/format';
import { StatusBadge } from './StatusBadge';

export function OrderDetails({ order }: { order: LaundryOrder }) {
  return <>
    <View style={ui.card}>
      <StatusBadge status={order.status} />
      <Text style={ui.title}>{formatKg(order.estimatedWeightKg)}</Text>
      <Text style={ui.body}>{order.userName} · Kamar {order.roomNumber}</Text>
      <Text selectable style={ui.muted}>{order.id}</Text>
      <Text style={ui.muted}>Diantar {formatDate(order.submittedAt)}</Text>
      <Text style={ui.body}>Catatan: {order.notes || 'Tidak ada catatan khusus.'}</Text>
      {order.photoUri && <Image source={{ uri: order.photoUri }} accessibilityLabel="Foto cucian" style={{ width: '100%', height: 200, borderRadius: 8 }} resizeMode="cover" />}
    </View>
    <View style={ui.card}>
      <Text style={ui.subtitle}>Perkembangan laundry</Text>
      {LAUNDRY_STATUSES.map((status, index) => {
        const entry = order.statusHistory.find((event) => event.status === status);
        return <View key={status} style={[ui.row, { justifyContent: 'flex-start', alignItems: 'flex-start' }]}>
          <Text style={[ui.body, { color: entry ? theme.colors.primary : theme.colors.muted, fontWeight: '700' }]}>{entry ? '✓' : `${index + 1}.`}</Text>
          <View style={{ flex: 1 }}><Text style={[ui.body, { fontWeight: entry ? '600' : '400' }]}>{STATUS_LABELS[status]}</Text><Text style={ui.muted}>{entry ? formatDate(entry.at) : 'Menunggu tahap sebelumnya'}</Text></View>
        </View>;
      })}
    </View>
    {order.status === 'selesai' && <Text style={[ui.body, { color: theme.colors.success }]}>Cucian sudah selesai dan siap diambil.</Text>}
  </>;
}
