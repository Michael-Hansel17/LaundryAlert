import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertWithinQuota, calculateQuota, monthInJakarta, nextStatus, normalizeNotes, parseWeight, transitionOrder,
} from '../src/features/laundry/domain/rules';
import { LAUNDRY_STATUSES, STATUS_LABELS, type LaundryOrder, type LaundryStatus } from '../src/features/laundry/domain/models';
import { errorMessage, formatKg } from '../src/shared/utils/format';
import { ApiError, parseOrder, parseOrderList } from '../src/features/laundry/data/orderDto';
import { MIN_PASSWORD_LENGTH, normalizeEmail, validateLogin, validateRegistration } from '../src/features/auth/domain/validation';
import { MONTHLY_QUOTA_KG } from '../src/config/constants';
import type { User } from '../src/features/auth/domain/models';

const user: User = {
  id: 'u1', name: 'Sari', email: 'sari@example.test', roomNumber: 'B-102',
  role: 'resident', monthlyQuotaKg: 10, createdAt: '2026-01-01T00:00:00.000Z',
};

const order = (over: Partial<LaundryOrder> = {}): LaundryOrder => ({
  id: 'o1', userId: 'u1', userName: 'Sari', roomNumber: 'B-102', estimatedWeightKg: 2,
  notes: '', submittedAt: '2026-05-10T03:00:00.000Z', updatedAt: '2026-05-10T03:00:00.000Z',
  status: 'diterima', statusHistory: [{ status: 'diterima', at: '2026-05-10T03:00:00.000Z' }], ...over,
});

// ---- parseWeight: input yang valid (satu test per kasus) ----
const validWeights: [string, number][] = [
  ['1', 1], ['2.5', 2.6], ['2,5', 2.5], ['0.01', 0.01], ['0,01', 0.01], ['10', 10], ['10.00', 10],
  ['3.75', 3.75], ['  4 ', 4], ['100', 100], ['0.5', 0.5], ['7,25', 7.25],
];
for (const [input, expected] of validWeights) {
  test(`parseWeight menerima "${input}" -> ${expected}`, () => assert.equal(parseWeight(input), expected));
}

// ---- parseWeight: input yang harus ditolak ----
const invalidWeights = ['', '   ', 'abc', '-1', '0', '0.00', '1.234', '1,234', '1e3', '1..2', '+2', '2 kg', '.5', '1,', 'NaN'];
for (const input of invalidWeights) {
  test(`parseWeight menolak "${input}"`, () => assert.throws(() => parseWeight(input), /Berat harus/));
}

// ---- assertWithinQuota ----
const quotaOk: [number, number][] = [[1, 10], [10, 10], [0.01, 0.01], [2.5, 2.5], [0.1, 0.3]];
for (const [weight, remaining] of quotaOk) {
  test(`assertWithinQuota lolos: ${weight} kg dari sisa ${remaining} kg`, () => {
    assert.doesNotThrow(() => assertWithinQuota(weight, remaining));
  });
}
const quotaBad: [number, number][] = [[10.01, 10], [1, 0], [0.02, 0.01], [5, 4.99]];
for (const [weight, remaining] of quotaBad) {
  test(`assertWithinQuota menolak: ${weight} kg dari sisa ${remaining} kg`, () => {
    assert.throws(() => assertWithinQuota(weight, remaining), /melebihi sisa kuota/);
  });
}
test('assertWithinQuota memakai pesan kustom jika diberikan', () => {
  assert.throws(() => assertWithinQuota(5, 1, 'Kuota habis'), /Kuota habis/);
});

// ---- normalizeNotes ----
const notesCases: [unknown, string][] = [
  ['  halo  ', 'halo'], [undefined, ''], [null, ''], ['', ''], [42, '42'], ['\n\tcatatan\n', 'catatan'],
];
for (const [input, expected] of notesCases) {
  test(`normalizeNotes(${JSON.stringify(input)}) -> ${JSON.stringify(expected)}`, () => assert.equal(normalizeNotes(input), expected));
}

