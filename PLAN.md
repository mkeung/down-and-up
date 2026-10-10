# Down & Up: Daily 1–10 Tracker Plan

## 1. What it does

- **Mobile app (iOS + Android):**
  - Pick a day: today or any earlier day, as far back as you like, but never a future day.
  - Tap a number from 1–10. The number you tap stays highlighted, and tapping a different number replaces it.
  - Each day can also have an optional **text note** and an optional **audio recording**.
  - A History view shows past values as a list and a chart.
  - Everything is stored on the device, so the app works offline. It syncs to the server on its own when a connection is available.
- **No accounts, no sign-in.** On first launch the app generates a short **unique ID** (letters and numbers only). That ID is what links the phone's data to the server.
- **Web app:** enter your ID to see your numbers, notes, and recordings over time, with simple charts and an adjustable date range.

**At most one entry per calendar day.** Selecting a number updates that day's value. A value can be changed but never cleared. The note and recording for a day can be edited or removed.

**Discreet by design:** the app tracks mood, but nothing in the UI, web dashboard, app name, icon, store listing, permission prompts, or notifications says so. The main screen shows only a date and the numbers 1–10, with no labels, prompts, or emotive colors or emoji.

---

## 2. Tech stack (recommended)

| Layer | Choice | Why |
|---|---|---|
| Mobile | **Expo (React Native) + TypeScript** | One codebase for iOS and Android. EAS handles builds and store submission. |
| Navigation (mobile) | **expo-router** with a bottom tab bar | Three tabs: Today, History, Settings. |
| Local storage | **expo-sqlite** | Durable and queryable, and it holds the sync metadata. |
| Audio | **expo-audio** (record + playback) + **expo-file-system** | Records AAC `.m4a` files and stores them in the app's documents directory. |
| Connectivity | `@react-native-community/netinfo` | Starts a sync when the device comes back online. |
| ID storage | `expo-secure-store` | Keeps the unique ID in the Keychain on iOS and the Keystore on Android. |
| Web + API | **Next.js (App Router) + TypeScript** | The dashboard UI and the REST API live in one deployable app. |
| Database | **PostgreSQL** (Neon / Supabase / RDS) + **Drizzle ORM** | |
| Audio file storage | **Cloudflare R2** (S3-compatible; Vercel Blob or S3 also work) | Cheap object storage with no download (egress) fees. Files move through short-lived presigned URLs. |
| Access | **ID-based, no accounts** (custom, see §5) | No email, no password, no third-party auth library. |
| Charts (web) | **Recharts** | Simple and good enough for line and bar charts. |
| Charts (mobile) | **victory-native** (Skia-based, works with Expo) | Native-speed line and bar charts with touch tooltips. A simpler alternative is `react-native-gifted-charts`. |
| Validation / shared types | **zod** in a shared package | Mobile and server validate payloads the same way. |
| Hosting | Vercel (web/API) + managed Postgres + R2 | |

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
  dirty              INTEGER NOT NULL DEFAULT 1  -- 1 = has changes not yet pushed
);
CREATE TABLE audio_files (
  audio_id    TEXT PRIMARY KEY,
  local_path  TEXT,                      -- NULL if not downloaded on this device yet
  uploaded    INTEGER NOT NULL DEFAULT 0 -- 1 = file is on the server
);
CREATE TABLE sync_state (
  key   TEXT PRIMARY KEY,                -- 'cursor', 'last_synced_at', 'id_registered'
  value TEXT
);
```
The unique ID itself lives in `expo-secure-store`, not in SQLite.

### Server (Postgres)
```sql
profiles (
  id          text PRIMARY KEY,          -- the unique ID, normalized (uppercase, no spaces)
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz
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
  server_seq         bigserial,          -- bumped on every change, used as pull cursor
  PRIMARY KEY (profile_id, date)
);
CREATE INDEX ON entries (profile_id, server_seq);
```
Audio objects are stored at `audio/<profile_id>/<audio_id>.m4a`.

---

## 4. Mobile app

### 4.1 Screen: Today (the main screen)
```
┌─────────────────────────────┐
│  ◀   Today, Sat Oct 10   ▶  │  ← tap the label to open the calendar
│                             │
│     [ 1 ]  [ 2 ]  [ 3 ]     │
│     [ 4 ]  [ 5 ]  [ 6 ]     │
│     [ 7 ]  [ 8 ]  [ 9 ]     │
│            [10 ]            │  ← like the 0 key on a phone keypad
│                             │
│  ┌ Note…                  ┐ │  ← optional, expands when tapped
│  └────────────────────────┘ │
│  [ ● Record ]               │  ← or: [ ▶ 0:42 ]  [ 🗑 ]
│                             │
│           ✓ Synced          │  ← small, unobtrusive status
└─────────────────────────────┘
```

**Day selector**
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
- The note field sits below the keypad as a one-line "Note…" field and expands to multi-line when focused.
- It autosaves, debounced ~1s and on blur. There is no save button.
- Maximum 2,000 characters. Clearing the text removes the note (stored as `NULL`).
- On small screens the area below the keypad scrolls, so the keypad never shrinks below its minimum size.

**Audio recording (optional, one per day)**
- **Record:** `● Record` starts recording and shows a timer and a Stop button. The microphone permission is requested on the first tap only.
- **Recording format:** AAC `.m4a`, mono, ~64 kbps, about 0.5 MB per minute. There is a **5-minute maximum**, and recording stops on its own at the limit.
- **Saving:** stopping saves the recording right away to the documents directory. If an interruption (phone call, app sent to background) stops the recording, what was captured so far is kept.
- **Playback:** a play/pause button and the duration. Delete is a trash icon with a confirmation. Recording again on a day that already has a recording asks "Replace recording?" first.
- **Downloads:** recordings made on another device are downloaded the first time they're played and cached locally after that.
- **Discreet permission text:** "Used to record audio notes."

**Sync status indicator:** one of "Synced", "Saved on device, will sync", or "Syncing…". Tapping it starts a manual sync.

### 4.2 Screen: History
Read entirely from local SQLite, so it works offline and updates instantly after a change on the Today screen. It uses the same neutral styling as the rest of the app: no labels or mood words, and one neutral color.

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
- **Summary row:** average, min, max, and days logged out of days in range. These are computed by the same shared helper the web uses, so both show the same numbers.
- **Line chart:**
  - X = date, Y = fixed 1–10 axis.
  - Missing days, and days that only have a note, are gaps, not zeros.
  - Press and drag shows the date and value.
  - For 1Y and All, show weekly averages so the chart stays readable.
- **Counts chart:** a toggle switches to a bar chart showing how many days each value (1–10) was recorded in the range.
- **List (value-wise):**
  - One row per day in the range, newest first, showing the date and its value ("—" if none).
  - `✎` marks days with a note and `🎙` marks days with a recording, with a one-line preview of the note.
  - The list scrolls under the chart using a virtualized list (`FlatList` / `FlashList`), so long ranges stay smooth.
  - Days with unsynced changes get a subtle dot.
- **Tap a row** to jump to the Today tab with that day selected, where the value, note, and recording can be viewed, played, and changed. History itself is read-only.
- **Empty state:** if the range has no entries, show a short neutral message ("Nothing recorded yet") instead of an empty chart.
- **Refresh:** History re-queries SQLite when it gains focus and after a sync pulls new rows.

### 4.3 Screen: Settings
- **Your ID:**
  - Shown large and grouped for readability (e.g., `7K3M9 QX2PD`).
  - Buttons to **Copy** and **Share** it, plus a "Write this down. It's the only way to see your data on the web or move it to a new phone" hint.
  - Before the ID has been registered with the server (first sync), it shows "Not active on the web yet".
- **Open web view:** a link to the website. The ID is *not* put in the URL.
- **Use an existing ID:** for a new phone or a reinstall. See §5.4.
- **Sync:** last sync time and a "Sync now" button.
- **Delete my data from the server** (with confirmation). This removes all entries and audio for the ID from the server. Local data stays unless the user also chooses "Delete from this device too".
- **Export CSV:** date, value, and note. Recordings can optionally be shared as a zip.

### 4.4 Offline-first behavior
- The app is **fully usable without internet from the very first launch.** The ID is generated on the device, and every change is saved locally with `dirty = 1`.
- The first time the app is online, it registers the ID and pushes everything. After that, sync just keeps both sides up to date.
- Recordings are uploaded in the background when online, and they upload *before* the entry that references them (see §6.3).

---

## 5. Unique ID: access without accounts

### 5.1 Format
- **10 characters** from the **Crockford Base32** alphabet: digits `0–9` and letters `A–Z` **excluding `I`, `L`, `O`, `U`**. That leaves letters and numbers only, without the easily confused characters.
- **Size:** about 50 bits of randomness, roughly 1 quadrillion possible IDs. That is short enough to type and big enough that guessing one is impractical once rate limiting is added (§5.5).
- **Display:** shown as two groups of five (`7K3M9 QX2PD`). The space is only visual and is not part of the ID.
- **Lenient input:** typed IDs are case-insensitive, spaces and dashes are ignored, and look-alikes are mapped (`O`→`0`, `I`/`L`→`1`).
- **Generation:** uses a cryptographically secure random source (`expo-crypto` `getRandomBytes`).

### 5.2 Lifecycle
1. **First launch:** the app generates an ID locally and stores it in secure storage. No network is needed.
2. **First online sync:** `POST /api/ids/register` with the ID.
   - If the ID is new, the server creates the profile, and the ID is now active.
   - If the ID already exists (vanishingly rare), the server returns `409`. The app silently generates a new ID and tries again. This only happens before the ID has ever been shown as "active", so the user is never affected.
3. **Every sync and API call** sends the ID as `Authorization: Bearer <ID>` over HTTPS.

### 5.3 Web login
- `/` is a single field: "Enter your ID", plus a "View" button. Wording stays neutral.
- On success, the server sets a signed, `httpOnly`, `Secure`, `SameSite=Lax` session cookie (30 days) and redirects to `/dashboard`. A **Sign out** link clears the cookie.
- Invalid IDs get a generic "ID not found" error after a small fixed delay.
- The ID never appears in URLs, page titles, or logs. Server logs record a hash of it only.

### 5.4 New phone / reinstall
- Settings → **Use an existing ID** → enter the ID → the app verifies it with the server.
  - If this device already has local entries under its own ID, the app asks: **Merge** them into the existing ID or **Discard** them.
  - The app then switches to the existing ID and does a full pull.
- Several devices can use the same ID at once. They sync through the per-field merge (§6.2).

### 5.5 Security model (accepted trade-offs)
- **The ID is the only key.** Anyone who has it can view and add data for it. There is no email, so **a lost ID can't be recovered**. The Settings screen makes this clear.
- **Brute-force protection:**
  - Limit login and registration attempts per IP (e.g., 10 per minute, then increasing backoff).
  - Return the same response for "wrong format" and "not found".
  - Alert on unusual numbers of failed lookups.
- **Replace ID** (Settings, low cost): generates a new ID and moves the server data over to it, in case the old one was shared by accident. Other devices using the old ID get `401` and are asked to enter the new one.
- All traffic is HTTPS only. Audio is only reachable through short-lived signed URLs handed out after an ID check.

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
  "applied": ["2026-10-10"],        // dates processed (accepted, or server already had newer)
  "changes": [ /* server rows with server_seq > cursor, same shape */ ],
  "cursor": "1840"
}
```
Each field group (value / note / audio) is optional in a change. The client only sends the groups that changed.

