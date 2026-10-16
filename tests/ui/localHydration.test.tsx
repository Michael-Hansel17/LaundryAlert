import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native';
import { DemoProvider, useDemo } from '../../src/shared/state/DemoProvider';
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() },
}));
function Child() { const { orders } = useDemo(); return <Text>Siap: {orders.length}</Text>; }
beforeEach(() => { jest.resetAllMocks(); jest.mocked(AsyncStorage.setItem).mockResolvedValue(); });
test('hydration memblokir aplikasi sampai read selesai, empty tersimpan tidak menjadi seed', async () => {
  let finish!: (raw: string) => void;
  jest.mocked(AsyncStorage.getItem).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  await render(<DemoProvider><Child /></DemoProvider>);
  expect(screen.getByText('Membaca data laundry lokal...')).toBeTruthy();
  expect(screen.queryByText('Siap: 0')).toBeNull();
  await act(async () => { finish(JSON.stringify({ version: 1, orders: [], sequence: 0 })); });
  expect(screen.getByText('Siap: 0')).toBeTruthy();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});
test('read gagal menyediakan retry tanpa menulis seed di atas data lama', async () => {
  jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('Storage tidak bisa dibaca'))
    .mockResolvedValueOnce(JSON.stringify({ version: 1, orders: [], sequence: 0 }));
  await render(<DemoProvider><Child /></DemoProvider>);
  expect(screen.getByText('Storage tidak bisa dibaca')).toBeTruthy();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Coba baca data lokal lagi' }));
  expect(screen.getByText('Siap: 0')).toBeTruthy(); expect(AsyncStorage.getItem).toHaveBeenCalledTimes(2);
});
