import { useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Button } from '../../../shared/components/Button';
import { EmptyState } from '../../../shared/components/EmptyState';
import { LaundryCard } from '../../../shared/components/LaundryCard';
import { OrderDetails } from '../../../shared/components/OrderDetails';
import { theme, ui } from '../../../shared/theme/theme';
import { LAUNDRY_STATUSES, STATUS_LABELS } from '../../laundry/domain/models';
import { nextStatus } from '../../laundry/domain/rules';
import type { AdminStatusController } from '../state/AdminStatusController';
interface Props {
  controller: AdminStatusController;
  onOpenOrder?: (id: string) => void;
  onSimulateLoadError?: () => void;
  onSimulateSubmitError?: () => void;
}
export function AdminStatusView({ controller, onOpenOrder, onSimulateLoadError, onSimulateSubmitError }: Props) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  if (state.loadStatus === 'loading') return <View style={ui.card}>
    <ActivityIndicator accessibilityLabel="Sedang memuat antrean admin" color={theme.colors.primary} size="large" />
    <Text style={ui.subtitle}>Memuat data admin...</Text>
  </View>;
  if (state.loadStatus === 'error') return <View style={ui.card}>
    <Text style={ui.subtitle}>Data admin gagal dimuat</Text>
    <Text accessibilityRole="alert" style={ui.error}>{state.loadError}</Text>
    <Button title="Coba lagi" onPress={() => { void controller.load(); }} />
  </View>;
  const order = state.orders.find((entry) => entry.id === state.orderId);
  const submitting = state.submitStatus === 'submitting';
  const filtered = state.orders.filter((entry) => state.filter === 'semua' || entry.status === state.filter);
  return <>
    <Text style={ui.title}>{state.orderId ? 'Kelola status laundry' : 'Antrean laundry'}</Text>
    <Text style={ui.muted}>Data admin berhasil dimuat · {state.orders.length} pengajuan.</Text>
    {state.orderId ? !order ? <EmptyState title="Laundry tidak ditemukan" message="Kembali ke antrean dan pilih laundry yang tersedia." /> : <>
      <OrderDetails order={order} />
      {state.submitStatus === 'success' && <Text accessibilityLiveRegion="polite" style={ui.body}>Status berhasil disimpan. {order.status === 'selesai' ? 'Pemberitahuan simulasi tersedia untuk penghuni.' : 'Data penghuni telah diperbarui.'}</Text>}
      {nextStatus(order.status) ? <View style={ui.card}>
        <Text style={ui.subtitle}>Form pembaruan status</Text>
        <Text style={ui.body}>Pilih status tujuan</Text>
        <Text style={ui.muted}>Tahap berikutnya: {STATUS_LABELS[nextStatus(order.status)!]}. Status hanya boleh maju satu tahap.</Text>
        <View accessibilityRole="radiogroup" style={ui.section}>
          {LAUNDRY_STATUSES.map((target) => <Pressable key={target} accessibilityRole="radio" accessibilityLabel={`Status tujuan ${STATUS_LABELS[target]}`}
            accessibilityState={{ checked: state.target === target, disabled: submitting }} disabled={submitting} onPress={() => controller.setTarget(target)}
            style={{ minHeight: 48, padding: theme.spacing.md, borderRadius: theme.radius.sm, backgroundColor: state.target === target ? theme.colors.primarySoft : theme.colors.background }}>
            <Text style={ui.body}>{state.target === target ? '●' : '○'} {STATUS_LABELS[target]}</Text>
          </Pressable>)}
        </View>
        {!!state.validationError && <Text accessibilityRole="alert" style={ui.error}>{state.validationError}</Text>}
        {!!state.submitError && <Text accessibilityRole="alert" style={ui.error}>{state.submitError}</Text>}
        <Button title={state.submitStatus === 'error' ? 'Coba kirim lagi' : 'Simpan status'} loading={submitting} loadingTitle="Menyimpan status..." disabled={state.submitStatus === 'success'} onPress={() => { void controller.submit(); }} />
        {submitting && <Text style={ui.muted}>Form dikunci untuk mencegah penyimpanan ganda.</Text>}
      </View> : <Text style={ui.body}>Laundry sudah diambil. Tidak ada perubahan status berikutnya.</Text>}
    </> : <>
      <Text style={ui.body}>{state.orders.filter((entry) => entry.status !== 'diambil').length} laundry aktif dari seluruh penghuni.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {(['semua', ...LAUNDRY_STATUSES] as const).map((filter) => <Pressable key={filter} accessibilityRole="button" accessibilityState={{ selected: state.filter === filter }} onPress={() => controller.setFilter(filter)}
          style={{ minHeight: 44, padding: theme.spacing.md, borderRadius: theme.radius.sm, backgroundColor: state.filter === filter ? theme.colors.primarySoft : theme.colors.surface }}>
          <Text style={ui.body}>{filter === 'semua' ? 'Semua' : STATUS_LABELS[filter]}</Text>
        </Pressable>)}
      </View>
      <Text style={ui.muted}>{filtered.length} pengajuan ditampilkan</Text>
      {filtered.length === 0 && <EmptyState title="Tidak ada pengajuan" message="Coba filter status lain atau buat pengajuan sebagai penghuni." />}
      {filtered.map((entry) => <LaundryCard key={entry.id} order={entry} showResident onPress={() => onOpenOrder?.(entry.id)} />)}
    </>}
    <Button title="Muat ulang data admin" variant="secondary" disabled={submitting} onPress={() => { void controller.load(); }} />
    <Text style={ui.muted}>Data dan pemberitahuan masih simulasi dalam aplikasi yang sama. Belum ada push notification.</Text>
    {__DEV__ && <View style={ui.card}>
      <Text style={ui.subtitle}>Uji kondisi layanan admin</Text>
      <Text style={ui.muted}>Simulasi satu kegagalan request berikutnya. Panel hanya tersedia pada development.</Text>
      {onSimulateLoadError && <Button title="Coba gagal muat admin" variant="secondary" disabled={submitting} onPress={onSimulateLoadError} />}
      {order && nextStatus(order.status) && onSimulateSubmitError && <Button title="Coba gagal simpan status" variant="secondary" disabled={submitting || state.submitStatus === 'success' || !state.target || nextStatus(order.status) !== state.target} onPress={onSimulateSubmitError} />}
    </View>}
  </>;
}
