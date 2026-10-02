import { Text, View, StyleSheet } from 'react-native';
import type { QuotaInfo } from '../../features/laundry/domain/models';
import { theme, ui } from '../theme/theme';
import { formatKg } from '../utils/format';

export function QuotaCard({ quota }: { quota: QuotaInfo }) {
  const ratio = Math.min(1, quota.usedKg / quota.limitKg);
  return <View style={[ui.card, styles.card]}>
    <Text style={ui.muted}>SISA KUOTA · {quota.month} · WIB</Text>
    <Text style={styles.value}>{formatKg(quota.remainingKg)}</Text>
    <View style={styles.track} accessibilityLabel={`Kuota terpakai ${formatKg(quota.usedKg)} dari ${formatKg(quota.limitKg)}`}>
      <View style={[styles.progress, { width: `${ratio * 100}%` }]} />
    </View>
    <Text style={ui.muted}>Terpakai {formatKg(quota.usedKg)} dari {formatKg(quota.limitKg)} bulan ini.</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.primarySoft },
  value: { fontSize: theme.fontSize.display, fontWeight: '700', color: theme.colors.primary },
  track: { height: 8, backgroundColor: '#CEDBFC', borderRadius: 4, overflow: 'hidden' },
  progress: { height: 8, backgroundColor: theme.colors.primary },
});
