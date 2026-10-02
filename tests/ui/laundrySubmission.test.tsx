import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DemoStore } from '../../src/features/laundry/data/demoStore';
import { DEMO_EMAILS, DEMO_PASSWORD } from '../../src/config/constants';
import type { LaundryData, LaundryRepository } from '../../src/features/laundry/domain/laundryRepository';
import type { LaundryOrder } from '../../src/features/laundry/domain/models';
import { SubmitLaundryView } from '../../src/features/laundry/presentation/SubmitLaundryView';
import { LaundrySubmissionController } from '../../src/features/laundry/state/LaundrySubmissionController';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(empty = false) {
  const store = new DemoStore(() => new Date('2026-10-02T03:00:00Z'));
  store.login(DEMO_EMAILS.resident, DEMO_PASSWORD);
  const data: LaundryData = { orders: empty ? [] : store.visibleOrders(), quota: empty ? { month: '2026-10', limitKg: 10, usedKg: 0, remainingKg: 10 } : store.quota() };
  const repository: jest.Mocked<LaundryRepository> = {
    load: jest.fn(), submit: jest.fn(), subscribe: jest.fn((_listener: (data: LaundryData) => void) => () => {}),
  };
  const controller = new LaundrySubmissionController(repository);
  return { repository, controller, data, store };
}
async function mount(controller: LaundrySubmissionController) {
  const onOpenOrder = jest.fn();
  await render(<SubmitLaundryView controller={controller} onOpenOrder={onOpenOrder} />);
  return onOpenOrder;
}
async function loaded(empty = false) {
  const setup = fixture(empty);
  setup.repository.load.mockResolvedValue(setup.data);
  const onOpenOrder = await mount(setup.controller);
  await act(async () => { await setup.controller.load(); });
  return { ...setup, onOpenOrder };
}

describe('Pengajuan Laundry — component/widget states', () => {
  test('initial loading: spinner dan pesan, form belum tersedia', async () => {
    const { controller, repository } = fixture();
    const request = deferred<LaundryData>(); repository.load.mockReturnValue(request.promise);
    await mount(controller);
    await act(async () => { void controller.load(); });
    expect(screen.getByLabelText('Sedang memuat data laundry')).toBeOnTheScreen();
    expect(screen.getByText('Memuat data laundry...')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Estimasi berat (kg)')).toBeNull();
    controller.dispose();
  });

  test('data berhasil dimuat: kuota, kartu terbaru dan form tampil', async () => {
    await loaded();
    expect(screen.getByText(/Data berhasil dimuat/)).toBeOnTheScreen();
    expect(screen.getByText('6,5 kg')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Detail laundry LA-DEMO-001, diterima' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Estimasi berat (kg)')).toBeOnTheScreen();
  });

  test('empty state: akun tanpa order tetap dapat mengisi form', async () => {
    await loaded(true);
    expect(screen.getByText('Belum ada pengajuan laundry')).toBeOnTheScreen();
    expect(screen.getByText('10 kg')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Kirim pengajuan' })).toBeEnabled();
  });

  test('error muat menampilkan retry yang benar-benar memanggil repository kembali', async () => {
    const { controller, repository, data } = fixture();
    repository.load.mockRejectedValueOnce(new Error('Koneksi simulasi terputus.')).mockResolvedValueOnce(data);
    await mount(controller);
    await act(async () => { await controller.load(); });
    expect(screen.getByText('Data laundry gagal dimuat')).toBeOnTheScreen();
    expect(screen.getByText('Koneksi simulasi terputus.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Estimasi berat (kg)')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(repository.load).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/Data berhasil dimuat/)).toBeOnTheScreen();
  });

  test.each(['', 'abc', '0', '-1', '1.234', '7'])('validasi berat %p mencegah submit ke repository', async (input) => {
    const { repository } = await loaded();
    await fireEvent.changeText(screen.getByLabelText('Estimasi berat (kg)'), input);
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim pengajuan' }));
    expect(screen.getByRole('alert')).toBeOnTheScreen();
    expect(repository.submit).not.toHaveBeenCalled();
  });

  test('submitting: spinner, tombol disabled/busy, input dikunci, double tap hanya satu request', async () => {
    const { repository, controller, data } = await loaded();
    const request = deferred<LaundryOrder>(); repository.submit.mockReturnValue(request.promise);
    await fireEvent.changeText(screen.getByLabelText('Estimasi berat (kg)'), '2,5');
    await fireEvent.changeText(screen.getByLabelText('Catatan (opsional)'), 'Pisahkan jaket');
    const button = screen.getByRole('button', { name: 'Kirim pengajuan' });
    await fireEvent.press(button);
    const sending = screen.getByRole('button', { name: 'Mengirim pengajuan...' });
    expect(sending).toBeDisabled();
    expect(sending).toHaveProp('accessibilityState', { disabled: true, busy: true });
    expect(screen.getByLabelText('Estimasi berat (kg)')).toHaveProp('editable', false);
    expect(screen.getByLabelText('Catatan (opsional)')).toHaveProp('editable', false);
    await fireEvent.press(sending);
    await act(async () => { await controller.submit(); });
    expect(repository.submit).toHaveBeenCalledTimes(1);
    expect(repository.submit).toHaveBeenCalledWith({ weight: '2,5', notes: 'Pisahkan jaket' }, expect.any(AbortSignal));
    await act(async () => { request.resolve({ ...data.orders[0], id: 'new-order' }); });
    expect(screen.getByText('Pengajuan berhasil dikirim')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Pengajuan terkirim' })).toBeDisabled();
  });

  test('gagal submit: input dipertahankan dan retry berhasil tanpa double request', async () => {
    const { repository, data } = await loaded();
    repository.submit.mockRejectedValueOnce(new Error('Pengajuan belum terkirim.')).mockResolvedValueOnce({ ...data.orders[0], id: 'retry-order' });
    await fireEvent.changeText(screen.getByLabelText('Estimasi berat (kg)'), '1');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim pengajuan' }));
    expect(await screen.findByText('Pengajuan belum terkirim.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Estimasi berat (kg)')).toHaveProp('value', '1');
    await fireEvent.press(screen.getByRole('button', { name: 'Coba kirim lagi' }));
    expect(await screen.findByText('Pengajuan berhasil dikirim')).toBeOnTheScreen();
    expect(repository.submit).toHaveBeenCalledTimes(2);
  });

  test('berhasil submit: detail dapat dibuka dan form baru dapat direset', async () => {
    const { repository, data, onOpenOrder } = await loaded();
    repository.submit.mockResolvedValue({ ...data.orders[0], id: 'success-order' });
    await fireEvent.changeText(screen.getByLabelText('Estimasi berat (kg)'), '2.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim pengajuan' }));
    await screen.findByText('Pengajuan berhasil dikirim');
    await fireEvent.press(screen.getByRole('button', { name: 'Lihat detail laundry' }));
    expect(onOpenOrder).toHaveBeenCalledWith('success-order');
    await fireEvent.press(screen.getByRole('button', { name: 'Buat pengajuan lagi' }));
    expect(screen.getByLabelText('Estimasi berat (kg)')).toHaveProp('value', '');
    expect(screen.getByRole('button', { name: 'Kirim pengajuan' })).toBeEnabled();
  });
});
