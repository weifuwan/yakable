import 'dotenv/config';

import { createYakableApiServer } from './web-api.js';

function readPort(): number {
  const raw = process.env.YAKABLE_API_PORT?.trim();
  if (!raw) return 8787;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0 || value > 65535) {
    throw new Error('YAKABLE_API_PORT must be an integer between 1 and 65535.');
  }
  return value;
}

const api = createYakableApiServer();
const url = await api.listen(readPort());

console.log('Yakable Web API');
console.log(`API ready: ${url}`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  console.log('\nStopping Yakable API and project runtimes...');
  await api.close();
}

process.once('SIGINT', () => {
  void stop().finally(() => process.exit(0));
});
process.once('SIGTERM', () => {
  void stop().finally(() => process.exit(0));
});
