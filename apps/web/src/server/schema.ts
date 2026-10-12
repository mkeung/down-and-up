import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(),
  secretHash: text('secret_hash').notNull(),
  audioNamespace: text('audio_namespace').notNull().unique(),
  seq: bigint('seq', { mode: 'bigint' })
    .notNull()
    .default(sql`0`),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
});
export const entries = pgTable(
  'entries',
  {
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    date: date('date', { mode: 'string' }).notNull(),
    value: smallint('value'),
    valueUpdatedAt: timestamp('value_updated_at', {
      withTimezone: true,
      mode: 'date',
    }),
    note: text('note'),
    noteUpdatedAt: timestamp('note_updated_at', {
      withTimezone: true,
      mode: 'date',
    }),
    audioId: uuid('audio_id'),
    audioDurationMs: integer('audio_duration_ms'),
    audioUpdatedAt: timestamp('audio_updated_at', {
      withTimezone: true,
      mode: 'date',
    }),
    serverSeq: bigint('server_seq', { mode: 'bigint' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.profileId, table.date] }),
    index('entries_profile_seq').on(table.profileId, table.serverSeq),
    check('value_bounds', sql`${table.value} BETWEEN 1 AND 10`),
    check('note_length', sql`length(${table.note}) <= 2000`),
    check(
      'audio_duration_bounds',
      sql`${table.audioDurationMs} BETWEEN 1 AND 300000`,
    ),
    check(
      'audio_pair',
      sql`(${table.audioId} IS NULL) = (${table.audioDurationMs} IS NULL)`,
    ),
  ],
);
export const settings = pgTable(
  'settings',
  {
    profileId: text('profile_id')
      .primaryKey()
      .references(() => profiles.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    reminderEnabled: boolean('reminder_enabled').notNull().default(false),
    reminderTime: text('reminder_time').notNull().default('20:00'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'reminder_time_format',
      sql`${table.reminderTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`,
    ),
  ],
);
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('session_expiration').on(table.expiresAt)],
);
export const audioDeletions = pgTable(
  'audio_deletions',
  {
    objectKey: text('object_key').primaryKey(),
    namespace: text('namespace').notNull(),
    deleteAfter: timestamp('delete_after', { withTimezone: true }).notNull(),
  },
  // drainDeletions reads due jobs in delete_after order.
  (table) => [index('audio_deletions_due').on(table.deleteAfter)],
);
export const replacementReceipts = pgTable(
  'replacement_receipts',
  {
    oldIdHash: text('old_id_hash').notNull(),
    operationId: uuid('operation_id').notNull(),
    sealedIdentity: text('sealed_identity').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.oldIdHash, table.operationId] })],
);
export const clampedWrites = pgTable(
  'clamped_writes',
  {
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    date: date('date', { mode: 'string' }).notNull(),
    field: text('field').notNull(),
    clientTimestamp: bigint('client_timestamp', { mode: 'bigint' }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.profileId,
        table.date,
        table.field,
        table.clientTimestamp,
      ],
    }),
  ],
);
