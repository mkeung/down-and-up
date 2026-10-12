# Data model

**Status: completed.** The SQLite and Postgres schemas. The audio columns exist but stay empty until [voice recording](../voice-recording.md) ships.

## Key decision: store the day as a calendar date string, not a timestamp

An entry belongs to the day the user picked, stored as `YYYY-MM-DD` in the user's local calendar. This avoids timezone bugs. For example, an entry logged at 11pm in New York must not turn into "tomorrow" in UTC.

## Key decision: each field gets its own timestamp

The value, the note, and the recording for a day can be edited separately, possibly on two different phones. Each one has its own `*_updated_at` so the merge happens per field. For example, a value changed on phone A and a note added on phone B for the same day both survive.

## Mobile (SQLite)

```sql
CREATE TABLE entries (
  date               TEXT PRIMARY KEY,   -- 'YYYY-MM-DD'
  value              INTEGER CHECK (value BETWEEN 1 AND 10),  -- NULL if the day only has a note/recording
  value_updated_at   INTEGER,            -- client epoch ms
  note               TEXT,               -- NULL = no note; max 2,000 chars
  note_updated_at    INTEGER,
  audio_id           TEXT,               -- UUID of the recording; NULL = none
  audio_duration_ms  INTEGER,
  audio_updated_at   INTEGER,
  dirty              INTEGER NOT NULL DEFAULT 1, -- aggregate of the three field flags
  value_dirty        INTEGER NOT NULL DEFAULT 0,
  note_dirty         INTEGER NOT NULL DEFAULT 0,
  audio_dirty        INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE audio_files (
  audio_id    TEXT PRIMARY KEY,
  local_path  TEXT,                      -- NULL if not downloaded on this device yet
  uploaded    INTEGER NOT NULL DEFAULT 0 -- 1 = file is on the server
);
CREATE TABLE sync_state (
  key   TEXT PRIMARY KEY,                -- 'cursor', 'last_synced_at', 'reminder' (JSON from server)
  value TEXT
);
```

The identity record `{ id, secret, registered }` lives in `expo-secure-store`, not in SQLite. All three are kept together so they survive or disappear together (see [identity: lifecycle](identity.md#lifecycle) for the reinstall rules).

## Server (Postgres)

```sql
profiles (
  id           text PRIMARY KEY,         -- the unique ID, normalized (uppercase, no spaces)
  secret_hash  text NOT NULL,            -- hash of the registering device's secret (identity.md)
  seq          bigint NOT NULL DEFAULT 0,-- per-profile change counter (sync.md)
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen    timestamptz
);
entries (
  profile_id         text REFERENCES profiles(id) ON DELETE CASCADE,
  date               date NOT NULL,
  value              smallint CHECK (value BETWEEN 1 AND 10),
  value_updated_at   timestamptz,
  note               text,
  note_updated_at    timestamptz,
  audio_id           uuid,
  audio_duration_ms  integer,
  audio_updated_at   timestamptz,
  server_seq         bigint NOT NULL,    -- set from profiles.seq on every insert AND update; pull cursor
  PRIMARY KEY (profile_id, date)
);
CREATE INDEX ON entries (profile_id, server_seq);

settings (                               -- per-ID settings, edited on the web (reminders.md)
  profile_id        text PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  reminder_enabled  boolean NOT NULL DEFAULT false,
  reminder_time     text NOT NULL DEFAULT '20:00',  -- 'HH:MM', 24h, phone-local wall-clock time
  updated_at        timestamptz NOT NULL DEFAULT now()
);

sessions (                               -- web sessions (identity.md)
  id          text PRIMARY KEY,          -- random; the cookie holds this, signed
  profile_id  text REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL
);

audio_deletions (                        -- queue drained by a cron job (voice-recording.md)
  object_key   text PRIMARY KEY,
  delete_after timestamptz NOT NULL
);
```

Audio objects are stored at `audio/<sha256(profile_id)>/<audio_id>.m4a`. Hashing the profile namespace prevents the bearer ID from appearing in presigned URLs.

`server_seq` is deliberately **not** a `bigserial`. A sequence only assigns a number on insert, and concurrent transactions can commit out of order, which would let a client's cursor skip rows. See [sync: conflict resolution](sync.md#conflict-resolution-last-write-wins-per-field) for how it's assigned.