### 6.2 Conflict resolution: last-write-wins per field
- For each field group, the server takes the incoming version **only if** its `*UpdatedAt` is newer than the stored one. Any accepted change bumps `server_seq`.
- **Value can't be cleared:** a `null` value is never accepted over an existing one.
- **Notes and recordings can be cleared:** `null` plus a newer timestamp removes them.
- When a recording is replaced or removed, the server deletes the old audio object asynchronously, after the database change commits.
- The client applies each pulled field group only if the local copy of that group is not dirty, or the pulled timestamp is newer.
- After a successful response, the client clears `dirty` only for rows unchanged since the push. It compares timestamps so a tap or keystroke during the sync isn't lost.
- Pushes are **idempotent**, so retries are always safe.
- Known limitation: LWW relies on device clocks. That is fine for one person on one or two phones. The server clamps timestamps that are far in the future to `now()`.

### 6.3 Audio transfer
1. **Upload:**
   - The client calls `POST /api/audio/upload-url` with `{ audioId, size }`. The server checks the ID and size, then returns a presigned PUT URL (valid 10 min).
   - The client PUTs the `.m4a` file directly to R2, then marks `audio_files.uploaded = 1`.
   - The client only pushes a row's audio fields **after** its file has uploaded. Until then the row's value and note still sync, and the audio fields wait. That way the server never references a missing file.
