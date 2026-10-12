import { and, asc, eq, gt, sql } from 'drizzle-orm';
import {
  DEFAULT_SETTINGS,
  FIELDS,
  fieldTimestamp,
  MAX_BATCH,
  mergeServer,
  type Change,
  type Entry,
  type ServerEntry,
  type SyncRequest,
  type SyncResponse,
} from '@down-up/shared';
import { getDb, type Transaction } from './db';
import {
  audioDeletions,
  clampedWrites,
  entries,
  profiles,
  settings,
} from './schema';
import { audioHead, audioKey, validAudio } from './audio';
import { hash } from './security';
import { HttpError } from './http';
export async function lockNamespace(tx: Transaction, namespace: string) {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${namespace}, 0))`,
  );
}
export async function lockProfile(tx: Transaction, id: string) {
  await lockNamespace(tx, hash(id));
  const [profile] = await tx
    .select()
    .from(profiles)
    .where(eq(profiles.id, id))
    .for('update');
  if (!profile) throw new HttpError(401, 'ID not found');
  return profile;
}
export function serialize(row: typeof entries.$inferSelect): ServerEntry {
  return {
    date: row.date,
    value: row.value,
    valueUpdatedAt: row.valueUpdatedAt?.getTime() ?? null,
    note: row.note,
    noteUpdatedAt: row.noteUpdatedAt?.getTime() ?? null,
    audioId: row.audioId,
    audioDurationMs: row.audioDurationMs,
    audioUpdatedAt: row.audioUpdatedAt?.getTime() ?? null,
    serverSeq: row.serverSeq.toString(),
  };
}
export function storeFields(entry: Entry) {
  return {
    date: entry.date,
    value: entry.value,
    valueUpdatedAt:
      entry.valueUpdatedAt === null ? null : new Date(entry.valueUpdatedAt),
    note: entry.note,
    noteUpdatedAt:
      entry.noteUpdatedAt === null ? null : new Date(entry.noteUpdatedAt),
    audioId: entry.audioId,
    audioDurationMs: entry.audioDurationMs,
    audioUpdatedAt:
      entry.audioUpdatedAt === null ? null : new Date(entry.audioUpdatedAt),
  };
}
export async function queueAudio(
  tx: Transaction,
  id: string,
  audioId: string,
  delayMs = 0,
) {
  await tx
    .insert(audioDeletions)
    .values({
      objectKey: audioKey(id, audioId),
      namespace: hash(id),
      deleteAfter: new Date(Date.now() + delayMs),
    })
    .onConflictDoNothing();
}
export async function syncProfile(
  id: string,
  request: SyncRequest,
  now = Date.now(),
): Promise<SyncResponse> {
  return getDb().transaction(async (tx) => {
    const profile = await lockProfile(tx, id);
    let seq = profile.seq;
    if (request.cursor !== null && BigInt(request.cursor) > seq)
      throw new HttpError(400, 'Reset the sync cursor');
    const applied: ServerEntry[] = [];
    const missingAudio: string[] = [];
    for (const change of request.changes) {
      const [existing] = await tx
        .select()
        .from(entries)
        .where(and(eq(entries.profileId, id), eq(entries.date, change.date)))
        .limit(1);
      const audioExists = change.audioId
        ? validAudio(await audioHead(audioKey(id, change.audioId)))
        : true;
      const fresh: Change = { ...change };
      for (const field of FIELDS) {
        const timestamp = fieldTimestamp(change, field);
        if (timestamp == null) continue;
        const [receipt] = await tx
          .select()
          .from(clampedWrites)
          .where(
            and(
              eq(clampedWrites.profileId, id),
              eq(clampedWrites.date, change.date),
              eq(clampedWrites.field, field),
              eq(clampedWrites.clientTimestamp, BigInt(timestamp)),
            ),
          )
          .limit(1);
        if (receipt) {
          delete fresh[`${field}UpdatedAt`];
          if (field === 'audio') {
            delete fresh.audioId;
            delete fresh.audioDurationMs;
          } else delete fresh[field];
        }
      }
      const merged = mergeServer(
        existing ? serialize(existing) : null,
        fresh,
        now,
        audioExists,
      );
      for (const field of FIELDS) {
        const timestamp = fieldTimestamp(fresh, field);
        if (
          timestamp != null &&
          timestamp > now + 5 * 60_000 &&
          !(field === 'audio' && merged.missingAudio)
        ) {
          await tx
            .insert(clampedWrites)
            .values({
              profileId: id,
              date: change.date,
              field,
              clientTimestamp: BigInt(timestamp),
            })
            .onConflictDoNothing();
        }
      }
      if (merged.missingAudio) missingAudio.push(merged.missingAudio);
      if (merged.removedAudio) await queueAudio(tx, id, merged.removedAudio);
      if (merged.changed) {
        seq++;
        const values = {
          ...storeFields(merged.entry),
          profileId: id,
          serverSeq: seq,
        };
        const [saved] = await tx
          .insert(entries)
          .values(values)
          .onConflictDoUpdate({
            target: [entries.profileId, entries.date],
            set: values,
          })
          .returning();
        applied.push(serialize(saved!));
      } else if (existing) applied.push(serialize(existing));
      if (merged.entry.audioId)
        await tx
          .delete(audioDeletions)
          .where(
            eq(audioDeletions.objectKey, audioKey(id, merged.entry.audioId)),
          );
    }
    await tx
      .update(profiles)
      .set({ seq, lastSeen: new Date(now) })
      .where(eq(profiles.id, id));
    const pulled = await tx
      .select()
      .from(entries)
      .where(
        and(
          eq(entries.profileId, id),
          gt(entries.serverSeq, BigInt(request.cursor ?? '0')),
        ),
      )
      .orderBy(asc(entries.serverSeq))
      .limit(MAX_BATCH + 1);
    const page = pulled.slice(0, MAX_BATCH);
    const [config] = await tx
      .select({
        reminderEnabled: settings.reminderEnabled,
        reminderTime: settings.reminderTime,
      })
      .from(settings)
      .where(eq(settings.profileId, id))
      .limit(1);
    return {
      applied,
      changes: page.map(serialize),
      cursor: page.at(-1)?.serverSeq.toString() ?? request.cursor ?? '0',
      hasMore: pulled.length > MAX_BATCH,
      missingAudio,
      settings: config ?? DEFAULT_SETTINGS,
    };
  });
}
