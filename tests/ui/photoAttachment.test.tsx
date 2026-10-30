import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { LaundryData, LaundryRepository } from '../../src/features/laundry/domain/laundryRepository';
import { SubmitLaundryView } from '../../src/features/laundry/presentation/SubmitLaundryView';
import { LaundrySubmissionController } from '../../src/features/laundry/state/LaundrySubmissionController';
import type { PhotoPicker, PhotoResult } from '../../src/shared/services/photoPicker';

const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
async function mountWith(result: PhotoResult) {
  const data: LaundryData = { orders: [], quota: { month: '2026-10', limitKg: 10, usedKg: 0, remainingKg: 10 } };
  const repository: jest.Mocked<LaundryRepository> = { load: jest.fn().mockResolvedValue(data), submit: jest.fn(), subscribe: jest.fn((_listener: (data: LaundryData) => void) => () => {}) };
  const picker: PhotoPicker = { takePhoto: jest.fn().mockResolvedValue(result), pickFromLibrary: jest.fn().mockResolvedValue(result) };
  const controller = new LaundrySubmissionController(repository, picker);
  await render(<SubmitLaundryView controller={controller} onOpenOrder={jest.fn()} />);
  await act(async () => { await controller.load(); });
  return { controller, picker };
}

describe('Foto cucian — kamera, izin, dan pembatalan', () => {
  test('foto berhasil diambil: pratinjau tampil dan bisa dihapus', async () => {
    await mountWith({ status: 'ok', uri: PHOTO });
    await fireEvent.press(screen.getByText('Ambil foto'));
    expect(await screen.findByLabelText('Pratinjau foto cucian')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Hapus foto'));
    expect(screen.queryByLabelText('Pratinjau foto cucian')).not.toBeOnTheScreen();
  });

  test('izin kamera ditolak: pesan petunjuk muncul, form tetap dapat dipakai', async () => {
    await mountWith({ status: 'denied', canAskAgain: false });
    await fireEvent.press(screen.getByText('Ambil foto'));
    expect(await screen.findByText(/Izin kamera diblokir/)).toBeOnTheScreen();
    expect(screen.getByText('Kirim pengajuan')).toBeOnTheScreen();
  });

  test('pengambilan foto dibatalkan: pesan netral dan tidak ada foto', async () => {
    await mountWith({ status: 'cancelled' });
    await fireEvent.press(screen.getByText('Pilih dari galeri'));
    expect(await screen.findByText('Pemilihan foto dibatalkan. Foto tidak berubah.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Pratinjau foto cucian')).not.toBeOnTheScreen();
  });
});
