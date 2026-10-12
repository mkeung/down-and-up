# Implementation and verification

The plan review identified field-level dirty tracking, durable clamped-write receipts, hashed audio namespaces, and recoverable ID transitions as necessary for correct sync and credential privacy. These are implemented and recorded in [the implementation review](completed/implementation-review.md).

## Delivered

- Strict TypeScript pnpm workspace, lint/format checks, and CI.
- Shared validation, ID/date utilities, field merges, chart/statistics calculations, reminder dates, and CSV export.
- Expo SQLite app with Today/History/Settings, instant keypad saves, notes, recordings, offline consent/privacy, local notifications, sync, identity transitions, CSV and recording ZIP exports.
- Next.js API/dashboard with PostgreSQL migrations, per-profile locking and cursors, opaque server sessions, Origin checks, Upstash limits, signed R2 audio operations, and durable cleanup.
- Neutral icon/splash, dark mode, store-copy draft, EAS profiles, and release checklist.

## Checks completed

- TypeScript, ESLint, Prettier, and production Next.js build.
- 40 unit tests for shared logic, SQLite/sync and phone-only cleanup, session signatures, environment aliases, response-body cancellation, and bounded native audio operations.
- 9 integration tests against actual temporary PostgreSQL and Redis services, including pagination, concurrent sync, idempotent registration, clamped replay, missing audio, and ID replacement.
- 5 Playwright flows covering history/ranges, notes, AAC playback, reminder persistence, sign-out, Origin rejection, cleanup, and shared rate limits. The object-storage fixture is local; live R2 enforcement remains a separate check.
- iOS and Android JavaScript bundles export successfully.
- The iOS 27 simulator Release build succeeds with Expo 57 scene support enabled. Simulator builds must be locally signed for Keychain access.
- Two native Maestro flows pass: offline values/notes/history, selected dates and restart persistence; and playback/deletion of a ten-second silent fixture. Phone-only deletion also removes the file from disk.
- Native capture verification is blocked on this simulator by invalid CoreAudio input devices and a zero-channel input stream. Capture, interruptions, and Bluetooth still require real-device testing.
- Vercel preview builds successfully; protected landing and database health endpoints return HTTP 200.

## Staging resources

- Team: `mikekeung-4887s-projects`.
- Project: [down-and-up](https://vercel.com/mikekeung-4887s-projects/down-and-up).
- Preview: [Down & Up](https://down-and-pa5nl7mta-mikekeung-4887s-projects.vercel.app), protected by Vercel Authentication.
- Automated checks use the project's short-lived Vercel token. The phone app needs an API origin it can reach without Vercel Authentication before hosted device sync checks; protection has not been disabled.
- Neon: `down-and-up-staging-db`, connected to Preview and Development; migrations applied.
- Session signing and cron secrets are configured for Preview.
- Hosted registration, value/note sync, opaque sessions, and reminder persistence pass against Neon and Upstash. The temporary test profile was deleted afterward.
- Upstash: `down-and-up-staging-limits`, connected to Preview and Development. The server accepts Vercel's `KV_REST_API_URL`/`KV_REST_API_TOKEN` aliases. Rate limiting fails closed if Redis is unavailable; no in-memory fallback is used.
- Cloudflare R2 requires endpoint, private bucket, and scoped credentials in the project dashboard. Live audio verification has not been completed.

After the account setup is complete, redeploy to pick up environment changes and run `pnpm test:staging` through `vercel env run`, as described in `README.md`. The script creates a temporary profile, verifies the hosted flow, then deletes it and queues its recording for cleanup.

## Release gates

The implementation is not a production/store release. Real-device audio and two-phone sync checks, Android native runtime checks, signed EAS builds/store submission, actual privacy contact, and confirmed provider encryption/backup retention remain in `RELEASE.md`. Preview cron routes require manual execution; production scheduled cleanup uses two staggered daily jobs on Hobby.
