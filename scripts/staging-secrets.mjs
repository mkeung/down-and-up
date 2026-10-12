import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
for (const key of ['SESSION_SIGNING_SECRET', 'CRON_SECRET']) {
  const value = randomBytes(32).toString('base64url');
  const child = spawn(
    'vercel',
    [
      'env',
      'add',
      key,
      'preview',
      '--scope',
      'mikekeung-4887s-projects',
      '--type',
      'secret',
      '--non-interactive',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  let error = '';
  child.stderr.on('data', (chunk) => {
    error += chunk;
  });
  child.stdin.end(value);
  const [code] = await once(child, 'exit');
  if (code)
    throw new Error(
      `${key} could not be configured: ${error.replaceAll(value, '[redacted]')}`,
    );
  process.stdout.write(`${key} configured for preview\n`);
}