2. **Download:** `GET /api/audio/:audioId` checks the ID or web session, then redirects (302) to a presigned GET URL (valid 10 min). The mobile app downloads on first play and caches the file. The web plays it in an `<audio>` element.
3. **Retries:** uploads use the same backoff as sync. Large uploads only start when online. An optional "Upload recordings on Wi-Fi only" setting is a cheap later addition.

### 6.4 When sync runs
iOS background execution is unreliable, so sync **opportunistically**:
1. **After each change**, debounced ~2s, when online.
2. **On app foreground** (AppState → active).
3. **On connectivity regained** (NetInfo).
4. **On manual "Sync now"** / pull-to-refresh in History.
5. **Background task** (`expo-background-task`) as a bonus. It is not relied on.

Failures retry with exponential backoff (cap ~5 min while foregrounded). Only one sync runs at a time, enforced with a mutex.

### 6.5 Server-side validation
- **ID:** 10 valid Crockford Base32 characters after normalization, and registered.
- **`value`:** an integer from 1 to 10.
- **`note`:** at most 2,000 characters.
- **Audio:** at most 5 MB and 5 minutes. `audioId` must be a UUID.
- **`date`:**
  - It must be a valid date **on or before the current UTC date + 1 day**. That one day of leeway covers timezones ahead of UTC (e.g., Pacific/Kiritimati). The future-date rule is mainly enforced by the client.
  - There is no lower limit apart from a sanity floor of `1900-01-01`.
