import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import {
  addDays,
  cleanFields,
  emptyEntry,
  mergeServer,
  type Identity,
  type ServerEntry,
  type SyncRequest,
  type SyncResponse,
} from '@down-up/shared';
import { Repository, type SqlDatabase } from './repository';
import { SyncEngine, type SyncStatus, type Transport } from './sync-engine';

export function sqliteRepository() {
  const db = new DatabaseSync(':memory:');
  const adapter: SqlDatabase = {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, ...params) {
      return db.prepare(sql).run(...params);
    },
    async getFirstAsync<T>(sql: string, ...params: (string | number | null)[]) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, ...params: (string | number | null)[]) {
      return db.prepare(sql).all(...params) as T[];
    },
    async withExclusiveTransactionAsync(operation) {
      db.exec('BEGIN IMMEDIATE');
      try {
        await operation(adapter);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { repo: new Repository(adapter), db, adapter };
}
const date = '2026-01-01';
const settings = { reminderEnabled: false, reminderTime: '20:00' };
const response = (applied: ServerEntry[], changes = applied): SyncResponse => ({
  applied,
  changes,
  cursor: changes.at(-1)?.serverSeq ?? '0',
  hasMore: false,
  missingAudio: [],
  settings,
});

describe('SQLite repository', () => {
  it('publishes entry revisions only for entry edits and reads existence without loading rows', async () => {
    const { repo, db } = sqliteRepository();
    await repo.initialize();
    const changed = vi.fn();
    repo.subscribe(changed);
    expect(await repo.hasEntries()).toBe(false);
    expect(await repo.firstDate()).toBeNull();
    await repo.setState('ui_sound', '{}');
    expect(changed).not.toHaveBeenCalled();
    await repo.setField(date, 'value', 7);
    await repo.setField(date, 'value', 7);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(await repo.hasEntries()).toBe(true);
    await repo.setField('1900-01-01', 'note', 'first');
    expect(await repo.firstDate()).toBe('1900-01-01');
    expect(await repo.list(date, date)).toHaveLength(1);
    db.close();
  });
  it('bulk-applies a 500-row pull with bounded SQL calls', async () => {
    const { repo, db, adapter } = sqliteRepository();
    await repo.initialize();
    const reads = vi.spyOn(adapter, 'getAllAsync');
    const writes = vi.spyOn(adapter, 'runAsync');
    const rows = Array.from({ length: 500 }, (_, index) => ({
      ...emptyEntry(addDays('2020-01-01', index)),
      value: 5,
      valueUpdatedAt: 100,
      serverSeq: String(index + 1),
    }));
    await repo.applyResponse([], response([], rows));
    expect(reads).toHaveBeenCalledTimes(10);
    expect(writes).toHaveBeenCalledTimes(13);
    expect(await repo.list()).toHaveLength(500);
    expect(await repo.state('cursor')).toBe('500');
    db.close();
  });
  it('publishes sync settings without invalidating entries on an empty pull', async () => {
    const { repo, db } = sqliteRepository();
    await repo.initialize();
    const entries = vi.fn();
    const metadata = vi.fn();
    repo.subscribe(entries);
    repo.subscribeSyncState(metadata);
    await repo.applyResponse([], {
      ...response([], []),
      settings: { reminderEnabled: true, reminderTime: '18:00' },
    });
    expect(entries).not.toHaveBeenCalled();
    expect(metadata).toHaveBeenCalledTimes(1);
    expect(await repo.reminder()).toEqual({
      reminderEnabled: true,
      reminderTime: '18:00',
    });
    await repo.resetSync(true);
    expect(metadata).toHaveBeenCalledTimes(2);
    db.close();
  });
  it('lets a queued tap save between pull chunks and preserves it when its row arrives', async () => {
    const { repo, db, adapter } = sqliteRepository();
    await repo.initialize();
    let firstStarted!: () => void;
    let secondStarted!: () => void;
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    const first = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    const second = new Promise<void>((resolve) => {
      secondStarted = resolve;
    });
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const original = adapter.getAllAsync.bind(adapter);
    let batches = 0;
    adapter.getAllAsync = async <T>(
      sql: string,
      ...params: (string | number | null)[]
    ) => {
      if (++batches === 1) {
        firstStarted();
        await firstGate;
      } else if (batches === 2) {
        secondStarted();
        await secondGate;
      }
      return original<T>(sql, ...params);
    };
    const rows = Array.from({ length: 100 }, (_, index) => ({
      ...emptyEntry(addDays('2020-01-01', index)),
      value: 5,
      valueUpdatedAt: 100,
      serverSeq: String(index + 1),
    }));
    const applying = repo.applyResponse([], response([], rows));
    await first;
    let saved = false;
    const tappedDate = rows[75]!.date;
    const tap = repo.setField(tappedDate, 'value', 8).then(() => {
      saved = true;
    });
    releaseFirst();
    await second;
    expect(saved).toBe(true);
    expect(
      db.prepare("SELECT value FROM sync_state WHERE key='cursor'").get(),
    ).toBeUndefined();
    releaseSecond();
    await Promise.all([tap, applying]);
    expect((await repo.get(tappedDate))?.value).toBe(8);
    expect((await repo.get(tappedDate))?.dirtyFields.value).toBe(true);
    db.close();
  });
  it('keeps the cursor replayable after an interrupted pull chunk', async () => {
    const { repo, db, adapter } = sqliteRepository();
    await repo.initialize();
    const original = adapter.getAllAsync.bind(adapter);
    let batches = 0;
    adapter.getAllAsync = async <T>(
      sql: string,
      ...params: (string | number | null)[]
    ) => {
      if (++batches === 2) throw new Error('Interrupted');
      return original<T>(sql, ...params);
    };
    const rows = Array.from({ length: 100 }, (_, index) => ({
      ...emptyEntry(addDays('2020-01-01', index)),
      value: 5,
      valueUpdatedAt: 100,
      serverSeq: String(index + 1),
    }));
    const changed = vi.fn();
    repo.subscribe(changed);
    await expect(repo.applyResponse([], response([], rows))).rejects.toThrow(
      'Interrupted',
    );
    expect(await repo.state('cursor')).toBeNull();
    expect(await repo.list()).toHaveLength(50);
    expect(changed).toHaveBeenCalledTimes(1);
    await repo.applyResponse([], response([], rows));
    expect(await repo.list()).toHaveLength(100);
    expect(await repo.state('cursor')).toBe('100');
    db.close();
  });
  it('keeps the theme local, separate from entry edits, and across identity resets', async () => {
    const { repo, db } = sqliteRepository();
    await repo.initialize();
    await repo.setField(date, 'value', 7);
    const sent = await repo.pushBatch();
    const server = {
      ...mergeServer(null, sent[0]!, Date.now()).entry,
      serverSeq: '1',
    };
    await repo.applyResponse(sent, response([server]));
    const edit = vi.fn();
    repo.onEdit(edit);
    await repo.setState('ui_theme', 'blue');
    const sound = JSON.stringify({ muted: true, volume: 0.4 });
    await repo.setState('ui_sound', sound);
    expect(await repo.state('ui_theme')).toBe('blue');
    expect(edit).not.toHaveBeenCalled();
    expect(await repo.pushBatch()).toEqual([]);
    await repo.resetSync(false);
    expect(await repo.state('ui_theme')).toBe('blue');
    expect(await repo.state('ui_sound')).toBe(sound);
    await repo.resetSync(true);
    expect(await repo.state('ui_theme')).toBe('blue');
    expect(await repo.state('ui_sound')).toBe(sound);
    db.close();
  });
  it('collects unreferenced recordings in phone-only mode while preserving active recordings', async () => {
    const { repo, db } = sqliteRepository();
    await repo.initialize();
    const audioId = 'a4c6cbb6-bb0e-4307-b410-9ddc93cfb771';
    await repo.setField(date, 'audio', audioId, 1000, '/recording.m4a');
    expect(await repo.collectAudio(true)).toEqual([]);
    await repo.setField(date, 'audio', null);
    expect(await repo.collectAudio()).toEqual([]);
    expect((await repo.collectAudio(true)).map((row) => row.audio_id)).toEqual([
      audioId,
    ]);
    await repo.forgetAudio(audioId);
    expect(await repo.collectAudio(true)).toEqual([]);
    db.close();
  });
  it('saves immediately, keeps selected taps idempotent, and never clears values', async () => {
    const { repo, db } = sqliteRepository();
    await repo.initialize();
    const edited = vi.fn();
    repo.onEdit(edited);
    expect(await repo.setField(date, 'value', 3)).toBe(true);
    const first = await repo.get(date);
    expect(await repo.setField(date, 'value', 3)).toBe(false);
    expect(edited).toHaveBeenCalledTimes(1);
    expect(await repo.get(date)).toEqual(first);
    await repo.setField(date, 'value', 8);
    expect(edited).toHaveBeenCalledTimes(2);
    expect((await repo.get(date))?.value).toBe(8);
    await expect(repo.setField(date, 'value', null)).rejects.toThrow(
      'cannot be cleared',
    );
    expect((await repo.get(date))?.value).toBe(8);
    db.close();
  });
  it('acknowledges only sent fields and preserves a note edited mid-request', async () => {
    const { repo, db } = sqliteRepository();
    await repo.initialize();
    await repo.setField(date, 'value', 3);
    await repo.setField(date, 'note', 'before');
    const sent = await repo.pushBatch();
    await repo.setField(date, 'note', 'during');
    const server = {
      ...mergeServer(null, sent[0]!, Date.now()).entry,
      serverSeq: '1',
    };
    await repo.applyResponse(sent, response([server]));
    const row = await repo.get(date);
    expect(row?.value).toBe(3);
    expect(row?.note).toBe('during');
    expect(row?.dirtyFields).toEqual({
      value: false,
      note: true,
      audio: false,
    });
    db.close();
  });
  it('re-queues every field and file when merging into a different ID', async () => {
    const { repo, db } = sqliteRepository();
    await repo.initialize();
    const audioId = 'b68d4f5e-4168-4d8b-ae7e-3c4df743364c';
    await repo.setField(date, 'value', 3);
    await repo.setField(date, 'audio', audioId, 1000, '/test.m4a');
    await repo.setAudioUploaded(audioId, true);
    const sent = await repo.pushBatch();
    const server = {
      ...mergeServer(null, sent[0]!, Date.now()).entry,
      serverSeq: '1',
    };
    await repo.applyResponse(sent, response([server]));
    await repo.resetSync(false);
    expect((await repo.get(date))?.dirtyFields).toEqual({
      value: true,
      note: false,
      audio: true,
    });
    expect(await repo.state('cursor')).toBeNull();
    expect((await repo.audio(audioId))?.uploaded).toBe(0);
    await repo.resetSync(true);
    expect(await repo.list()).toEqual([]);
    expect(await repo.audio(audioId)).toBeNull();
    db.close();
  });
  it('keeps old dates local and does not let blocked audio starve newer edits', async () => {
    const { repo, db } = sqliteRepository();
    await repo.initialize();
    await repo.setField('1899-01-01', 'value', 5);
    await repo.setField(
      date,
      'audio',
      'b68d4f5e-4168-4d8b-ae7e-3c4df743364c',
      1000,
      '/test.m4a',
    );
    await repo.setField('2026-01-02', 'value', 7);
    expect((await repo.pushBatch()).map((row) => row.date)).toEqual([
      '2026-01-02',
    ]);
    db.close();
  });
  it('preserves uploaded remote recordings during ID replacement', async () => {
    const { repo, db } = sqliteRepository();
    await repo.initialize();
    const audioId = 'b68d4f5e-4168-4d8b-ae7e-3c4df743364c';
    const remote = {
      ...emptyEntry(date),
      audioId,
      audioDurationMs: 1000,
      audioUpdatedAt: 100,
      serverSeq: '1',
    };
    await repo.applyResponse([], response([], [remote]));
    await repo.resetSync(false, true);
    expect((await repo.audio(audioId))?.uploaded).toBe(1);
    expect((await repo.pushBatch())[0]?.audioId).toBe(audioId);
    db.close();
  });
  it('adopts server clamping even when no pull row is returned', async () => {
    const { repo, db } = sqliteRepository();
    await repo.initialize();
    await repo.setField(date, 'value', 3);
    const sent = await repo.pushBatch();
    const server = {
      ...emptyEntry(date),
      value: 8,
      valueUpdatedAt: 50,
      note: 'remote',
      noteUpdatedAt: 40,
      serverSeq: '1',
    };
    await repo.applyResponse(sent, response([server], []));
    expect((await repo.get(date))?.valueUpdatedAt).toBe(50);
    expect((await repo.get(date))?.note).toBe('remote');
    expect((await repo.get(date))?.dirtyFields).toEqual(cleanFields());
    db.close();
  });
  it('tracks writes in flight, remembers a failed write, and reports dirty fields', async () => {
    const { repo, db } = sqliteRepository();
    await repo.initialize();
    const pending: boolean[] = [];
    repo.onWriteState(() => pending.push(repo.writeState().pending));
    expect(await repo.hasDirty()).toBe(false);
    await repo.setField(date, 'value', 3);
    expect(pending).toEqual([true, false]);
    expect(await repo.hasDirty()).toBe(true);
    await expect(repo.setField(date, 'value', null)).rejects.toThrow(
      'cannot be cleared',
    );
    expect(repo.writeState()).toEqual({ pending: false, failed: true });
    await repo.setField(date, 'note', 'saved');
    expect(repo.writeState()).toEqual({ pending: false, failed: false });
    const sent = await repo.pushBatch();
    await repo.applyResponse(
      sent,
      response(
        sent.map((change, index) => ({
          ...mergeServer(null, change, Date.now()).entry,
          serverSeq: String(index + 1),
        })),
      ),
    );
    expect(await repo.hasDirty()).toBe(false);
    db.close();
  });
});

describe('sync engine', () => {
  function memoryServer(): Transport & {
    rows: Map<string, ServerEntry>;
    batches: number[];
    requests: number;
    uploads: string[];
  } {
    const rows = new Map<string, ServerEntry>();
    let seq = 0;
    return {
      rows,
      batches: [],
      requests: 0,
      uploads: [],
      async request(path, _identity, _method, body, signal) {
        if (signal.aborted) throw new Error('Aborted');
        this.requests++;
        if (path !== '/api/sync') return {};
        const input = body as SyncRequest;
        this.batches.push(input.changes.length);
        const applied = input.changes.map((change) => {
          const merged = mergeServer(
            rows.get(change.date) ?? null,
            change,
            Date.now(),
          );
          const stored = merged.changed
            ? { ...merged.entry, serverSeq: (++seq).toString() }
            : rows.get(change.date)!;
          rows.set(change.date, stored);
          return stored;
        });
        const pull = Array.from(rows.values())
          .filter((row) => BigInt(row.serverSeq) > BigInt(input.cursor ?? '0'))
          .sort((a, b) => Number(BigInt(a.serverSeq) - BigInt(b.serverSeq)));
        const page = pull.slice(0, 500);
        return {
          ...response(applied, page),
          cursor: page.at(-1)?.serverSeq ?? input.cursor ?? '0',
          hasMore: pull.length > 500,
        };
      },
      async upload(file) {
        this.uploads.push(file.audio_id);
      },
      async cleanup() {},
    };
  }
  const identity: Identity = {
    id: '7K3M9QX2PDA4',
    secret: null,
    registered: true,
  };
  function engine(repo: Repository, transport: Transport) {
    return new SyncEngine(
      repo,
      transport,
      () => identity,
      async () => undefined,
      () => undefined,
      () => undefined,
      async () => undefined,
    );
  }
  it('converges independent offline edits on two devices and retries idempotently', async () => {
    const a = sqliteRepository();
    const b = sqliteRepository();
    await a.repo.initialize();
    await b.repo.initialize();
    const server = memoryServer();
    await a.repo.setField(date, 'value', 7);
    await b.repo.setField(date, 'note', 'from phone B');
    const first = engine(a.repo, server);
    const second = engine(b.repo, server);
    first.configure(true, true);
    await first.sync();
    second.configure(true, true);
    await second.sync();
    await first.sync();
    expect((await a.repo.get(date))?.note).toBe('from phone B');
    expect((await b.repo.get(date))?.value).toBe(7);
    expect((await a.repo.get(date))?.dirtyFields).toEqual(cleanFields());
    const seq = server.rows.get(date)?.serverSeq;
    await first.sync();
    expect(server.rows.get(date)?.serverSeq).toBe(seq);
    await first.stop();
    await second.stop();
    a.db.close();
    b.db.close();
  });
  it('chunks pushes and pulls over multiple 500-row pages', async () => {
    const source = sqliteRepository();
    const restore = sqliteRepository();
    await source.repo.initialize();
    await restore.repo.initialize();
    for (let index = 0; index < 1005; index++)
      await source.repo.setField(
        addDays('2020-01-01', index),
        'value',
        (index % 10) + 1,
      );
    const server = memoryServer();
    const push = engine(source.repo, server);
    const pull = engine(restore.repo, server);
    push.configure(true, true);
    await push.sync();
    expect(server.batches.filter((size) => size > 0)).toEqual([500, 500, 5]);
    pull.configure(true, true);
    await pull.sync();
    expect(await restore.repo.list()).toHaveLength(1005);
    expect(await restore.repo.state('cursor')).toBe('1005');
    await push.stop();
    await pull.stop();
    source.db.close();
    restore.db.close();
  });
  it('makes no requests with sync disabled and cancels an in-flight request on disable', async () => {
    const { repo, db } = sqliteRepository();
    await repo.initialize();
    const server = memoryServer();
    const sync = engine(repo, server);
    sync.configure(false, true);
    await sync.sync();
    expect(server.requests).toBe(0);
    let started!: () => void;
    const began = new Promise<void>((resolve) => {
      started = resolve;
    });
    server.request = async (_path, _identity, _method, _body, signal) => {
      started();
      return new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('Aborted'))),
      );
    };
    sync.configure(true, true);
    const running = sync.sync();
    await began;
    await sync.stop();
    await running;
    expect(await repo.state('cursor')).toBeNull();
    db.close();
  });
  it('holds the mutex across concurrent triggers and uploads before pushing audio', async () => {
    const { repo, db } = sqliteRepository();
    await repo.initialize();
    const server = memoryServer();
    const audioId = 'b68d4f5e-4168-4d8b-ae7e-3c4df743364c';
    await repo.setField(date, 'audio', audioId, 1000, '/test.m4a');
    const original = server.request;
    let concurrent = 0;
    let maxConcurrent = 0;
    server.request = async function (...args) {
      concurrent++;
      maxConcurrent = Math.max(concurrent, maxConcurrent);
      expect(this.uploads).toContain(audioId);
      try {
        return await original.apply(this, args);
      } finally {
        concurrent--;
      }
    };
    const sync = engine(repo, server);
    sync.configure(true, true);
    await Promise.all([sync.sync(), sync.sync(), sync.sync()]);
    expect(maxConcurrent).toBe(1);
    expect(server.rows.get(date)?.audioId).toBe(audioId);
    await sync.stop();
    db.close();
  });
  it('reports a failed sync separately from a stopped one', async () => {
    const { repo, db } = sqliteRepository();
    await repo.initialize();
    await repo.setField(date, 'value', 3);
    const statuses: SyncStatus[] = [];
    const server = memoryServer();
    server.request = async () => {
      throw new Error('Offline');
    };
    const sync = new SyncEngine(
      repo,
      server,
      () => identity,
      async () => undefined,
      (status) => statuses.push(status),
      () => undefined,
      async () => undefined,
    );
    sync.configure(true, true);
    await sync.sync();
    expect(statuses.at(-1)).toBe('Could not sync, will retry');
    await sync.stop();
    db.close();
  });
});
