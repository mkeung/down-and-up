import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { generateId, generateSecret } from '../packages/shared/src/ids.ts';

const origin = new URL(process.env.DOWN_UP_STAGING_URL ?? process.argv[2])
  .origin;
if (!origin.startsWith('https://')) throw new Error('Use an HTTPS staging URL');
const token = process.env.VERCEL_OIDC_TOKEN;
if (!token) throw new Error('Run this check with vercel env run');
const id = generateId(randomBytes);
const secret = generateSecret(randomBytes);
const date = new Date().toISOString().slice(0, 10);
let registered = false;
let cookie = '';

async function request(path, { method = 'GET', body, session = false } = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      'x-vercel-trusted-oidc-idp-token': token,
      ...(session ? { Cookie: cookie } : { Authorization: `Bearer ${id}` }),
      Origin: origin,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
    redirect: 'manual',
  });
  if (!response.ok)
    throw new Error(`${method} ${path}: HTTP ${response.status}`);
  return { response, data: await response.json() };
}

try {
  await request('/api/ids/register', { method: 'POST', body: { secret } });
  registered = true;
  await request('/api/ids/register', { method: 'POST', body: { secret } });
  await request('/api/ids/verify', { method: 'POST' });
  const time = Date.now();
  const { data: synced } = await request('/api/sync', {
    method: 'POST',
    body: {
      cursor: '0',
      changes: [
        {
          date,
          value: 7,
          valueUpdatedAt: time,
          note: 'Temporary staging verification',
          noteUpdatedAt: time,
        },
      ],
    },
  });
  assert.equal(synced.applied[0].value, 7);
  assert.deepEqual(synced.missingAudio, []);
  const { response: session } = await request('/api/session', {
    method: 'POST',
  });
  cookie = session.headers.get('set-cookie').split(';')[0];
  assert.equal(cookie.includes(id), false, 'Cookie must not contain the ID');
  const { data: entries } = await request(
    `/api/entries?from=${date}&to=${date}&page=1`,
    { session: true },
  );
  assert.equal(entries.entries[0].value, 7);
  await request('/api/settings', {
    method: 'PUT',
    session: true,
    body: { reminderEnabled: true, reminderTime: '20:15' },
  });
  const { data: pull } = await request('/api/sync', {
    method: 'POST',
    body: { cursor: synced.cursor, changes: [] },
  });
  assert.equal(pull.settings.reminderTime, '20:15');
  console.log(
    'Hosted registration, value/note sync, session, and reminder checks passed.',
  );
  const audioId = randomUUID();
  const audio = await readFile(
    new URL('../tests/fixtures/silence.m4a', import.meta.url),
  );
  const { data: grant } = await request('/api/audio/upload-url', {
    method: 'POST',
    body: { audioId, size: audio.byteLength },
  });
  const uploaded = await fetch(grant.url, {
    method: 'PUT',
    headers: grant.headers,
    body: audio,
    signal: AbortSignal.timeout(120000),
  });
  assert.equal(uploaded.ok, true, 'Signed audio upload failed');
  const { data: audioSync } = await request('/api/sync', {
    method: 'POST',
    body: {
      cursor: pull.cursor,
      changes: [
        { date, audioId, audioDurationMs: 1000, audioUpdatedAt: Date.now() },
      ],
    },
  });
  assert.deepEqual(audioSync.missingAudio, []);
  assert.equal(audioSync.applied[0].audioId, audioId);
  const { data: download } = await request(`/api/audio/${audioId}`);
  const recording = await fetch(download.url, {
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(recording.ok, true);
  assert.equal((await recording.arrayBuffer()).byteLength, audio.byteLength);
  console.log(
    'Hosted registration, sync, sessions, reminder, and audio checks passed.',
  );
} finally {
  if (registered) {
    await request('/api/data', { method: 'DELETE' });
    console.log('Temporary staging profile removed.');
  }
}
