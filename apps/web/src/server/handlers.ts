import { randomBytes } from 'node:crypto';
import { and, asc, eq, gt, isNotNull, lt, lte, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  audioIdSchema,
  dateSchema,
  generateId,
  generateSecret,
  registerSchema,
  replaceSchema,
  serverSyncRequestSchema,
  settingsSchema,
  uploadSchema,
  type Identity,
} from '@down-up/shared';
import {
  authenticate,
  authenticateWithBody,
  assertOrigin,
  bearerId,
  COOKIE_NAME,
  lookupFailure,
  rawBearer,
  sessionProfile,
} from './auth';
import {
  audioHead,
  audioKey,
  copyAudio,
  deleteObject,
  downloadUrl,
  listObjects,
  uploadUrl,
  validAudio,
} from './audio';
import { getDb } from './db';
import { appOrigin, requiredEnv } from './env';
import { body, HttpError, json, route } from './http';
import { failedLookup, rateLimit } from './rate-limit';
import {
  audioDeletions,
  clampedWrites,
  entries,
  profiles,
  replacementReceipts,
  sessions,
  settings,
} from './schema';
import {
  constantEqual,
  hash,
  openIdentity,
  sealIdentity,
  signSession,
  verifySession,
} from './security';
import { lockNamespace, lockProfile, serialize, syncProfile } from './sync';
import type { Transaction } from './db';
const COPY_CONCURRENCY = 16;
// Queues every recording a profile references, in one statement. Keys match
// audioKey(): audio/<namespace>/<lowercase audio ID>.m4a.
async function queueProfileAudio(tx: Transaction, id: string) {
  const namespace = hash(id);
  await tx.execute(sql`
    INSERT INTO ${audioDeletions}
      (${sql.identifier(audioDeletions.objectKey.name)},
       ${sql.identifier(audioDeletions.namespace.name)},
       ${sql.identifier(audioDeletions.deleteAfter.name)})
    SELECT ${`audio/${namespace}/`} || lower(${entries.audioId}::text) || '.m4a',
      ${namespace}, ${new Date().toISOString()}::timestamptz
    FROM ${entries}
    WHERE ${entries.profileId} = ${id} AND ${entries.audioId} IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
}

export const register = route(async (request) => {
  const id = await bearerId(request);
  const input = await body(request, registerSchema);
  await getDb().transaction(async (tx) => {
    await lockNamespace(tx, hash(id));
    const [existing] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.id, id))
      .for('update');
    if (existing) {
      if (!constantEqual(existing.secretHash, hash(input.secret)))
        return failedLookup(request, 409, 'ID unavailable');
    } else {
      await tx.insert(profiles).values({
        id,
        secretHash: hash(input.secret),
        audioNamespace: hash(id),
      });
      await tx.insert(settings).values({ profileId: id });
    }
  });
  return json({ registered: true });
});
export const verify = route(async (request) => {
  await authenticate(request, { bearerOnly: true });
  return json({ exists: true });
});
export const sync = route(async (request) => {
  // The profile lookup happens under the sync lock instead of separately.
  const { id, input } = await authenticateWithBody(
    request,
    serverSyncRequestSchema(),
    { bearerOnly: true, deferLookup: true },
  );
  try {
    return json(await syncProfile(id, input));
  } catch (error) {
    return lookupFailure(request, error);
  }
});
export const createSession = route(async (request) => {
  assertOrigin(request);
  const { id } = await authenticate(request, {
    bearerOnly: true,
    deferLookup: true,
  });
  const sessionId = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);
  await getDb()
    .transaction(async (tx) => {
      await lockProfile(tx, id);
      await tx
        .insert(sessions)
        .values({ id: sessionId, profileId: id, expiresAt });
    })
    .catch((error: unknown) => lookupFailure(request, error));
  const response = json({ ok: true });
  response.cookies.set(COOKIE_NAME, signSession(sessionId), {
    httpOnly: true,
    secure: appOrigin().startsWith('https:'),
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
  return response;
});
export const deleteSession = route(async (request) => {
  assertOrigin(request);
  await rateLimit(request);
  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  const session = cookie ? verifySession(cookie) : null;
  if (session) await getDb().delete(sessions).where(eq(sessions.id, session));
  const response = json({ ok: true });
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: appOrigin().startsWith('https:'),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
});
export const getSettings = route(async (request) => {
  const { id } = await authenticate(request, { sessionOnly: true });
  const [config] = await getDb()
    .select({
      reminderEnabled: settings.reminderEnabled,
      reminderTime: settings.reminderTime,
    })
    .from(settings)
    .where(eq(settings.profileId, id));
  return json(config);
});
export const putSettings = route(async (request) => {
  const { id, input } = await authenticateWithBody(request, settingsSchema, {
    sessionOnly: true,
  });
  await getDb().transaction(async (tx) => {
    await lockProfile(tx, id);
    await tx
      .update(settings)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(settings.profileId, id));
  });
  return json(input);
});
export const getEntries = route(async (request) => {
  const { id } = await authenticate(request, { sessionOnly: true });
  const search = new URL(request.url).searchParams;
  const parsed = z
    .object({
      from: dateSchema,
      to: dateSchema,
      page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    })
    .safeParse({
      from: search.get('from'),
      to: search.get('to'),
      ...(search.has('page') ? { page: search.get('page') } : {}),
    });
  if (!parsed.success || parsed.data.from > parsed.data.to)
    throw new HttpError(400, 'Choose a valid range');
  const { from, to, page } = parsed.data;
  const rows = await getDb()
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.profileId, id),
        sql`${entries.date} BETWEEN ${from}::date AND ${to}::date`,
      ),
    )
    .orderBy(sql`${entries.date} DESC`)
    .limit(51)
    .offset((page - 1) * 50);
  return json({
    entries: rows.slice(0, 50).map(serialize),
    hasMore: rows.length > 50,
  });
});
export const audioUpload = route(async (request) => {
  const { id, input } = await authenticateWithBody(request, uploadSchema, {
    bearerOnly: true,
  });
  // No profile lock: this answer is advisory. Sync HEADs the object again under
  // the lock before accepting audio fields, and the signed If-None-Match
  // prevents overwrites. A grant that races ID replacement or deletion can only
  // leave an unreferenced object, which the orphan sweep removes; holding the
  // lock here never prevented that, because the upload happens after it.
  const key = audioKey(id, input.audioId);
  const head = await audioHead(key);
  if (validAudio(head)) return json({ uploaded: true });
  if (head) throw new HttpError(409, 'Recording is unavailable');
  // Missing referenced files can be repaired; the signed If-None-Match prevents overwrites.
  return json(await uploadUrl(key, input.size));
});
export const audioDownload = route(async (request) => {
  const { id } = await authenticate(request);
  const audioId = new URL(request.url).pathname.split('/').at(-1);
  const parsed = audioIdSchema.safeParse(audioId);
  if (!parsed.success) throw new HttpError(404, 'Recording not found');
  return getDb().transaction(async (tx) => {
    await lockProfile(tx, id);
    const [reference] = await tx
      .select({ date: entries.date })
      .from(entries)
      .where(and(eq(entries.profileId, id), eq(entries.audioId, parsed.data)))
      .limit(1);
    if (!reference) throw new HttpError(404, 'Recording not found');
    const url = await downloadUrl(audioKey(id, parsed.data));
    if (request.headers.get('accept')?.includes('application/json'))
      return json({ url });
    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  });
});
export const deleteData = route(async (request) => {
  const { id } = await authenticate(request);
  await getDb().transaction(async (tx) => {
    await lockProfile(tx, id);
    await queueProfileAudio(tx, id);
    await tx.delete(profiles).where(eq(profiles.id, id));
  });
  const response = json({ deleted: true });
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: appOrigin().startsWith('https:'),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
});
export const replaceId = route(async (request) => {
  const id = await bearerId(request);
  const input = await body(request, replaceSchema);
  const identity = await getDb().transaction(async (tx) => {
    await lockNamespace(tx, hash(id));
    const [receipt] = await tx
      .select()
      .from(replacementReceipts)
      .where(
        and(
          eq(replacementReceipts.oldIdHash, hash(id)),
          eq(replacementReceipts.operationId, input.operationId),
          gt(replacementReceipts.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (receipt) {
      const restored = openIdentity(receipt.sealedIdentity);
      const [active] = await tx
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, restored.id))
        .limit(1);
      if (!active) throw new HttpError(401, 'ID not found');
      return restored;
    }
    const [profile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.id, id))
      .for('update');
    if (!profile) return failedLookup(request);
    let next: Identity;
    for (;;) {
      next = {
        id: generateId(randomBytes),
        secret: generateSecret(randomBytes),
        registered: true,
      };
      const [collision] = await tx
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, next.id))
        .limit(1);
      if (!collision) break;
    }
    // The random new namespace has no live owner. Registration for it waits on this advisory lock.
    await lockNamespace(tx, hash(next.id));
    // Copies stay under the lock: the recording list must be complete (a
    // concurrent sync could add one), the new ID is only chosen here, and
    // copying earlier would strand objects whenever this transaction fails or
    // is a retry. Copies finish before any row moves.
    const recordings = await tx
      .select({ audioId: entries.audioId })
      .from(entries)
      .where(and(eq(entries.profileId, id), isNotNull(entries.audioId)));
    let nextCopy = 0;
    await Promise.all(
      Array.from(
        { length: Math.min(COPY_CONCURRENCY, recordings.length) },
        async () => {
          while (nextCopy < recordings.length) {
            const { audioId } = recordings[nextCopy++]!;
            await copyAudio(
              audioKey(id, audioId!),
              audioKey(next.id, audioId!),
            );
          }
        },
      ),
    );
    await queueProfileAudio(tx, id);
    await tx.insert(profiles).values({
      id: next.id,
      secretHash: hash(next.secret!),
      audioNamespace: hash(next.id),
      seq: 0n,
      createdAt: profile.createdAt,
      lastSeen: new Date(),
    });
    // Move every row in one statement, renumbering server_seq 1..n in the old
    // order, and leave the new profile's seq equal to the highest assigned.
    await tx.execute(sql`
      WITH numbered AS (
        SELECT ${entries.date} AS date,
          row_number() OVER (ORDER BY ${entries.serverSeq}, ${entries.date}) AS seq
        FROM ${entries} WHERE ${entries.profileId} = ${id}
      ), moved AS (
        UPDATE ${entries}
        SET ${sql.identifier(entries.profileId.name)} = ${next.id},
          ${sql.identifier(entries.serverSeq.name)} = numbered.seq
        FROM numbered
        WHERE ${entries.profileId} = ${id} AND ${entries.date} = numbered.date
        RETURNING numbered.seq
      )
      UPDATE ${profiles}
      SET ${sql.identifier(profiles.seq.name)} = (SELECT coalesce(max(seq), 0) FROM moved)
      WHERE ${profiles.id} = ${next.id}
    `);
    await tx
      .update(clampedWrites)
      .set({ profileId: next.id })
      .where(eq(clampedWrites.profileId, id));
    await tx
      .update(settings)
      .set({ profileId: next.id })
      .where(eq(settings.profileId, id));
    await tx.delete(profiles).where(eq(profiles.id, id));
    await tx.insert(replacementReceipts).values({
      oldIdHash: hash(id),
      operationId: input.operationId,
      sealedIdentity: sealIdentity(next),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
    return next;
  });
  return json(identity);
});

function assertCron(request: Request) {
  const expected = `Bearer ${requiredEnv('CRON_SECRET')}`;
  if (!constantEqual(request.headers.get('authorization') ?? '', expected))
    throw new HttpError(401);
}
export async function drainDeletions(): Promise<number> {
  const dueBefore = new Date();
  let deleted = 0;
  for (;;) {
    const pending = await getDb()
      .select()
      .from(audioDeletions)
      .where(lte(audioDeletions.deleteAfter, dueBefore))
      .orderBy(asc(audioDeletions.deleteAfter))
      .limit(500);
    if (!pending.length) return deleted;
    for (const item of pending) {
      await getDb().transaction(async (tx) => {
        await lockNamespace(tx, item.namespace);
        const [queued] = await tx
          .select()
          .from(audioDeletions)
          .where(eq(audioDeletions.objectKey, item.objectKey))
          .for('update');
        if (!queued || queued.deleteAfter > dueBefore) return;
        const [profile] = await tx
          .select()
          .from(profiles)
          .where(eq(profiles.audioNamespace, item.namespace))
          .for('update');
        const match = /\/([0-9a-f-]{36})\.m4a$/i.exec(item.objectKey);
        if (!match) {
          await tx
            .delete(audioDeletions)
            .where(eq(audioDeletions.objectKey, item.objectKey));
          return;
        }
        const [referenced] = profile
          ? await tx
              .select({ date: entries.date })
              .from(entries)
              .where(
                and(
                  eq(entries.profileId, profile.id),
                  eq(entries.audioId, match[1]!),
                ),
              )
              .limit(1)
          : [];
        if (!referenced) {
          await deleteObject(item.objectKey);
          deleted++;
        }
        await tx
          .delete(audioDeletions)
          .where(eq(audioDeletions.objectKey, item.objectKey));
      });
    }
  }
}
export const audioDeletionCron = route(async (request) => {
  assertCron(request);
  const deleted = await drainDeletions();
  await getDb().delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await getDb()
    .delete(replacementReceipts)
    .where(lt(replacementReceipts.expiresAt, new Date()));
  return json({ deleted });
});
export const orphanSweepCron = route(async (request) => {
  assertCron(request);
  let token: string | undefined;
  let queued = 0;
  const cutoff = Date.now() - 24 * 60 * 60_000;
  do {
    const page = await listObjects(token);
    for (const object of page.Contents ?? []) {
      if (
        !object.Key ||
        !object.LastModified ||
        object.LastModified.getTime() > cutoff
      )
        continue;
      const match = /^audio\/([0-9a-f]{64})\/([0-9a-f-]{36})\.m4a$/i.exec(
        object.Key,
      );
      if (!match) continue;
      await getDb().transaction(async (tx) => {
        await lockNamespace(tx, match[1]!);
        const [profile] = await tx
          .select()
          .from(profiles)
          .where(eq(profiles.audioNamespace, match[1]!))
          .for('update');
        const [reference] = profile
          ? await tx
              .select({ date: entries.date })
              .from(entries)
              .where(
                and(
                  eq(entries.profileId, profile.id),
                  eq(entries.audioId, match[2]!),
                ),
              )
              .limit(1)
          : [];
        if (!reference) {
          await tx
            .insert(audioDeletions)
            .values({
              objectKey: object.Key!,
              namespace: match[1]!,
              deleteAfter: new Date(),
            })
            .onConflictDoNothing();
          queued++;
        }
      });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  const deleted = await drainDeletions();
  return json({ queued, deleted });
});
export const health = route(async () => {
  if (!process.env.DATABASE_URL)
    throw new HttpError(503, 'Server is not configured');
  await getDb().execute(sql`SELECT 1`);
  return json({ ok: true });
});

export async function dashboardData(id: string, from: string, to: string) {
  const rows = await getDb()
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.profileId, id),
        sql`${entries.date} BETWEEN ${from}::date AND ${to}::date`,
      ),
    )
    .orderBy(asc(entries.date));
  return rows.map(serialize);
}
export { rawBearer, sessionProfile, NextResponse };
