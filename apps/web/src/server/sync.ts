import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';
import {
  DEFAULT_SETTINGS,
  clampTimestamp,
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
import { HttpError, UnknownProfile } from './http';
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
  if (!profile) throw new UnknownProfile();
  return profile;
}
// Locks the profile and reads its reminder settings in the same query.
async function lockProfileSettings(tx: Transaction, id: string) {
  await lockNamespace(tx, hash(id));
  const [locked] = await tx
    .select({
      seq: profiles.seq,
      reminderEnabled: settings.reminderEnabled,
      reminderTime: settings.reminderTime,
    })
    .from(profiles)
    .leftJoin(settings, eq(settings.profileId, profiles.id))
    .where(eq(profiles.id, id))
    .for('update', { of: profiles });
  if (!locked) throw new UnknownProfile();
  return locked;
}
// Whether an incoming audio change could win mergeServer against `existing`.
// Field timestamps only increase during a push, so a change that cannot win
// against the stored row cannot win later in the same request either. Only
// winning changes need their object confirmed with HEAD.
export function audioCouldWin(
  existing: Entry | null,
  change: Change,
  now: number,
): boolean {
  return (
    !!change.audioId &&
    change.audioUpdatedAt != null &&
    clampTimestamp(change.audioUpdatedAt, now) >
      (existing?.audioUpdatedAt ?? -1)
  );
}
const HEAD_CONCURRENCY = 32;
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
    const profile = await lockProfileSettings(tx, id);
    let seq = profile.seq;
    if (request.cursor !== null && BigInt(request.cursor) > seq)
      throw new HttpError(400, 'Reset the sync cursor');
    const dates = [...new Set(request.changes.map((change) => change.date))];
    const existingRows = dates.length
      ? await tx
          .select()
          .from(entries)
          .where(and(eq(entries.profileId, id), inArray(entries.date, dates)))
      : [];
    const byDate = new Map(
      existingRows.map((row) => [row.date, serialize(row)]),
    );
    const receiptKey = (
      date: string,
      field: string,
      timestamp: number | bigint,
    ) => `${date}:${field}:${timestamp}`;
    const requestedReceipts = request.changes.flatMap((change) =>
      FIELDS.flatMap((field) => {
        const timestamp = fieldTimestamp(change, field);
        return timestamp == null
          ? []
          : [
              sql`(${change.date}::date, ${field}::text, ${BigInt(timestamp)}::bigint)`,
            ];
      }),
    );
    const storedReceipts = requestedReceipts.length
      ? await tx
          .select()
          .from(clampedWrites)
          .where(
            and(
              eq(clampedWrites.profileId, id),
              sql`(${clampedWrites.date}, ${clampedWrites.field}, ${clampedWrites.clientTimestamp}) IN (${sql.join(requestedReceipts, sql`, `)})`,
            ),
          )
      : [];
    const receipts = new Set(
      storedReceipts.map((row) =>
        receiptKey(row.date, row.field, row.clientTimestamp),
      ),
    );
    const newReceipts = new Map<string, typeof clampedWrites.$inferInsert>();
    const writes = new Map<string, typeof entries.$inferInsert>();
    const removedAudio = new Set<string>();
    const audioExists = new Map<string, boolean>();
    const audioIds = [
      ...new Set(
        request.changes.flatMap((change) =>
          audioCouldWin(byDate.get(change.date) ?? null, change, now)
            ? [change.audioId!]
            : [],
        ),
      ),
    ];
    for (let offset = 0; offset < audioIds.length; offset += HEAD_CONCURRENCY)
      await Promise.all(
        audioIds
          .slice(offset, offset + HEAD_CONCURRENCY)
          .map(async (audioId) => {
            audioExists.set(
              audioId,
              validAudio(await audioHead(audioKey(id, audioId))),
            );
          }),
      );
    const applied: ServerEntry[] = [];
    const missingAudio: string[] = [];
    for (const change of request.changes) {
      const existing = byDate.get(change.date) ?? null;
      const fresh: Change = { ...change };
      for (const field of FIELDS) {
        const timestamp = fieldTimestamp(change, field);
        if (
          timestamp == null ||
          !receipts.has(receiptKey(change.date, field, timestamp))
        )
          continue;
        delete fresh[`${field}UpdatedAt`];
        if (field === 'audio') {
          delete fresh.audioId;
          delete fresh.audioDurationMs;
        } else delete fresh[field];
      }
      const merged = mergeServer(
        existing,
        fresh,
        now,
        // Unchecked IDs cannot win the merge; if one somehow did, it reports missing.
        change.audioId ? (audioExists.get(change.audioId) ?? false) : true,
      );
      for (const field of FIELDS) {
        const timestamp = fieldTimestamp(fresh, field);
        if (
          timestamp != null &&
          timestamp > now + 5 * 60_000 &&
          !(field === 'audio' && merged.missingAudio)
        ) {
          const key = receiptKey(change.date, field, timestamp);
          receipts.add(key);
          newReceipts.set(key, {
            profileId: id,
            date: change.date,
            field,
            clientTimestamp: BigInt(timestamp),
          });
        }
      }
      if (merged.missingAudio) missingAudio.push(merged.missingAudio);
      if (merged.removedAudio) removedAudio.add(merged.removedAudio);
      if (merged.changed) {
        seq++;
        const saved = {
          ...merged.entry,
          audioId: merged.entry.audioId?.toLowerCase() ?? null,
          serverSeq: seq.toString(),
        };
        byDate.set(change.date, saved);
        writes.set(change.date, {
          ...storeFields(saved),
          profileId: id,
          serverSeq: seq,
        });
        applied.push(saved);
      } else if (existing) applied.push(existing);
    }
    if (newReceipts.size)
      await tx
        .insert(clampedWrites)
        .values([...newReceipts.values()])
        .onConflictDoNothing();
    if (writes.size)
      await tx
        .insert(entries)
        .values([...writes.values()])
        .onConflictDoUpdate({
          target: [entries.profileId, entries.date],
          set: {
            value: sql`excluded.value`,
            valueUpdatedAt: sql`excluded.value_updated_at`,
            note: sql`excluded.note`,
            noteUpdatedAt: sql`excluded.note_updated_at`,
            audioId: sql`excluded.audio_id`,
            audioDurationMs: sql`excluded.audio_duration_ms`,
            audioUpdatedAt: sql`excluded.audio_updated_at`,
            serverSeq: sql`excluded.server_seq`,
          },
        });
    if (removedAudio.size)
      await tx
        .insert(audioDeletions)
        .values(
          [...removedAudio].map((audioId) => ({
            objectKey: audioKey(id, audioId),
            namespace: hash(id),
            deleteAfter: new Date(),
          })),
        )
        .onConflictDoNothing();
    const referencedAudio = [
      ...new Set(
        [...byDate.values()].flatMap((row) =>
          row.audioId ? [audioKey(id, row.audioId)] : [],
        ),
      ),
    ];
    if (referencedAudio.length)
      await tx
        .delete(audioDeletions)
        .where(inArray(audioDeletions.objectKey, referencedAudio));
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
    return {
      applied,
      changes: page.map(serialize),
      cursor: page.at(-1)?.serverSeq.toString() ?? request.cursor ?? '0',
      hasMore: pulled.length > MAX_BATCH,
      missingAudio,
      settings:
        profile.reminderEnabled === null || profile.reminderTime === null
          ? DEFAULT_SETTINGS
          : {
              reminderEnabled: profile.reminderEnabled,
              reminderTime: profile.reminderTime,
            },
    };
  });
}
