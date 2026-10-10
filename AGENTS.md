# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

**Down & Up** is a discreet daily 1–10 tracker. The repo will contain:
- an offline-first mobile app (iOS + Android) for recording one value per day, with an optional text note and audio recording,
- a web dashboard where users view their history as charts after entering their unique ID.

**`PLAN.md` is the source of truth** for features, data model, sync protocol, and phases. Read it before starting work. If a change departs from the plan, update `PLAN.md` in the same change, and record any new decision in its "Decisions made" section.

## Status

Planning only. No code exists yet. Build in the phase order from `PLAN.md` §8, unless told otherwise.

## Layout (planned)

```
apps/mobile/      Expo (React Native) + TypeScript, expo-router, expo-sqlite, expo-audio
apps/web/         Next.js (App Router) + TypeScript: dashboard UI and /api routes
packages/shared/  zod schemas, sync protocol types, date utils, ID utils, stats helpers
```
Package manager: **pnpm** workspaces. Once tooling exists, list the real commands here (install, dev, test, lint, typecheck, build).

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
- **No accounts:** access is a device-generated **10-character Crockford Base32 ID**. There's no email, no password, and no auth library. The web login is just that ID.

## Technical invariants

- **Store days as `YYYY-MM-DD` local calendar strings**, never timestamps. Don't convert them through UTC.
- **Merge per field with last-write-wins.** Value, note, and audio each carry their own `*_updated_at`. Never merge whole rows. The server must reject a `null` value replacing an existing one.
- **Clear `dirty` only for rows unchanged since the push.** Compare timestamps so edits made during a sync aren't lost. Sync pushes must stay idempotent.
- **Audio uploads before its fields sync.** A row's audio fields are pushed only after its file has uploaded through a presigned URL, so the server never references a missing file.
- **Treat the ID like a secret.**
  - Normalize it with the shared `normalizeId()` (uppercase; drop spaces and dashes; `O`→`0`, `I`/`L`→`1`).
  - Send it only in the `Authorization: Bearer` header or the web session cookie.
  - **Never** put it in URLs, page titles, analytics, or logs. Log a hash instead.
  - Rate-limit every endpoint that looks up an ID.
- **Keep shared logic shared.** Validation (zod), date math, ID utilities, and chart/stats calculations live in `packages/shared`. Mobile and web must use these rather than reimplementing them, so both show identical numbers.
- **Validation limits** (enforce on client and server): value is an integer 1–10; note ≤ 2,000 characters; audio ≤ 5 minutes and ≤ 5 MB, one recording per day; dates from `1900-01-01` to UTC today + 1 day.

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
