# AGENTS.md

Down & Up is a discreet daily 1–10 tracker: an offline Expo app and a Next.js API/history dashboard. Values and notes ship now; recording is built but deferred to Phase 6.

## Start here

- Read [docs/README.md](docs/README.md) and the plans relevant to the task. `docs/` is the source of truth: active plans describe pending work; `docs/completed/` describes the app as built.
- Work on the active plans unless instructed otherwise. Update affected plans and `docs/decisions.md` when changing direction. Fold finished work into its completed plan and move fully completed plans to `docs/completed/`.
- Implementation is built; remaining infrastructure, device, and store gates are in `docs/RELEASE.md`. Setup, commands, and native rebuilds are in `README.md`; signing/install steps are in `docs/DEPLOYMENT.md`.

## Workspace

Node.js 24; pnpm 12.9.1 workspaces. `apps/mobile/` uses Expo, React Native, expo-router, SQLite, and expo-audio. `apps/web/` uses Next.js App Router and Postgres. `packages/shared/` owns zod validation, sync types/merges, dates, IDs, and chart/stats calculations. Reuse shared logic; stats must match `docs/completed/stats.md`. Follow `apps/web/AGENTS.md` for Next.js work.

## Product rules

- **Discretion:** never expose “mood,” “feelings,” “emotions,” or equivalent wording in UI, titles, app identity, store copy, permissions, or notifications. Use “value,” “note,” or no label. All numeric keys use the same neutral color; no value gradients or good/bad emoji.
- **Keypad:** `1 2 3 / 4 5 6 / 7 8 9`, with `10` centered alone below; targets ≥64×64pt. Selection persists and uses more than color. Tapping saves immediately, replacing that day's value; tapping the selected value does nothing. Values cannot be cleared; notes/recordings can.
- **Dates/offline:** default to local today, allow any earlier day, never a future day. All mobile reads, including History, use local SQLite; network is only for sync. Dates before 1900 stay local.
- **Identity/consent:** no accounts, email, password, or auth library. Access uses a device-generated 12-character Crockford Base32 ID. Show the one-time sync notice; sync defaults on. Phone-only mode must make no network requests with user data.
- **Reminders:** configured only on the web (on/off + `HH:MM`); scheduled as phone-local notifications, skipping logged days. Text: “Down & Up” / “Reminder”. No server push (`docs/completed/reminders.md`).
- **Deferred audio:** gate all recording controls, markers, playback, and export behind shared `RECORDING_ENABLED`; request no microphone permission. Retain audio columns, protocol fields, and server routes (`docs/voice-recording.md`).

## Data and sync invariants

- Store days as local `YYYY-MM-DD` strings; never convert through UTC or store them as timestamps.
- Merge value, note, and audio separately with last-write-wins and their own `*_updated_at`. Reject a null value replacing an existing value.
- Each sync transaction locks the profile row (`FOR UPDATE`) and assigns `server_seq = ++profiles.seq` on every insert/update; never use `bigserial`. Pull with `hasMore`; chunk pushes; cap both at 500 rows.
- Pushes stay idempotent. Acknowledged rows unchanged since push adopt the server's stored fields/timestamps and become clean; edits made during sync stay dirty. Preserve durable replay receipts for clamped timestamps.
- Switching IDs resets the cursor. Merge marks all rows dirty and re-queues every recording; Discard deletes local data. If synced history exists but identity is missing, prompt instead of generating a new ID. Preserve recoverable transitions (`docs/completed/identity.md`).
- Upload audio before pushing its fields. Presigned PUTs sign `Content-Length`, `Content-Type`, and `If-None-Match`; objects are immutable. Server HEAD checks reject missing audio through `missingAudio`. Use hashed profile namespaces. Delete objects only through `audio_deletions` and cron jobs.
- Validate value as integer 1–10, note ≤2,000 characters, audio ≤5 minutes/5 MB and one per day. Sync dates range from `1900-01-01` to UTC today +1 day; this transport allowance does not permit future-day entry in the UI. Clamp client timestamps >5 minutes ahead.

## Security and conventions

- Normalize IDs with shared `normalizeId()` (uppercase, remove spaces/dashes, `O`→`0`, `I`/`L`→`1`). Send only in `Authorization: Bearer`; never expose in URLs, cookies, titles, analytics, or logs. Log a hash. Cookies hold signed server-side session IDs; cookie mutations check `Origin`.
- Store `{ id, secret, registered }` together in one SecureStore record, never in SQLite. Registration is idempotent: same secret →200, different secret →409. Rate-limit ID lookup endpoints per IP and globally with shared Postgres counters; no in-memory counters.
- No third-party analytics, ads, or tracking SDKs; no IP addresses stored with entries. Keep Android Auto Backup disabled. Never commit secrets; use ignored `.env.local` and maintain `.env.example`.
- TypeScript strict; avoid `any`. Match surrounding style. Label interactive elements accessibly (keypad labels are just numbers) and support font scaling.
- Add tests for behavior changes, prioritizing merge/sync, timezone/DST dates, ID normalization, and stats. Mobile E2E: Maestro; web E2E: Playwright. Use the relevant checks listed in `README.md`.
- Commit messages: short imperative summary.
