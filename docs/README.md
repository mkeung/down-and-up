# Down & Up: Daily 1–10 Tracker Plan

This folder is the source of truth for features, data model, sync protocol, and phases. It replaces the former monolithic `PLAN.md`.

## What it does

- **Mobile app (iOS + Android):**
  - Pick a day: today or any earlier day, as far back as you like, but never a future day.
  - Tap a number from 1–10. The number you tap stays highlighted, and tapping a different number replaces it.
  - Each day can also have an optional **text note**. An optional **audio recording** is deferred to a later release ([voice recording](voice-recording.md)).
  - A History view shows past values as a list and a chart.
  - Everything is stored on the device, so the app works offline. It syncs to the server on its own when a connection is available.
- **No accounts, no sign-in.** On first launch the app generates a short **unique ID** (letters and numbers only). That ID is what links the phone's data to the server. A one-time notice explains that entries sync to the server. Syncing is on by default, and the user can choose to keep data on the phone only.
- **Web app:** enter your ID to see your numbers and notes (and recordings, once they ship) over time, with simple charts and an adjustable date range. The web is also where you turn on an optional **daily reminder** and set its time.

**At most one entry per calendar day.** Selecting a number updates that day's value. A value can be changed but never cleared. The note and recording for a day can be edited or removed.

**Discreet by design:** the app tracks mood, but nothing in the UI, web dashboard, app name, icon, store listing, permission prompts, or notifications says so. The main screen shows only a date and the numbers 1–10, with no labels, prompts, or emotive colors or emoji.

## Plans

### Active

| Plan                                    | Status                                    |
| --------------------------------------- | ----------------------------------------- |
| [v1 launch](v1-launch.md)               | In progress (Phase 5: polish and release) |
| [Data status icon](data-status-icon.md) | Planned, part of v1                       |
| [Visual direction](visual-direction.md) | Direction chosen, mobile UI to implement  |
| [Voice recording](voice-recording.md)   | Deferred (Phase 6); built but hidden      |

### Completed

| Plan                                                        | Covers                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| [Architecture](completed/architecture.md)                   | Tech stack, repo layout, Phase 0 foundations                 |
| [Data model](completed/data-model.md)                       | SQLite and Postgres schemas                                  |
| [Mobile app](completed/mobile-app.md)                       | Rate, Pawsitive, History, Settings, offline-first (Phase 1)  |
| [Stats](completed/stats.md)                                 | Shared stats definitions                                     |
| [Reminders](completed/reminders.md)                         | Daily reminder set on the web, delivered by the phone        |
| [Identity](completed/identity.md)                           | The ID, web login, new phones, security, data protection     |
| [Sync](completed/sync.md)                                   | Protocol, per-field merge, triggers, validation (Phases 2–3) |
| [Web](completed/web.md)                                     | API routes and dashboard (Phase 4)                           |
| [Testing](completed/testing.md)                             | Test strategy                                                |
| [Implementation review](completed/implementation-review.md) | Changes found while building                                 |

### Other docs

- [Decisions made](decisions.md): the running decision log.
- [`RELEASE.md`](RELEASE.md): device, infrastructure, and store release checklist.
- [`IMPLEMENTATION.md`](IMPLEMENTATION.md): what was delivered and how it was verified.

## How plans work

- **One plan per feature or area.** Active plans sit in `docs/` and describe only what they add or change.
- **Completed plans** sit in `docs/completed/` and describe the app as built. When an active plan is fully done, fold its changes into the matching completed plan (or move it as is), and move it to `completed/`.
- **Changing course:** if a change departs from a plan, update that plan in the same change, and record the decision in [decisions](decisions.md).
- **Phases:** 0–4 are done (see the completed plans), 5 is [v1 launch](v1-launch.md), and 6 is [voice recording](voice-recording.md). Rough total for phases 0–5: about 11–12 weeks for one developer.
