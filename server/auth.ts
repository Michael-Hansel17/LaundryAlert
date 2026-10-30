import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Passwords are stored as salted scrypt hashes, never as plain text.
export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 32).toString('hex') };
}
export function verifyPassword(password: string, record: { salt: string; hash: string }) {
  const expected = Buffer.from(record.hash, 'hex');
  const actual = scryptSync(password, record.salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Stateless session token: base64url(payload).HMAC-SHA256(payload). Expires after ttlMs.
const encode = (value: string) => Buffer.from(value).toString('base64url');
export function signToken(userId: string, secret: string, now: number, ttlMs: number) {
  const payload = encode(JSON.stringify({ sub: userId, exp: now + ttlMs }));
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function verifyToken(token: string, secret: string, now: number): string | null {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: unknown; exp?: unknown };
    return typeof data.sub === 'string' && typeof data.exp === 'number' && data.exp > now ? data.sub : null;
  } catch { return null; }
}
