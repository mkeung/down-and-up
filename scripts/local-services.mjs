import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

export async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
async function stop(child) {
  if (child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await exited;
}
function start(binary, args, ready) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${binary} did not start`));
    }, 15000);
    const read = (chunk) => {
      output += chunk;
      if (output.includes(ready)) {
        clearTimeout(timer);
        resolve(child);
      }
    };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code) reject(new Error(`${binary} exited ${code}: ${output}`));
    });
  });
}
function redisResult(socket, input) {
  const command = input.map((value) =>
    typeof value === 'string' ? value : JSON.stringify(value),
  );
  // Upstash supports a Lua flag that local Redis does not. Preserve the original script hash.
  if (command[0]?.toLowerCase() === 'eval' && command[1]?.startsWith('#!lua'))
    command[1] = command[1].replace(/^#![^\n]*\n/, '\n');
  if (
    command[0]?.toLowerCase() === 'script' &&
    command[1]?.toLowerCase() === 'load' &&
    command[2]?.startsWith('#!lua')
  )
    return { result: 'unsupported-local-hash' };
  try {
    const output = execFileSync(
      'redis-cli',
      ['-s', socket, '--json', ...command],
      { encoding: 'utf8' },
    ).trim();
    if (output.startsWith('error:'))
      return { error: output.slice(6).trim().replace(/^"|"$/g, '') };
    const parsed = JSON.parse(output);
    return typeof parsed === 'object' && parsed && 'error' in parsed
      ? { error: parsed.error }
      : { result: parsed };
  } catch (error) {
    const message = error.stdout?.toString() ?? '';
    return {
      error: message.includes('NOSCRIPT')
        ? 'NOSCRIPT No matching script. Please use EVAL.'
        : 'Local Redis command failed',
    };
  }
}
async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}
function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
function base64Result(value) {
  return typeof value === 'string'
    ? Buffer.from(value).toString('base64')
    : Array.isArray(value)
      ? value.map(base64Result)
      : value;
}

export async function startLocalServices() {
  const directory = await mkdtemp(join(tmpdir(), 'down-up-test-'));
  const data = join(directory, 'pg');
  const socket = join(directory, 'redis.sock');
  await mkdir(data);
  execFileSync(
    'initdb',
    ['-D', data, '-U', 'down_up_test', '-A', 'trust', '--no-locale'],
    { stdio: 'ignore' },
  );
  const pgPort = await freePort();
  const postgres = await start(
    'postgres',
    ['-D', data, '-h', '127.0.0.1', '-p', String(pgPort), '-k', directory],
    'database system is ready to accept connections',
  );
  const redis = await start(
    'redis-server',
    [
      '--port',
      '0',
      '--unixsocket',
      socket,
      '--save',
      '',
      '--appendonly',
      'no',
      '--dir',
      directory,
    ],
    'Ready to accept connections',
  );
  const redisHttp = createServer(async (request, response) => {
    try {
      if (request.headers.authorization !== 'Bearer local-test-token') {
        response.writeHead(401);
        response.end();
        return;
      }
      const input = JSON.parse((await readBody(request)).toString());
      const encode = (command) => {
        const result = redisResult(socket, command);
        return request.headers['upstash-encoding'] === 'base64' &&
          'result' in result
          ? { result: base64Result(result.result) }
          : result;
      };
      const result =
        request.url === '/pipeline' || request.url === '/multi-exec'
          ? input.map(encode)
          : encode(input);
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(result));
    } catch {
      response.writeHead(500);
      response.end();
    }
  });
  const objects = new Map();
  const r2 = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const key = decodeURIComponent(url.pathname).replace(/^\/test\/?/, '');
    const existing = objects.get(key);
    if (request.method === 'HEAD') {
      if (!existing) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.setHeader('content-length', existing.data.length);
      response.setHeader('content-type', existing.type);
      response.setHeader('etag', '"local"');
      response.end();
      return;
    }
    if (request.method === 'DELETE') {
      objects.delete(key);
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method === 'PUT') {
      const source = request.headers['x-amz-copy-source'];
      if (source) {
        const object = objects.get(
          decodeURIComponent(source).replace(/^\/?test\//, ''),
        );
        if (!object) {
          response.writeHead(404);
          response.end();
          return;
        }
        objects.set(key, { ...object, modified: new Date() });
        response.setHeader('content-type', 'application/xml');
        response.end(
          '<CopyObjectResult><ETag>"local"</ETag><LastModified>2026-01-01T00:00:00Z</LastModified></CopyObjectResult>',
        );
        return;
      }
      if (request.headers['if-none-match'] === '*' && existing) {
        response.writeHead(412);
        response.end();
        return;
      }
      const data = await readBody(request);
      objects.set(key, {
        data,
        type: request.headers['content-type'],
        modified: new Date(),
      });
      response.setHeader('etag', '"local"');
      response.end();
      return;
    }
    if (url.searchParams.has('list-type')) {
      const prefix = url.searchParams.get('prefix') ?? '';
      const all = [...objects].filter(([name]) => name.startsWith(prefix));
      const start = Number(url.searchParams.get('continuation-token') ?? 0);
      const page = all.slice(start, start + 500);
      response.setHeader('content-type', 'application/xml');
      response.end(
        `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><IsTruncated>${start + 500 < all.length}</IsTruncated>${start + 500 < all.length ? `<NextContinuationToken>${start + 500}</NextContinuationToken>` : ''}${page.map(([name, object]) => `<Contents><Key>${escapeXml(name)}</Key><LastModified>${object.modified.toISOString()}</LastModified><Size>${object.data.length}</Size><ETag>"local"</ETag></Contents>`).join('')}</ListBucketResult>`,
      );
      return;
    }
    if (request.method === 'GET' && existing) {
      response.setHeader('content-type', existing.type);
      response.setHeader('content-length', existing.data.length);
      response.end(existing.data);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const redisUrl = await listen(redisHttp);
  const r2Url = await listen(r2);
  return {
    objects,
    redisSocket: socket,
    env: {
      DATABASE_URL: `postgres://down_up_test@127.0.0.1:${pgPort}/postgres`,
      TEST_DATABASE_URL: `postgres://down_up_test@127.0.0.1:${pgPort}/postgres`,
      UPSTASH_REDIS_REST_URL: redisUrl,
      UPSTASH_REDIS_REST_TOKEN: 'local-test-token',
      R2_ENDPOINT: r2Url,
      R2_BUCKET: 'test',
      R2_ACCESS_KEY_ID: 'test',
      R2_SECRET_ACCESS_KEY: 'test',
      SESSION_SIGNING_SECRET: 'local-test-secret-at-least-32-characters',
      CRON_SECRET: 'local-test-cron',
      APP_ORIGIN: 'http://localhost:3000',
      PRIVACY_CONTACT_EMAIL: 'test@example.invalid',
    },
    async close() {
      await Promise.all([
        new Promise((resolve) => redisHttp.close(resolve)),
        new Promise((resolve) => r2.close(resolve)),
      ]);
      await stop(redis);
      await stop(postgres);
      await rm(directory, { recursive: true, force: true });
    },
  };
}
