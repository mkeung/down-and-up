import { randomBytes } from 'node:crypto';
import { and, asc, eq, gt, isNotNull, lt, lte, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
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
  assertOrigin,
  bearerId,
  COOKIE_NAME,
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
import {
  lockNamespace,
  lockProfile,
  queueAudio,
  serialize,
  syncProfile,
} from './sync';

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
  const { id } = await authenticate(request, { bearerOnly: true });
  return json(
    await syncProfile(id, await body(request, serverSyncRequestSchema())),
  );
});
export const createSession = route(async (request) => {
  assertOrigin(request);
  const { id } = await authenticate(request, { bearerOnly: true });
  const sessionId = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);
  await getDb().transaction(async (tx) => {
    await lockProfile(tx, id);
    await tx
      .insert(sessions)
      .values({ id: sessionId, profileId: id, expiresAt });
  });
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
  const { id } = await authenticate(request, { sessionOnly: true });
  const input = await body(request, settingsSchema);
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
  const { id } = await authenticate(request, { bearerOnly: true });
  const input = await body(request, uploadSchema);
  return getDb().transaction(async (tx) => {
    await lockProfile(tx, id);
    const key = audioKey(id, input.audioId);
    const head = await audioHead(key);
    if (validAudio(head)) return json({ uploaded: true });
    const [reference] = await tx
      .select({ date: entries.date })
      .from(entries)
      .where(and(eq(entries.profileId, id), eq(entries.audioId, input.audioId)))
      .limit(1);
    if (reference) throw new HttpError(409, 'Recording is unavailable');
    if (head) throw new HttpError(409, 'Recording is unavailable');
    return json(await uploadUrl(key, input.size));
  });
});
export const audioDownload = route(async (request) => {
  const { id } = await authenticate(request);
  const audioId = new URL(request.url).pathname.split('/').at(-1);
  const parsed = z.uuid().safeParse(audioId);
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
    const recordings = await tx
      .select({ audioId: entries.audioId })
      .from(entries)
      .where(and(eq(entries.profileId, id), isNotNull(entries.audioId)));
    for (const recording of recordings)
      await queueAudio(tx, id, recording.audioId!);
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
    const recordings = await tx
      .select({ audioId: entries.audioId })
      .from(entries)
      .where(and(eq(entries.profileId, id), isNotNull(entries.audioId)));
    for (let offset = 0; offset < recordings.length; offset += 10)
      await Promise.all(
        recordings.slice(offset, offset + 10).map(async ({ audioId }) => {
          await copyAudio(audioKey(id, audioId!), audioKey(next.id, audioId!));
          await queueAudio(tx, id, audioId!);
        }),
      );
    await tx.insert(profiles).values({
      id: next.id,
      secretHash: hash(next.secret!),
      audioNamespace: hash(next.id),
      seq: 0n,
      createdAt: profile.createdAt,
      lastSeen: new Date(),
    });
    const moving = await tx
      .select({ date: entries.date })
      .from(entries)
      .where(eq(entries.profileId, id))
      .orderBy(asc(entries.serverSeq));
    let sequence = 0n;
    for (const row of moving)
      await tx
        .update(entries)
        .set({ profileId: next.id, serverSeq: ++sequence })
        .where(and(eq(entries.profileId, id), eq(entries.date, row.date)));
    await tx
      .update(profiles)
      .set({ seq: sequence })
      .where(eq(profiles.id, next.id));
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
export async function drainDeletions(limit = 500): Promise<number> {
  const pending = await getDb()
    .select()
    .from(audioDeletions)
    .where(lte(audioDeletions.deleteAfter, new Date()))
    .orderBy(asc(audioDeletions.deleteAfter))
    .limit(limit);
  let deleted = 0;
  for (const item of pending) {
    await getDb().transaction(async (tx) => {
      await lockNamespace(tx, item.namespace);
      const [queued] = await tx
        .select()
        .from(audioDeletions)
        .where(eq(audioDeletions.objectKey, item.objectKey))
        .for('update');
      if (!queued || queued.deleteAfter > new Date()) return;
      const [profile] = await tx
        .select()
        .from(profiles)
        .where(eq(profiles.audioNamespace, item.namespace))
        .for('update');
      const match = /\/([0-9a-f-]{36})\.m4a$/.exec(item.objectKey);
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
  return deleted;
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
      const match = /^audio\/([0-9a-f]{64})\/([0-9a-f-]{36})\.m4a$/.exec(
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
