import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DiagnosticsView } from '../../src/shared/presentation/DiagnosticsScreen';
import { Logger } from '../../src/shared/services/logger';

// Screen needs a navigator header; the log content is what is under test here.
jest.mock('../../src/shared/components/Screen', () => {
  const { View } = jest.requireActual('react-native');
  return { Screen: ({ children }: { children: unknown }) => <View>{children}</View> };
});

const at = new Date('2026-11-20T03:00:00Z');
function filled() {
  const log = new Logger({ clock: () => at });
  log.setContext({ apiUrl: 'http://192.168.1.12:3001' });
  log.info('api', 'GET /api/orders → 200', { reqId: 'r1' });
  log.warn('auth', 'Masuk gagal');
  log.error('api', 'POST /api/orders gagal terhubung');
  return log;
}

test('log kosong menampilkan empty state dan tombol nonaktif', async () => {
  await render(<DiagnosticsView logger={new Logger()} share={jest.fn()} />);
  expect(screen.getByText('Belum ada log')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Bagikan log' })).toBeDisabled();
});

test('menampilkan konteks, ringkasan, dan entri terbaru di atas', async () => {
  await render(<DiagnosticsView logger={filled()} share={jest.fn()} />);
  expect(screen.getByText('apiUrl: http://192.168.1.12:3001')).toBeTruthy();
  expect(screen.getByText('3 entri · 1 peringatan · 1 error')).toBeTruthy();
  const messages = screen.getAllByText(/GET \/api|Masuk gagal|POST \/api/).map((node) => node.props.children);
  expect(messages).toEqual(['POST /api/orders gagal terhubung', 'Masuk gagal', 'GET /api/orders → 200']);
});

test('filter Error hanya menampilkan error, detail data bisa dibuka', async () => {
  await render(<DiagnosticsView logger={filled()} share={jest.fn()} />);
  await fireEvent.press(screen.getByRole('tab', { name: 'Error' }));
  expect(screen.queryByText('Masuk gagal')).toBeNull();
  expect(screen.getByText('POST /api/orders gagal terhubung')).toBeTruthy();
  await fireEvent.press(screen.getByRole('tab', { name: 'Semua' }));
  await fireEvent.press(screen.getByText('GET /api/orders → 200'));
  expect(screen.getByText(/"reqId": "r1"/)).toBeTruthy();
});

test('bagikan mengirim teks ekspor dan hapus mengosongkan log', async () => {
  const share = jest.fn(async () => undefined);
  await render(<DiagnosticsView logger={filled()} share={share} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Bagikan log' }));
  expect(share).toHaveBeenCalledWith(expect.stringContaining('[api] POST /api/orders gagal terhubung'));
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: 'Hapus log' })); });
  expect(screen.getByText('Belum ada log')).toBeTruthy();
  expect(screen.getByText('Log dihapus.')).toBeTruthy();
});
