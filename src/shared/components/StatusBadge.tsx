import { Text, StyleSheet } from 'react-native';
import { STATUS_LABELS, type LaundryStatus } from '../../features/laundry/domain/models';
import { theme } from '../theme/theme';

const colors: Record<LaundryStatus, { backgroundColor: string; color: string }> = {
  diterima: { backgroundColor: '#EAF0FF', color: '#2458CE' },
  diproses: { backgroundColor: '#FFF3D6', color: '#805000' },
  selesai: { backgroundColor: '#E0F5EA', color: '#167247' },
  diambil: { backgroundColor: '#EDF0F5', color: '#56657B' },
};

export function StatusBadge({ status }: { status: LaundryStatus }) {
  return <Text style={[styles.badge, colors[status]]}>{STATUS_LABELS[status]}</Text>;
}

const styles = StyleSheet.create({
  badge: { fontSize: theme.fontSize.caption, fontWeight: '700', borderRadius: theme.radius.sm, paddingVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.sm, alignSelf: 'flex-start', overflow: 'hidden' },
});
