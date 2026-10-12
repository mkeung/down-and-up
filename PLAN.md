# Down & Up: Daily 1–10 Tracker Plan

## 1. What it does

- **Mobile app (iOS + Android):**
  - Pick a day: today or any earlier day, as far back as you like, but never a future day.
  - Tap a number from 1–10. The number you tap stays highlighted, and tapping a different number replaces it.
  - Each day can also have an optional **text note**. An optional **audio recording** is deferred to a later release (see below).
  - A History view shows past values as a list and a chart.
  - Everything is stored on the device, so the app works offline. It syncs to the server on its own when a connection is available.
- **No accounts, no sign-in.** On first launch the app generates a short **unique ID** (letters and numbers only). That ID is what links the phone's data to the server. A one-time notice explains that entries sync to the server. Syncing is on by default, and the user can choose to keep data on the phone only.
- **Web app:** enter your ID to see your numbers and notes (and recordings, once they ship) over time, with simple charts and an adjustable date range. The web is also where you turn on an optional **daily reminder** and set its time.

**At most one entry per calendar day.** Selecting a number updates that day's value. A value can be changed but never cleared. The note and recording for a day can be edited or removed.

**Deferred: voice recording.** The first release records a value and a text note only. The audio design in this plan (marked _deferred_) is kept for a later release, Phase 6 (§8). The data model and sync protocol keep their audio fields so recording can be turned on without a migration (§10).

**Discreet by design:** the app tracks mood, but nothing in the UI, web dashboard, app name, icon, store listing, permission prompts, or notifications says so. The main screen shows only a date and the numbers 1–10, with no labels, prompts, or emotive colors or emoji.

---

## 2. Tech stack (recommended)

| Layer                     | Choice                                                         | Why                                                                                                                                |
| ------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Mobile                    | **Expo (React Native) + TypeScript**                           | One codebase for iOS and Android. EAS handles builds and store submission.                                                         |
| Navigation (mobile)       | **expo-router** with a bottom tab bar                          | Two tabs: Rate and Pawsitive. History and Settings are routes without a tab.                                                       |
| Local storage             | **expo-sqlite**                                                | Durable and queryable, and it holds the sync metadata.                                                                             |
| Audio (deferred)          | **expo-audio** (record + playback) + **expo-file-system**      | Records AAC `.m4a` files and stores them in the app's documents directory.                                                         |
| Connectivity              | `@react-native-community/netinfo`                              | Starts a sync when the device comes back online.                                                                                   |
| Reminders                 | **expo-notifications** (local, scheduled on the phone)         | Fires offline, with no push server, device tokens, or per-minute cron job.                                                         |
| ID storage                | `expo-secure-store`                                            | Keeps the unique ID, its registration secret, and its registered flag together in the Keychain on iOS and the Keystore on Android. |
| Web + API                 | **Next.js (App Router) + TypeScript**                          | The dashboard UI and the REST API live in one deployable app.                                                                      |
| Database                  | **PostgreSQL** (Neon / Supabase / RDS) + **Drizzle ORM**       |                                                                                                                                    |
| Audio storage (deferred)  | **Cloudflare R2** (S3-compatible; Vercel Blob or S3 also work) | Cheap object storage with no download (egress) fees. Files move through short-lived presigned URLs.                                |
| Access                    | **ID-based, no accounts** (custom, see §5)                     | No email, no password, no third-party auth library.                                                                                |
| Rate limiting             | **Upstash Redis** + `@upstash/ratelimit`                       | Serverless instances share no memory, so limits need a shared store. A Postgres table also works at small scale.                   |
| Scheduled jobs            | **Vercel Cron**                                                | Runs the audio deletion queue and the orphaned-file sweep (§6.3).                                                                  |
| Charts (web)              | **Recharts**                                                   | Simple and good enough for line and bar charts.                                                                                    |
| Charts (mobile)           | **victory-native** (Skia-based, works with Expo)               | Native-speed line and bar charts with touch tooltips. A simpler alternative is `react-native-gifted-charts`.                       |
| Validation / shared types | **zod** in a shared package                                    | Mobile and server validate payloads the same way.                                                                                  |
| Hosting                   | Vercel (web/API) + managed Postgres + R2 + Upstash             | No third-party analytics or ad SDKs anywhere.                                                                                      |

**Repo layout (pnpm workspaces monorepo):**

```
apps/
  mobile/        # Expo app
  web/           # Next.js dashboard + /api
packages/
  shared/        # zod schemas, types, date utils, sync protocol types,
                 # ID generate/normalize/validate,
                 # chart/stats helpers (ranges, gap filling, rolling avg, summaries)
```

---

## 3. Data model

### Key decision: store the day as a calendar date string, not a timestamp

An entry belongs to the day the user picked, stored as `YYYY-MM-DD` in the user's local calendar. This avoids timezone bugs. For example, an entry logged at 11pm in New York must not turn into "tomorrow" in UTC.

### Key decision: each field gets its own timestamp

The value, the note, and the recording for a day can be edited separately, possibly on two different phones. Each one has its own `*_updated_at` so the merge happens per field. For example, a value changed on phone A and a note added on phone B for the same day both survive.

### Mobile (SQLite)

```sql
CREATE TABLE entries (
  date               TEXT PRIMARY KEY,   -- 'YYYY-MM-DD'
  value              INTEGER CHECK (value BETWEEN 1 AND 10),  -- NULL if the day only has a note/recording
  value_updated_at   INTEGER,            -- client epoch ms
  note               TEXT,               -- NULL = no note; max 2,000 chars
  note_updated_at    INTEGER,
  audio_id           TEXT,               -- UUID of the recording; NULL = none
  audio_duration_ms  INTEGER,
  audio_updated_at   INTEGER,
  dirty              INTEGER NOT NULL DEFAULT 1, -- aggregate of the three field flags
  value_dirty        INTEGER NOT NULL DEFAULT 0,
  note_dirty         INTEGER NOT NULL DEFAULT 0,
  audio_dirty        INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE audio_files (
  audio_id    TEXT PRIMARY KEY,
  local_path  TEXT,                      -- NULL if not downloaded on this device yet
  uploaded    INTEGER NOT NULL DEFAULT 0 -- 1 = file is on the server
);
CREATE TABLE sync_state (
  key   TEXT PRIMARY KEY,                -- 'cursor', 'last_synced_at', 'reminder' (JSON from server)
  value TEXT
);
```