- **Batch size:** at most ~1000 changes per request. The client splits larger pushes into chunks.
- **Rate limiting:** per ID and per IP.

---

## 7. Web server

### 7.1 API routes
| Route | Purpose |
|---|---|
| `POST /api/ids/register` | Register a newly generated ID (mobile) |
| `POST /api/ids/verify` | Check that an ID exists ("Use an existing ID" on mobile) |
| `POST /api/ids/replace` | Move data to a new ID |
| `POST /api/session` / `DELETE /api/session` | Web login with ID / sign out |
| `POST /api/sync` | Mobile sync |
| `POST /api/audio/upload-url` | Presigned upload URL |
| `GET /api/audio/:audioId` | Redirect to a presigned download URL |
| `GET /api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD` | Dashboard data for a date range |
| `DELETE /api/data` | Delete all server data for the ID (entries + audio) |
| `GET /api/health` | Uptime checks |

### 7.2 Dashboard page (`/dashboard`, session required)
- **Date range control:** presets **7D · 30D · 90D · 1Y · All**, plus a **custom** from/to picker. The range is kept in the URL query string (`?from=…&to=…`) so it can be bookmarked. Only the range goes in the URL, never the ID.
- **Summary tiles for the range:** average, min, max, days logged / days in range, and a current streak.
- **Main chart: line chart of value over time.**
  - X = date, Y = 1–10 (fixed axis).
  - Days without a value show as **gaps** and are not interpolated to zero.
  - Optional toggle for a **7-day rolling average** overlay.
  - For ranges longer than ~180 days, offer weekly or monthly averages so the chart stays readable.
  - Tooltip shows the date, the value, and a short note preview, if any. Points for days with a note or recording get a small marker.
- **Secondary chart: distribution bar chart** showing how many days each value (1–10) was recorded in the range.
- **Entries table** below the charts, sorted newest first and paginated.
  - Columns: date, value, note (full text, wrapped), and recording (inline play button with duration).
- Responsive layout so the dashboard also works on a phone browser.
- Use neutral wording throughout: "value" or no label at all, never "mood". Page titles and the browser tab title stay generic.
- Read-only in v1. Editing on the web can come later; it would use the same per-field upsert.

### 7.3 Other web pages
- `/`: the ID entry page.
- `/privacy`: the privacy policy.

---

## 8. Implementation phases

### Phase 0: Foundations (≈2–3 days)
- Set up the monorepo (pnpm, TypeScript, ESLint/Prettier, CI running lint and tests).
- `packages/shared`:
  - zod schemas for `Entry` and the sync request/response.
  - Date utilities (`todayLocal()`, `isFutureDate()`, `addDays()`) using `date-fns`.
  - ID utilities: `generateId()`, `normalizeId()`, `isValidId()`, `formatIdForDisplay()`.
  - Stats helpers used by both the mobile History tab and the web dashboard: range presets → from/to, fill missing days with `null` for gaps, rolling and weekly averages, summary stats, and value counts.

