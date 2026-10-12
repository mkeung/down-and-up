# Testing strategy

**Status: completed.** The suites below are in place. Tests for planned work live in their plans: [data status icon](../data-status-icon.md#tests) and [voice recording](../voice-recording.md#tests). Device and store checks are in [`RELEASE.md`](../RELEASE.md).

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
- **Mobile E2E (Maestro):**
  - Select a day, tap 3 then 8, and check that 8 is highlighted.
  - Try to go past today and check it's blocked. Pick a date years back.
  - Add a note on Pawsitive, and check that the selected day matches across Rate and Pawsitive.
  - Airplane-mode round trip.
  - Reinstall cases: ID kept but database gone (full restore), and database kept but ID gone (prompt, no silent new ID).
  - "Use an existing ID" with Merge (previously synced rows reach the new ID) and with Discard.
  - "Delete my data" with each choice. "Keep on this device" turns sync off and uploads nothing.
  - Turn on a reminder on the web, sync, grant permission, and check that notifications are scheduled. Log today and check that today's notification is cancelled. Tap a notification and check that Rate opens.
  - In History, check that the value, note marker, and chart update, then tap a row and confirm it opens that day on the Rate tab.
- **Web E2E (Playwright):** enter an ID, change range presets and check that the chart and the URL update, check that synced recordings stay hidden, turn the reminder on and change its time (check it persists), sign out. A bad ID gets the generic error.
- **Security checks:**
  - Per-IP and global rate limits on ID lookup.
  - The ID never appearing in URLs, cookies, or logs.
  - Old sessions rejected after Replace ID or Delete.
  - Origin checks on cookie-authenticated mutations.
