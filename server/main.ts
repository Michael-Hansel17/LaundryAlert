import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { createSeed } from '../src/features/laundry/data/seed';
import { createApiServer } from './app';
import { fileLogger } from './logger';

const port = Number(process.env.PORT ?? 3001);
const dataDir = join(__dirname, 'data');
// Session-signing secret is created once and kept next to the data (server/data is git-ignored).
const secretFile = join(dataDir, 'secret.txt');
mkdirSync(dataDir, { recursive: true });
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('hex'));

// Request / error log: server/data/logs/server-YYYY-MM-DD.log (one JSON object per line, kept 14 days).
const logDir = join(dataDir, 'logs');
const logger = fileLogger({ dir: logDir });
process.on('uncaughtException', (error) => { logger.log('error', 'uncaughtException', { error }); process.exit(1); });
process.on('unhandledRejection', (reason) => { logger.log('error', 'unhandledRejection', { error: reason instanceof Error ? reason : String(reason) }); });

// IPv4 addresses a phone on the same Wi-Fi can use as EXPO_PUBLIC_API_URL for the APK.
const lanAddresses = Object.values(networkInterfaces()).flat()
  .filter((item) => item && item.family === 'IPv4' && !item.internal)
  .map((item) => `http://${item!.address}:${port}`);

// First start: demo accounts + orders (gives the admin a queue). Later starts reuse server/data/*.json.
// Delete the folder server/data to reset everything.
const seed = createSeed(new Date());
createApiServer({
  file: join(dataDir, 'orders.json'), accountsFile: join(dataDir, 'accounts.json'),
  seed: seed.orders, seedAccounts: seed.accounts, tokenSecret: readFileSync(secretFile, 'utf8').trim(),
  logger,
}).listen(port, () => {
  logger.log('info', 'Server dimulai', { port, lan: lanAddresses, logDir });
  console.log(`LaundryAlert API berjalan di http://localhost:${port}/api (akun demo: penghuni@laundryalert.test / admin@laundryalert.test, sandi demo123)`);
  if (lanAddresses.length) console.log(`Untuk HP/APK di Wi-Fi yang sama: ${lanAddresses.join(' atau ')}`);
  console.log(`Log server: ${logDir}`);
});
