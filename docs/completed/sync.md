# Sync design

**Status: completed** (the sync parts of Phase 2, and Phase 3). Audio transfer is part of [voice recording](../voice-recording.md).

## Protocol: one endpoint, push + pull in one round trip

`POST /api/sync` (`Authorization: Bearer <ID>`)

```jsonc
// request
{
  "cursor": "1834",                 // last server_seq the client has seen (null on first sync)
  "changes": [                      // all local rows with dirty = 1
    {
      "date": "2026-10-10",
      "value": 7,         "valueUpdatedAt": 1791648000000,
      "note": "long walk", "noteUpdatedAt": 1791648100000,
      "audioId": "3f1c…",  "audioDurationMs": 42000, "audioUpdatedAt": 1791648200000
    }
  ]
}
// response
{
  "applied": [ /* the server's stored version of every pushed row, after merge + clamping */ ],
  "changes": [ /* up to 500 rows with server_seq > cursor, ordered by server_seq */ ],
  "cursor": "1840",                 // server_seq of the last row in `changes`
  "hasMore": false,                 // true → client immediately calls again with the new cursor and no changes
  "missingAudio": [],               // audioIds whose file isn't on the server yet; client re-uploads (voice-recording.md)
  "settings": { "reminderEnabled": true, "reminderTime": "20:00" }  // always included (reminders.md)
}
```

