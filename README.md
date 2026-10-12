# Down & Up

A discreet daily 1–10 record. The Expo app saves values and notes in SQLite and works offline. Voice recording is built but turned off until Phase 6 (`RECORDING_ENABLED` in `packages/shared`). The Next.js app provides the sync API and a read-only dashboard. Access uses a device-generated ID; there are no accounts or authentication SDKs.

[`docs/README.md`](docs/README.md) indexes the plans that define the product and protocol: active plans in `docs/`, completed ones in `docs/completed/`. The [implementation review](docs/completed/implementation-review.md) records the changes required to make the original plan consistent.

## Requirements

- Node.js 24 and pnpm 12.9.1.
- For native development: Xcode / CocoaPods on macOS or Android Studio and a configured emulator.
- For integration tests: PostgreSQL (`initdb`, `postgres`) and Redis (`redis-server`, `redis-cli`) on PATH. These tests create isolated temporary instances containing synthetic data, then remove them.
- For web E2E: Chrome, or an installed Playwright Chromium with `PLAYWRIGHT_CHANNEL=''`.

## Commands

```sh
pnpm install --frozen-lockfile
pnpm dev                  # web, http://localhost:3000
pnpm dev:mobile           # Expo development server
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test                 # unit tests; database integration suite is skipped here
pnpm test:integration     # real Postgres and Redis, isolated temporary instances
pnpm test:web             # temporary services, Next.js, and Playwright; no hosted credentials needed
pnpm build                # production web build, safe without environment secrets
pnpm --filter @down-up/mobile export   # iOS and Android JavaScript bundles
pnpm --filter @down-up/mobile ios      # native simulator build
pnpm --filter @down-up/mobile android  # native emulator build
pnpm db:generate          # generate Drizzle migrations after schema changes
pnpm db:migrate           # apply migrations to the configured DATABASE_URL
```

The unit tests use Node's built-in SQLite. Integration tests exercise the real Postgres locks and cursor behavior. Web tests use real local Redis through an Upstash REST adapter and an in-process S3 fixture. The S3 fixture exercises uploads, HEAD validation, downloads, copies, and deletions; live Cloudflare signature enforcement still needs staging verification.

## Configuration

Copy `apps/web/.env.example` to `apps/web/.env.local`, and fill in a Postgres connection string, Upstash REST credentials, R2 bucket credentials and endpoint, a random session-signing secret of at least 32 characters, a cron secret, `APP_ORIGIN`, and a privacy contact. Keep secrets out of source control. Use TLS for hosted database connections and HTTPS for the public origin. Give the R2 key access only to the private application bucket; disable public bucket access.

For mobile sync, copy `apps/mobile/.env.example` to `apps/mobile/.env.local` and set `EXPO_PUBLIC_API_URL` to the public server origin. This value is public configuration, not a credential. It must be HTTPS outside development. Without a server origin, the app remains fully usable locally and explains that the server is not configured.

Build the mobile app with a development build for notification and audio testing. Expo Go does not replace native acceptance testing. Bundle identifiers in `app.config.ts` should be confirmed before creating store records.

## Storage and sync

- Calendar days are local `YYYY-MM-DD` strings. Dates before 1900 are supported locally and are excluded from server sync.
- Each field has its own timestamp and dirty flag. Writes use monotonic local timestamps; pushes send only dirty groups whose audio has uploaded.
- Every sync transaction locks the profile and allocates its own `server_seq` for inserts and updates. Pulls and pushes are capped at 500 rows.
- Acknowledgments adopt server timestamps for accepted groups that have not changed in flight. Rejected or pending audio remains dirty.
- Future-clock writes have replay receipts, so retrying a lost response cannot advance a clamped timestamp and overwrite later work.
- The ID, registration secret, and registered flag share one SecureStore record. A reset marker makes identity transitions recoverable across interruption. SQLite does not hold the identity or registration secret.
- Signed session cookies hold opaque session IDs. Cookie mutations require the configured Origin. Every profile lookup uses shared rate limits.
- Audio object paths contain a SHA-256 namespace, never the bearer ID. PUT URLs sign size, type, and a conditional write header. Audio is immutable after upload. Cleanup runs through a durable queue and protected cron routes.
- Reminders are local one-off notifications for the next 30 calendar days, in phone-local time, with logged days skipped. They are rebuilt on sync, edits, foreground, date changes, and timezone-offset changes.

## Native acceptance tests

Maestro flows are in `tests/mobile`. Install [Maestro](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli), build the app, and run:

```sh
maestro test tests/mobile/local.yaml
```

Run the additional two-phone, reinstall, identity transition, notification, and audio interruption checks in `docs/RELEASE.md` on both platforms. The background-task trigger is optional in the plan; foreground, connectivity, local edits, and manual sync are the supported triggers in this implementation.

The recording flows in `tests/mobile/deferred` (`audio.yaml`, `playback.yaml`) apply once recording is turned on. `playback.yaml` checks playback and deletion when a recording is already cached. Simulator capture requires a working host audio input; a silent `.m4a` fixture can be used to test playback separately. Audio preparation and playback are bounded and cancelled when leaving the screen, so delayed operations cannot start recording or playback in the background.

## Deployment

Set the Vercel project root to `apps/web`; use the workspace install command and the web build script. `apps/web/vercel.json` declares two daily jobs, staggered by twelve hours, compatible with Vercel Hobby. Both drain audio deletions; the second also sweeps orphans. Both require `CRON_SECRET`. Vercel invokes cron jobs on production deployments only. For preview staging, run the protected routes manually to verify cleanup. Apply the tracked migrations before starting traffic, connect the private R2 bucket and Upstash database, and set environment variables separately for staging and production. Migrations prefer `DATABASE_URL_UNPOOLED` when provided.

After connecting all staging services, run `DOWN_UP_STAGING_URL=<preview-url> vercel env run -- pnpm test:staging` from the linked repository. This checks real registration, field sync, sessions, reminders, and audio upload/download using a temporary profile, then deletes the profile and queues its recording for cleanup. It keeps credentials and the generated ID out of output.

Monitor `du:security:lookup-alert` in Redis for the global guessing threshold. No outbound alert integration is configured. Self-hosting behind another proxy requires adapting the trusted IP-header boundary; the deployed implementation trusts Vercel's overwritten forwarding header and treats development traffic as one local IP.

Release gates and store copy are in `docs/RELEASE.md`. Deployment, provider configuration, store submission, and physical-device testing are separate from a passing local build.
