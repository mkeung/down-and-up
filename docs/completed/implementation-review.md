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

Deployment and release require environment credentials, a configured public server origin, a real privacy contact, confirmed provider encryption/backup retention, EAS accounts, and device/store checks. These cannot be inferred from repository contents. See [v1 launch](../v1-launch.md) and the [`RELEASE.md`](../RELEASE.md) checklist; local test/build results do not replace device testing.
