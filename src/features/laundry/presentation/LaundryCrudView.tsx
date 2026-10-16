import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { LaundryOrder } from '../domain/models';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';
import { ui } from '../../../shared/theme/theme';

interface Props {
  order: LaundryOrder;
  onSave: (weight: string, notes: string) => Promise<unknown>;
  onDelete: () => Promise<void>;
}

export function LaundryCrudView({ order, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [weight, setWeight] = useState(String(order.estimatedWeightKg));
  const [notes, setNotes] = useState(order.notes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const locked = useRef(false);
  async function run(action: () => Promise<unknown>, success: string) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null); setMessage(null);
    try { await action(); setEditing(false); setConfirmDelete(false); setMessage(success); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Data belum tersimpan. Silakan coba lagi.'); }
    finally { locked.current = false; setBusy(false); }
  }
  if (order.status !== 'diterima') return <Text style={ui.muted}>Pengajuan yang sudah diproses tidak dapat diedit atau dihapus.</Text>;
  return <View style={ui.card}>
    <Text style={ui.subtitle}>Kelola pengajuan</Text>
    {editing ? <>
      <Input label="Ubah berat (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" editable={!busy} />
      <Input label="Ubah catatan" value={notes} onChangeText={setNotes} multiline editable={!busy} />
      <Button title="Simpan perubahan" loading={busy} loadingTitle="Menyimpan ke perangkat..." onPress={() => { void run(() => onSave(weight, notes), 'Perubahan tersimpan di perangkat.'); }} />
      <Button title="Batal edit" variant="ghost" disabled={busy} onPress={() => { setEditing(false); setError(null); }} />
    </> : <Button title="Edit pengajuan" disabled={busy || confirmDelete} variant="secondary" onPress={() => {
      setWeight(String(order.estimatedWeightKg)); setNotes(order.notes); setMessage(null); setError(null); setEditing(true);
    }} />}
    {!editing && (confirmDelete ? <>
      <Text style={ui.body}>Hapus pengajuan ini? Data akan dihapus dari penyimpanan lokal dan kuota dikembalikan.</Text>
      <Button title="Ya, hapus pengajuan" loading={busy} loadingTitle="Menghapus dari perangkat..." onPress={() => { void run(onDelete, 'Pengajuan dihapus.'); }} />
      <Button title="Batal hapus" variant="ghost" disabled={busy} onPress={() => { setConfirmDelete(false); setError(null); }} />
    </> : <Button title="Hapus pengajuan" disabled={busy} variant="ghost" onPress={() => { setConfirmDelete(true); setMessage(null); setError(null); }} />)}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={ui.body}>{message}</Text>}
  </View>;
}
