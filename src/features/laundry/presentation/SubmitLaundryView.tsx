import { useSyncExternalStore } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from '../../../shared/components/Button';
import { EmptyState } from '../../../shared/components/EmptyState';
import { Input } from '../../../shared/components/Input';
import { LaundryCard } from '../../../shared/components/LaundryCard';
import { QuotaCard } from '../../../shared/components/QuotaCard';
import { theme, ui } from '../../../shared/theme/theme';
import { formatDate } from '../../../shared/utils/format';
import type { LaundrySubmissionController } from '../state/LaundrySubmissionController';

export interface SubmitLaundryViewProps {
  controller: LaundrySubmissionController;
  onOpenOrder: (orderId: string) => void;
  onSimulateLoadError?: () => void;
  onSimulateSubmitError?: () => void;
}

// Presentation only: no quota rules, persistence or asynchronous requests here.
export function SubmitLaundryView({ controller, onOpenOrder, onSimulateLoadError, onSimulateSubmitError }: SubmitLaundryViewProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  if (state.loadStatus === 'loading') return <View style={ui.card}>
    <ActivityIndicator size="large" color={theme.colors.primary} accessibilityLabel="Sedang memuat data laundry" />
    <Text style={ui.subtitle}>Memuat data laundry...</Text>
    <Text style={ui.muted}>Menyiapkan kuota dan pengajuan terbarumu.</Text>
  </View>;
  if (state.loadStatus === 'error' || !state.data) return <View style={ui.card}>
    <Text style={ui.subtitle}>Data laundry gagal dimuat</Text>
    <Text accessibilityRole="alert" style={ui.error}>{state.loadError}</Text>
    <Button title="Coba lagi" onPress={() => { void controller.load(); }} />
  </View>;
  const { orders, quota } = state.data;
  const submitting = state.submitStatus === 'submitting';
  const success = state.submitStatus === 'success';
  return <>
    <Text style={ui.title}>Ajukan laundry</Text>
    <Text style={ui.muted}>Data berhasil dimuat · {orders.length} pengajuan tercatat.</Text>
    <QuotaCard quota={quota} />
    <View style={ui.section}>
      <Text style={ui.subtitle}>Pengajuan terbaru</Text>
      {orders.length === 0 ? <EmptyState title="Belum ada pengajuan laundry" message="Isi form di bawah untuk membuat pengajuan pertamamu." />
        : <LaundryCard order={orders[0]} onPress={() => { if (!submitting) onOpenOrder(orders[0].id); }} />}
    </View>
    {success && state.submittedOrder && <View style={ui.card}>
      <Text accessibilityLiveRegion="polite" style={[ui.subtitle, { color: theme.colors.success }]}>Pengajuan berhasil dikirim</Text>
      <Text style={ui.body}>Status awal Diterima. Kuota dan daftar laundry sudah diperbarui.</Text>
      <Button title="Lihat detail laundry" onPress={() => onOpenOrder(state.submittedOrder!.id)} />
      <Button title="Buat pengajuan lagi" variant="secondary" onPress={() => controller.resetForm()} />
    </View>}
    <View style={ui.section}>
      <Text style={ui.subtitle}>Form pengajuan</Text>
      <Text style={ui.muted}>Tanggal antar dicatat saat dikirim. Saat ini: {formatDate(new Date())} WIB.</Text>
      <Input label="Estimasi berat (kg)" hint="Contoh: 2,5 atau 2.5. Maksimal 2 angka desimal." value={state.weight} onChangeText={(value) => controller.setWeight(value)} keyboardType="decimal-pad" editable={!submitting && !success} placeholder="Contoh: 2,5" />
      {state.validationError && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{state.validationError}</Text>}
      <Input label="Catatan (opsional)" value={state.notes} onChangeText={(value) => controller.setNotes(value)} multiline editable={!submitting && !success} placeholder="Contoh: Jaket dicuci dengan hati-hati" />
      {state.submitError && <View style={ui.section}>
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{state.submitError}</Text>
        <Button title="Coba kirim lagi" onPress={() => { void controller.submit(); }} />
      </View>}
      <Button title={success ? 'Pengajuan terkirim' : 'Kirim pengajuan'} loading={submitting} loadingTitle="Mengirim pengajuan..." onPress={() => { void controller.submit(); }} disabled={success || quota.remainingKg === 0} />
      {submitting && <Text accessibilityLiveRegion="polite" style={ui.muted}>Sedang mengirim. Tombol dan form dikunci untuk mencegah pengajuan ganda.</Text>}
      {quota.remainingKg === 0 && <Text style={ui.error}>Kuota bulan ini sudah habis. Pengajuan baru tersedia pada bulan berikutnya.</Text>}
    </View>
    <Text style={ui.muted}>Kuota berkurang setelah pengajuan berhasil. Layanan prototype menggunakan data sementara dengan jeda respons simulasi.</Text>
    {__DEV__ && onSimulateLoadError && onSimulateSubmitError && <View style={ui.card}>
      <Text style={ui.subtitle}>Uji kondisi layanan</Text>
      <Text style={ui.muted}>Panel demonstrasi tugas kuliah. Kegagalan hanya terjadi sekali; percobaan berikutnya kembali normal. Panel tidak tampil pada build produksi.</Text>
      <Button title="Coba gagal muat data" variant="secondary" disabled={submitting} onPress={onSimulateLoadError} />
      <Button title="Coba gagal kirim pengajuan" variant="secondary" disabled={submitting || success} onPress={onSimulateSubmitError} />
      <Button title="Muat ulang data" variant="ghost" disabled={submitting} onPress={() => { void controller.load(); }} />
    </View>}
  </>;
}
