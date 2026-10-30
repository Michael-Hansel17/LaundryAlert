import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSeed } from '../src/features/laundry/data/seed';
import { createApiServer } from './app';

const port = Number(process.env.PORT ?? 3001);
const dataDir = join(__dirname, 'data');
// Session-signing secret is created once and kept next to the data (server/data is git-ignored).
const secretFile = join(dataDir, 'secret.txt');
mkdirSync(dataDir, { recursive: true });
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('hex'));

// First start: demo accounts + orders (gives the admin a queue). Later starts reuse server/data/*.json.
// Delete the folder server/data to reset everything.
const seed = createSeed(new Date());
createApiServer({
  file: join(dataDir, 'orders.json'), accountsFile: join(dataDir, 'accounts.json'),
  seed: seed.orders, seedAccounts: seed.accounts, tokenSecret: readFileSync(secretFile, 'utf8').trim(),
}).listen(port, () => {
  console.log(`LaundryAlert API berjalan di http://localhost:${port}/api (akun demo: penghuni@laundryalert.test / admin@laundryalert.test, sandi demo123)`);
});
