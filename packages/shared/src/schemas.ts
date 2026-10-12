import { z } from 'zod';
import { addDays, isCalendarDate, todayUTC } from './dates';
import { isValidId, normalizeId } from './ids';

export const MAX_BATCH = 500;
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
export const MAX_AUDIO_DURATION_MS = 5 * 60 * 1000;
export const MAX_NOTE_LENGTH = 2000;
export const SYNC_DATE_FLOOR = '1900-01-01';
export const timestampSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const dateSchema = z
  .string()
  .refine(isCalendarDate, 'Invalid calendar date');
export const idSchema = z
  .string()
  .transform(normalizeId)
  .refine(isValidId, 'Invalid ID');
export const secretSchema = z.string().regex(/^[0-9a-f]{32}$/);
export const identitySchema = z.object({
  id: idSchema,
  secret: secretSchema.nullable(),
  registered: z.boolean(),
});
export type Identity = z.infer<typeof identitySchema>;
export const settingsSchema = z
  .object({
    reminderEnabled: z.boolean(),
    reminderTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  })
  .strict();
export type Settings = z.infer<typeof settingsSchema>;
export const DEFAULT_SETTINGS: Settings = {
  reminderEnabled: false,
  reminderTime: '20:00',
};

export const entrySchema = z
  .object({
    date: dateSchema,
    value: z.number().int().min(1).max(10).nullable(),
    valueUpdatedAt: timestampSchema.nullable(),
    note: z.string().max(MAX_NOTE_LENGTH).nullable(),
    noteUpdatedAt: timestampSchema.nullable(),
    audioId: z.uuid().nullable(),
    audioDurationMs: z
      .number()
      .int()
      .min(1)
      .max(MAX_AUDIO_DURATION_MS)
      .nullable(),
    audioUpdatedAt: timestampSchema.nullable(),
  })
  .strict()
  .superRefine((row, ctx) => {
    for (const [field, time] of [
      ['value', 'valueUpdatedAt'],
      ['note', 'noteUpdatedAt'],
      ['audioId', 'audioUpdatedAt'],
    ] as const) {
      if (row[field] !== null && row[time] === null)
        ctx.addIssue({
          code: 'custom',
          path: [time],
          message: 'A timestamp is required',
        });
    }
    if ((row.audioId === null) !== (row.audioDurationMs === null))
      ctx.addIssue({
        code: 'custom',
        path: ['audioDurationMs'],
        message: 'Audio ID and duration must be present together',
      });
  });
export type Entry = z.infer<typeof entrySchema>;
export const serverEntrySchema = entrySchema.safeExtend({
  serverSeq: z.string().regex(/^\d+$/),
});
export type ServerEntry = z.infer<typeof serverEntrySchema>;

export const changeSchema = z
  .object({
    date: dateSchema,
    value: z.number().int().min(1).max(10).nullable().optional(),
    valueUpdatedAt: timestampSchema.optional(),
    note: z.string().max(MAX_NOTE_LENGTH).nullable().optional(),
    noteUpdatedAt: timestampSchema.optional(),
    audioId: z.uuid().nullable().optional(),
    audioDurationMs: z
      .number()
      .int()
      .min(1)
      .max(MAX_AUDIO_DURATION_MS)
      .nullable()
      .optional(),
    audioUpdatedAt: timestampSchema.optional(),
  })
  .strict()
  .superRefine((row, ctx) => {
    for (const [field, time] of [
      ['value', 'valueUpdatedAt'],
      ['note', 'noteUpdatedAt'],
      ['audioId', 'audioUpdatedAt'],
    ] as const) {
      if ((row[field] === undefined) !== (row[time] === undefined))
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: 'Field and timestamp must be provided together',
        });
    }
    if (
      row.audioId !== undefined &&
      ((row.audioId === null) !== (row.audioDurationMs === null) ||
        row.audioDurationMs === undefined)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['audioDurationMs'],
        message: 'Audio ID and duration must be provided together',
      });
    if (row.audioId === undefined && row.audioDurationMs !== undefined)
      ctx.addIssue({
        code: 'custom',
        path: ['audioId'],
        message: 'Audio ID is required',
      });
    if (
      row.valueUpdatedAt === undefined &&
      row.noteUpdatedAt === undefined &&
      row.audioUpdatedAt === undefined
    )
      ctx.addIssue({
        code: 'custom',
        message: 'At least one field group is required',
      });
  });
export type Change = z.infer<typeof changeSchema>;
export const syncRequestSchema = z
  .object({
    cursor: z.string().regex(/^\d+$/).max(20).nullable(),
    changes: z.array(changeSchema).max(MAX_BATCH),
  })
  .strict();
export function serverSyncRequestSchema(now = new Date()) {
  return syncRequestSchema.superRefine((request, ctx) => {
    const dates = new Set<string>();
    request.changes.forEach((change, index) => {
      if (
        change.date < SYNC_DATE_FLOOR ||
        change.date > addDays(todayUTC(now), 1)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['changes', index, 'date'],
          message: 'Date is outside the sync range',
        });
      if (dates.has(change.date))
        ctx.addIssue({
          code: 'custom',
          path: ['changes', index, 'date'],
          message: 'Duplicate date',
        });
      dates.add(change.date);
    });
    if (request.cursor && BigInt(request.cursor) > 9223372036854775807n)
      ctx.addIssue({
        code: 'custom',
        path: ['cursor'],
        message: 'Invalid cursor',
      });
  });
}
export type SyncRequest = z.infer<typeof syncRequestSchema>;
export const syncResponseSchema = z
  .object({
    applied: z.array(serverEntrySchema).max(MAX_BATCH),
    changes: z.array(serverEntrySchema).max(MAX_BATCH),
    cursor: z.string().regex(/^\d+$/).nullable(),
    hasMore: z.boolean(),
    missingAudio: z.array(z.uuid()).max(MAX_BATCH),
    settings: settingsSchema,
  })
  .strict();
export type SyncResponse = z.infer<typeof syncResponseSchema>;
export const uploadSchema = z
  .object({
    audioId: z.uuid(),
    size: z.number().int().min(1).max(MAX_AUDIO_BYTES),
  })
  .strict();
export const signedUrlSchema = z
  .object({
    url: z.url(),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .strict();
export const uploadResponseSchema = z.union([
  signedUrlSchema,
  z.object({ uploaded: z.literal(true) }).strict(),
]);
export const registerSchema = z.object({ secret: secretSchema }).strict();
export const replaceSchema = z.object({ operationId: z.uuid() }).strict();
