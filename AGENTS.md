# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

**Down & Up** is a discreet daily 1–10 tracker. The repo will contain:

- an offline-first mobile app (iOS + Android) for recording one value per day, with an optional text note (audio recording is deferred; see `docs/voice-recording.md`),
- a web dashboard where users view their history as charts after entering their unique ID.

**`docs/` is the source of truth** for features, data model, sync protocol, and phases. Start at `docs/README.md`, which indexes the plans, and read the plans relevant to your work before starting. Active plans live in `docs/`; fully completed plans live in `docs/completed/` and describe the app as built. If a change departs from a plan, update that plan in the same change, and record any new decision in `docs/decisions.md`. When a plan's work is fully done, fold it into the matching completed plan and move it to `docs/completed/`.

## Status

The shared package, Expo app, Next.js API/dashboard, migrations, and test suites are implemented. Hosted infrastructure and release/device gates remain in `docs/RELEASE.md`. Work on the active plans listed in `docs/README.md`, unless told otherwise.

## Layout (planned)

```
apps/mobile/      Expo (React Native) + TypeScript, expo-router, expo-sqlite, expo-audio
apps/web/         Next.js (App Router) + TypeScript: dashboard UI and /api routes
packages/shared/  zod schemas, sync protocol types, date utils, ID utils, stats helpers
```

Package manager: **pnpm 12.9.1** workspaces, Node.js 24.

Commands: `pnpm install --frozen-lockfile`, `pnpm dev`, `pnpm dev:mobile`, `pnpm test`, `pnpm test:integration`, `pnpm test:web`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm db:migrate`. See `README.md` for environment setup and native builds.

## Product rules (don't break these)

- **Discretion:** the app tracks mood, but **never** say "mood" (or similar words like feelings or emotions) anywhere users can see it. That includes:
  - UI copy, the web dashboard, page and tab titles,
  - the app name and icon, the store listing,
  - permission prompts and notifications.

  Use neutral words like "value" and "note", or no label at all. All ten keys share one neutral color, with no color gradients or emoji that suggest good or bad.

- **Keypad:** 3×3 grid `1 2 3 / 4 5 6 / 7 8 9`, with `10` alone and centered in the bottom row. Keys are at least 64×64pt. The selected key stays highlighted, and the highlight doesn't rely on color alone.
- **One entry per day:** tapping a number saves right away (no save button) and overwrites that day's value. Tapping the selected number does nothing. **A value can never be cleared.** Notes and recordings can be edited or removed.
- **Dates:** default to today. Future dates are never allowed. There is no lower limit.
- **Offline-first:** every feature, including History, works with no network. All reads come from local SQLite. The network is used only for sync.
- **No accounts:** access is a device-generated **12-character Crockford Base32 ID**. There's no email, no password, and no auth library. The web login is just that ID.
- **Reminders:** set only on the web (on/off + `HH:MM`). The phone schedules them as local notifications in **phone-local time**, skips days that already have a value, and uses neutral text ("Down & Up" / "Reminder"). No server push (`docs/completed/reminders.md`).
- **Sync consent:** a one-time notice on first launch. Sync is on by default, and "keep on this phone only" must always work: no network calls with user data while sync is off.
- **Recording is deferred:** keep every recording control, marker, and playback behind `RECORDING_ENABLED` from `packages/shared`, and request no microphone permission. The audio columns, sync fields, and server routes stay so Phase 6 needs no migration.

## Technical invariants

- **Store days as `YYYY-MM-DD` local calendar strings**, never timestamps. Don't convert them through UTC.
- **Merge per field with last-write-wins.** Value, note, and audio each carry their own `*_updated_at`. Never merge whole rows. The server must reject a `null` value replacing an existing one.
- **Assign `server_seq` under a per-profile lock.** It is never a `bigserial`. Each sync transaction locks the `profiles` row (`FOR UPDATE`) and assigns `server_seq = ++profiles.seq` on every insert **and** update. Otherwise cursors can skip rows.
- **Pulls are paginated** (`hasMore`). Pushes are chunked. Both are capped at 500 rows.
- **Adopt the server's version of acknowledged rows.** After a push, rows unchanged since the push take the server's stored version, timestamps included, and are marked clean. Rows edited mid-sync stay dirty. Pushes must stay idempotent.
- **Switching IDs resets sync state.** "Use an existing ID" with Merge marks every row dirty, re-queues every recording, and resets the cursor. Discard deletes local data and resets the cursor. Never silently generate a new ID when the database has synced history but the ID is missing; prompt instead (`docs/completed/identity.md`, Lifecycle).
- **Audio uploads before its fields sync.**
  - A row's audio fields are pushed only after its file has uploaded through a presigned URL with `Content-Length` and `Content-Type` signed.
  - The server checks (`HEAD`) that the object exists before accepting audio fields. If it doesn't, the server returns the ID in `missingAudio`.
  - Object deletion only goes through the `audio_deletions` queue and cron jobs, never as fire-and-forget work after a response.
- **Treat the ID like a secret.**
  - Normalize it with the shared `normalizeId()` (uppercase; drop spaces and dashes; `O`→`0`, `I`/`L`→`1`).
  - Send it only in the `Authorization: Bearer` header.
  - Web sessions are server-side rows. The cookie holds a signed session ID, never the ID itself.
  - **Never** put it in URLs, cookies, page titles, analytics, or logs. Log a hash instead.
  - Rate-limit every endpoint that looks up an ID, per IP and globally, through Upstash Redis. In-memory counters don't work on serverless.
- **Keep the identity record together.** `{ id, secret, registered }` is one secure-storage record, never split between secure storage and SQLite. Registration is idempotent: the same secret means `200`, a different secret means `409`.
- **Keep shared logic shared.** Validation (zod), date math, ID utilities, and chart/stats calculations live in `packages/shared`. Mobile and web must use these rather than reimplementing them, so both show identical numbers. Stats follow the definitions in `docs/completed/stats.md` exactly (logged day, bucketing thresholds, rolling average, streak).
- **Validation limits** (enforce on client and server): value is an integer 1–10; note ≤ 2,000 characters; audio ≤ 5 minutes and ≤ 5 MB, one recording per day; dates from `1900-01-01` to UTC today + 1 day; client timestamps more than 5 minutes in the future are clamped.
- **Privacy:** no third-party analytics, ad, or tracking SDKs. Don't store IP addresses with entries. Android Auto Backup stays disabled. Cookie-authenticated mutations check the `Origin` header.

## Conventions

- TypeScript `strict` everywhere. Avoid `any`.
- Match the surrounding code's style, naming, and comment density.
- Add tests with each change. Priorities:
  1. the merge and sync logic,
  2. date handling across timezones and DST,
  3. ID normalization,
  4. the stats helpers.

  Mobile E2E uses Maestro. Web E2E uses Playwright.

- Accessibility: every interactive element has an accessibility label (the keypad labels are just the numbers), and font scaling is supported.
- Never commit secrets (database URLs, R2 keys, the session signing secret). Use `.env.local` and keep `.env.example` up to date.
- Commit messages: imperative mood, with a short summary line.
