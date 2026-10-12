# Release checks

## Infrastructure

- Choose the staging and production Vercel projects, Postgres host, R2 buckets, and Upstash databases. Keep environments separate.
- Confirm database and R2 encryption at rest, database backup expiry within seven days, and the region appropriate for the deployment.
- Configure HTTPS, `APP_ORIGIN`, session-signing and cron secrets, and the real privacy contact. Update `/privacy` with the actual database processor and confirmed retention before public release.
- Apply Drizzle migrations. Confirm the profile counter is not a database sequence.
- Keep R2 private. On live R2, verify that changing the signed Content-Length, Content-Type, or If-None-Match header rejects an upload; check retry after an interrupted upload, a missing object, and a referenced object.
- Confirm the two staggered daily crons run, drain the queue within 24 hours, retain objects still referenced, and retry after storage failures. Preview deployments require manual invocation; Vercel runs scheduled jobs only on production.
- Monitor the Redis security alert key and connect an operator-owned alert integration if required.
- Test ID replacement on a large recording library within the function duration limit. Copies happen under a profile lock; partial failed copies are orphaned and retried safely, but a very large library may need a multi-step migration job before release.

## Both platforms

- Cold launch offline. Choose phone-only storage and verify zero requests with user data. Log 3, then 8, then 8 again; only the first two taps change SQLite timestamps.
- Confirm 64pt minimum keys, a centered 10, selected accessibility state, VoiceOver/TalkBack labels, large fonts, landscape/tablet layout, and light/dark mode.
- Confirm today's forward arrow is disabled. Pick a date years back, including a date before 1900; those dates should show the local-only notice. Test midnight rollover, timezone changes, and DST.
- Add, blur, clear, and rapidly change dates while editing a note. Kill/restart after saving and confirm durable history.
- Record, play/pause/resume, replace, and delete audio. Test a five-minute recording, file size, incoming calls, backgrounding, headset disconnects, and Bluetooth on both platforms. Recording is saved before switching tabs.
- Put both phones offline with the same ID. Edit the value on one and note/audio on the other, then reconnect and confirm both converge.
- Edit during an in-flight sync, retry after a dropped response, restore multiple 500-row pages, and test a fast device clock.
- Reinstall with identity present/database missing; restore the full history. Simulate database present/identity missing; verify the prompt and that no new ID is silently generated.
- Switch IDs with Merge and Discard. Cache remote recordings before Merge, re-queue every field/file, reset the cursor, and confirm the previous ID remains untouched.
- Replace ID, retry after a lost response, and verify old devices and browser sessions lose access.
- Delete server data and choose each local outcome. Keeping local data must disable sync and must never re-upload it automatically.
- Enable/change a reminder on the web, sync, and inspect the next 30 local calendar dates. Deny permission, log today, travel across timezones/DST, and tap a notification while a historical day is open.
- Export CSV, including quotes/newlines/formula-like text, and share the ZIP of locally saved recordings. ZIP export streams files in 64KB chunks and does not download remote recordings.

## Web

- Enter normalized and aliased IDs; invalid format and missing ID must have a generic error with delay.
- Confirm only Authorization headers carry the bearer ID. Check URLs, cookies, page source, titles, network logs, and error responses for leaks.
- Test every range, weekly/monthly boundaries, chart gaps, rolling averages, note markers, count bars, table pagination, recordings, reminder autosave, and sign-out at phone/tablet/desktop sizes.
- Verify per-IP and global failed-lookup limits on hosted Upstash; successful requests should not increment the failed counter.
- Check missing/wrong Origin on all cookie-authenticated mutations. Delete/replace IDs and confirm existing sessions immediately fail.

## Store setup and copy

Confirm bundle identifiers, EAS project ownership, signing, and store records. Use the production EAS profile for signed builds and the preview profile for internal testing. TestFlight and Play internal testing precede production submission.

Display name: **Down & Up**

Short description: **A simple daily record, saved on your phone.**

Description:

> Record one number from 1 to 10 each day. Add a text note or a short audio recording, and look back through your history. Everything works offline. Choose to keep your entries on your phone, or sync and view your record on the web with your unique ID. Set an optional daily reminder on the web and receive it on your phone. No email or password is needed.

Microphone permission: **Used to record audio notes.**

Notification title/body: **Down & Up** / **Reminder**

Prepare App Store and Google Play disclosures from the actual released configuration. The plan identifies Health, Audio Data, Other User Content, and User ID; no tracking. These forms require the operator's review and submission. Do not claim provider retention or encryption has been verified until it has been checked.
