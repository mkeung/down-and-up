# Implementation review

**Status: completed.** Implementation started from an empty repository. These review findings changed the original plan, and all of them are implemented. Delivery notes and check results are in [`IMPLEMENTATION.md`](../IMPLEMENTATION.md).

- Per-field dirty flags are required in SQLite; a row-wide flag cannot safely acknowledge value/note while audio is pending.
- Clamped writes have durable per-field replay receipts. Without these, retrying a future timestamp after a dropped response would clamp it to a later server time and could overwrite a newer edit. Receipts move with Replace ID and are deleted with the profile.
- Registration and verification carry the ID only in the bearer header. Registration bodies contain only the registration secret.
- Object namespaces hash the profile ID so signed storage URLs cannot disclose the bearer credential.
- Local dates before 1900 remain supported, but are local-only to preserve the server validation floor. Dates use local calendar arithmetic, including years before 100.
- ID transitions use a durable SQLite reset marker, stop in-flight sync, and reset/re-queue state before resuming. Remote recordings are cached before a Merge transition so they can upload into the new namespace.
- Replace ID is a retryable operation keyed by a client-generated UUID. The server generates the new ID and secret, copies recordings before moving database rows, and invalidates old sessions. A short-lived hashed receipt allows retries after a lost response.
- Mobile charts use `react-native-svg` with shared chart points, gaps, neutral styling, and touch inspection, avoiding a Skia dependency for this small chart.
- Presigned GET links may be returned as JSON for mobile. This avoids forwarding a bearer header through a redirect to object storage.
- Uploaded audio IDs become immutable once referenced. HEAD checks validate size and content type. Deletion workers lock the owning profile and recheck references before deleting, so retries cannot remove a newly reused recording.
- Consent is decided before the first data request. Turning sync off aborts in-flight requests, clears retries, and cancels reminders.

## Performance and responsiveness

- Sparse long-range charts advance by bucket and use a sliding rolling window. In a desktop comparison, the 1900–2026 rolling overlay fell from about 4.15 seconds to 66ms; ten years fell from about 302ms to 6ms. These are helper timings, not native frame-rate measurements. Reproduce with `pnpm perf`.
- A 500-row mobile pull without recordings uses 23 SQL operations instead of 1,003, split across short transactions. Tests hold a chunk open, queue a tap, and verify the tap saves before the next chunk finishes; interrupted pages retain a replayable cursor.
- A changed 500-row value-only server push uses a fixed handful of SQL queries rather than at least 1,500. Integration coverage verifies sequence order, retries, timestamp receipts, field merges, UUID normalization, and queued audio deletions.
- Startup does not wait for notification scheduling or recording cleanup, and reads existence instead of materializing every entry. The database opens while fonts load, secure storage is read alongside SQLite, and startup `sync_state` keys come from one query. Reminder work coalesces during edits.
- A keypad tap no longer re-renders the whole app. The app context is split into a stable runtime (repository, engine, actions), a revision, and volatile status; providers memoize their values, and the keypad keys, tab bar, and animal artwork are memoized. Press feedback reuses its interpolations, and animal frame steps re-render only the artwork. The tapped key highlights optimistically and reverts if the write fails; Rate and the tab bar share one read of the selected day.
- Reminders change only for value saves from today on (cancelling just that day's notification) or syncs that changed settings or pulled such days, and rebuilds schedule only the difference. After a sync, pending work is checked with a one-row query instead of reading the whole table; each push batch is read once with audio upload state joined in, not one query per row.
- Animal reaction and trick sheets are prefetched shortly after startup where the platform exposes a URI (the dev server and iOS bundle files); Android release builds load them from the APK on demand. Sound clips load when saved sound settings are applied, and repeat taps rewind and play in the same tick.
- Mobile History reads the visible range only while focused and creates calendar rows on demand. Preferences and empty sync pages do not publish entry revisions; Settings receives sync metadata through its own subscription.
- Web range changes send only server-computed chart points (both the value and rolling series), summary, and counts, with note previews only for daily ranges; earliest-date and consecutive-run metadata come from one query. Database and browser tests preserve All, lifetime streaks, historical empty ranges, and table pagination.
- Login lands directly on the local 30D range in one render instead of three. Recharts is code-split out of the initial dashboard bundle, and the entries table no longer bundles zod.
- A value-only 500-row push uses seven SQL queries (settings come from the lock query). Storage `HEAD` checks are limited to audio changes that could win the merge. Replace ID moves rows with one set-based statement instead of one `UPDATE` per entry; deletion queueing is a single `INSERT … SELECT`. Audio upload grants no longer hold the profile lock. Rate-limit counters and limiter calls share one concurrent Redis round trip.

Deployment and release require environment credentials, a configured public server origin, a real privacy contact, confirmed provider encryption/backup retention, EAS accounts, and device/store checks. These cannot be inferred from repository contents. See [v1 launch](../v1-launch.md) and the [`RELEASE.md`](../RELEASE.md) checklist; local test/build results do not replace device testing.
