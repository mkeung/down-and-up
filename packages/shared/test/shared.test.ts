import { afterEach, describe, expect, it } from 'vitest';
import {
  addDays,
  applyAcknowledgment,
  applyPull,
  changeSchema,
  chartPoints,
  cleanFields,
  currentStreak,
  dailyPoints,
  emptyEntry,
  entrySchema,
  exportCsv,
  formatIdForDisplay,
  generateId,
  isCalendarDate,
  isFutureDate,
  isValidId,
  mergeServer,
  normalizeId,
  pendingChange,
  presetRange,
  reminderSchedule,
  rollingAverage,
  serverSyncRequestSchema,
  summary,
  todayLocal,
  uploadSchema,
  valueCounts,
  type Change,
  type LocalEntry,
} from '../src';

describe('identity', () => {
  it('normalizes all supported input and rejects excluded characters', () => {
    expect(normalizeId('oilk - 9qx2 pda4')).toBe('011K9QX2PDA4');
    expect(isValidId('7k3m-9qx2 pda4')).toBe(true);
    expect(isValidId('7K3U9QX2PDA4')).toBe(false);
    expect(isValidId('7K3M9QX2PDA')).toBe(false);
    expect(formatIdForDisplay('7k3m9qx2pda4')).toBe('7K3M 9QX2 PDA4');
  });
  it('maps cryptographic bytes without alphabet bias', () => {
    expect(
      generateId(
        () =>
          new Uint8Array([0, 31, 32, 63, 64, 95, 96, 127, 128, 159, 160, 255]),
      ),
    ).toBe('0Z0Z0Z0Z0Z0Z');
  });
});

describe('calendar dates', () => {
  const originalTimezone = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTimezone;
  });
  it.each([
    'America/Los_Angeles',
    'America/New_York',
    'Pacific/Kiritimati',
    'Pacific/Honolulu',
  ])('keeps local days in %s across DST', (timezone) => {
    process.env.TZ = timezone;
    expect(todayLocal(new Date(2026, 2, 8, 23, 30))).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(isFutureDate('2026-10-11', new Date(2026, 9, 10, 23, 59))).toBe(
      true,
    );
  });
  it('validates actual dates and permits old local dates', () => {
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2024-02-29')).toBe(true);
    expect(addDays('1899-12-31', 1)).toBe('1900-01-01');
    expect(addDays('0001-01-01', 1)).toBe('0001-01-02');
    expect(isCalendarDate('2026-13-01')).toBe(false);
  });
});

describe('shared statistics', () => {
  const rows = [
    { date: '2026-10-01', value: 3 },
    { date: '2026-10-02', value: null },
    { date: '2026-10-03', value: 7 },
    { date: '2026-10-04', value: 5 },
  ];
  it('counts only logged days and keeps gaps', () => {
    expect(summary(rows, '2026-10-01', '2026-10-05')).toEqual({
      average: 5,
      min: 3,
      max: 7,
      logged: 3,
      days: 5,
    });
    expect(
      dailyPoints(rows, '2026-10-01', '2026-10-05').map((point) => point.value),
    ).toEqual([3, null, 7, 5, null]);
    expect(valueCounts(rows, '2026-10-01', '2026-10-05')[6]).toEqual({
      value: 7,
      count: 1,
    });
    expect(summary([], '2026-10-01', '2026-10-05').average).toBeNull();
  });
  it('uses daily, ISO weekly, and monthly thresholds, including empty buckets', () => {
    expect(
      chartPoints(rows, '2026-10-01', addDays('2026-10-01', 89)),
    ).toHaveLength(90);
    const weekly = chartPoints(rows, '2026-10-01', addDays('2026-10-01', 90));
    expect(weekly[0]).toEqual({ date: '2026-09-28', value: 5, count: 3 });
    expect(weekly[1]?.value).toBeNull();
    expect(
      chartPoints(rows, '2026-10-01', addDays('2026-10-01', 729))[0]?.date,
    ).toBe('2026-09-28');
    expect(
      chartPoints(rows, '2026-10-01', addDays('2026-10-01', 730))[0]?.date,
    ).toBe('2026-10-01');
  });
  it('requires four logged days for a rolling average and includes preceding days', () => {
    const data = [...rows, { date: '2026-10-05', value: 9 }];
    expect(
      rollingAverage(data, '2026-10-04', '2026-10-05').map(
        (point) => point.value,
      ),
    ).toEqual([null, 6]);
  });
  it('preserves a streak until today ends and excludes note-only rows', () => {
    expect(currentStreak(rows, '2026-10-05')).toBe(2);
    expect(currentStreak(rows, '2026-10-04')).toBe(2);
    expect(currentStreak(rows, '2026-10-06')).toBe(0);
    expect(presetRange('30D', '2026-10-10')).toEqual({
      from: '2026-09-11',
      to: '2026-10-10',
    });
  });
});

