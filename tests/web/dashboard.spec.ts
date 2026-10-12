import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  addDays,
  generateId,
  generateSecret,
  todayLocal,
  uploadResponseSchema,
} from '../../packages/shared/src';

async function profile(request: APIRequestContext) {
  const id = generateId(randomBytes);
  const headers = { Authorization: `Bearer ${id}` };
  expect(
    (
      await request.post('/api/ids/register', {
        headers,
        data: { secret: generateSecret(randomBytes) },
      })
    ).status(),
  ).toBe(200);
  return { id, headers };
}
test('complete ID, history, range, hidden recording, reminder and sign-out flow', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const { id, headers } = await profile(request);
  const today = todayLocal();
  const audioId = randomUUID();
  const audio = await readFile('tests/fixtures/silence.m4a');
  const grant = await request.post('/api/audio/upload-url', {
    headers,
    data: { audioId, size: audio.length },
  });
  expect(grant.ok()).toBe(true);
  const upload = uploadResponseSchema.parse(await grant.json());
  if ('uploaded' in upload) throw new Error('Expected a new upload');
  expect(upload.url).not.toContain(id);
  expect(
    (
      await request.put(upload.url, { headers: upload.headers, data: audio })
    ).ok(),
  ).toBe(true);
  const changes = Array.from({ length: 70 }, (_, index) => ({
    date: addDays(today, -index),
    value: (index % 10) + 1,
    valueUpdatedAt: Date.now() - 1000,
    note: index === 0 ? 'A quiet walk' : null,
    noteUpdatedAt: Date.now() - 1000,
    ...(index === 0
      ? { audioId, audioDurationMs: 1000, audioUpdatedAt: Date.now() - 1000 }
      : {}),
  }));
  expect(
    (
      await request.post('/api/sync', {
        headers,
        data: { cursor: null, changes },
      })
    ).ok(),
  ).toBe(true);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Your history, here.' }),
  ).toBeVisible();
  const dashboardLoads: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/dashboard')
      dashboardLoads.push(request.url());
  });
  await page.getByLabel('Enter your ID').fill(id.toLowerCase());
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?from=/);
  await expect(
    page.getByRole('heading', { name: 'Daily values' }),
  ).toBeVisible();
  // Login goes straight to the local 30D range: one render, no refresh or redirect.
  expect(dashboardLoads).toHaveLength(1);
  expect(dashboardLoads[0]).toContain(
    `from=${addDays(today, -29)}&to=${today}`,
  );
  await expect(page.getByText('A quiet walk', { exact: true })).toBeVisible();
  expect(page.url()).not.toContain(id);
  const cookies = await page.context().cookies();
  expect(
    cookies.find((cookie) => cookie.name === 'du_session')?.value,
  ).not.toContain(id);
  expect(await page.locator('body').innerText()).not.toMatch(
    /mood|feelings|emotions/i,
  );
  await expect(
    page
      .locator('.stat')
      .filter({ hasText: 'Current streak' })
      .locator('.stat-number'),
  ).toHaveText('70');
  await page.getByRole('button', { name: '7D', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`from=${addDays(today, -6)}`));
  await expect(
    page
      .locator('.stat')
      .filter({ hasText: 'Current streak' })
      .locator('.stat-number'),
  ).toHaveText('70');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`from=${addDays(today, -69)}`));
  await page.getByRole('button', { name: '90D', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`from=${addDays(today, -89)}`));
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.getByText('Page 1', { exact: true })).toBeVisible();
  await page.getByLabel('7-day rolling average').check();
  await page.screenshot({
    path: 'test-results/dashboard-desktop.png',
    fullPage: true,
  });
  // Recording is deferred, so a synced recording is never shown.
  await expect(page.locator('audio')).toHaveCount(0);
  await expect(
    page.getByRole('columnheader', { name: 'Recording' }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'Reminder', exact: true }).click();
  await page.getByRole('switch', { name: 'Daily reminder' }).check();
  await page.getByLabel('Reminder time').fill('18:45');
  await expect(page.getByRole('status')).toHaveText('Saved');
  await page.reload();
  await expect(page.getByLabel('Reminder time')).toHaveValue('18:45');
  expect(
    (
      await request.post('/api/sync', {
        headers,
        data: { cursor: null, changes: [] },
      })
    ).ok(),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'A view over time.' }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/dashboard-mobile.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/');
  expect(errors).toEqual([]);
});
test('rejects cookie mutations without a matching Origin and invalid IDs generically', async ({
  page,
  request,
}) => {
  const { id } = await profile(request);
  await page.goto('/');
  await page.getByLabel('Enter your ID').fill('not-an-id');
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('ID not found');
  await page.getByLabel('Enter your ID').fill(id);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const response = await page.request.put('/api/settings', {
    headers: { origin: 'https://another.invalid' },
    data: { reminderEnabled: true, reminderTime: '20:00' },
  });
  expect(response.status()).toBe(403);
  const absent = await page.request.put('/api/settings', {
    data: { reminderEnabled: true, reminderTime: '20:00' },
  });
  expect(absent.status()).toBe(403);
});
test('queues removed audio and the protected cron deletes it', async ({
  request,
}) => {
  const { headers } = await profile(request);
  const audioId = randomUUID();
  const date = todayLocal();
  const audio = await readFile('tests/fixtures/silence.m4a');
  const grant = await request.post('/api/audio/upload-url', {
    headers,
    data: { audioId, size: audio.length },
  });
  const upload = await grant.json();
  expect(
    (
      await request.put(upload.url, { headers: upload.headers, data: audio })
    ).status(),
  ).toBe(200);
  const create = {
    date,
    audioId,
    audioDurationMs: 1000,
    audioUpdatedAt: Date.now() - 1000,
  };
  expect(
    (
      await request.post('/api/sync', {
        headers,
        data: { cursor: null, changes: [create] },
      })
    ).ok(),
  ).toBe(true);
  const remove = {
    date,
    audioId: null,
    audioDurationMs: null,
    audioUpdatedAt: Date.now(),
  };
  expect(
    (
      await request.post('/api/sync', {
        headers,
        data: { cursor: null, changes: [remove] },
      })
    ).ok(),
  ).toBe(true);
  expect((await request.get('/api/cron/audio-deletions')).status()).toBe(401);
  const cron = await request.get('/api/cron/audio-deletions', {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(cron.ok()).toBe(true);
  expect((await cron.json()).deleted).toBeGreaterThan(0);
  expect(
    (await request.get('/api/audio/' + audioId, { headers })).status(),
  ).toBe(404);
});
test('enforces the global failed-lookup limit in shared Redis', async ({
  request,
}) => {
  const socket = process.env.TEST_REDIS_SOCKET;
  test.skip(!socket, 'Local Redis fixture is required');
  const key = `du:failed:global:${Math.floor(Date.now() / 60_000)}`;
  execFileSync('redis-cli', ['-s', socket!, 'SET', key, '1000', 'EX', '120']);
  const response = await request.post('/api/ids/verify', {
    headers: { Authorization: 'Bearer 000000000000' },
  });
  expect(response.status()).toBe(429);
  execFileSync('redis-cli', ['-s', socket!, 'DEL', key]);
});
test('enforces the per-IP failed-lookup limit from shared Redis', async ({
  request,
}) => {
  const socket = process.env.TEST_REDIS_SOCKET;
  test.skip(!socket, 'Local Redis fixture is required');
  const key = `du:failed:${createHash('sha256').update('local').digest('hex')}`;
  execFileSync('redis-cli', ['-s', socket!, 'SET', key, '10', 'EX', '60']);
  try {
    expect(
      (
        await request.post('/api/ids/verify', {
          headers: { Authorization: 'Bearer 000000000000' },
        })
      ).status(),
    ).toBe(429);
  } finally {
    execFileSync('redis-cli', ['-s', socket!, 'DEL', key]);
  }
});
