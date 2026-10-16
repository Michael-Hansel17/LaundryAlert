import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DemoStore } from '../../src/features/laundry/data/demoStore';
import { DEMO_EMAILS, DEMO_PASSWORD } from '../../src/config/constants';
import type { LaundryOrder } from '../../src/features/laundry/domain/models';
import type { AdminRepository } from '../../src/features/admin/domain/adminRepository';
import { AdminStatusController } from '../../src/features/admin/state/AdminStatusController';
import { AdminStatusView } from '../../src/features/admin/presentation/AdminStatusView';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
function fixture(orderId: string | null = 'LA-DEMO-001') {
  const store = new DemoStore(() => new Date('2026-10-02T03:00:00Z'));
  store.login(DEMO_EMAILS.admin, DEMO_PASSWORD);
  const orders = store.visibleOrders();
  const repository: jest.Mocked<AdminRepository> = { load: jest.fn(), update: jest.fn(), subscribe: jest.fn((_listener: (orders: readonly LaundryOrder[]) => void) => () => {}) };
  const controller = new AdminStatusController(repository, orderId);
  return { controller, repository, orders };
}
async function loaded(orderId: string | null = 'LA-DEMO-001', empty = false) {
  const setup = fixture(orderId);
  setup.repository.load.mockResolvedValue(empty ? [] : setup.orders);
  const onOpenOrder = jest.fn();
  await render(<AdminStatusView controller={setup.controller} onOpenOrder={onOpenOrder} />);
  await act(async () => { await setup.controller.load(); });
  return { ...setup, onOpenOrder };
}
describe('Admin status — component/widget states', () => {
  test('initial loading: spinner tampil sebelum form tersedia', async () => {
    const { controller, repository } = fixture();
    const request = deferred<readonly LaundryOrder[]>(); repository.load.mockReturnValue(request.promise);
    await render(<AdminStatusView controller={controller} />);
    await act(async () => { void controller.load(); });
    expect(screen.getByLabelText('Sedang memuat antrean admin')).toBeOnTheScreen();
    expect(screen.queryByText('Form pembaruan status')).toBeNull();
    controller.dispose();
  });
  test('loaded: detail dan pilihan status tampil', async () => {
    await loaded();
    expect(screen.getByText(/Data admin berhasil dimuat/)).toBeOnTheScreen();
    expect(screen.getByText('Form pembaruan status')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Status tujuan Diproses' })).toBeOnTheScreen();
  });
  test('empty: antrean tanpa order', async () => {
    await loaded(null, true);
    expect(screen.getByText('Tidak ada pengajuan')).toBeOnTheScreen();
  });
  test('filter kosong dan membuka order bekerja dari data nyata', async () => {
    const { onOpenOrder, repository, controller, orders } = await loaded(null);
    await fireEvent.press(screen.getByRole('button', { name: 'Detail laundry LA-DEMO-001, diterima' }));
    expect(onOpenOrder).toHaveBeenCalledWith('LA-DEMO-001');
    repository.load.mockResolvedValue(orders.filter((order) => order.status !== 'diterima'));
    await act(async () => { await controller.load(); });
    await fireEvent.press(screen.getByRole('button', { name: 'Diterima' }));
    expect(screen.getByText('Tidak ada pengajuan')).toBeOnTheScreen();
  });
  test('error muat dan retry memanggil repository lagi', async () => {
    const { controller, repository, orders } = fixture();
    repository.load.mockRejectedValueOnce(new Error('Antrean gagal dimuat.')).mockResolvedValueOnce(orders);
    await render(<AdminStatusView controller={controller} />);
    await act(async () => { await controller.load(); });
    expect(screen.getByText('Data admin gagal dimuat')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByText('Form pembaruan status')).toBeOnTheScreen();
    expect(repository.load).toHaveBeenCalledTimes(2);
  });
  test('validasi pilihan kosong tidak mengirim request', async () => {
    const { repository } = await loaded();
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan status' }));
    expect(screen.getByText('Pilih status tujuan terlebih dahulu.')).toBeOnTheScreen();
    expect(repository.update).not.toHaveBeenCalled();
  });
  test.each(['Diterima', 'Selesai', 'Sudah diambil'])('validasi transisi %s menolak status tetap/lompatan', async (label) => {
    const { repository } = await loaded();
    await fireEvent.press(screen.getByRole('radio', { name: `Status tujuan ${label}` }));
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan status' }));
    expect(screen.getByText('Status harus maju satu tahap sesuai urutan.')).toBeOnTheScreen();
    expect(repository.update).not.toHaveBeenCalled();
  });
  test('submit loading mengunci pilihan, retry/load dan double tap hanya satu request', async () => {
    const { repository, controller, orders } = await loaded();
    const request = deferred<LaundryOrder>(); repository.update.mockReturnValue(request.promise);
    await fireEvent.press(screen.getByRole('radio', { name: 'Status tujuan Diproses' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan status' }));
    const sending = screen.getByRole('button', { name: 'Menyimpan status...' });
    expect(sending).toBeDisabled();
    expect(sending).toHaveProp('accessibilityState', { disabled: true, busy: true });
    expect(screen.getByRole('radio', { name: 'Status tujuan Diproses' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Muat ulang data admin' })).toBeDisabled();
    await fireEvent.press(sending);
    await act(async () => { await controller.submit(); await controller.load(); controller.setTarget('selesai'); });
    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(repository.load).toHaveBeenCalledTimes(1);
    expect(repository.update).toHaveBeenCalledWith({ orderId: 'LA-DEMO-001', expectedStatus: 'diterima', target: 'diproses' }, expect.any(AbortSignal));
    await act(async () => { request.resolve({ ...orders.find((o) => o.id === 'LA-DEMO-001')!, status: 'diproses' }); });
    expect(screen.getByText(/Status berhasil disimpan/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Simpan status' })).toBeDisabled();
  });
  test('gagal submit mempertahankan pilihan dan retry berhasil', async () => {
    const { repository, orders } = await loaded();
    repository.update.mockRejectedValueOnce(new Error('Status belum tersimpan.')).mockResolvedValueOnce({ ...orders.find((order) => order.id === 'LA-DEMO-001')!, status: 'diproses' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Status tujuan Diproses' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan status' }));
    expect(await screen.findByText('Status belum tersimpan.')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Status tujuan Diproses' })).toHaveProp('accessibilityState', { checked: true, disabled: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Coba kirim lagi' }));
    expect(await screen.findByText(/Status berhasil disimpan/)).toBeOnTheScreen();
    expect(repository.update).toHaveBeenCalledTimes(2);
  });
  test('order tidak ditemukan tidak menampilkan form', async () => {
    await loaded('missing');
    expect(screen.getByText('Laundry tidak ditemukan')).toBeOnTheScreen();
    expect(screen.queryByText('Form pembaruan status')).toBeNull();
  });
  test('status final tidak dapat diubah', async () => {
    await loaded('LA-DEMO-004');
    expect(screen.getByText('Laundry sudah diambil. Tidak ada perubahan status berikutnya.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Simpan status' })).toBeNull();
  });
});
