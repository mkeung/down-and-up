# Mobile app

**Status: completed** (Phase 1, plus the Rate/Pawsitive tab split). This describes the screens as built. Planned changes to them live in active plans:

- [Data status icon](../data-status-icon.md) replaces the status line on Rate and becomes the way into Settings.
- [Visual direction](../visual-direction.md) restyles the screens.
- [Voice recording](../voice-recording.md) adds recording to Pawsitive.

## Screens: Rate (the main screen) and Pawsitive

The bottom tab bar has two tabs. **Rate** holds the keypad and **Pawsitive** holds the note. Both show the same day selector, and they share one selected day: changing the day on either tab changes it on both.

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

### Day selector

- Shared by the Rate and Pawsitive tabs, which always show the same day.
- Defaults to **today** (device local date) on launch.
- `◀` goes back one day. `▶` goes forward one day and is **disabled when today is selected**.
- Tapping the date label opens a native calendar picker with `maximumDate = today` and **no minimum date**, so any past day can be chosen. The native pickers allow quick month and year jumps for dates far back.
- When the app returns to the foreground, recompute "today". If the user was on the old "today" and midnight has passed, move them to the new today.
- Label shows "Today", "Yesterday", or the full date (including the year if it's not the current year).

### Number buttons

- **Phone keypad layout:** a 3-column grid with `1 2 3` / `4 5 6` / `7 8 9` and **`10` alone in the bottom row, centered**, where the 0 key sits on a phone keypad. The same layout is used in every orientation and on tablets, with the grid centered and its width capped on large screens.
- The keys are large and roughly square, at least 64×64pt, sized to fill the available width up to the cap, with comfortable spacing.
- **The selected button stays highlighted:** filled background and bold border, so the state doesn't depend on color alone.
- **Tapping another number updates the day's value:** the highlight moves and the day's single entry is overwritten.
- **Tapping the already-selected number does nothing:** it stays selected. Once a day has a value it can be changed but never cleared.
- Tapping a number writes to SQLite **immediately**, so there is no save button. A light haptic tap confirms it.
- Changing the day loads that day's value and note, if any. If the day has no value, nothing is highlighted.
- All ten keys use one neutral color, so they don't suggest that low numbers are bad or high numbers are good.
- Accessibility: each button's label is just the number (e.g., "7"), the selected one has `accessibilityState={{ selected: true }}`, and Dynamic Type / font scaling is supported.

### Text note (optional)

- The note field is on the Pawsitive tab, below the day selector, as a one-line "Note…" field and expands to multi-line when focused.
- It autosaves, debounced ~1s and on blur. There is no save button.
- Editing waits for the selected day's SQLite read. Drafts remain intact while a write is pending or fails; an older write cannot clear a newer draft.
- Maximum 2,000 characters. Clearing the text removes the note (stored as `NULL`).
- On small screens each tab scrolls, so the keypad never shrinks below its minimum size.

### Sync status indicator

On Rate: one of "Synced", "Saved on device, will sync", or "Syncing…". Tapping it starts a manual sync. [Data status icon](../data-status-icon.md) replaces it.

## Screen: History

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
│  Sat Oct 10      7   ✎      │  ← list, newest first
│    "long walk, slept ok…"   │  ← one-line note preview
│  Fri Oct 9       6          │
│  Thu Oct 8       —   ✎      │  ← "—" = no value that day
│  …                          │
└─────────────────────────────┘
```

- **Range:** presets 7D · 30D · 90D · 1Y · All, the same as the web dashboard. The default is 30D. Custom ranges are left to the web.
- **Summary row:** average, min, max, and days logged out of days in range. These are computed by the same shared helper the web uses, so both show the same numbers ([stats definitions](stats.md)).
- **Line chart:**
  - X = date, Y = fixed 1–10 axis.
  - Missing days, and days that only have a note, are gaps, not zeros.
  - Press and drag shows the date and value.
  - Long ranges switch to weekly or monthly averages, following the [shared rules](stats.md).
- **Counts chart:** a toggle switches to a bar chart showing how many days each value (1–10) was recorded in the range.
- **List (value-wise):**
  - One row per day in the range, newest first, showing the date and its value ("—" if none).
  - `✎` marks days with a note, with a one-line preview of the note.
  - The list scrolls under the chart using a virtualized list (`FlatList` / `FlashList`), so long ranges stay smooth.
  - Days with unsynced changes get a subtle dot.
- **Tap a row** to jump to the Rate tab with that day selected. The value can be changed there, and the note for the same day is on the Pawsitive tab. History itself is read-only.
- **Empty state:** if the range has no entries, show a short neutral message ("Nothing recorded yet") instead of an empty chart.
- **Refresh:** History re-queries SQLite when it gains focus and after a sync pulls new rows.

## Screen: Settings

Settings has no tab. It opens from the "Enter ID" prompt ([identity: lifecycle](identity.md#lifecycle)) and through the `down-up://settings` link. [Data status icon](../data-status-icon.md) adds a visible entry point.

- **Your ID:**
  - Shown large and grouped for readability (e.g., `7K3M 9QX2 PDA4`).
  - Buttons to **Copy** and **Share** it, plus a "Write this down. It's the only way to see your data on the web or move it to a new phone" hint.
  - Before the ID has been registered with the server (first sync), it shows "Not active on the web yet".
- **Open web view:** a link to the website. The ID is _not_ put in the URL.
- **Use an existing ID:** for a new phone or a reinstall. See [identity: new phone / reinstall](identity.md#new-phone--reinstall).
- **Reminder** (read-only here): "Daily at 8:00 PM", or "Off", with a note that it's set on the web. If notification permission is denied, it shows "Notifications are blocked" with a button that opens the phone's settings.
- **Sync:**
  - Shows the last sync time and a "Sync now" button.
  - When sync is off, shows "Sync is off" with a **Start syncing** button. Starting creates a new ID and uploads all local data.
- **Delete my data from the server** (with confirmation). This removes all entries for the ID from the server, then asks:
  - **Also delete from this device:** wipes local data, then starts fresh with a new ID.
  - **Keep on this device:** keeps local data, clears the ID, and **turns sync off**, so nothing gets re-uploaded.
- **Export CSV:** date, value, and note.

## Offline-first behavior

- The app is **fully usable without internet from the very first launch.** The ID is generated on the device, and every change is saved locally with `dirty = 1`.
- **One-time sync notice on first launch:** "Your entries are saved on this phone and synced to our server so you can view them on the web."
  - **Continue** (default) turns sync on.
  - **Keep on this phone only** leaves sync off. No ID is registered and nothing leaves the device until the user starts syncing in Settings.
  - The wording stays neutral, and it links to the privacy policy.
- The first time the app is online with sync on, it registers the ID and pushes everything. After that, sync just keeps both sides up to date.
- **Backups:**
  - Android Auto Backup is **disabled** (`android.allowBackup: false`). Otherwise it could restore the database without the secure-store ID, because Keystore-protected values aren't backed up.
  - The server is the backup. Restoring on a new phone goes through "Use an existing ID".

## Phase 1: Mobile, local-only (done)

- Expo app scaffold (expo-router tabs: Rate and Pawsitive, plus History and Settings routes) with the SQLite schema and migrations.
- Local ID + secret generation on first launch (a single secure-storage record), the one-time sync notice, and the ID shown in Settings with copy/share.
- Android Auto Backup disabled.
- Rate and Pawsitive screens:
  - Shared day selector (arrows + calendar picker, future blocked, no lower limit).
  - The 1–10 keypad (3×3 grid with 10 centered on the bottom row) with persistent highlight.
  - Instant local save, haptics, accessibility labels, midnight rollover handling.
- On Pawsitive: text note with autosave.
- History: range presets, summary row, line chart, counts chart toggle, and the list of days with note markers. Tapping a row opens that day on the Rate tab.
- CSV export.
- ✅ Done: everything works in airplane mode on both platforms.