### Phase 1: Mobile, local-only (≈2.5 weeks)
- Expo app scaffold (expo-router tabs: Today, History, Settings) with the SQLite schema and migrations.
- Local ID generation on first launch, shown in Settings with copy/share.
- Today screen:
  - Day selector (arrows + calendar picker, future blocked, no lower limit).
  - The 1–10 keypad (3×3 grid with 10 centered on the bottom row) with persistent highlight.
  - Instant local save, haptics, accessibility labels, midnight rollover handling.
- Text note with autosave. Audio record, playback, replace, and delete, with a 5-minute cap and interruption handling.
- History tab: range presets, summary row, line chart, counts chart toggle, and the list of days with note/recording markers. Tapping a row opens that day on the Today tab.
- ✅ Done when everything works in airplane mode on both platforms.

### Phase 2: Server (≈1–1.5 weeks)
- Next.js app, Postgres schema, Drizzle migrations, R2 bucket.
- ID register/verify endpoints, bearer-ID middleware, rate limiting.
- `POST /api/sync` with per-field LWW and validation.
- Presigned audio upload/download and async cleanup of replaced recordings.
- Deploy to staging.

### Phase 3: Sync in the mobile app (≈1.5 weeks)
- Sync engine: register the ID, push dirty field groups, pull since cursor, merge, mark clean. Includes triggers, backoff, mutex, and the status indicator.
- Audio upload queue (upload before push) and lazy download with a local cache.
- "Use an existing ID" flow with merge/discard.
- ✅ Done when offline edits on two phones sharing an ID (value on one, note and recording on the other, same day) converge correctly after both come online.

### Phase 4: Web dashboard (≈1 week)
- ID entry page, session cookie, sign out.
- `GET /api/entries` and the dashboard with range presets and custom range in the URL.
- Line chart with gaps and the rolling average, distribution chart, summary tiles, and the entries table with notes and audio playback.

### Phase 5: Polish + release (≈1 week)
- App icon, splash screen, dark mode, store listings, privacy policy (needed by both stores). Keep the icon, display name ("Down & Up"), listing text, and the mic permission string neutral, with no mention of mood.
- Delete-my-data, CSV export, and Replace ID.
- EAS build and submission to TestFlight and Play internal testing, then production.

**Rough total: about 8 weeks for one developer.**

---

## 9. Testing strategy
- **Unit (shared + server):**
  - Date utilities across timezones and DST.
  - ID generate/normalize (case, spaces, `O`→`0`, `I`/`L`→`1`) and the alphabet check.
  - The per-field LWW merge, including "value can't be cleared" and "note/audio can be cleared".
  - zod validation and the stats helpers (gap filling, averages, counts).
- **Sync integration tests:**
  - Two phones sharing an ID: offline edits on both, different fields on the same day, the same field on both.
  - A tap or keystroke during an in-flight sync.
  - Retry after a dropped response.
  - The ID collision path (`409`) during registration.
- **Audio:**
  - Upload interrupted mid-way, then retried.
  - Row pushed before its file finished uploading: the audio fields are held back.
  - Replace/delete removes the old object on the server.
  - Recording stopped by an interruption.
- **Mobile E2E (Maestro):**
  - Select a day, tap 3 then 8, and check that 8 is highlighted.
  - Try to go past today and check it's blocked. Pick a date years back.
  - Add a note and a recording.
  - Airplane-mode round trip.
  - In History, check that the value, note marker, and chart update, then tap a row and confirm it opens that day on the Today tab.
- **Web E2E (Playwright):** enter an ID, change range presets and check that the chart and the URL update, play a recording, sign out. A bad ID gets the generic error.
- **Security checks:** rate limiting on ID lookup, and the ID never appearing in URLs or logs.

---

## 10. Decisions made
- **Tapping the selected number again:** does nothing. A day's value can be changed but never cleared, and each day has at most one entry.
- **Labels:** none. The app is for mood but stays discreet, so there is no label, prompt, or mood wording anywhere.
- **Number layout:** phone keypad style, with 1–9 in a 3×3 grid and 10 alone, centered, on the bottom row.
- **Name:** keep "Down & Up".
- **App lock:** none.
- **In-app history:** a History tab with a list of values by day and charts, read from local data so it works offline.
- **Notes:** an optional text note (≤2,000 chars) and an optional audio recording (≤5 min, one per day) for any day.
- **Past dates:** no limit on how far back.
- **No sign-in:** a device-generated 10-character letters-and-numbers ID links the app to the web. The web login is just that ID.

## 11. Open questions
1. **Reminders:** a daily local notification? If added, it should use neutral text with no mood wording (e.g., just the app name, or "Reminder").
