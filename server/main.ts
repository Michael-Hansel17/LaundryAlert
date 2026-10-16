import { join } from 'node:path';
import { createApiServer } from './app';

const port = Number(process.env.PORT ?? 3001);
createApiServer({ file: join(__dirname, 'data', 'orders.json') }).listen(port, () => {
  console.log(`LaundryAlert API berjalan di http://localhost:${port}/api/orders`);
});
