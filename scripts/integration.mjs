import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { startLocalServices } from './local-services.mjs';
const services = await startLocalServices();
try {
  const child = spawn(
    'pnpm',
    ['exec', 'vitest', 'run', 'apps/web/src/server/sync.integration.test.ts'],
    { stdio: 'inherit', env: { ...process.env, ...services.env } },
  );
  const [code] = await once(child, 'exit');
  process.exitCode = code;
} finally {
  await services.close();
}
