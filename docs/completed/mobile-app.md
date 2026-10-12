# Mobile app

**Status: completed** (Phase 1, the Rate/Pawsitive tab split, and the [data status icon](data-status-icon.md)). This describes the screens as built. Planned changes to them live in active plans:

- [Visual direction](../visual-direction.md) restyles the screens.
- [Voice recording](../voice-recording.md) adds recording to Pawsitive.

## Screens: Rate (the main screen) and Pawsitive

All custom buttons share a short press/release animation: a 2pt dip and dimming while pressed, returning on release or cancellation. This includes date and Settings actions, keypad keys, tabs, theme swatches, History controls, and the note Submit accessory. Selection indicators remain visible and actions run immediately. Disabled buttons do not animate. Reduce Motion uses immediate opacity feedback without movement, also used until the accessibility preference loads or if it cannot be read.

The bottom tab bar has two tabs. **Rate** holds the keypad and **Pawsitive** holds the note. Both show the same day selector, and they share one selected day: changing the day on either tab changes it on both. A green circle checkmark appears on Rate when that day has a saved value and on Pawsitive when it has a nonempty saved note, including on inactive tabs. These indicators read local SQLite and update after saves and sync; removing a note removes its checkmark. A day still loading shows no checkmarks from the previous day. Accessibility hints describe the saved content independently of tab selection.

```
Rate                              Pawsitive
┌─────────────────────────────┐   ┌─────────────────────────────┐
│                         (●) │   │                         (●) │
│  ◀   Today, Sat Oct 10   ▶  │   │  ◀   Today, Sat Oct 10   ▶  │
│                             │   │                             │
│     [ 1 ]  [ 2 ]  [ 3 ]     │   │  ┌ Note…                  ┐ │
│     [ 4 ]  [ 5 ]  [ 6 ]     │   │  └────────────────────────┘ │
│     [ 7 ]  [ 8 ]  [ 9 ]     │   │                             │
│            [10 ]            │   │                             │
│                             │   │                             │
│─────────────────────────────│   │─────────────────────────────│
│     Rate       Pawsitive    │   │     Rate       Pawsitive    │
└─────────────────────────────┘   └─────────────────────────────┘
```

Tap the date label to open the calendar. On iOS it opens a dismissible overlay with Cancel/Done; on Android it uses the native dialog. It never leaves a second date control in the screen layout. `10` sits where the 0 key is on a phone keypad. The note is optional and expands when tapped. `(●)` in the top-right corner is the data status icon.

### Day selector