describe('field-level sync', () => {
  const date = '2026-10-10';
  const audioId = 'b68d4f5e-4168-4d8b-ae7e-3c4df743364c';
  const entry = {
    ...emptyEntry(date),
    value: 3,
    valueUpdatedAt: 10,
    note: 'first',
    noteUpdatedAt: 20,
    audioId,
    audioDurationMs: 5000,
    audioUpdatedAt: 30,
  };
  it('merges independent edits, preserves a value and supports explicit removals', () => {
    const a = mergeServer(
      entry,
      { date, value: 8, valueUpdatedAt: 40 },
      100,
    ).entry;
    const b = mergeServer(
      a,
      { date, note: 'second', noteUpdatedAt: 50 },
      100,
    ).entry;
    expect(b.value).toBe(8);
    expect(b.note).toBe('second');
    const removed = mergeServer(
      b,
      {
        date,
        value: null,
        valueUpdatedAt: 60,
        note: null,
        noteUpdatedAt: 60,
        audioId: null,
        audioDurationMs: null,
        audioUpdatedAt: 60,
      },
      100,
    );
    expect(removed.entry.value).toBe(8);
    expect(removed.entry.valueUpdatedAt).toBe(40);
    expect(removed.entry.note).toBeNull();
    expect(removed.removedAudio).toBe(audioId);
  });
  it('is idempotent and adopts clamped timestamps', () => {
    const change: Change = { date, value: 9, valueUpdatedAt: 1_000_000 };
    const merged = mergeServer(entry, change, 100);
    expect(merged.entry.valueUpdatedAt).toBe(100);
    const local: LocalEntry = {
      ...entry,
      value: 9,
      valueUpdatedAt: 1_000_000,
      dirtyFields: { ...cleanFields(), value: true },
    };
    const adopted = applyAcknowledgment(
      local,
      change,
      { ...merged.entry, serverSeq: '1' },
      [],
    );
    expect(adopted.valueUpdatedAt).toBe(100);
    expect(adopted.dirtyFields.value).toBe(false);
    expect(
      mergeServer(merged.entry, { date, value: 9, valueUpdatedAt: 100 }, 100)
        .changed,
    ).toBe(false);
  });
  it('keeps edits made during a request dirty while acknowledging other fields', () => {
    const local: LocalEntry = {
      ...entry,
      value: 8,
      valueUpdatedAt: 45,
      note: 'editing',
      noteUpdatedAt: 65,
      dirtyFields: { value: true, note: true, audio: true },
    };
    const sent: Change = {
      date,
      value: 8,
      valueUpdatedAt: 45,
      note: 'sent',
      noteUpdatedAt: 55,
    };
    const server = {
      ...entry,
      value: 8,
      valueUpdatedAt: 45,
      note: 'sent',
      noteUpdatedAt: 55,
      serverSeq: '2',
    };
    const ack = applyAcknowledgment(local, sent, server, []);
    expect(ack.value).toBe(8);
    expect(ack.dirtyFields.value).toBe(false);
    expect(ack.note).toBe('editing');
    expect(ack.dirtyFields.note).toBe(true);
    expect(ack.dirtyFields.audio).toBe(true);
    expect(applyPull(ack, server).note).toBe('editing');
  });
  it('holds audio back and never acknowledges a missing file', () => {
    const local: LocalEntry = {
      ...entry,
      dirtyFields: { value: true, note: false, audio: true },
    };
    expect(pendingChange(local, false)).toEqual({
      date,
      value: 3,
      valueUpdatedAt: 10,
    });
    const sent = pendingChange(local, true)!;
    const missing = mergeServer(null, sent, 100, false);
    expect(missing.entry.audioId).toBeNull();
    expect(missing.missingAudio).toBe(audioId);
    expect(
      applyAcknowledgment(local, sent, { ...missing.entry, serverSeq: '1' }, [
        audioId,
      ]).dirtyFields.audio,
    ).toBe(true);
  });
  it('allows server winners to replace dirty fields independently', () => {
    const local: LocalEntry = {
      ...entry,
      dirtyFields: { value: true, note: true, audio: false },
    };
    const result = applyPull(local, {
      ...entry,
      value: 8,
      valueUpdatedAt: 40,
      note: 'older',
      noteUpdatedAt: 10,
      serverSeq: '3',
    });
    expect(result.value).toBe(8);
    expect(result.dirtyFields.value).toBe(false);
    expect(result.note).toBe('first');
    expect(result.dirtyFields.note).toBe(true);
  });
});

