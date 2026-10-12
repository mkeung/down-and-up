import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { freePort, startLocalServices } from './local-services.mjs';
const services = await startLocalServices();
const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  ...services.env,
  APP_ORIGIN: origin,
  PLAYWRIGHT_BASE_URL: origin,
  TEST_REDIS_SOCKET: services.redisSocket,
  NEXT_TELEMETRY_DISABLED: '1',
};
let server;
try {
  const migrate = spawn('pnpm', ['db:migrate'], { stdio: 'inherit', env });
  const [migrated] = await once(migrate, 'exit');
  if (migrated) throw new Error('Migration failed');
  server = spawn(
    'pnpm',
    [
      '--filter',
      '@down-up/web',
      'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    { stdio: 'inherit', env, detached: true },
  );
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if (
        (
          await fetch(origin + '/api/health', {
            signal: AbortSignal.timeout(2000),
          })
        ).ok
      ) {
        ready = true;
        break;
      }
    } catch {
      /* waiting for startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!ready) throw new Error('Web server did not start');
  const child = spawn('pnpm', ['exec', 'playwright', 'test'], {
    stdio: 'inherit',
    env,
  });
  const [code] = await once(child, 'exit');
  process.exitCode = code;
} finally {
  if (server) {
    process.kill(-server.pid, 'SIGTERM');
  }
  await services.close();
}