- Shared by the Rate and Pawsitive tabs, which always show the same day.
- Defaults to **today** (device local date) on launch.
- `◀` goes back one day. `▶` goes forward one day and is **disabled when today is selected**.
- Tapping the date label opens a native calendar picker with `maximumDate = today` and **no minimum date**, so any past day can be chosen. The native pickers allow quick month and year jumps for dates far back.
- When the app returns to the foreground, recompute "today". If the user was on the old "today" and midnight has passed, move them to the new today.
- Label shows "Today", "Yesterday", or the full date (including the year if it's not the current year).

### Number buttons

- **Phone keypad layout:** a 3-column grid with `1 2 3` / `4 5 6` / `7 8 9` and **`10` alone in the bottom row, centered**, where the 0 key sits on a phone keypad. The same layout is used in every orientation and on tablets, with the grid centered and its width capped on large screens.
- Keys retain at least 64×64pt targets with compact vertical padding and identical neutral art. On Rate, all four rows stay together below a shared Rate/Pawsitive header. Keys 1–9 scroll inside a clipped upper-row area only when necessary, and 10 stays centered underneath with a 12pt gap and its full target visible. All keys share selection and immediate-save behavior.
- **The selected button stays highlighted:** filled neutral background, bold border, and a green circle checkmark at the bottom-right rim, so the state doesn't depend on color alone. The same green badge is used for every number and means only that content exists for the day; it does not indicate the numeric value or cloud sync status.
- **Tapping another number updates the day's value:** the highlight moves and the day's single entry is overwritten.
- **Tapping the already-selected number does nothing:** it stays selected. Once a day has a value it can be changed but never cleared.
- Tapping a number writes to SQLite **immediately**, so there is no save button. A light haptic tap confirms it. After a changed value is saved, its matching 1–10 Cerberus reaction plays once at the current position and facing, then roaming resumes. New choices replace the current reaction; late completions from earlier writes cannot override the latest choice. A failed save triggers no reaction. Repeated selected taps still do nothing. History reads, date changes, and sync do not trigger playback. Reduce Motion shows the final pose without animation.
- Changing the day loads that day's value and note, if any. If the day has no value, nothing is highlighted.
- All ten keys use one neutral color, so they don't suggest that low numbers are bad or high numbers are good.
- Accessibility: each button's label is just the number (e.g., "7"), the selected one has `accessibilityState={{ selected: true }}`, and Dynamic Type / font scaling is supported.

### Text note (optional)

- The note field is on the Pawsitive tab, below the day selector, as a multi-line panel with the same scaled height as the full keypad. Both screens share header geometry, so the date does not shift between tabs.
- It autosaves, debounced ~1s and on blur. The keyboard’s Submit control flushes the current draft, dismisses the keyboard, and randomly plays either the food-can or backflip animation once (equal probability), retaining the character’s facing. Backflip plays a dog bark at the start and a meow on the final recovery pose, respecting the local sound controls. iOS also shows an explicit Submit accessory button. No animation depends on note contents or numeric values.
- Editing waits for the selected day's SQLite read. Drafts remain intact while a write is pending or fails; an older write cannot clear a newer draft.
- Maximum 2,000 characters. Clearing the text removes the note (stored as `NULL`).
- On small screens each tab scrolls, so the keypad never shrinks below its minimum size.

### Data status icon

A red, yellow, or green icon in the top-right corner of Rate and Pawsitive shows whether entries are unsaved, saved on this phone, or saved to the cloud. Red appears only after unsaved persists continuously for 500ms; quick saves keep the previous yellow/green icon. Both tabs share the delay, and yellow/green recovery is immediate. Each state has its own shape. Tapping it opens Settings. Details in [data status icon](data-status-icon.md).

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
  - The list scrolls under the chart using `VirtualizedList`. Calendar rows are generated only as needed; History reads just the selected SQLite range while focused. All uses a separate earliest-date lookup. Entry revisions refresh the view; preference writes and sync metadata do not reload history.
  - Days with unsynced changes get a subtle dot.
- **Tap a row** to jump to the Rate tab with that day selected. The value can be changed there, and the note for the same day is on the Pawsitive tab. History itself is read-only.
- **Empty state:** if the range has no entries, show a short neutral message ("Nothing recorded yet") instead of an empty chart.
- **Refresh:** History re-queries SQLite when it gains focus and after a sync pulls new rows.

## Screen: Settings

Settings has no tab. It opens from the [data status icon](data-status-icon.md), from the "Enter ID" prompt ([identity: lifecycle](identity.md#lifecycle)), and through the `down-up://settings` link. The tab bar stays visible, so tapping Rate or Pawsitive returns.

- **Your ID:**
  - Shown large and grouped for readability (e.g., `7K3M 9QX2 PDA4`).
  - Buttons to **Copy** and **Share** it, plus a "Write this down. It's the only way to see your data on the web or move it to a new phone" hint.
  - Before the ID has been registered with the server (first sync), it shows "Not active on the web yet".
- **Open web view:** a link to the website. The ID is _not_ put in the URL.
- **Use an existing ID:** for a new phone or a reinstall. See [identity: new phone / reinstall](identity.md#new-phone--reinstall).
- **Reminder** (read-only here): "Daily at 8:00 PM", or "Off", with a note that it's set on the web. If notification permission is denied, it shows "Notifications are blocked" with a button that opens the phone's settings.
- **Sync:**
  - Shows the immediate underlying data status in words (the top icon alone delays red by 500ms), plus the last sync time and a "Sync now" button. If the last sync failed, it says "The last sync failed. It will try again."
  - When sync is off, shows "Sync is off" with a **Start syncing** button. Starting creates a new ID and uploads all local data.
- **Delete my data from the server** (with confirmation). This removes all entries for the ID from the server, then asks:
  - **Also delete from this device:** wipes local data, then starts fresh with a new ID.
  - **Keep on this device:** keeps local data, clears the ID, and **turns sync off**, so nothing gets re-uploaded.
- **Export CSV:** date, value, and note.
- **Sound:** a Mute toggle and 0–100% volume slider control button and animal effects together.

### Sound controls

- Settings has a **Sound** panel below the theme picker, with **Mute** and a continuous **Volume** slider. Screen readers can adjust volume in 5% steps. The touch area is at least 48pt high and labels scale with text.
- Mute stops active effects and cancels pending animation cues immediately. Unmuting retains the chosen volume and does not replay canceled sounds. Zero volume is also silent; adjusting the slider while muted does not unmute.
- Master volume scales each clip's existing level. The default is unmuted at 100%, preserving the established mix. Effects still follow the phone's silent/vibrate mode and mix with other audio.
- `{ muted, volume }` is one local SQLite state record under `ui_sound`. It is never synced and survives restarts and ID changes, including discarding entry data. Slider movement applies immediately and saves after a short debounce or on release; mute saves immediately. Writes are serialized so earlier changes cannot overwrite newer ones.
- Playback waits for the saved preference to load. A malformed saved record or failed read starts muted. Save failures retain the live setting and show a Retry control.

### Theme colors

- Settings has a **Theme color** picker: Neutral (default), Mint, Blue, Peach, Plum, and Yellow. Labeled swatches preview the surface color with neutral keys. A checkmark, selected border, and accessibility selection state identify the active choice.
- Picking a swatch saves immediately and updates all mobile screens and the tab bar. There is no save button. The choice stays in SQLite under `ui_theme`, is never synced, and survives restarts and identity changes, including discarding entry data.
- The saved choice loads before the screens render. Unknown saved choices fall back to Neutral. A failed save preserves the previous choice and shows an error so it can be retried.
- Light and dark variants follow the phone's appearance. Text contrast is at least 4.5:1, control outlines at least 3:1, and dedicated data-status colors at least 3:1 against each palette's background.
- Color applies to backgrounds and chrome. All ten number keys retain the same neutral surfaces and selection colors; data-status colors describe storage and do not change with the selected theme.

### Retro-pixel presentation

Rate, Pawsitive, History, Settings, and privacy/consent panels use shared stepped frames and block shadows. Keypad numerals and both date-button rows use locally bundled Silkscreen; headings, other button labels, and typed notes use Pixelify Sans; explanations and IDs retain regular text. The date button always shows two single-line rows so its height is stable across days. Font scaling stays enabled, keycaps have at least 64pt targets, and content scrolls when enlarged. The custom two-tab bar keeps its safe-area inset and shows selection with a double rim and underline. The selected numeric key also has a green circle with a pixel checkmark. Both Rate and Pawsitive show the approved Cerberus character with a transparent background and no visible container, gently roaming across the bottom above navigation in a 240pt viewport. Walking uses the approved eight-frame walk loop and flips horizontally when heading right. At random stops, it sits (including occasional longer rests) or plays with a tennis/yarn ball, retaining the direction it faced when the stationary animation began. The six everyday sheets, tug sheet, ten reaction sheets, alpha hit masks, and original frame timings are bundled locally; the [visual direction](../visual-direction.md) describes timing and asset preparation. A single instance in the navigation footer keeps its position and ongoing animation across Rate/Pawsitive tab changes. Its position is retained in memory while visiting Settings/History and resets on a fresh app launch. The character reserves its own space below the full keypad (and below Pawsitive’s note panel), with transparent image margins removed and a 12pt gap above navigation, so neither walking nor idle poses can cover that button. Its viewport stays 240pt on tall phones and shrinks to 96–240pt on shorter screens to leave room for controls. Settings and History apply safe-area insets only at the top and sides, since the shared tab bar already handles the bottom inset; this avoids a duplicate blank strip above navigation. It pauses both travel and frame playback for hidden tabs/background/Reduce Motion while retaining the current frame and remaining action duration, and hides during keyboard input. Ambient movement remains independent of entries. Only explicitly changed keypad selections request the approved matching reactions, without descriptive labels or changes to the neutral key art. Holding empty space in the animal area for 350ms pauses travel and shows a rope from the finger to the middle head’s grip, with a looping tug pose. The rope follows the finger; release or cancellation removes it and resumes the interrupted behavior. Holds on visible artwork, short taps, and pre-hold drags do nothing. Leaving the area, extra fingers, lifecycle/layout changes, and new entry animation requests cancel tugging. Reduce Motion uses a still grip. “Animal area” has accessible activation and a Hold/Release rope action; numeric and navigation controls stay outside its touch area.

The icon and splash image use `OfficialAssets/10-cerberus-retro-pixel-icon.png`, resized with nearest-neighbor sampling by `scripts/icons.mjs`. That script also prepares the Pawsitive character. Platform device/accessibility checks still live in the [visual-direction plan](../visual-direction.md).

## Offline-first behavior

- Startup reads entry existence without loading all history and opens the local screens before rebuilding notifications or cleaning recording files. Housekeeping failures do not prevent access to saved entries.

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