// ---- monthInJakarta (zona waktu Asia/Jakarta = UTC+7) ----
const monthCases: [string, string][] = [
  ['2026-05-10T03:00:00.000Z', '2026-05'],
  ['2026-04-30T17:00:00.000Z', '2026-05'], // 00:00 WIB 1 Mei
  ['2026-04-30T16:59:59.000Z', '2026-04'],
  ['2026-12-31T17:00:00.000Z', '2027-01'], // pergantian tahun
  ['2026-01-01T00:00:00.000Z', '2026-01'],
];
for (const [iso, expected] of monthCases) {
  test(`monthInJakarta(${iso}) -> ${expected}`, () => assert.equal(monthInJakarta(iso), expected));
}

// ---- nextStatus & transitionOrder ----
const chain: [LaundryStatus, LaundryStatus | undefined][] = [
  ['diterima', 'diproses'], ['diproses', 'selesai'], ['selesai', 'diambil'], ['diambil', undefined],
];
for (const [from, to] of chain) {
  test(`nextStatus(${from}) -> ${to}`, () => assert.equal(nextStatus(from), to));
}
test('urutan status laundry tetap empat tahap', () => {
  assert.deepEqual([...LAUNDRY_STATUSES], ['diterima', 'diproses', 'selesai', 'diambil']);
});
for (const status of LAUNDRY_STATUSES) {
  test(`STATUS_LABELS punya label untuk ${status}`, () => assert.ok(STATUS_LABELS[status].length > 0));
}
test('transitionOrder maju satu tahap dan mencatat riwayat', () => {
  const next = transitionOrder(order(), 'diproses', '2026-05-11T00:00:00.000Z');
  assert.equal(next.status, 'diproses');
  assert.equal(next.updatedAt, '2026-05-11T00:00:00.000Z');
  assert.equal(next.statusHistory.length, 2);
});
test('transitionOrder tidak mengubah objek aslinya', () => {
  const original = order();
  transitionOrder(original, 'diproses', '2026-05-11T00:00:00.000Z');
  assert.equal(original.status, 'diterima');
  assert.equal(original.statusHistory.length, 1);
});
test('transitionOrder ke selesai mengisi completedAt', () => {
  const next = transitionOrder(order({ status: 'diproses' }), 'selesai', '2026-05-12T00:00:00.000Z');
  assert.equal(next.completedAt, '2026-05-12T00:00:00.000Z');
});
test('transitionOrder ke diambil mengisi pickedUpAt', () => {
  const next = transitionOrder(order({ status: 'selesai' }), 'diambil', '2026-05-13T00:00:00.000Z');
  assert.equal(next.pickedUpAt, '2026-05-13T00:00:00.000Z');
});
const badJumps: [LaundryStatus, LaundryStatus][] = [
  ['diterima', 'selesai'], ['diterima', 'diambil'], ['diproses', 'diterima'], ['diambil', 'diterima'], ['selesai', 'selesai'],
];
for (const [from, to] of badJumps) {
  test(`transitionOrder menolak lompatan ${from} -> ${to}`, () => {
    assert.throws(() => transitionOrder(order({ status: from }), to, 'x'), /maju satu tahap/);
  });
}

// ---- calculateQuota ----
const now = '2026-05-20T05:00:00.000Z';
test('calculateQuota tanpa pesanan: seluruh kuota tersisa', () => {
  assert.deepEqual(calculateQuota([], user, now), { month: '2026-05', limitKg: 10, usedKg: 0, remainingKg: 10 });
});
test('calculateQuota menjumlahkan berat pesanan bulan ini', () => {
  const q = calculateQuota([order({ estimatedWeightKg: 2.5 }), order({ id: 'o2', estimatedWeightKg: 3 })], user, now);
  assert.equal(q.usedKg, 5.5);
  assert.equal(q.remainingKg, 4.5);
});
test('calculateQuota mengabaikan pesanan bulan lain', () => {
  const q = calculateQuota([order({ submittedAt: '2026-04-10T03:00:00.000Z', estimatedWeightKg: 9 })], user, now);
  assert.equal(q.usedKg, 0);
});
test('calculateQuota mengabaikan pesanan pengguna lain', () => {
  const q = calculateQuota([order({ userId: 'u2', estimatedWeightKg: 9 })], user, now);
  assert.equal(q.usedKg, 0);
});
test('calculateQuota tidak pernah negatif saat kuota terlampaui', () => {
  const q = calculateQuota([order({ estimatedWeightKg: 12 })], user, now);
  assert.equal(q.remainingKg, 0);
});
test('calculateQuota tidak terkena galat pembulatan desimal (0.1 + 0.2)', () => {
  const q = calculateQuota([order({ estimatedWeightKg: 0.1 }), order({ id: 'o2', estimatedWeightKg: 0.2 })], user, now);
  assert.equal(q.usedKg, 0.3);
});
test('konstanta kuota bulanan default adalah 10 kg', () => assert.equal(MONTHLY_QUOTA_KG, 10));

