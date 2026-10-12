import {
  applyAcknowledgment,
  applyPull,
  cleanFields,
  emptyEntry,
  entrySchema,
  exportCsv,
  FIELDS,
  fieldTimestamp,
  isFutureDate,
  nextTimestamp,
  pendingChange,
  SYNC_DATE_FLOOR,
  type Change,
  type Field,
  type LocalEntry,
  type Settings,
  type SyncResponse,
} from '@down-up/shared';

export interface SqlDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    ...params: (string | number | null)[]
  ): Promise<unknown>;
  getFirstAsync<T>(
    sql: string,
    ...params: (string | number | null)[]
  ): Promise<T | null>;
  getAllAsync<T>(
    sql: string,
    ...params: (string | number | null)[]
  ): Promise<T[]>;
  withExclusiveTransactionAsync(
    task: (tx: SqlDatabase) => Promise<void>,
  ): Promise<void>;
}
type StoredEntry = {
  date: string;
  value: number | null;
  value_updated_at: number | null;
  note: string | null;
  note_updated_at: number | null;
  audio_id: string | null;
  audio_duration_ms: number | null;
  audio_updated_at: number | null;
  value_dirty: number;
  note_dirty: number;
  audio_dirty: number;
};
export type AudioFile = {
  audio_id: string;
  local_path: string | null;
  uploaded: number;
};

