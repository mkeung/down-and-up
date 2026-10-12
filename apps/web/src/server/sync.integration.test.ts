import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { and, eq, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { addDays, type Change, type ServerEntry } from '@down-up/shared';
import { getDb } from './db';
import { entries, profiles } from './schema';
import { syncProfile } from './sync';
import { hash } from './security';
import {
  register,
  deleteData,
  drainDeletions,
  replaceId,
  verify,
} from './handlers';
import { queueAudio } from './sync';
import { rateLimit } from './rate-limit';

const audio = vi.hoisted(() => ({ exists: new Set<string>() }));
vi.mock('./audio', async (original) => ({
  ...(await original<typeof import('./audio')>()),
  audioHead: async (key: string) =>
    audio.exists.has(key) ? { size: 1000, type: 'audio/mp4' } : null,
  copyAudio: async (_old: string, next: string) => {
    audio.exists.add(next);
  },
  deleteObject: async (key: string) => {
    audio.exists.delete(key);
  },
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
});
