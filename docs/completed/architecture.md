# Architecture and foundations

**Status: completed.** Stack choices, repo layout, and the Phase 0 foundations.

## Tech stack

| Layer                     | Choice                                                          | Why                                                                                                                                |
| ------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Mobile                    | **Expo (React Native) + TypeScript**                            | One codebase for iOS and Android. EAS handles builds and store submission.                                                         |
| Navigation (mobile)       | **expo-router** with a bottom tab bar                           | Two tabs: Rate and Pawsitive. History and Settings are routes without a tab.                                                       |
| Local storage             | **expo-sqlite**                                                 | Durable and queryable, and it holds the sync metadata.                                                                             |
| Audio (deferred)          | **expo-audio** (record + playback) + **expo-file-system**       | Records AAC `.m4a` files and stores them in the app's documents directory. See [voice recording](../voice-recording.md).           |
| Connectivity              | `@react-native-community/netinfo`                               | Starts a sync when the device comes back online.                                                                                   |
| Reminders                 | **expo-notifications** (local, scheduled on the phone)          | Fires offline, with no push server, device tokens, or per-minute cron job.                                                         |
| ID storage                | `expo-secure-store`                                             | Keeps the unique ID, its registration secret, and its registered flag together in the Keychain on iOS and the Keystore on Android. |
| Web + API                 | **Next.js (App Router) + TypeScript**                           | The dashboard UI and the REST API live in one deployable app.                                                                      |
| Database                  | **PostgreSQL** (Neon / Supabase / RDS) + **Drizzle ORM**        |                                                                                                                                    |
| Audio storage (deferred)  | **Cloudflare R2** (S3-compatible; Vercel Blob or S3 also work)  | Cheap object storage with no download (egress) fees. Files move through short-lived presigned URLs.                                |
| Access                    | **ID-based, no accounts** (custom, see [identity](identity.md)) | No email, no password, no third-party auth library.                                                                                |
| Rate limiting             | **Upstash Redis** + `@upstash/ratelimit`                        | Serverless instances share no memory, so limits need a shared store. A Postgres table also works at small scale.                   |
| Scheduled jobs            | **Vercel Cron**                                                 | Runs the audio deletion queue and the orphaned-file sweep ([voice recording](../voice-recording.md)).                              |
| Charts (web)              | **Recharts**                                                    | Simple and good enough for line and bar charts.                                                                                    |
| Charts (mobile)           | **react-native-svg**                                            | Lightweight SVG charts using the shared chart points, avoiding a Skia dependency for this small chart.                             |
| Validation / shared types | **zod** in a shared package                                     | Mobile and server validate payloads the same way.                                                                                  |
| Hosting                   | Vercel (web/API) + managed Postgres + R2 + Upstash              | No third-party analytics or ad SDKs anywhere.                                                                                      |

## Repo layout (pnpm workspaces monorepo)

```
apps/
  mobile/        # Expo app
  web/           # Next.js dashboard + /api
packages/
  shared/        # zod schemas, types, date utils, sync protocol types,
                 # ID generate/normalize/validate,
                 # chart/stats helpers (ranges, gap filling, rolling avg, summaries)
```

## Phase 0: Foundations (done)

- Set up the monorepo (pnpm, TypeScript, ESLint/Prettier, CI running lint and tests).
- `packages/shared`:
  - zod schemas for `Entry` and the sync request/response.
  - Date utilities (`todayLocal()`, `isFutureDate()`, `addDays()`) using `date-fns`. Days before 1900 stay local and are omitted from pushes; the UI explains this when such a day is selected.
  - ID utilities: `generateId()`, `normalizeId()`, `isValidId()`, `formatIdForDisplay()`.
  - Stats helpers implementing the [stats definitions](stats.md), used by both the mobile History screen and the web dashboard: range presets → from/to, gap filling, bucketing, rolling average, summary stats, streak, and value counts.
