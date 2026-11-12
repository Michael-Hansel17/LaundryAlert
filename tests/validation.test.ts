import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail, validateLogin, validateRegistration } from '../src/features/auth/domain/validation';

const valid = { name: ' Sari ', email: ' SARI@Example.Test ', roomNumber: ' B-102 ', password: 'rahasia', confirmPassword: 'rahasia' };

test('validation: normalizeEmail memangkas spasi dan mengecilkan huruf', () => {
  assert.equal(normalizeEmail('  A@B.Com '), 'a@b.com');
});

test('validation: validateLogin menolak kolom kosong dan menormalkan email', () => {
  assert.deepEqual(validateLogin(' A@B.com ', 'x'), { email: 'a@b.com', password: 'x' });
  assert.throws(() => validateLogin('   ', 'x'), /wajib diisi/);
  assert.throws(() => validateLogin('a@b.com', ''), /wajib diisi/);
});

test('validation: validateRegistration mengembalikan input yang sudah dibersihkan', () => {
  const clean = validateRegistration(valid);
  assert.equal(clean.name, 'Sari');
  assert.equal(clean.roomNumber, 'B-102');
  assert.equal(clean.email, 'sari@example.test');
});

test('validation: validateRegistration menolak setiap aturan yang dilanggar', () => {
  const cases: [Partial<typeof valid>, RegExp][] = [
    [{ name: '  ' }, /Nama dan nomor kamar/],
    [{ roomNumber: '' }, /Nama dan nomor kamar/],
    [{ email: 'bukan-email' }, /email yang valid/],
    [{ password: '12345', confirmPassword: '12345' }, /minimal 6/],
    [{ confirmPassword: 'lain' }, /tidak cocok/],
  ];
  for (const [patch, message] of cases) {
    assert.throws(() => validateRegistration({ ...valid, ...patch }), message, JSON.stringify(patch));
  }
});
