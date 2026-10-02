import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParams } from '../../../navigation/types';
import { EmptyState } from '../../../shared/components/EmptyState';
import { LaundryCard } from '../../../shared/components/LaundryCard';
import { Screen } from '../../../shared/components/Screen';
import { theme, ui } from '../../../shared/theme/theme';
import { LAUNDRY_STATUSES, STATUS_LABELS } from '../../laundry/domain/models';
import type { AdminQueueFilter } from '../domain/models';
import { useAdminQueue } from '../hooks/useAdminQueue';

export function AdminDashboardScreen({ navigation }: NativeStackScreenProps<AdminStackParams, 'AdminDashboard'>) {
  const [filter, setFilter] = useState<AdminQueueFilter>('semua');
  const { orders, activeCount } = useAdminQueue(filter);
  return <Screen>
    <Text style={ui.title}>Antrean laundry</Text>
    <Text style={ui.body}>{activeCount} laundry aktif dari seluruh penghuni.</Text>
    <Text style={ui.muted}>Pilih pengajuan untuk memperbarui status. Data dibagikan dengan tampilan penghuni dalam sesi demo ini.</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {(['semua', ...LAUNDRY_STATUSES] as const).map((value) => <Pressable key={value} onPress={() => setFilter(value)} accessibilityRole="button" accessibilityState={{ selected: filter === value }}
        style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.radius.sm, backgroundColor: filter === value ? theme.colors.primary : theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }}>
        <Text style={[ui.muted, { color: filter === value ? theme.colors.surface : theme.colors.text, fontWeight: '600' }]}>{value === 'semua' ? 'Semua' : STATUS_LABELS[value]}</Text>
      </Pressable>)}
    </View>
    <Text style={ui.muted}>{orders.length} pengajuan ditampilkan</Text>
    {orders.length === 0 && <EmptyState title="Tidak ada pengajuan" message="Coba filter status lain atau buat pengajuan sebagai penghuni." />}
    {orders.map((order) => <LaundryCard key={order.id} order={order} showResident onPress={() => navigation.navigate('AdminDetail', { orderId: order.id })} />)}
  </Screen>;
}