The identity record `{ id, secret, registered }` lives in `expo-secure-store`, not in SQLite. All three are kept together so they survive or disappear together (see §5.2 for the reinstall rules).

### Server (Postgres)

```sql
profiles (
  id           text PRIMARY KEY,         -- the unique ID, normalized (uppercase, no spaces)
  secret_hash  text NOT NULL,            -- hash of the registering device's secret (§5.2)
  seq          bigint NOT NULL DEFAULT 0,-- per-profile change counter (§6.2)
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen    timestamptz
);
entries (
  profile_id         text REFERENCES profiles(id) ON DELETE CASCADE,
  date               date NOT NULL,
  value              smallint CHECK (value BETWEEN 1 AND 10),
  value_updated_at   timestamptz,
  note               text,
  note_updated_at    timestamptz,
  audio_id           uuid,
  audio_duration_ms  integer,
  audio_updated_at   timestamptz,
  server_seq         bigint NOT NULL,    -- set from profiles.seq on every insert AND update; pull cursor
  PRIMARY KEY (profile_id, date)
);
CREATE INDEX ON entries (profile_id, server_seq);

settings (                               -- per-ID settings, edited on the web (§4.6)
  profile_id        text PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  reminder_enabled  boolean NOT NULL DEFAULT false,
  reminder_time     text NOT NULL DEFAULT '20:00',  -- 'HH:MM', 24h, phone-local wall-clock time
  updated_at        timestamptz NOT NULL DEFAULT now()
);

sessions (                               -- web sessions (§5.3)
  id          text PRIMARY KEY,          -- random; the cookie holds this, signed
  profile_id  text REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL
);

audio_deletions (                        -- queue drained by a cron job (§6.3)
  object_key   text PRIMARY KEY,
  delete_after timestamptz NOT NULL
);
```

Audio objects are stored at `audio/<sha256(profile_id)>/<audio_id>.m4a`. Hashing the profile namespace prevents the bearer ID from appearing in presigned URLs.

`server_seq` is deliberately **not** a `bigserial`. A sequence only assigns a number on insert, and concurrent transactions can commit out of order, which would let a client's cursor skip rows. See §6.2 for how it's assigned.

---

## 4. Mobile app

### 4.1 Screens: Rate (the main screen) and Pawsitive

The bottom tab bar has two tabs. **Rate** holds the keypad and **Pawsitive** holds the note. The recording will also go on Pawsitive once it ships. Both show the same day selector, and they share one selected day: changing the day on either tab changes it on both.

```
Rate                              Pawsitive
┌─────────────────────────────┐   ┌─────────────────────────────┐
│  ◀   Today, Sat Oct 10   ▶  │   │  ◀   Today, Sat Oct 10   ▶  │
│                             │   │                             │
│     [ 1 ]  [ 2 ]  [ 3 ]     │   │  ┌ Note…                  ┐ │
│     [ 4 ]  [ 5 ]  [ 6 ]     │   │  └────────────────────────┘ │
│     [ 7 ]  [ 8 ]  [ 9 ]     │   │                             │
│            [10 ]            │   │                             │
│                             │   │                             │
│           ✓ Synced          │   │                             │
│─────────────────────────────│   │─────────────────────────────│
│     Rate       Pawsitive    │   │     Rate       Pawsitive    │
└─────────────────────────────┘   └─────────────────────────────┘
```

Tap the date label to open the calendar. `10` sits where the 0 key is on a phone keypad. The note is optional and expands when tapped. The sync status on Rate is small and unobtrusive.

**Day selector**

