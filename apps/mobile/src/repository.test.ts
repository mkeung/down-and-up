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
import { SyncEngine, type Transport } from './sync-engine';

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
  return { repo: new Repository(adapter), db };
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
    expect(await repo.state('ui_theme')).toBe('blue');
    expect(edit).not.toHaveBeenCalled();
    expect(await repo.pushBatch()).toEqual([]);
    await repo.resetSync(false);
    expect(await repo.state('ui_theme')).toBe('blue');
    await repo.resetSync(true);
    expect(await repo.state('ui_theme')).toBe('blue');
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
});
