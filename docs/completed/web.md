# Web server and dashboard

**Status: completed** (the API parts of Phase 2, and Phase 4). Recording playback on the web is part of [voice recording](../voice-recording.md).

## API routes

| Route                                                         | Purpose                                                                                             |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `POST /api/ids/register`                                      | Register a newly generated ID + secret (mobile, idempotent)                                         |
| `POST /api/ids/verify`                                        | Check that an ID exists ("Use an existing ID" on mobile)                                            |
| `POST /api/ids/replace`                                       | Move data to a new ID                                                                               |
| `POST /api/session` / `DELETE /api/session`                   | Web login with ID / sign out                                                                        |
| `POST /api/sync`                                              | Mobile sync                                                                                         |
| `POST /api/audio/upload-url`                                  | Presigned upload URL (used once voice recording ships)                                              |
| `GET /api/audio/:audioId`                                     | Redirect to a presigned download URL (used once voice recording ships)                              |
| `GET /api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD`              | Dashboard data for a date range                                                                     |
| `GET /api/settings` / `PUT /api/settings`                     | Read or update the reminder settings (web session)                                                  |
| `DELETE /api/data`                                            | Delete all server data for the ID (profile, entries, settings, sessions; audio queued for deletion) |
| `GET /api/cron/audio-deletions`, `GET /api/cron/orphan-sweep` | Vercel Cron jobs (protected by `CRON_SECRET`)                                                       |
| `GET /api/health`                                             | Uptime checks                                                                                       |

## Dashboard page (`/dashboard`, session required)

- **Date range control:** presets **7D · 30D · 90D · 1Y · All**, plus a **custom** from/to picker. The range is kept in the URL query string (`?from=…&to=…`) so it can be bookmarked. Only the range goes in the URL, never the ID.
- **Summary tiles for the range:** average, min, max, days logged / days in range, and a current streak ([stats definitions](stats.md)).
- **Main chart: line chart of value over time.**
  - X = date, Y = 1–10 (fixed axis).
  - Days without a value show as **gaps** and are not interpolated to zero.
  - Optional toggle for a **7-day rolling average** overlay.
  - Long ranges switch to weekly or monthly averages, following the [shared rules](stats.md) (identical to the app).
  - Tooltip shows the date, the value, and a short note preview, if any. Points for days with a note get a small marker. Weekly and monthly points show their average and day count only, never a single day's note.
- **Secondary chart: distribution bar chart** showing how many days each value (1–10) was recorded in the range.
- **Entries table** below the charts, sorted newest first and paginated.
  - Columns: date, value, and note (full text, wrapped).
- Responsive layout so the dashboard also works on a phone browser.
- The server computes the summary, value counts, chart points, and the bucketed 7-day rolling average series with the shared helpers (`chartSeries`, `summary`, `valueCounts`) and sends only those bounded results; the browser never receives the range's raw rows. Note previews (80 characters) are attached only to daily (≤ 90-day) points. The rolling toggle only shows or hides the precomputed series.
- Login navigates straight to `/dashboard` with the browser-local 30D range (no extra refresh). Without a range in the URL, the server renders its UTC 30D default and the browser replaces the URL only when its local range differs.
- Recharts loads after hydration (`next/dynamic`, no SSR) inside fixed-height frames, so it stays out of the initial bundle without layout shift. The static page header and navigation render on the server.
- Chart data includes only the selected range and its six-day rolling-average lookback. The earliest entry date and the three most recent consecutive logged-day runs are fetched separately, in one query, as compact metadata, preserving All and the browser-local current streak even when the chart shows a short or empty historical range. Runs include the UTC + 1 day margin needed for other phones' local dates; future days never extend today's streak.
- Use neutral wording throughout: "value" or no label at all, never "mood". Page titles and the browser tab title stay generic.
- Entries are read-only on the web in v1. Editing them can come later, using the same per-field upsert. The only thing editable on the web is the reminder ([other web pages](#other-web-pages)).

## Other web pages

All buttons share a short press/release animation (2px dip and dimming), including login, range presets, pagination, sign out, and retry actions. Disabled buttons retain their disabled presentation. The browser's Reduce Motion preference keeps immediate dimming and removes movement and transitions.

- `/`: the ID entry page.
- `/settings` (session required): the **daily reminder**.
  - An on/off switch and a time picker (hour and minute, shown in 12h or 24h to match the browser's locale). Changes save on change, with a small "Saved" confirmation.
  - A note: "Reminders come from the app on your phone, in the phone's local time. Changes apply the next time the app syncs."
  - Neutral wording, with no mood terms.
- `/privacy`: the privacy policy.

## Phase 4: Web dashboard (done)

- ID entry page, server-side sessions, sign out, Origin checks.
- `GET /api/entries` and the dashboard with range presets and custom range in the URL.
- Line chart with gaps and the rolling average, distribution chart, summary tiles, and the entries table with notes.
- `/settings` page with the reminder switch and time picker.