const migrate = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS entries (
  date TEXT PRIMARY KEY,
  value INTEGER CHECK(value BETWEEN 1 AND 10), value_updated_at INTEGER,
  note TEXT CHECK(length(note) <= 2000), note_updated_at INTEGER,
  audio_id TEXT, audio_duration_ms INTEGER CHECK(audio_duration_ms BETWEEN 1 AND 300000), audio_updated_at INTEGER,
  dirty INTEGER NOT NULL DEFAULT 1,
  value_dirty INTEGER NOT NULL DEFAULT 0, note_dirty INTEGER NOT NULL DEFAULT 0, audio_dirty INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS audio_files (audio_id TEXT PRIMARY KEY, local_path TEXT, uploaded INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY, value TEXT);
PRAGMA user_version = 1;
`;

function hydrate(row: StoredEntry): LocalEntry {
  return {
    date: row.date,
    value: row.value,
    valueUpdatedAt: row.value_updated_at,
    note: row.note,
    noteUpdatedAt: row.note_updated_at,
    audioId: row.audio_id,
    audioDurationMs: row.audio_duration_ms,
    audioUpdatedAt: row.audio_updated_at,
    dirtyFields: {
      value: !!row.value_dirty,
      note: !!row.note_dirty,
      audio: !!row.audio_dirty,
    },
  };
}
async function read(tx: SqlDatabase, date: string): Promise<LocalEntry | null> {
  const row = await tx.getFirstAsync<StoredEntry>(
    'SELECT * FROM entries WHERE date = ?',
    date,
  );
  return row ? hydrate(row) : null;
}
async function write(tx: SqlDatabase, row: LocalEntry): Promise<void> {
  const dirty = FIELDS.some((field) => row.dirtyFields[field]);
  await tx.runAsync(
    `INSERT INTO entries(date,value,value_updated_at,note,note_updated_at,audio_id,audio_duration_ms,audio_updated_at,dirty,value_dirty,note_dirty,audio_dirty)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(date) DO UPDATE SET
    value=excluded.value,value_updated_at=excluded.value_updated_at,note=excluded.note,note_updated_at=excluded.note_updated_at,
    audio_id=excluded.audio_id,audio_duration_ms=excluded.audio_duration_ms,audio_updated_at=excluded.audio_updated_at,
    dirty=excluded.dirty,value_dirty=excluded.value_dirty,note_dirty=excluded.note_dirty,audio_dirty=excluded.audio_dirty`,
    row.date,
    row.value,
    row.valueUpdatedAt,
    row.note,
    row.noteUpdatedAt,
    row.audioId,
    row.audioDurationMs,
    row.audioUpdatedAt,
    Number(dirty),
    Number(row.dirtyFields.value),
    Number(row.dirtyFields.note),
    Number(row.dirtyFields.audio),
  );
}

export class Repository {
  private tail: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  private editListeners = new Set<() => void>();
  private writeListeners = new Set<() => void>();
  private writes = 0;
  private writeFailed = false;
  constructor(private readonly db: SqlDatabase) {}
  async initialize() {
    await this.db.execAsync(migrate);
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  onEdit = (listener: () => void) => {
    this.editListeners.add(listener);
    return () => {
      this.editListeners.delete(listener);
    };
  };
  onWriteState = (listener: () => void) => {
    this.writeListeners.add(listener);
    return () => {
      this.writeListeners.delete(listener);
    };
  };
  writeState() {
    return { pending: this.writes > 0, failed: this.writeFailed };
  }
  private wrote() {
    for (const listener of this.writeListeners) listener();
  }
  async hasDirty() {
    await this.tail;
    return !!(await this.db.getFirstAsync<{ found: number }>(
      'SELECT 1 AS found FROM entries WHERE value_dirty=1 OR note_dirty=1 OR audio_dirty=1 LIMIT 1',
    ));
  }
  private changed() {
    for (const listener of this.listeners) listener();
  }
  private exclusive<T>(operation: (tx: SqlDatabase) => Promise<T>): Promise<T> {
    const result = this.tail.then(async () => {
      let value!: T;
      await this.db.withExclusiveTransactionAsync(async (tx) => {
        value = await operation(tx);
      });
      this.changed();
      return value;
    });
    this.tail = result.catch(() => undefined);
    return result;
  }
  async get(date: string) {
    await this.tail;
    return read(this.db, date);
  }
  async list(from = '0001-01-01', to = '9999-12-31'): Promise<LocalEntry[]> {
    await this.tail;
    return (
      await this.db.getAllAsync<StoredEntry>(
        'SELECT * FROM entries WHERE date BETWEEN ? AND ? ORDER BY date DESC',
        from,
        to,
      )
    ).map(hydrate);
  }
  async state(key: string): Promise<string | null> {
    await this.tail;
    return (
      (
        await this.db.getFirstAsync<{ value: string | null }>(
          'SELECT value FROM sync_state WHERE key = ?',
          key,
        )
      )?.value ?? null
    );
  }
  setState(key: string, value: string | null) {
    return this.exclusive((tx) =>
      tx.runAsync(
        'INSERT INTO sync_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        key,
        value,
      ),
    );
  }
  async setField(
    date: string,
    field: Field,
    value: number | string | null,
    duration: number | null = null,
    localPath?: string,
  ) {
    if (isFutureDate(date)) throw new Error('Choose today or an earlier day');
    this.writes++;
    this.wrote();
    let didEdit: boolean;
    try {
      didEdit = await this.edit(date, field, value, duration, localPath);
      this.writeFailed = false;
    } catch (error) {
      this.writeFailed = true;
      throw error;
    } finally {
      this.writes--;
      this.wrote();
    }
    if (didEdit) for (const listener of this.editListeners) listener();
    return didEdit;
  }
  private edit(
    date: string,
    field: Field,
    value: number | string | null,
    duration: number | null,
    localPath?: string,
  ) {
    return this.exclusive(async (tx) => {
      const row = (await read(tx, date)) ?? {
        ...emptyEntry(date),
        dirtyFields: cleanFields(),
      };
      if (field === 'value') {
        if (value === null) throw new Error('A value cannot be cleared');
        if (row.value === value) return false;
        row.value = value as number;
      } else if (field === 'note') {
        if (row.note === value) return false;
        row.note = value as string | null;
      } else {
        if (row.audioId === value && row.audioDurationMs === duration)
          return false;
        row.audioId = value as string | null;
        row.audioDurationMs = duration;
        if (value && localPath)
          await tx.runAsync(
            'INSERT INTO audio_files(audio_id,local_path,uploaded) VALUES(?,?,0)',
            value,
            localPath,
          );
      }
      row[`${field}UpdatedAt`] = nextTimestamp(
        fieldTimestamp(row, field) ?? null,
      );
      row.dirtyFields[field] = true;
      const { dirtyFields: _dirty, ...entry } = row;
      entrySchema.parse(entry);
      await write(tx, row);
      return true;
    });
  }
  async audio(audioId: string): Promise<AudioFile | null> {
    await this.tail;
    return this.db.getFirstAsync<AudioFile>(
      'SELECT * FROM audio_files WHERE audio_id = ?',
      audioId,
    );
  }
  setAudioUploaded(audioId: string, uploaded: boolean) {
    return this.exclusive((tx) =>
      tx.runAsync(
        'UPDATE audio_files SET uploaded=? WHERE audio_id=?',
        Number(uploaded),
        audioId,
      ),
    );
  }
  cacheAudio(audioId: string, path: string) {
    return this.exclusive((tx) =>
      tx.runAsync(
        'INSERT INTO audio_files(audio_id,local_path,uploaded) VALUES(?,?,1) ON CONFLICT(audio_id) DO UPDATE SET local_path=excluded.local_path',
        audioId,
        path,
      ),
    );
  }
  async uploads(): Promise<AudioFile[]> {
    await this.tail;
    return this.db.getAllAsync<AudioFile>(
      'SELECT a.* FROM audio_files a JOIN entries e ON a.audio_id=e.audio_id WHERE a.uploaded=0 AND a.local_path IS NOT NULL AND e.date>=?',
      SYNC_DATE_FLOOR,
    );
  }
  async pushBatch(): Promise<Change[]> {
    await this.tail;
    const rows = await this.db.getAllAsync<StoredEntry>(
      `SELECT e.* FROM entries e WHERE e.date>=? AND (e.value_dirty=1 OR e.note_dirty=1 OR
      (e.audio_dirty=1 AND (e.audio_id IS NULL OR EXISTS(SELECT 1 FROM audio_files a WHERE a.audio_id=e.audio_id AND a.uploaded=1)))) ORDER BY e.date LIMIT 500`,
      SYNC_DATE_FLOOR,
    );
    const changes: Change[] = [];
    for (const stored of rows) {
      const row = hydrate(stored);
      const uploaded = row.audioId
        ? !!(await this.audio(row.audioId))?.uploaded
        : true;
      const change = pendingChange(row, uploaded);
      if (change) changes.push(change);
    }
    return changes;
  }
  applyResponse(sent: readonly Change[], response: SyncResponse) {
    return this.exclusive(async (tx) => {
      const snapshots = new Map(sent.map((change) => [change.date, change]));
      for (const server of response.applied) {
        const local = await read(tx, server.date);
        const snapshot = snapshots.get(server.date);
        if (local && snapshot)
          await write(
            tx,
            applyPull(
              applyAcknowledgment(
                local,
                snapshot,
                server,
                response.missingAudio,
              ),
              server,
            ),
          );
      }
      for (const server of response.changes) {
        const row = applyPull(await read(tx, server.date), server);
        await write(tx, row);
        if (row.audioId)
          await tx.runAsync(
            'INSERT OR IGNORE INTO audio_files(audio_id,local_path,uploaded) VALUES(?,NULL,1)',
            row.audioId,
          );
      }
      for (const id of response.missingAudio)
        await tx.runAsync(
          'UPDATE audio_files SET uploaded=0 WHERE audio_id=?',
          id,
        );
      for (const [key, value] of [
        ['cursor', response.cursor],
        ['reminder', JSON.stringify(response.settings)],
        ['last_synced_at', Date.now().toString()],
      ]) {
        await tx.runAsync(
          'INSERT INTO sync_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
          key!,
          value ?? null,
        );
      }
    });
  }
  resetSync(discard: boolean, preserveUploads = false) {
    return this.exclusive(async (tx) => {
      if (discard) {
        await tx.execAsync('DELETE FROM entries; DELETE FROM audio_files;');
      } else {
        await tx.execAsync(
          `UPDATE entries SET value_dirty=(value_updated_at IS NOT NULL),note_dirty=(note_updated_at IS NOT NULL),audio_dirty=(audio_updated_at IS NOT NULL),dirty=1;`,
        );
        if (!preserveUploads)
          await tx.execAsync('UPDATE audio_files SET uploaded=0;');
      }
      await tx.execAsync(
        "DELETE FROM sync_state WHERE key IN ('cursor','last_synced_at','reminder','identity_transition');",
      );
    });
  }
  async loggedDates(): Promise<Set<string>> {
    await this.tail;
    return new Set(
      (
        await this.db.getAllAsync<{ date: string }>(
          'SELECT date FROM entries WHERE value IS NOT NULL',
        )
      ).map((row) => row.date),
    );
  }
  async collectAudio(includePending = false): Promise<AudioFile[]> {
    await this.tail;
    return this.db.getAllAsync<AudioFile>(
      `SELECT a.* FROM audio_files a WHERE NOT EXISTS (SELECT 1 FROM entries e WHERE e.audio_id=a.audio_id)
      ${includePending ? '' : 'AND NOT EXISTS (SELECT 1 FROM entries e WHERE e.audio_dirty=1 AND e.date >= ?)'}`,
      ...(includePending ? [] : [SYNC_DATE_FLOOR]),
    );
  }
  forgetAudio(id: string) {
    return this.exclusive((tx) =>
      tx.runAsync('DELETE FROM audio_files WHERE audio_id=?', id),
    );
  }
  async csv(): Promise<string> {
    return exportCsv(await this.list());
  }
  async reminder(): Promise<Settings | null> {
    const raw = await this.state('reminder');
    return raw ? (JSON.parse(raw) as Settings) : null;
  }
}
