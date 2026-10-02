import { Pressable, Text, View } from 'react-native';
import type { LaundryOrder } from '../../features/laundry/domain/models';
import { theme, ui } from '../theme/theme';
import { formatDate, formatKg } from '../utils/format';
import { StatusBadge } from './StatusBadge';

export function LaundryCard({ order, onPress, showResident = false }: { order: LaundryOrder; onPress: () => void; showResident?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Detail laundry ${order.id}, ${order.status}`}
    onPress={onPress} style={({ pressed }) => [ui.card, pressed && { opacity: 0.7 }]}>
    <View style={ui.row}><Text style={ui.subtitle}>{formatKg(order.estimatedWeightKg)}</Text><StatusBadge status={order.status} /></View>
    {showResident && <Text style={ui.body}>{order.userName} · Kamar {order.roomNumber}</Text>}
    <Text style={ui.muted}>{formatDate(order.submittedAt)}</Text>
    <View style={ui.row}><Text style={[ui.muted, { flex: 1 }]} numberOfLines={1}>{order.id}</Text><Text style={[ui.muted, { color: theme.colors.primary, fontWeight: '600' }]}>Lihat detail ›</Text></View>
  </Pressable>;
}