- Shared by the Rate and Pawsitive tabs, which always show the same day.
- Defaults to **today** (device local date) on launch.
- `◀` goes back one day. `▶` goes forward one day and is **disabled when today is selected**.
- Tapping the date label opens a native calendar picker with `maximumDate = today` and **no minimum date**, so any past day can be chosen. The native pickers allow quick month and year jumps for dates far back.
- When the app returns to the foreground, recompute "today". If the user was on the old "today" and midnight has passed, move them to the new today.
- Label shows "Today", "Yesterday", or the full date (including the year if it's not the current year).

**Number buttons**

- **Phone keypad layout:** a 3-column grid with `1 2 3` / `4 5 6` / `7 8 9` and **`10` alone in the bottom row, centered**, where the 0 key sits on a phone keypad. The same layout is used in every orientation and on tablets, with the grid centered and its width capped on large screens.
- The keys are large and roughly square, at least 64×64pt, sized to fill the available width up to the cap, with comfortable spacing.
- **The selected button stays highlighted:** filled background and bold border, so the state doesn't depend on color alone.
- **Tapping another number updates the day's value:** the highlight moves and the day's single entry is overwritten.
- **Tapping the already-selected number does nothing:** it stays selected. Once a day has a value it can be changed but never cleared.
- Tapping a number writes to SQLite **immediately**, so there is no save button. A light haptic tap confirms it.
- Changing the day loads that day's value, note, and recording, if any. If the day has no value, nothing is highlighted.
- All ten keys use one neutral color, so they don't suggest that low numbers are bad or high numbers are good.
- Accessibility: each button's label is just the number (e.g., "7"), the selected one has `accessibilityState={{ selected: true }}`, and Dynamic Type / font scaling is supported.

**Text note (optional)**

- The note field is on the Pawsitive tab, below the day selector, as a one-line "Note…" field and expands to multi-line when focused.
- It autosaves, debounced ~1s and on blur. There is no save button.
- Maximum 2,000 characters. Clearing the text removes the note (stored as `NULL`).
- On small screens each tab scrolls, so the keypad never shrinks below its minimum size.

**Audio recording (optional, one per day): _deferred_ (Phase 6)**

Not in the first release. When it ships, a recording shows on Pawsitive as `[ ● Record ]`, or `[ ▶ 0:42 ]  [ 🗑 ]` once recorded.

- **Record:** on the Pawsitive tab, `● Record` starts recording and shows a timer and a Stop button. The microphone permission is requested on the first tap only.
- **Recording format:** AAC `.m4a`, mono, ~64 kbps, about 0.5 MB per minute. There is a **5-minute maximum**, and recording stops on its own at the limit.
- **Saving:** stopping saves the recording right away to the documents directory. If an interruption (phone call, app sent to background) stops the recording, what was captured so far is kept.
- **Playback:** a play/pause button and the duration. Delete is a trash icon with a confirmation. Recording again on a day that already has a recording asks "Replace recording?" first.
- **Downloads:** recordings made on another device are downloaded the first time they're played and cached locally after that.
- **Day changes while recording:** the day selector is disabled on both tabs, and leaving the Pawsitive tab stops and saves the recording.
- **Discreet permission text:** "Used to record audio notes."

**Sync status indicator** (Rate tab): one of "Synced", "Saved on device, will sync", or "Syncing…". Tapping it starts a manual sync.

### 4.2 Screen: History

Read entirely from local SQLite, so it works offline and updates instantly after a change on the Rate or Pawsitive tab. It has no tab; it opens through the `down-up://history` link. It uses the same neutral styling as the rest of the app: no labels or mood words, and one neutral color.

```
┌─────────────────────────────┐
│ [7D] [30D] [90D] [1Y] [All] │  ← range presets (default 30D)
│                             │
│  avg 6.4 · min 3 · max 9    │  ← summary row
│  21 of 30 days              │
│                             │
│  10┤        •               │
│    │   •─•  │ •─•     •     │  ← line chart, gaps on missing days
│   1┤ •─╯  ╰─╯    ╰─•  │     │
│    └─────────────────────── │
│  [ Chart | Counts ]         │  ← toggle to the distribution chart
│─────────────────────────────│
│  Sat Oct 10      7   ✎ 🎙   │  ← list, newest first
│    "long walk, slept ok…"   │  ← one-line note preview
│  Fri Oct 9       6          │
│  Thu Oct 8       —   ✎      │  ← "—" = no value that day
│  …                          │
└─────────────────────────────┘
```

- **Range:** presets 7D · 30D · 90D · 1Y · All, the same as the web dashboard. The default is 30D. Custom ranges are left to the web.
- **Summary row:** average, min, max, and days logged out of days in range. These are computed by the same shared helper the web uses, so both show the same numbers (definitions in §4.5).
- **Line chart:**
  - X = date, Y = fixed 1–10 axis.
  - Missing days, and days that only have a note, are gaps, not zeros.
  - Press and drag shows the date and value.
  - Long ranges switch to weekly or monthly averages, following the shared rules in §4.5.
- **Counts chart:** a toggle switches to a bar chart showing how many days each value (1–10) was recorded in the range.
- **List (value-wise):**
  - One row per day in the range, newest first, showing the date and its value ("—" if none).
  - `✎` marks days with a note (and, once recording ships, `🎙` marks days with a recording), with a one-line preview of the note.
  - The list scrolls under the chart using a virtualized list (`FlatList` / `FlashList`), so long ranges stay smooth.
  - Days with unsynced changes get a subtle dot.
- **Tap a row** to jump to the Rate tab with that day selected. The value can be changed there, and the note for the same day is on the Pawsitive tab. History itself is read-only.
- **Empty state:** if the range has no entries, show a short neutral message ("Nothing recorded yet") instead of an empty chart.
- **Refresh:** History re-queries SQLite when it gains focus and after a sync pulls new rows.

### 4.3 Screen: Settings

Settings has no tab. It opens from the "Enter ID" prompt (§5.2) and through the `down-up://settings` link.

- **Your ID:**
  - Shown large and grouped for readability (e.g., `7K3M 9QX2 PDA4`).
  - Buttons to **Copy** and **Share** it, plus a "Write this down. It's the only way to see your data on the web or move it to a new phone" hint.
  - Before the ID has been registered with the server (first sync), it shows "Not active on the web yet".
- **Open web view:** a link to the website. The ID is _not_ put in the URL.
- **Use an existing ID:** for a new phone or a reinstall. See §5.4.
- **Reminder** (read-only here): "Daily at 8:00 PM", or "Off", with a note that it's set on the web. If notification permission is denied, it shows "Notifications are blocked" with a button that opens the phone's settings.
- **Sync:**
  - Shows the last sync time and a "Sync now" button.
  - When sync is off, shows "Sync is off" with a **Start syncing** button. Starting creates a new ID and uploads all local data.
- **Delete my data from the server** (with confirmation). This removes all entries and audio for the ID from the server, then asks:
  - **Also delete from this device:** wipes local data, then starts fresh with a new ID.
  - **Keep on this device:** keeps local data, clears the ID, and **turns sync off**, so nothing gets re-uploaded.
- **Export CSV:** date, value, and note. Recordings can optionally be shared as a zip.

### 4.4 Offline-first behavior

- The app is **fully usable without internet from the very first launch.** The ID is generated on the device, and every change is saved locally with `dirty = 1`.
- **One-time sync notice on first launch:** "Your entries are saved on this phone and synced to our server so you can view them on the web."
  - **Continue** (default) turns sync on.
  - **Keep on this phone only** leaves sync off. No ID is registered and nothing leaves the device until the user starts syncing in Settings.
  - The wording stays neutral, and it links to the privacy policy.
- The first time the app is online with sync on, it registers the ID and pushes everything. After that, sync just keeps both sides up to date.
- Recordings are uploaded in the background when online, and they upload _before_ the entry that references them (see §6.3).
- **Backups:**
  - Android Auto Backup is **disabled** (`android.allowBackup: false`). Otherwise it could restore the database without the secure-store ID, because Keystore-protected values aren't backed up.
  - The server is the backup. Restoring on a new phone goes through "Use an existing ID".

### 4.5 Stats definitions (shared with the web)

Implemented once in `packages/shared` and used by both the History tab and the web dashboard:

- **Logged day:** a day with a value. Days with only a note or recording don't count toward stats or "days logged".
- **Average:** mean of logged values in the range, shown to 1 decimal. Min and max are taken over logged values.
- **Bucketing by range length** (presets and custom ranges alike):
  - ≤ 90 days: daily points.
  - 91–730 days: weekly averages (ISO weeks, starting Monday).
  - Over 730 days: monthly averages.
  - A bucket with no logged days is a gap.
- **7-day rolling average:** for each day, the mean of logged values in that day and the 6 before it. It's shown only when at least 4 of those 7 days are logged, otherwise it's a gap.
- **Current streak** (web only): consecutive logged days ending today, or ending yesterday if today isn't logged yet, so the streak doesn't drop to zero before the day ends.
- **Value counts:** how many logged days had each value 1–10 in the range.

### 4.6 Daily reminder (set on the web, delivered by the phone)

- **Settings:** an on/off switch and a time of day, both set on the web (§7.3). They're stored per ID, so every phone using the ID follows them. The phone shows them read-only.
- **Time zone:**
  - The time is a phone-local wall-clock time. "20:00" means 8 PM wherever the phone is.
  - If the phone changes time zones, the reminder follows it, and daylight saving time changes don't shift it.
- **Delivery:** **local notifications scheduled on the phone** with `expo-notifications`. Nothing is sent from the server, so reminders fire with no connection and there's no push infrastructure.
- **Getting settings to the phone:** every sync response includes the current settings (§6.1). A change made on the web takes effect the next time the phone syncs: on app open, on foreground, on reconnect, or opportunistically in the background. The web page says so.
- **Scheduling:**
  - The app schedules **individual notifications for the next 30 days** rather than one repeating notification. iOS allows 64 pending notifications.
  - **The reminder is skipped on any day that already has a value.** Recording a value for today cancels today's notification.
  - The schedule is rebuilt on app start, on foreground, after every sync, after a value is recorded for today, and when the phone's time zone changes.
  - If the app isn't opened for 30 days, reminders stop until it's opened again. That's a deliberate quiet failure mode.
- **Android timing:** uses inexact scheduling, which can be a few minutes late. Exact alarms would need the `SCHEDULE_EXACT_ALARM` permission, which Google Play restricts to alarm and calendar apps.
- **Permission:**
  - The app asks for notification permission only once a reminder has been turned on, the next time the app is in the foreground, with a short neutral explanation first. This covers iOS and Android 13+.
  - If permission is denied, nothing is scheduled, and the app's Settings screen shows how to turn notifications back on.
- **Discreet text:** the title is "Down & Up" and the body is "Reminder". There's no mood wording, and the lock-screen preview gives nothing away.
- **Tapping the notification** opens the Rate tab with today selected.
- **Sync off:** reminders need the web, so they're unavailable while sync is off ("Turn on sync to set a reminder").
- **Multiple phones:** each phone sharing the ID schedules its own reminders. Logging on one phone cancels the reminder on the others only after they sync.

---

## 5. Unique ID: access without accounts

### 5.1 Format

- **12 characters** from the **Crockford Base32** alphabet: digits `0–9` and letters `A–Z` **excluding `I`, `L`, `O`, `U`**. That leaves letters and numbers only, without the easily confused characters.
- **Size:** 60 bits of randomness, about 1.15 quintillion possible IDs.
  - 10 characters (50 bits) was considered and rejected. With ~100k users, a billion guesses spread across many IPs would have about a 9% chance of hitting someone's ID.
  - At 12 characters the same attack has about a 0.01% chance. The data (mood scores and voice recordings) justifies the two extra characters.
- **Display:** shown as three groups of four (`7K3M 9QX2 PDA4`). The spaces are only visual and are not part of the ID.
- **Lenient input:** typed IDs are case-insensitive, spaces and dashes are ignored, and look-alikes are mapped (`O`→`0`, `I`/`L`→`1`).
- **Generation:** uses a cryptographically secure random source (`expo-crypto` `getRandomBytes`).

### 5.2 Lifecycle

1. **First launch:**
   - The app generates an ID and a 128-bit random **registration secret**.
   - It stores `{ id, secret, registered: false }` as a single secure-storage record. No network is needed.
2. **First online sync** (sync on): `POST /api/ids/register` with the ID in the Authorization header and `{ secret }` in the body. Registration is **idempotent**:
   - **ID is new:** the server creates the profile and stores a hash of the secret. Returns `200`.
   - **ID exists, same secret:** this is the same device re-registering (e.g., a reinstall, or a retry after a lost response). Returns `200`.
   - **ID exists, different secret:** a true collision (odds are negligible at 60 bits). Returns `409`, and the app generates a new ID and secret and retries.
     - At this point the ID may already have been displayed, so Settings shows it as "Not active on the web yet" until registration succeeds. Users should only rely on an ID once it's active.
   - On `200`, the app sets `registered: true` in the same secure-storage record.
3. **Every sync and API call** sends the ID as `Authorization: Bearer <ID>` over HTTPS. The secret is used only for registration. The ID alone grants access (§5.5).
4. **Startup reconciliation.** The ID (secure storage) and data (SQLite) can survive independently. On iOS, Keychain items survive an uninstall but app files don't.
   - **ID present, database empty or missing:** treat as a reinstall. Reset the cursor, re-register (succeeds thanks to the secret), and do a full pull.
   - **Database has synced history (a cursor exists), but the ID is missing:** **don't** silently generate a new ID. Show a one-time prompt: "Enter your ID to keep syncing" with **Enter ID** (goes to §5.4) or **Start new** (new ID, all rows marked dirty, all recordings re-queued for upload).
   - **Neither present:** this is a first launch.

### 5.3 Web login

- `/` is a single field: "Enter your ID", plus a "View" button. Wording stays neutral.
- On success, the server creates a `sessions` row and sets a signed, `httpOnly`, `Secure`, `SameSite=Lax` cookie holding the session ID (30 days). Then it redirects to `/dashboard`. **Sign out** deletes the session row and clears the cookie.
- Invalid IDs get a generic "ID not found" error after a small fixed delay.
- The ID never appears in URLs, page titles, or logs. Server logs record a hash of it only.

### 5.4 New phone / reinstall

- Settings → **Use an existing ID** → enter the ID → the app verifies it with `POST /api/ids/verify`.
- The app saves `{ id, secret: null, registered: true }`. A device that adopts an ID never registers it, so it doesn't need the secret.
- If this device already has local entries, the app asks:
  - **Merge into this ID:**
    - Mark **every** local row `dirty = 1`. Rows synced under the old ID were clean and would otherwise never be pushed.
    - Set `uploaded = 0` on every local recording.
    - Reset the cursor to `null`, then sync.
    - Per-field LWW decides any days that exist on both sides.
  - **Discard local data:** delete local rows and recording files, reset the cursor to `null`, then do a full pull.
- The previous ID's server data is left untouched. The confirmation dialog says so, and suggests "Delete my data from the server" first if the user wants it gone.
- Several devices can use the same ID at once. They sync through the per-field merge (§6.2).

### 5.5 Security model (accepted trade-offs)

- **The ID is the only key.** Anyone who has it can view and add data for it. There is no email, so **a lost ID can't be recovered**. The Settings screen makes this clear.
- **Brute-force protection** (counters live in Upstash Redis, since serverless instances share no memory):
  - **Per IP:** 10 failed lookups per minute, then increasing backoff.
  - **Global:** a cap on failed lookups across all IPs (e.g., 1,000 per minute). Above it, every lookup gets a short delay, and an alert fires. This covers attacks spread over many IPs, where per-IP limits alone don't help.
  - Return the same response for "wrong format" and "not found".
- **Replace ID** (Settings, low cost): generates a new ID and secret and moves the server data over to it, in case the old one was shared by accident. Other devices using the old ID get `401` and are asked to enter the new one. Web sessions for the old ID stop working.
- **Web sessions:** the session cookie holds a signed session ID, never the ID itself. The profile is looked up on every request, so deleted or replaced IDs lose access right away.
- **CSRF:** cookie-authenticated mutations (`PUT /api/settings`, `DELETE /api/session`, `DELETE /api/data`) also check the `Origin` header.
- All traffic is HTTPS only. Audio is only reachable through short-lived signed URLs handed out after an ID check.

### 5.6 Data protection & compliance

Mood scores and voice recordings are likely **health-related data** (a special category under GDPR), so:

- **Encryption:** TLS in transit. Encryption at rest for Postgres and R2 (the default on Neon/Supabase and R2, but confirm it for whichever provider is chosen).
- **Consent:** the first-launch sync notice (§4.4) is the explicit opt-in. Keeping data on the phone only is always available.
- **Retention and deletion:**
  - "Delete my data" removes database rows immediately and queues audio objects for deletion within 24 hours.
  - Database point-in-time backups expire within 7 days, and the privacy policy says so.
  - Profiles with no sync for 2+ years may be purged after a notice in the app.
- **Minimal collection:** no email, no name, no analytics or ad SDKs. IP addresses are used only transiently for rate limiting and are not stored with entries.
- **Store disclosures:**
  - **App Store privacy label:** Health, Other User Content (notes), User ID. Not used for tracking. Add Audio Data when recording ships (Phase 6).
  - **Google Play Data Safety:** the matching categories, encrypted in transit, deletion available.
- **Privacy policy** (`/privacy`, linked in the app and the store listings) covers what's collected, why, the processors (Vercel, the Postgres host, Cloudflare, Upstash), retention, how to delete, and a contact address.

---

## 6. Sync design

### 6.1 Protocol: one endpoint, push + pull in one round trip

`POST /api/sync` (`Authorization: Bearer <ID>`)

```jsonc
// request
{
  "cursor": "1834",                 // last server_seq the client has seen (null on first sync)
  "changes": [                      // all local rows with dirty = 1
    {
      "date": "2026-10-10",
      "value": 7,         "valueUpdatedAt": 1791648000000,
      "note": "long walk", "noteUpdatedAt": 1791648100000,
      "audioId": "3f1c…",  "audioDurationMs": 42000, "audioUpdatedAt": 1791648200000
    }
  ]
}
// response
{
  "applied": [ /* the server's stored version of every pushed row, after merge + clamping */ ],
  "changes": [ /* up to 500 rows with server_seq > cursor, ordered by server_seq */ ],
  "cursor": "1840",                 // server_seq of the last row in `changes`
  "hasMore": false,                 // true → client immediately calls again with the new cursor and no changes
  "missingAudio": [],               // audioIds whose file isn't on the server yet; client re-uploads (§6.3)
  "settings": { "reminderEnabled": true, "reminderTime": "20:00" }  // always included (§4.6)
}
```

- Each field group (value / note / audio) is optional in a change. The client only sends the groups that changed.
- **Pulls are paginated.** A new phone pulling years of history loops until `hasMore` is `false`. Pushes are chunked the same way (§6.5).

### 6.2 Conflict resolution: last-write-wins per field

- **Ordering:** each sync request runs in one transaction that first locks the profile row (`SELECT … FROM profiles WHERE id = $1 FOR UPDATE`).
  - Every inserted **or updated** entry gets `server_seq = profiles.seq + 1`, and `profiles.seq` is incremented.
  - Concurrent syncs for the same ID are therefore serialized, and `server_seq` values always become visible in commit order. A cursor can never skip a row.
  - Different IDs never block each other.
- For each field group, the server takes the incoming version **only if** its `*UpdatedAt` is newer than the stored one.
- **Value can't be cleared:** a `null` value is never accepted over an existing one.
- **Notes and recordings can be cleared:** `null` plus a newer timestamp removes them.
- When a recording is replaced or removed, the old object key is inserted into `audio_deletions` in the same transaction. A cron job deletes it later (§6.3).
- **Acknowledged rows:** for each row in `applied` that hasn't changed locally since the push, the client **replaces its local copy with the server's version, timestamps included**, and clears `dirty`.
  - Rows edited during the sync (detected by comparing per-field timestamps) keep those fields dirty, so a tap or keystroke made mid-sync isn't lost. Only transmitted and accepted field groups are acknowledged; pending or rejected audio remains dirty.
- **Pulled rows:** the client applies each pulled field group only if the local copy of that group is not dirty, or the pulled timestamp is newer.
- Pushes are **idempotent**, so retries are always safe.
- **Clock limitation:** LWW relies on device clocks, which is fine for one person on one or two phones.
  - The server clamps timestamps more than 5 minutes in the future to `now()`.
  - Because the client adopts the server's stored timestamps, a phone with a fast clock can't keep a stale value that beats newer edits.

### 6.3 Audio transfer (deferred)

Part of Phase 6. Until then no audio is uploaded or downloaded, and audio field groups stay empty.

1. **Upload:**
   - The client calls `POST /api/audio/upload-url` with `{ audioId, size }`. The server checks the ID and that `size` ≤ 5 MB, then returns a presigned PUT URL (valid 10 min).
   - **`Content-Length` and `Content-Type: audio/mp4` are part of the signature**, so R2 rejects any upload of a different size or type.
   - The client PUTs the `.m4a` file directly to R2, then marks `audio_files.uploaded = 1`.
   - The client only pushes a row's audio fields **after** its file has uploaded. Until then the row's value and note still sync, and the audio fields wait.
2. **Verification on sync:**
   - Before accepting an audio field group, the server checks (`HEAD`) that `audio/<sha256(profile_id)>/<audioId>.m4a` exists and is ≤ 5 MB.
   - If not, the server rejects that group only and returns its `audioId` in a `missingAudio` list. The client resets `uploaded = 0` and uploads again.
   - So the server never references a missing file.
3. **Download:** `GET /api/audio/:audioId` checks the ID or web session, then redirects (302) to a presigned GET URL (valid 10 min). The mobile app downloads on first play and caches the file. The web plays it in an `<audio>` element.
4. **Cleanup** (Vercel Cron, since serverless functions can't reliably do work after responding):
   - **Deletion queue:** delete objects in `audio_deletions` whose `delete_after` has passed. This covers replaced and removed recordings and "Delete my data". On the selected Vercel Hobby team, both daily cron jobs drain this queue, staggered twelve hours apart. Higher-volume production can use hourly cleanup on a supporting plan; monitor queue age to preserve the 24-hour target.
   - **Daily orphan sweep:** list objects older than 24h that no entry references, and delete them. Orphans come from recordings uploaded and then deleted or replaced before their row synced, or from abandoned uploads.
5. **Retries:** uploads use the same backoff as sync. Large uploads only start when online. An optional "Upload recordings on Wi-Fi only" setting is a cheap later addition.
6. **Local cleanup:** when a recording is replaced or deleted on the phone, its local file and `audio_files` row are removed once the change has synced.
   When sync is off, unreferenced local recordings are removed immediately without making network requests. Discarding local data also deletes cached CSV and recording ZIP exports.

### 6.4 When sync runs

iOS background execution is unreliable, so sync **opportunistically**:

1. **After each change**, debounced ~2s, when online.
2. **On app foreground** (AppState → active).
3. **On connectivity regained** (NetInfo).
4. **On manual "Sync now"** / pull-to-refresh in History.
5. **Background task** (`expo-background-task`) as a bonus. It is not relied on.

Failures retry with exponential backoff (cap ~5 min while foregrounded). Only one sync runs at a time, enforced with a mutex.

### 6.5 Server-side validation

- **ID:** 12 valid Crockford Base32 characters after normalization, and registered.
- **`value`:** an integer from 1 to 10.
- **`reminderTime`:** `HH:MM`, 24-hour, `00:00`–`23:59`. **`reminderEnabled`:** a boolean.
- **`note`:** at most 2,000 characters.
- **Audio:** at most 5 MB and 5 minutes. `audioId` must be a UUID.
- **`date`:**
  - It must be a valid date **on or before the current UTC date + 1 day**. That one day of leeway covers timezones ahead of UTC (e.g., Pacific/Kiritimati). The future-date rule is mainly enforced by the client.
  - There is no lower limit apart from a sanity floor of `1900-01-01`.
- **Batch size:** at most 500 changes per push and 500 rows per pull. The client splits larger pushes into chunks.
- **Rate limiting:** per ID and per IP, enforced through Upstash (§5.5).

---

## 7. Web server

### 7.1 API routes

| Route                                                         | Purpose                                                                                             |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `POST /api/ids/register`                                      | Register a newly generated ID + secret (mobile, idempotent)                                         |
| `POST /api/ids/verify`                                        | Check that an ID exists ("Use an existing ID" on mobile)                                            |
| `POST /api/ids/replace`                                       | Move data to a new ID                                                                               |
| `POST /api/session` / `DELETE /api/session`                   | Web login with ID / sign out                                                                        |
| `POST /api/sync`                                              | Mobile sync                                                                                         |
| `POST /api/audio/upload-url`                                  | Presigned upload URL                                                                                |
| `GET /api/audio/:audioId`                                     | Redirect to a presigned download URL                                                                |
| `GET /api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD`              | Dashboard data for a date range                                                                     |
| `GET /api/settings` / `PUT /api/settings`                     | Read or update the reminder settings (web session)                                                  |
| `DELETE /api/data`                                            | Delete all server data for the ID (profile, entries, settings, sessions; audio queued for deletion) |
| `GET /api/cron/audio-deletions`, `GET /api/cron/orphan-sweep` | Vercel Cron jobs (protected by `CRON_SECRET`)                                                       |
| `GET /api/health`                                             | Uptime checks                                                                                       |

### 7.2 Dashboard page (`/dashboard`, session required)

- **Date range control:** presets **7D · 30D · 90D · 1Y · All**, plus a **custom** from/to picker. The range is kept in the URL query string (`?from=…&to=…`) so it can be bookmarked. Only the range goes in the URL, never the ID.
- **Summary tiles for the range:** average, min, max, days logged / days in range, and a current streak (definitions in §4.5).
- **Main chart: line chart of value over time.**
  - X = date, Y = 1–10 (fixed axis).
  - Days without a value show as **gaps** and are not interpolated to zero.
  - Optional toggle for a **7-day rolling average** overlay.
  - Long ranges switch to weekly or monthly averages, following the shared rules in §4.5 (identical to the app).
  - Tooltip shows the date, the value, and a short note preview, if any. Points for days with a note (or, once it ships, a recording) get a small marker.
- **Secondary chart: distribution bar chart** showing how many days each value (1–10) was recorded in the range.
- **Entries table** below the charts, sorted newest first and paginated.
  - Columns: date, value, note (full text, wrapped), and recording (inline play button with duration; deferred to Phase 6).
- Responsive layout so the dashboard also works on a phone browser.
- Use neutral wording throughout: "value" or no label at all, never "mood". Page titles and the browser tab title stay generic.
- Entries are read-only on the web in v1. Editing them can come later, using the same per-field upsert. The only thing editable on the web is the reminder (§7.3).

### 7.3 Other web pages

- `/`: the ID entry page.
- `/settings` (session required): the **daily reminder**.
  - An on/off switch and a time picker (hour and minute, shown in 12h or 24h to match the browser's locale). Changes save on change, with a small "Saved" confirmation.
  - A note: "Reminders come from the app on your phone, in the phone's local time. Changes apply the next time the app syncs."
  - Neutral wording, with no mood terms.
- `/privacy`: the privacy policy.

---

## 8. Implementation phases

### Phase 0: Foundations (≈3–4 days)

- Set up the monorepo (pnpm, TypeScript, ESLint/Prettier, CI running lint and tests).
- `packages/shared`:
  - zod schemas for `Entry` and the sync request/response.
  - Date utilities (`todayLocal()`, `isFutureDate()`, `addDays()`) using `date-fns`. Days before 1900 stay local and are omitted from pushes; the UI explains this when such a day is selected.
  - ID utilities: `generateId()`, `normalizeId()`, `isValidId()`, `formatIdForDisplay()`.
  - Stats helpers implementing §4.5, used by both the mobile History tab and the web dashboard: range presets → from/to, gap filling, bucketing, rolling average, summary stats, streak, and value counts.

### Phase 1: Mobile, local-only (≈3 weeks)

- Expo app scaffold (expo-router tabs: Rate and Pawsitive, plus History and Settings routes) with the SQLite schema and migrations.
- Local ID + secret generation on first launch (a single secure-storage record), the one-time sync notice, and the ID shown in Settings with copy/share.
- Android Auto Backup disabled.
- Rate and Pawsitive screens:
  - Shared day selector (arrows + calendar picker, future blocked, no lower limit).
  - The 1–10 keypad (3×3 grid with 10 centered on the bottom row) with persistent highlight.
  - Instant local save, haptics, accessibility labels, midnight rollover handling.
- On Pawsitive: text note with autosave. Audio record, playback, replace, and delete, with a 5-minute cap and interruption handling.
- History tab: range presets, summary row, line chart, counts chart toggle, and the list of days with note/recording markers. Tapping a row opens that day on the Rate tab.
- ✅ Done when everything works in airplane mode on both platforms.

### Phase 2: Server (≈2 weeks)

- Next.js app, Postgres schema, Drizzle migrations, R2 bucket, Upstash.
- Idempotent ID register (with secret) and verify endpoints, bearer-ID middleware, per-IP and global rate limiting.
- `POST /api/sync`:
  - per-profile row lock and `seq` assignment,
  - per-field LWW with timestamp clamping,
  - `applied` rows in the response,
  - paginated pulls,
  - validation.
- Presigned audio upload with signed size/type, a HEAD check during sync, and the `missingAudio` response list. Presigned download.
- `audio_deletions` queue and the two cron jobs.
- `settings` table, `GET`/`PUT /api/settings`, and settings included in every sync response.
- Deploy to staging.

### Phase 3: Sync in the mobile app (≈2.5 weeks)

- Sync engine: register the ID, push dirty field groups, adopt `applied` rows, pull pages until `hasMore` is false, merge. Includes triggers, backoff, mutex, and the status indicator.
- Audio upload queue (upload before push, re-upload on `missingAudio`), lazy download with a local cache, and local file cleanup.
- Startup reconciliation of ID vs. database (§5.2).
- "Use an existing ID" with merge (mark all dirty, re-queue recordings, reset cursor) or discard.
- Sync off/on states, and "Delete my data" with both of its outcomes.
- Reminders: store the synced settings, ask for notification permission, schedule 30 days of notifications (skipping logged days), rebuild the schedule on the triggers in §4.6, and open Today when a notification is tapped. Read-only reminder row in Settings.
- ✅ Done when offline edits on two phones sharing an ID (value on one, note on the other, same day) converge correctly after both come online.

### Phase 4: Web dashboard (≈1.5 weeks)

- ID entry page, server-side sessions, sign out, Origin checks.
- `GET /api/entries` and the dashboard with range presets and custom range in the URL.
- Line chart with gaps and the rolling average, distribution chart, summary tiles, and the entries table with notes. Audio playback is deferred to Phase 6.
- `/settings` page with the reminder switch and time picker.

### Phase 5: Polish + release (≈2 weeks, including store review buffer)

- App icon, splash screen, dark mode, store listings. Keep the icon, display name ("Down & Up"), and listing text neutral, with no mention of mood.
- Ship without voice recording: hide the Record control and recording playback in the app and on the web, and drop the microphone permission from the app config. Keep the audio columns and sync field group, which stay empty.
- Privacy policy, App Store privacy label, and Play Data Safety form (§5.6). Confirm encryption at rest and the backup retention settings with the chosen providers.
- CSV export and Replace ID.
- Real-device testing of two-phone sync.
- EAS build and submission to TestFlight and Play internal testing, then production.

**Rough total: about 11–12 weeks for one developer.**

### Phase 6: Voice recording (deferred)

- Everything marked _deferred_ above: recording on the Pawsitive tab (§4.1), the audio transfer (§6.3), audio routes and cron jobs, the R2 bucket, recording markers in History and on the web, and recording playback in the web entries table.
- The audio work already listed in Phases 1–4 belongs here; it doesn't block the first release.
- Neutral microphone permission text ("Used to record audio notes."), Audio Data in the store disclosures (§5.6), and the audio tests in §9.
- Real-device testing of audio (interruptions, Bluetooth headsets, both platforms).

---

## 9. Testing strategy

- **Unit (shared + server):**
  - Date utilities across timezones and DST.
  - ID generate/normalize (case, spaces, `O`→`0`, `I`/`L`→`1`) and the alphabet check.
  - The per-field LWW merge, including "value can't be cleared" and "note/audio can be cleared".
  - zod validation and the stats helpers (gap filling, averages, counts).
  - Reminder scheduling:
    - 30 one-off notifications at the right local time, with logged days skipped.
    - Today's notification cancelled after logging.
    - Rescheduling after a time zone change and across DST transitions.
    - Nothing scheduled when the reminder is off, permission is denied, or sync is off.
- **Sync integration tests:**
  - Two phones sharing an ID: offline edits on both, different fields on the same day, the same field on both.
  - A tap or keystroke during an in-flight sync.
  - Retry after a dropped response.
  - Two syncs for the same ID racing each other: no row is ever skipped by a cursor.
  - Pull pagination across several pages, including rows changing between pages.
  - A future-dated timestamp gets clamped, and the client adopts the server's version.
  - Registration: a new ID, a repeat with the same secret (`200`), and a different secret (`409` → new ID).
- **Audio (deferred, Phase 6):**
  - Upload interrupted mid-way, then retried.
  - Row pushed before its file finished uploading: the audio fields are held back.
  - Replace/delete removes the old object on the server.
  - Recording stopped by an interruption.
  - A row referencing a file that's missing on the server is answered with `missingAudio`, and the file is re-uploaded.
  - The cron jobs delete queued and orphaned objects, and nothing that's still referenced.
- **Mobile E2E (Maestro):**
  - Select a day, tap 3 then 8, and check that 8 is highlighted.
  - Try to go past today and check it's blocked. Pick a date years back.
  - Add a note. (Add a recording once Phase 6 ships.)
  - Airplane-mode round trip.
  - Reinstall cases: ID kept but database gone (full restore), and database kept but ID gone (prompt, no silent new ID).
  - "Use an existing ID" with Merge (previously synced rows reach the new ID) and with Discard.
  - "Delete my data" with each choice. "Keep on this device" turns sync off and uploads nothing.
  - Turn on a reminder on the web, sync, grant permission, and check that notifications are scheduled. Log today and check that today's notification is cancelled. Tap a notification and check that Rate opens.
  - In History, check that the value, note marker, and chart update, then tap a row and confirm it opens that day on the Rate tab.
- **Web E2E (Playwright):** enter an ID, change range presets and check that the chart and the URL update, turn the reminder on and change its time (check it persists), sign out. A bad ID gets the generic error.
- **Security checks:**
  - Per-IP and global rate limits on ID lookup.
  - The ID never appearing in URLs, cookies, or logs.
  - Old sessions rejected after Replace ID or Delete.
  - Origin checks on cookie-authenticated mutations.

---

## 10. Decisions made

- **Tapping the selected number again:** does nothing. A day's value can be changed but never cleared, and each day has at most one entry.
- **Labels:** none. The app is for mood but stays discreet, so there is no label, prompt, or mood wording anywhere.
- **Number layout:** phone keypad style, with 1–9 in a 3×3 grid and 10 alone, centered, on the bottom row.
- **Name:** keep "Down & Up".
- **Official artwork:** keep the Cerberus character version 01c and final icon versions 09b (opaque) and 09c (transparent) in `OfficialAssets/`. Exploratory studies and generation prompts stay in `ConceptArt/`. The icons show two front paws with the legs hidden.
- **App lock:** none.
- **In-app history:** a History screen with a list of values by day and charts, read from local data so it works offline.
- **Mobile tabs:** two tabs, **Rate** (keypad) and **Pawsitive** (note, plus recording once it ships), sharing one selected day. History and Settings stay as screens without a tab and have no visible entry point for now. They open through `down-up://history` and `down-up://settings`, and Settings also opens from the "Enter ID" prompt. Until an entry point is added, sync can't be turned off after the first-launch notice, and the ID, export, and delete options aren't reachable from the app.
- **Notes:** an optional text note (≤2,000 chars) for any day. An optional audio recording (≤5 min, one per day) comes later.
- **Voice recording deferred:** the first release ships without recording. The audio design (§4.1, §6.3, the audio routes, R2, and the cleanup cron jobs) is kept for Phase 6. The SQLite and Postgres audio columns and the audio field group in the sync protocol stay in place and empty, so turning recording on later needs no migration or protocol change.
- **Past dates:** no limit on how far back.
- **No sign-in:** a device-generated **12-character** letters-and-numbers ID links the app to the web. The web login is just that ID. A hidden registration secret makes re-registering safe after a reinstall.
- **Sync consent:** a one-time notice on first launch. Sync is on by default, and "Keep on this phone only" is available.
- **Android Auto Backup:** disabled. The server is the backup.
- **Daily reminder:** optional. Turned on and timed on the web, delivered as local notifications scheduled by the phone in its local time. Skipped on days already logged. Neutral text ("Down & Up" / "Reminder").
- **Delete my data:** either wipes the device too (fresh ID), or keeps local data and turns sync off.
- **Sync metadata:** each field has a dirty flag; acknowledgments clear only accepted groups unchanged since the push. Clamped timestamps also have replay receipts to make retries idempotent across changing server times.
- **Storage URLs:** audio object namespaces use a hash of the ID.
- **Very old dates:** dates before 1900 are local-only.
- **Mobile charts:** lightweight SVG charts, using the shared statistics helpers.
- **Identity transitions:** abort sync, journal the reset, cache remote recordings for Merge, and re-queue every field and file.
- **Replace ID:** generate server-side, copy audio before moving rows, invalidate sessions, and keep a short-lived retry receipt.
- **Hobby staging:** use two daily cleanup jobs twelve hours apart; both drain the deletion queue and the second also sweeps orphans. This preserves the 24-hour deletion target without a paid hourly cron schedule. Vercel cron is production-only, so preview cleanup is verified by manual invocation.
- **Phone-only cleanup:** delete unreferenced local recordings without waiting for sync. Discarding local data also removes cached CSV and ZIP exports.

## 11. Implementation review and delivery checks

Implementation starts from an empty repository. Review findings and decisions:

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

Deployment and release require environment credentials, a configured public server origin, a real privacy contact, confirmed provider encryption/backup retention, EAS accounts, and device/store checks. These cannot be inferred from repository contents. See `docs/RELEASE.md` for the concrete checklist; local test/build results do not replace device testing.