describe('validation', () => {
  const schema = serverSyncRequestSchema(new Date('2026-10-10T23:00:00Z'));
  it('normalizes audio UUIDs in uploads, changes, and stored entries', () => {
    const audioId = 'B68D4F5E-4168-4D8B-AE7E-3C4DF743364C';
    const change = {
      date: '2026-10-10',
      audioId,
      audioDurationMs: 1000,
      audioUpdatedAt: 1,
    };
    expect(uploadSchema.parse({ audioId, size: 1000 }).audioId).toBe(
      audioId.toLowerCase(),
    );
    expect(changeSchema.parse(change).audioId).toBe(audioId.toLowerCase());
    expect(
      entrySchema.parse({ ...emptyEntry(change.date), ...change }).audioId,
    ).toBe(audioId.toLowerCase());
  });
  it('requires paired fields and validates batch, time, and date bounds', () => {
    const change = { date: '2026-10-11', value: 7, valueUpdatedAt: 1 };
    expect(schema.safeParse({ cursor: null, changes: [change] }).success).toBe(
      true,
    );
    for (const invalid of [
      { ...change, date: '2026-10-12' },
      { ...change, date: '1899-12-31' },
      { ...change, value: 1.5 },
      { date: '2026-10-10', note: 'a' },
      { date: '2026-10-10', audioId: null, audioUpdatedAt: 1 },
    ]) {
      expect(
        schema.safeParse({ cursor: null, changes: [invalid] }).success,
      ).toBe(false);
    }
    expect(
      schema.safeParse({
        cursor: null,
        changes: Array.from({ length: 501 }, () => change),
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ cursor: '9223372036854775808', changes: [] }).success,
    ).toBe(false);
  });
});

describe('local reminders', () => {
  const originalTimezone = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTimezone;
  });
  it('uses 30 local calendar days across DST, skips logged and passed days', () => {
    process.env.TZ = 'America/Los_Angeles';
    const schedule = reminderSchedule(
      { reminderEnabled: true, reminderTime: '20:00' },
      new Set(['2026-03-08']),
      new Date(2026, 2, 7, 21),
      true,
      true,
    );
    expect(schedule).toHaveLength(28);
    expect(schedule[0]?.date).toBe('2026-03-09');
    expect(schedule.every((item) => item.at.getHours() === 20)).toBe(true);
    expect(schedule[0]?.at.getTimezoneOffset()).toBe(420);
  });
  it('does nothing when sync, reminder, or permission is off', () => {
    for (const [enabled, sync, permission] of [
      [false, true, true],
      [true, false, true],
      [true, true, false],
    ])
      expect(
        reminderSchedule(
          { reminderEnabled: enabled!, reminderTime: '20:00' },
          new Set(),
          new Date(),
          sync!,
          permission!,
        ),
      ).toEqual([]);
  });
});

it('exports escaped CSV without spreadsheet formula injection', () => {
  expect(
    exportCsv([
      { date: '2026-10-10', value: 7, note: '=HYPERLINK("x")\nhello' },
    ]),
  ).toContain('"\'=HYPERLINK(""x"")\nhello"');
});