- Each field group (value / note / audio) is optional in a change. The client only sends the groups that changed. Until [voice recording](../voice-recording.md) ships, the audio group stays empty.
- **Pulls are paginated.** A new phone pulling years of history loops until `hasMore` is `false`. Pushes are chunked the same way ([server-side validation](#server-side-validation)).

## Conflict resolution: last-write-wins per field

- **Ordering:** each sync request runs in one transaction that first locks the profile row (`SELECT … FROM profiles WHERE id = $1 FOR UPDATE`).
  - Every inserted **or updated** entry gets `server_seq = profiles.seq + 1`, and `profiles.seq` is incremented.
  - Concurrent syncs for the same ID are therefore serialized, and `server_seq` values always become visible in commit order. A cursor can never skip a row.
  - Different IDs never block each other.
- For each field group, the server takes the incoming version **only if** its `*UpdatedAt` is newer than the stored one.
- **Value can't be cleared:** a `null` value is never accepted over an existing one.
- **Notes and recordings can be cleared:** `null` plus a newer timestamp removes them.
- When a recording is replaced or removed, the old object key is inserted into `audio_deletions` in the same transaction. A cron job deletes it later ([voice recording: audio transfer](../voice-recording.md#audio-transfer)).
- **Acknowledged rows:** for each row in `applied` that hasn't changed locally since the push, the client **replaces its local copy with the server's version, timestamps included**, and clears `dirty`.
  - Rows edited during the sync (detected by comparing per-field timestamps) keep those fields dirty, so a tap or keystroke made mid-sync isn't lost. Only transmitted and accepted field groups are acknowledged; pending or rejected audio remains dirty.
- **Pulled rows:** the client applies each pulled field group only if the local copy of that group is not dirty, or the pulled timestamp is newer.
- Pushes are **idempotent**, so retries are always safe.
- Server batches load existing entries and matching replay receipts in bulk, merge in memory under the profile lock, and upsert the merged rows together. Each changed row still increments the per-profile sequence, and acknowledged audio UUIDs retain Postgres's lowercase representation.
- The profile lock query also reads the reminder settings, and the bearer ID's existence is proven by that lock rather than a separate lookup (an unknown ID still counts as a failed lookup). The request body is read while the rate limits are checked.
- Storage is checked (`HEAD`, 32 at a time) only for audio changes that could win the merge: an incoming `audioId` whose clamped `audioUpdatedAt` is newer than the stored one. Retries and older changes are not checked; they can never be accepted. A newer change for the already-stored `audioId` is still checked, so a missing object is reported in `missingAudio` and re-uploaded.
- **Replace ID** renumbers the moved rows in one statement (`row_number()` in the old `server_seq` order), leaving the new profile's `seq` equal to the highest assigned. Recording copies run 16 at a time under the lock before any row moves; the old keys and, for Delete, every referenced key are queued for deletion with one `INSERT … SELECT`.
- After a sync the phone checks for remaining work with one `hasDirty()` query. Each push batch is read once, with audio upload state joined in, so audio fields still wait for their upload. `applyResponse` returns the pulled dates and whether reminder settings changed, so the after-sync hook skips reminder rebuilds that change nothing.
- Mobile pages use bulk reads/writes in transactions of at most 50 dates so queued local edits can run between chunks. The cursor, reminder settings, and last-sync time commit only after all chunks succeed. An interrupted page can therefore replay safely without skipping rows; dirty edits made between chunks still use the same per-field merge rules. Entry revisions and sync-settings notifications are separate.
- **Clock limitation:** LWW relies on device clocks, which is fine for one person on one or two phones.
  - The server clamps timestamps more than 5 minutes in the future to `now()`.
  - Because the client adopts the server's stored timestamps, a phone with a fast clock can't keep a stale value that beats newer edits.

## When sync runs

iOS background execution is unreliable, so sync **opportunistically**:

1. **After each change**, debounced ~2s, when online.
2. **On app foreground** (AppState → active).
3. **On connectivity regained** (NetInfo).
4. **On manual "Sync now"** / pull-to-refresh in History.
5. **Background task** (`expo-background-task`) as a bonus. It is not relied on.

Failures retry with exponential backoff (cap ~5 min while foregrounded). Only one sync runs at a time, enforced with a mutex.

## Server-side validation

- **ID:** 12 valid Crockford Base32 characters after normalization, and registered.
- **`value`:** an integer from 1 to 10.
- **`reminderTime`:** `HH:MM`, 24-hour, `00:00`–`23:59`. **`reminderEnabled`:** a boolean.
- **`note`:** at most 2,000 characters.
- **Audio:** at most 5 MB and 5 minutes. `audioId` must be a UUID.
- **`date`:**
  - It must be a valid date **on or before the current UTC date + 1 day**. That one day of leeway covers timezones ahead of UTC (e.g., Pacific/Kiritimati). The future-date rule is mainly enforced by the client.
  - There is no lower limit apart from a sanity floor of `1900-01-01`.
- **Batch size:** at most 500 changes per push and 500 rows per pull. The client splits larger pushes into chunks.
- **Rate limiting:** per ID and per IP, enforced through Upstash ([security model](identity.md#security-model-accepted-trade-offs)).

## Build checklist (done)

### Phase 2: Server, sync parts

- Next.js app, Postgres schema, Drizzle migrations, Upstash.
- Idempotent ID register (with secret) and verify endpoints, bearer-ID middleware, per-IP and global rate limiting.
- `POST /api/sync`:
  - per-profile row lock and `seq` assignment,
  - per-field LWW with timestamp clamping,
  - `applied` rows in the response,
  - paginated pulls,
  - validation.
- `settings` table, `GET`/`PUT /api/settings`, and settings included in every sync response.
- Deploy to staging.

### Phase 3: Sync in the mobile app

- Sync engine: register the ID, push dirty field groups, adopt `applied` rows, pull pages until `hasMore` is false, merge. Includes triggers, backoff, mutex, and the status indicator.
- Startup reconciliation of ID vs. database ([identity: lifecycle](identity.md#lifecycle)).
- "Use an existing ID" with merge (mark all dirty, re-queue recordings, reset cursor) or discard.
- Sync off/on states, and "Delete my data" with both of its outcomes.
- Replace ID.
- Reminders: store the synced settings, ask for notification permission, schedule 30 days of notifications (skipping logged days), rebuild the schedule on the [reminder triggers](reminders.md), and open Rate when a notification is tapped. Read-only reminder row in Settings.
- ✅ Done: offline edits on two phones sharing an ID (value on one, note on the other, same day) converge correctly after both come online. (Real-device two-phone testing remains a release gate in [v1 launch](../v1-launch.md).)
