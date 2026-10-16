import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LaundryCrudView } from '../../src/features/laundry/presentation/LaundryCrudView';
import { DemoStore } from '../../src/features/laundry/data/demoStore';
import { DEMO_EMAILS, DEMO_PASSWORD } from '../../src/config/constants';
function setup() {
  const store = new DemoStore(() => new Date('2026-10-09T03:00:00Z')); store.login(DEMO_EMAILS.resident, DEMO_PASSWORD);
  const order = store.visibleOrders().find((o) => o.id === 'LA-DEMO-001')!;
  const onSave = jest.fn().mockResolvedValue(undefined); const onDelete = jest.fn().mockResolvedValue(undefined);
  return { order, onSave, onDelete };
}
test('edit mengisi form dari entity dan menyimpan nilai yang diubah', async () => {
  const props = setup(); await render(<LaundryCrudView {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Edit pengajuan' }));
  await fireEvent.changeText(screen.getByLabelText('Ubah berat (kg)'), '2.5');
  await fireEvent.changeText(screen.getByLabelText('Ubah catatan'), 'Baru');
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan perubahan' }));
  expect(props.onSave).toHaveBeenCalledWith('2.5', 'Baru');
  expect(screen.getByText('Perubahan tersimpan di perangkat.')).toBeTruthy();
});
test('delete memerlukan konfirmasi, batal tidak memanggil penyimpanan', async () => {
  const props = setup(); await render(<LaundryCrudView {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Hapus pengajuan' }));
  expect(props.onDelete).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Batal hapus' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Hapus pengajuan' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Ya, hapus pengajuan' }));
  expect(props.onDelete).toHaveBeenCalledTimes(1);
});
test('save pending mengunci form, lalu kegagalan mempertahankan input untuk retry', async () => {
  const props = setup(); let reject!: (error: Error) => void;
  props.onSave.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
  await render(<LaundryCrudView {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Edit pengajuan' }));
  await fireEvent.changeText(screen.getByLabelText('Ubah catatan'), 'Tetap ada');
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan perubahan' }));
  expect(screen.getByRole('button', { name: 'Menyimpan ke perangkat...' })).toHaveProp('accessibilityState', { disabled: true, busy: true });
  expect(screen.getByLabelText('Ubah catatan')).toHaveProp('editable', false);
  await act(async () => { reject(new Error('Disk penuh')); });
  expect(screen.getByText('Disk penuh')).toBeTruthy(); expect(screen.getByLabelText('Ubah catatan')).toHaveProp('value', 'Tetap ada');
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan perubahan' }));
  expect(props.onSave).toHaveBeenCalledTimes(2);
});
test('pengajuan diproses tidak menyediakan edit dan hapus', async () => {
  const props = setup(); await render(<LaundryCrudView {...props} order={{ ...props.order, status: 'diproses' }} />);
  expect(screen.queryByRole('button', { name: 'Edit pengajuan' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Hapus pengajuan' })).toBeNull();
});
