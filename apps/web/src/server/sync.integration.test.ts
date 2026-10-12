import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { and, eq, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  currentStreakFromRuns,
  todayUTC,
  type Change,
  type ServerEntry,
} from '@down-up/shared';
import { getDb } from './db';
import { audioDeletions, entries, profiles } from './schema';
import { syncProfile } from './sync';
import { hash } from './security';
import {
  register,
  deleteData,
  drainDeletions,
  audioDeletionCron,
  audioDownload,
  audioUpload,
  orphanSweepCron,
  replaceId,
  verify,
} from './handlers';
import { queueAudio } from './sync';
import { rateLimit } from './rate-limit';
import { loadDashboardData } from './dashboard-data';

const audio = vi.hoisted(() => ({
  exists: new Set<string>(),
  invalid: new Set<string>(),
  orphans: new Set<string>(),
  failures: new Set<string>(),
}));
vi.mock('./audio', async (original) => ({
  ...(await original<typeof import('./audio')>()),
  audioHead: async (key: string) =>
    audio.exists.has(key)
      ? {
          size: 1000,
          type: audio.invalid.has(key) ? 'text/plain' : 'audio/mp4',
        }
      : null,
  copyAudio: async (_old: string, next: string) => {
    audio.exists.add(next);
  },
  deleteObject: async (key: string) => {
    if (audio.failures.has(key)) throw new Error('Storage unavailable');
    audio.exists.delete(key);
  },
  listObjects: async () => ({
    Contents: [...audio.orphans].map((Key) => ({
      Key,
      LastModified: new Date(0),
    })),
  }),
}));
const run = process.env.TEST_DATABASE_URL ? describe : describe.skip;
run('Postgres transactions and API handlers', () => {
  const id = '7K3M9QX2PDA4';
  const other = '123456789ABC';
  const date = '2026-01-01';
  const request = (
    path: string,
    identity: string,
    data: unknown = {},
    method = 'POST',
  ) =>
    new Request(`http://localhost:3000${path}`, {
      method,
      headers: {
        authorization: `Bearer ${identity}`,
        'content-type': 'application/json',
      },
      body: method === 'GET' ? undefined : JSON.stringify(data),
    });
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const journal = JSON.parse(
      await readFile(
        fileURLToPath(
          new URL('../../drizzle/meta/_journal.json', import.meta.url),
        ),
        'utf8',
      ),
    ) as { entries: { tag: string }[] };
    for (const entry of journal.entries) {
      const migration = await readFile(
        fileURLToPath(
          new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url),
        ),
        'utf8',
      );
      await getDb().execute(
        sql.raw(migration.replaceAll('--> statement-breakpoint', '')),
      );
    }
    await rateLimit(request('/api/health', id));
  });
  it('syncs 500 rows with a bounded number of SQL queries and retries without advancing seq', async () => {
    const profileId = 'PERF12345678';
    await register(
      request('/api/ids/register', profileId, { secret: 'a'.repeat(32) }),
    );
    const db = getDb();
    const transaction = db.transaction.bind(db);
    let queries = 0;
    const spy = vi
      .spyOn(db, 'transaction')
      .mockImplementation((callback, options) =>
        transaction(
          (tx) =>
            callback(
              new Proxy(tx, {
                get(target, property, receiver) {
                  const value: unknown = Reflect.get(
                    target,
                    property,
                    receiver,
                  );
                  if (
                    typeof value === 'function' &&
                    [
                      'select',
                      'insert',
                      'update',
                      'delete',
                      'execute',
                    ].includes(String(property))
                  )
                    return (...args: unknown[]) => {
                      queries++;
                      return Reflect.apply(value, target, args);
                    };
                  return value;
                },
              }),
            ),
          options,
        ),
      );
    try {
      const changes = Array.from({ length: 500 }, (_, index) => ({
        date: addDays('2020-01-01', index),
        value: (index % 10) + 1,
        valueUpdatedAt: 100,
      }));
      const first = await syncProfile(
        profileId,
        { cursor: null, changes },
        1000,
      );
      expect(queries).toBe(8);
      expect(first.applied).toHaveLength(500);
      expect(first.cursor).toBe('500');
      expect(first.applied.map((row) => row.serverSeq)).toEqual(
        changes.map((_, index) => String(index + 1)),
      );
      queries = 0;
      const retry = await syncProfile(
        profileId,
        { cursor: null, changes },
        1000,
      );
      expect(queries).toBe(7);
      expect(retry).toEqual(first);
    } finally {
      spy.mockRestore();
    }
  });
  it('merges repeated dates in request order and remembers clamped receipts within the batch', async () => {
    const profileId = 'PERF22345678';
    await register(
      request('/api/ids/register', profileId, { secret: 'a'.repeat(32) }),
    );
    const fast = { date, value: 3, valueUpdatedAt: 900_000 };
    const result = await syncProfile(
      profileId,
      {
        cursor: null,
        changes: [
          fast,
          { date, note: 'kept', noteUpdatedAt: 1200 },
          { date, value: 8, valueUpdatedAt: 1500 },
          fast,
        ],
      },
      1000,
    );
    expect(result.applied.map((row) => row.serverSeq)).toEqual([
      '1',
      '2',
      '3',
      '3',
    ]);
    expect(result.changes[0]).toMatchObject({
      value: 8,
      note: 'kept',
      serverSeq: '3',
    });
    const retry = await syncProfile(
      profileId,
      { cursor: result.cursor, changes: [fast] },
      2000,
    );
    expect(retry.applied[0]).toMatchObject({
      value: 8,
      note: 'kept',
      serverSeq: '3',
    });
    expect(retry.changes).toEqual([]);
  });
  it('queues intermediate audio replacements and retains the final reference in a bulk write', async () => {
    const profileId = 'PERF32345678';
    await register(
      request('/api/ids/register', profileId, { secret: 'a'.repeat(32) }),
    );
    const a = '11111111-1111-4111-8111-111111111111';
    const b = '22222222-2222-4222-8222-222222222222';
    for (const audioId of [a, b])
      audio.exists.add(`audio/${hash(profileId)}/${audioId}.m4a`);
    const result = await syncProfile(
      profileId,
      {
        cursor: null,
        changes: [a, b, a].map((audioId, index) => ({
          date,
          audioId,
          audioDurationMs: 1000,
          audioUpdatedAt: 100 + index,
        })),
      },
      1000,
    );
    expect(result.changes[0]?.audioId).toBe(a);
    const queued = await getDb()
      .select()
      .from(audioDeletions)
      .where(eq(audioDeletions.namespace, hash(profileId)));
    expect(queued.map((row) => row.objectKey)).toEqual([
      `audio/${hash(profileId)}/${b}.m4a`,
    ]);
    expect(await drainDeletions()).toBe(1);
  });
  it('loads only the chart range and lookback while keeping lifetime All and streak metadata', async () => {
    const profileId = 'PERF42345678';
    await register(
      request('/api/ids/register', profileId, { secret: 'a'.repeat(32) }),
    );
    const today = todayUTC();
    await syncProfile(
      profileId,
      {
        cursor: null,
        changes: [
          { date: '2000-01-01', note: 'old note', noteUpdatedAt: 100 },
          ...Array.from({ length: 14 }, (_, index) => ({
            date: addDays(today, 1 - index),
            value: 5,
            valueUpdatedAt: 100,
          })),
        ],
      },
      1000,
    );
    const result = await loadDashboardData(
      profileId,
      addDays(today, -2),
      today,
    );
    expect(result.firstDate).toBe('2000-01-01');
    expect(result.history).toHaveLength(9);
    expect(result.history[0]?.date).toBe(addDays(today, -8));
    expect(result.history.at(-1)?.date).toBe(today);
    expect(result.rows).toHaveLength(3);
    expect(currentStreakFromRuns(result.streakRuns, today)).toBe(13);
    expect(currentStreakFromRuns(result.streakRuns, addDays(today, -1))).toBe(
      12,
    );
    expect(currentStreakFromRuns(result.streakRuns, addDays(today, 1))).toBe(
      14,
    );
    const empty = await loadDashboardData(
      profileId,
      '1999-01-01',
      '1999-01-07',
    );
    expect(empty.history).toEqual([]);
    expect(empty.firstDate).toBe('2000-01-01');
    expect(currentStreakFromRuns(empty.streakRuns, today)).toBe(13);
  });
  it('registers idempotently and returns 409 for a different secret', async () => {
    expect(
      (
        await register(
          request('/api/ids/register', id, { secret: 'a'.repeat(32) }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await register(
          request('/api/ids/register', id, { secret: 'a'.repeat(32) }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await register(
          request('/api/ids/register', id, { secret: 'b'.repeat(32) }),
        )
      ).status,
    ).toBe(409);
    expect((await verify(request('/api/ids/verify', id))).status).toBe(200);
  });
  it('serializes racing requests, changes seq on updates, and preserves independent fields', async () => {
    const [a, b] = await Promise.all([
      syncProfile(
        id,
        { cursor: null, changes: [{ date, value: 7, valueUpdatedAt: 100 }] },
        1000,
      ),
      syncProfile(
        id,
        {
          cursor: null,
          changes: [{ date, note: 'other phone', noteUpdatedAt: 200 }],
        },
        1000,
      ),
    ]);
    const final = await syncProfile(id, { cursor: null, changes: [] });
    expect(final.changes[0]?.value).toBe(7);
    expect(final.changes[0]?.note).toBe('other phone');
    expect(final.changes[0]?.serverSeq).toBe('2');
    const update = await syncProfile(
      id,
      { cursor: '2', changes: [{ date, value: 8, valueUpdatedAt: 300 }] },
      1000,
    );
    expect(update.changes[0]?.serverSeq).toBe('3');
    expect([a.cursor, b.cursor]).toContain('1');
  });
  it('is idempotent after a lost response and refuses null value replacement', async () => {
    const change = { date, value: 9, valueUpdatedAt: 400 };
    const first = await syncProfile(
      id,
      { cursor: '3', changes: [change] },
      1000,
    );
    const retry = await syncProfile(
      id,
      { cursor: '3', changes: [change] },
      1000,
    );
    expect(retry).toEqual(first);
    const remove = await syncProfile(
      id,
      {
        cursor: first.cursor,
        changes: [{ date, value: null, valueUpdatedAt: 500 }],
      },
      1000,
    );
    expect(remove.applied[0]?.value).toBe(9);
    expect(remove.applied[0]?.serverSeq).toBe('4');
  });
  it('clamps fast clocks, checks missing audio, and still accepts the note', async () => {
    const audioId = 'b68d4f5e-4168-4d8b-ae7e-3c4df743364c';
    const result = await syncProfile(
      id,
      {
        cursor: null,
        changes: [
          {
            date,
            value: 3,
            valueUpdatedAt: 900_000,
            note: 'kept',
            noteUpdatedAt: 600,
            audioId,
            audioDurationMs: 1000,
            audioUpdatedAt: 700,
          },
        ],
      },
      1000,
    );
    expect(result.applied[0]?.valueUpdatedAt).toBe(1000);
    expect(result.applied[0]?.note).toBe('kept');
    expect(result.missingAudio).toEqual([audioId]);
    expect(result.applied[0]?.audioId).toBeNull();
    audio.exists.add(`audio/${hash(id)}/${audioId}.m4a`);
    const uploaded = await syncProfile(
      id,
      {
        cursor: result.cursor,
        changes: [
          { date, audioId, audioDurationMs: 1000, audioUpdatedAt: 700 },
        ],
      },
      1000,
    );
    expect(uploaded.applied[0]?.audioId).toBe(audioId);
  });
  it('never skips rows across pagination when an earlier row changes', async () => {
    await register(
      request('/api/ids/register', other, { secret: 'c'.repeat(32) }),
    );
    const changes: Change[] = Array.from({ length: 1100 }, (_, index) => ({
      date: addDays('2020-01-01', index),
      value: (index % 10) + 1,
      valueUpdatedAt: 100,
    }));
    for (let offset = 0; offset < changes.length; offset += 500)
      await syncProfile(
        other,
        { cursor: null, changes: changes.slice(offset, offset + 500) },
        1000,
      );
    const first = await syncProfile(other, { cursor: null, changes: [] });
    expect(first.changes).toHaveLength(500);
    expect(first.hasMore).toBe(true);
    await syncProfile(
      other,
      {
        cursor: first.cursor,
        changes: [
          {
            date: changes[0]!.date,
            note: 'updated between pages',
            noteUpdatedAt: 200,
          },
        ],
      },
      1000,
    );
    let cursor = first.cursor;
    let more = true;
    const received = new Map<string, ServerEntry>(
      first.changes.map((row) => [row.date, row]),
    );
    while (more) {
      const page = await syncProfile(other, { cursor, changes: [] });
      for (const row of page.changes) received.set(row.date, row);
      cursor = page.cursor;
      more = page.hasMore;
    }
    expect(received.size).toBe(1100);
    expect(received.get(changes[0]!.date)?.note).toBe('updated between pages');
    expect(cursor).toBe('1101');
  });
  it('keeps future-clock retries idempotent after the server clock advances', async () => {
    const replayDate = '2026-01-02';
    const future: Change = {
      date: replayDate,
      value: 2,
      valueUpdatedAt: 10_000_000,
    };
    await syncProfile(id, { cursor: null, changes: [future] }, 1000);
    const newer = await syncProfile(
      id,
      {
        cursor: null,
        changes: [{ date: replayDate, value: 8, valueUpdatedAt: 2000 }],
      },
      3000,
    );
    const retried = await syncProfile(
      id,
      { cursor: newer.cursor, changes: [future] },
      5000,
    );
    expect(retried.applied[0]?.value).toBe(8);
    expect(retried.applied[0]?.valueUpdatedAt).toBe(2000);
    expect(retried.applied[0]?.serverSeq).toBe(newer.applied[0]?.serverSeq);
  });
  it('rechecks references before draining a stale audio deletion', async () => {
    const audioId = 'b68d4f5e-4168-4d8b-ae7e-3c4df743364c';
    await getDb().transaction((tx) => queueAudio(tx, id, audioId));
    expect(await drainDeletions()).toBe(0);
    expect(audio.exists.has(`audio/${hash(id)}/${audioId}.m4a`)).toBe(true);
  });
  it('rotates an ID, invalidates the old one, and retries a lost rotation response', async () => {
    const operationId = '11111111-1111-4111-8111-111111111111';
    const first = await replaceId(
      request('/api/ids/replace', id, { operationId }),
    );
    expect(first.status).toBe(200);
    const identity = await first.json();
    expect(identity.id).not.toBe(id);
    expect(identity.registered).toBe(true);
    const retry = await replaceId(
      request('/api/ids/replace', id, { operationId }),
    );
    expect(await retry.json()).toEqual(identity);
    expect((await verify(request('/api/ids/verify', id))).status).toBe(401);
    expect((await verify(request('/api/ids/verify', identity.id))).status).toBe(
      200,
    );
    const [row] = await getDb()
      .select()
      .from(entries)
      .where(and(eq(entries.profileId, identity.id), eq(entries.date, date)));
    expect(row?.value).toBe(3);
  });
  it('deletes the profile and all entries in one transaction', async () => {
    // DELETE uses bearer authentication; no browser Origin is required for this mobile path.
    const result = await deleteData(
      request('/api/data', other, undefined, 'DELETE'),
    );
    expect(result.status).toBe(200);
    expect(
      await getDb().select().from(entries).where(eq(entries.profileId, other)),
    ).toEqual([]);
    expect(
      await getDb().select().from(profiles).where(eq(profiles.id, other)),
    ).toEqual([]);
  });
  it('uses a lowercase object key throughout upload, sync, download, and deletion', async () => {
    await drainDeletions();
    const identity = '23456789ABCD';
    const audioId = 'B68D4F5E-4168-4D8B-AE7E-3C4DF743364C';
    const key = `audio/${hash(identity)}/${audioId.toLowerCase()}.m4a`;
    await register(
      request('/api/ids/register', identity, { secret: 'd'.repeat(32) }),
    );
    const grant = await audioUpload(
      request('/api/audio/upload-url', identity, { audioId, size: 1000 }),
    );
    expect(grant.status).toBe(200);
    expect(new URL((await grant.json()).url).pathname).toContain(key);
    audio.exists.add(key);
    const synced = await syncProfile(
      identity,
      {
        cursor: null,
        changes: [
          { date, audioId, audioDurationMs: 1000, audioUpdatedAt: 100 },
        ],
      },
      1000,
    );
    expect(synced.missingAudio).toEqual([]);
    expect(synced.applied[0]?.audioId).toBe(audioId.toLowerCase());
    const download = await audioDownload(
      request(`/api/audio/${audioId}`, identity, undefined, 'GET'),
    );
    expect(download.status).toBe(302);
    expect(new URL(download.headers.get('location')!).pathname).toContain(key);
    await deleteData(request('/api/data', identity, undefined, 'DELETE'));
    expect(await drainDeletions()).toBe(1);
    expect(audio.exists.has(key)).toBe(false);
  });
  it('repairs missing referenced objects without granting overwrites of existing objects', async () => {
    const identity = '3456789ABCDE';
    const audioId = 'b68d4f5e-4168-4d8b-ae7e-3c4df743364c';
    const key = `audio/${hash(identity)}/${audioId}.m4a`;
    await register(
      request('/api/ids/register', identity, { secret: 'e'.repeat(32) }),
    );
    audio.exists.add(key);
    await syncProfile(
      identity,
      {
        cursor: null,
        changes: [
          { date, audioId, audioDurationMs: 1000, audioUpdatedAt: 100 },
        ],
      },
      1000,
    );
    audio.exists.delete(key);
    const changes = [
      { date, audioId, audioDurationMs: 1000, audioUpdatedAt: 200 },
    ];
    expect(
      (await syncProfile(identity, { cursor: null, changes }, 1000))
        .missingAudio,
    ).toEqual([audioId]);
    const grant = await audioUpload(
      request('/api/audio/upload-url', identity, { audioId, size: 1000 }),
    );
    expect(grant.status).toBe(200);
    expect((await grant.json()).headers['If-None-Match']).toBe('*');
    audio.exists.add(key);
    const repaired = await syncProfile(
      identity,
      { cursor: null, changes },
      1000,
    );
    expect(repaired.missingAudio).toEqual([]);
    expect(repaired.applied[0]?.audioUpdatedAt).toBe(200);
    const existing = await audioUpload(
      request('/api/audio/upload-url', identity, { audioId, size: 1000 }),
    );
    expect(await existing.json()).toEqual({ uploaded: true });
    audio.invalid.add(key);
    expect(
      (
        await audioUpload(
          request('/api/audio/upload-url', identity, { audioId, size: 1000 }),
        )
      ).status,
    ).toBe(409);
    audio.invalid.delete(key);
    await deleteData(request('/api/data', identity, undefined, 'DELETE'));
    await drainDeletions();
  });
  it('sweeps legacy uppercase object keys and retains referenced recordings', async () => {
    const identity = '456789ABCDEF';
    const audioId = 'B68D4F5E-4168-4D8B-AE7E-3C4DF743364C';
    const key = `audio/${hash(identity)}/${audioId}.m4a`;
    await register(
      request('/api/ids/register', identity, { secret: 'f'.repeat(32) }),
    );
    audio.exists.add(key.toLowerCase());
    await syncProfile(
      identity,
      {
        cursor: null,
        changes: [
          {
            date,
            audioId: audioId.toLowerCase(),
            audioDurationMs: 1000,
            audioUpdatedAt: 100,
          },
        ],
      },
      1000,
    );
    audio.exists.add(key);
    audio.orphans.add(key);
    const cron = new Request('http://localhost:3000/api/cron/orphan-sweep', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(await (await orphanSweepCron(cron)).json()).toEqual({
      queued: 0,
      deleted: 0,
    });
    await deleteData(request('/api/data', identity, undefined, 'DELETE'));
    expect(await (await orphanSweepCron(cron)).json()).toEqual({
      queued: 1,
      deleted: 2,
    });
    expect(audio.exists.has(key)).toBe(false);
    audio.orphans.clear();
  });
  it('drains more than two batches in one cron run, preserves future jobs, and retries storage failures', async () => {
    const namespace = 'a'.repeat(64);
    const jobs = Array.from({ length: 1001 }, (_, index) => ({
      namespace,
      objectKey: `audio/${namespace}/00000000-0000-4000-8000-${index.toString().padStart(12, '0')}.m4a`,
      deleteAfter: new Date(0),
    }));
    const future = {
      ...jobs[0]!,
      objectKey: `audio/${namespace}/ffffffff-ffff-4fff-8fff-ffffffffffff.m4a`,
      deleteAfter: new Date(Date.now() + 60_000),
    };
    for (const job of [...jobs, future]) audio.exists.add(job.objectKey);
    await getDb()
      .insert(audioDeletions)
      .values([...jobs, future]);
    const cron = new Request('http://localhost:3000/api/cron/audio-deletions', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const result = await audioDeletionCron(cron);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ deleted: 1001 });
    expect(jobs.some((job) => audio.exists.has(job.objectKey))).toBe(false);
    expect(audio.exists.has(future.objectKey)).toBe(true);
    expect(await getDb().select().from(audioDeletions)).toEqual([future]);
    await getDb()
      .update(audioDeletions)
      .set({ deleteAfter: new Date(0) })
      .where(eq(audioDeletions.objectKey, future.objectKey));
    audio.failures.add(future.objectKey);
    expect((await audioDeletionCron(cron)).status).toBe(503);
    expect(await getDb().select().from(audioDeletions)).toHaveLength(1);
    audio.failures.clear();
    expect(await (await audioDeletionCron(cron)).json()).toEqual({
      deleted: 1,
    });
    expect(await getDb().select().from(audioDeletions)).toEqual([]);
  });
});
