import type { Change, Entry, ServerEntry } from './schemas';
export type Field = 'value' | 'note' | 'audio';
export const FIELDS: Field[] = ['value', 'note', 'audio'];
export type DirtyFields = Record<Field, boolean>;
export type LocalEntry = Entry & { dirtyFields: DirtyFields };
export function emptyEntry(date: string): Entry {
  return {
    date,
    value: null,
    valueUpdatedAt: null,
    note: null,
    noteUpdatedAt: null,
    audioId: null,
    audioDurationMs: null,
    audioUpdatedAt: null,
  };
}
export function cleanFields(): DirtyFields {
  return { value: false, note: false, audio: false };
}
export function fieldTimestamp(
  row: Entry | Change,
  field: Field,
): number | null | undefined {
  return row[`${field}UpdatedAt`];
}
export function copyField(
  target: Entry,
  source: Entry | Change,
  field: Field,
): void {
  if (field === 'value') {
    target.value = source.value ?? null;
    target.valueUpdatedAt = source.valueUpdatedAt ?? null;
  }
  if (field === 'note') {
    target.note = source.note ?? null;
    target.noteUpdatedAt = source.noteUpdatedAt ?? null;
  }
  if (field === 'audio') {
    target.audioId = source.audioId ?? null;
    target.audioDurationMs = source.audioDurationMs ?? null;
    target.audioUpdatedAt = source.audioUpdatedAt ?? null;
  }
}
export function clampTimestamp(timestamp: number, now: number): number {
  return timestamp > now + 5 * 60_000 ? now : timestamp;
}
export function nextTimestamp(
  previous: number | null,
  now = Date.now(),
): number {
  return Math.max(now, (previous ?? 0) + 1);
}

export function mergeServer(
  existing: Entry | null,
  incoming: Change,
  now: number,
  audioExists = true,
): {
  entry: Entry;
  changed: boolean;
  missingAudio: string | null;
  removedAudio: string | null;
} {
  const entry = { ...(existing ?? emptyEntry(incoming.date)) };
  let changed = existing === null;
  let missingAudio: string | null = null;
  const oldAudio = entry.audioId;
  for (const field of FIELDS) {
    const incomingTimestamp = fieldTimestamp(incoming, field);
    if (incomingTimestamp === undefined || incomingTimestamp === null) continue;
    if (field === 'value' && incoming.value === null && entry.value !== null)
      continue;
    const timestamp = clampTimestamp(incomingTimestamp, now);
    if (timestamp <= (fieldTimestamp(entry, field) ?? -1)) continue;
    if (field === 'audio' && incoming.audioId && !audioExists) {
      missingAudio = incoming.audioId;
      continue;
    }
    copyField(entry, { ...incoming, [`${field}UpdatedAt`]: timestamp }, field);
    changed = true;
  }
  return {
    entry,
    changed,
    missingAudio,
    removedAudio: oldAudio && oldAudio !== entry.audioId ? oldAudio : null,
  };
}

export function pendingChange(
  row: LocalEntry,
  audioUploaded: boolean,
): Change | null {
  const change: Change = { date: row.date };
  for (const field of FIELDS) {
    if (!row.dirtyFields[field] || fieldTimestamp(row, field) == null) continue;
    if (field === 'audio' && row.audioId && !audioUploaded) continue;
    if (field === 'value') {
      change.value = row.value;
      change.valueUpdatedAt = row.valueUpdatedAt!;
    }
    if (field === 'note') {
      change.note = row.note;
      change.noteUpdatedAt = row.noteUpdatedAt!;
    }
    if (field === 'audio') {
      change.audioId = row.audioId;
      change.audioDurationMs = row.audioDurationMs;
      change.audioUpdatedAt = row.audioUpdatedAt!;
    }
  }
  return Object.keys(change).length > 1 ? change : null;
}

export function applyAcknowledgment(
  local: LocalEntry,
  sent: Change,
  server: ServerEntry,
  missingAudio: readonly string[],
): LocalEntry {
  const result = { ...local, dirtyFields: { ...local.dirtyFields } };
  for (const field of FIELDS) {
    const timestamp = fieldTimestamp(sent, field);
    if (timestamp == null || fieldTimestamp(local, field) !== timestamp)
      continue;
    if (
      field === 'audio' &&
      sent.audioId &&
      missingAudio.includes(sent.audioId)
    )
      continue;
    copyField(result, server, field);
    result.dirtyFields[field] = false;
  }
  return result;
}

export function applyPull(
  local: LocalEntry | null,
  server: ServerEntry,
): LocalEntry {
  const result: LocalEntry = local
    ? { ...local, dirtyFields: { ...local.dirtyFields } }
    : { ...emptyEntry(server.date), dirtyFields: cleanFields() };
  for (const field of FIELDS) {
    if (field === 'value' && result.value !== null && server.value === null)
      continue;
    if (
      !result.dirtyFields[field] ||
      (fieldTimestamp(server, field) ?? -1) >
        (fieldTimestamp(result, field) ?? -1)
    ) {
      copyField(result, server, field);
      result.dirtyFields[field] = false;
    }
  }
  return result;
}