// ---- format ----
test('formatKg menambahkan satuan kg', () => assert.match(formatKg(2), /^2 kg$/));
test('formatKg membatasi dua desimal', () => assert.ok(formatKg(1.239).endsWith(' kg')));
test('errorMessage mengambil pesan dari Error', () => assert.equal(errorMessage(new Error('rusak')), 'rusak'));
test('errorMessage memakai pesan default untuk nilai non-Error', () => {
  assert.equal(errorMessage('string'), 'Terjadi masalah. Silakan coba lagi.');
  assert.equal(errorMessage(undefined), 'Terjadi masalah. Silakan coba lagi.');
});

// ---- orderDto (batas model: JSON server tidak dipercaya) ----
test('parseOrder menerima pesanan yang valid', () => assert.equal(parseOrder(order()).id, 'o1'));
const brokenOrders: [string, unknown][] = [
  ['null', null], ['string', 'x'], ['id kosong', order({ id: '' })], ['berat nol', order({ estimatedWeightKg: 0 })],
  ['berat negatif', order({ estimatedWeightKg: -1 })], ['status tidak dikenal', order({ status: 'hilang' as LaundryStatus })],
  ['tanggal rusak', order({ submittedAt: 'bukan-tanggal' })], ['riwayat kosong', order({ statusHistory: [] })],
];
for (const [name, value] of brokenOrders) {
  test(`parseOrder menolak data rusak: ${name}`, () => {
    assert.throws(() => parseOrder(value), (e: unknown) => e instanceof ApiError && e.kind === 'model');
  });
}
test('parseOrderList menerima daftar valid', () => assert.equal(parseOrderList({ orders: [order(), order({ id: 'o2' })] }).length, 2));
test('parseOrderList menolak ID ganda', () => assert.throws(() => parseOrderList({ orders: [order(), order()] }), /ID laundry ganda/));
test('parseOrderList menolak body tanpa orders', () => assert.throws(() => parseOrderList({}), /daftar laundry/));
test('ApiError menyimpan kind dan status', () => {
  const e = new ApiError('http', 'gagal', 500);
  assert.equal(e.kind, 'http');
  assert.equal(e.status, 500);
  assert.equal(e.name, 'ApiError');
});

// ---- validasi auth tambahan ----
const goodEmails = ['a@b.co', 'nama.belakang@kampus.ac.id', 'x+tag@mail.test'];
const badEmails = ['', 'tanpa-at', 'a@b', '@b.com', 'a b@c.com', 'a@b .com'];
for (const email of goodEmails) {
  test(`validateRegistration menerima email ${email}`, () => {
    const base = { name: 'A', roomNumber: '1', password: 'abcdef', confirmPassword: 'abcdef' };
    assert.equal(validateRegistration({ ...base, email }).email, email.toLowerCase());
  });
}
for (const email of badEmails) {
  test(`validateRegistration menolak email "${email}"`, () => {
    const base = { name: 'A', roomNumber: '1', password: 'abcdef', confirmPassword: 'abcdef' };
    assert.throws(() => validateRegistration({ ...base, email }));
  });
}
test('panjang sandi minimal adalah 6', () => assert.equal(MIN_PASSWORD_LENGTH, 6));
test('normalizeEmail idempoten', () => assert.equal(normalizeEmail(normalizeEmail(' A@B.C ')), 'a@b.c'));
test('validateLogin tidak mengubah sandi (spasi dipertahankan)', () => {
  assert.equal(validateLogin('a@b.c', ' pass ').password, ' pass ');
});
