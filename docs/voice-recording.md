# Voice recording (Phase 6)

**Status: deferred.** The first release records a value and a text note only. Recording is built but hidden behind `RECORDING_ENABLED = false` in `packages/shared`, and the app requests no microphone permission. The SQLite and Postgres audio columns and the audio field group in the sync protocol stay in place, empty, so turning recording on needs no migration or protocol change.

## Recording on Pawsitive (optional, one per day)

When it ships, a recording shows on Pawsitive below the note as `[ ● Record ]`, or `[ ▶ 0:42 ]  [ 🗑 ]` once recorded.

- **Record:** `● Record` starts recording and shows a timer and a Stop button. The microphone permission is requested on the first tap only.
- **Recording format:** AAC `.m4a`, mono, ~64 kbps, about 0.5 MB per minute. There is a **5-minute maximum**, and recording stops on its own at the limit.
- **Saving:** stopping saves the recording right away to the documents directory. If an interruption (phone call, app sent to background) stops the recording, what was captured so far is kept.
- **Playback:** a play/pause button and the duration. Delete is a trash icon with a confirmation. Recording again on a day that already has a recording asks "Replace recording?" first.
- **Downloads:** recordings made on another device are downloaded the first time they're played and cached locally after that.
- **Day changes while recording:** the day selector is disabled on both tabs, and leaving the Pawsitive tab stops and saves the recording.
- **Discreet permission text:** "Used to record audio notes."
- Changing the day loads that day's recording along with its value and note.
- Recordings are uploaded in the background when online, and they upload _before_ the entry that references them ([audio transfer](#audio-transfer)).

## Elsewhere in the app and on the web

- **History:** `🎙` (or `●`) marks days with a recording.
- **Settings:** "Share saved recordings" exports local recordings as a ZIP. ZIP export streams files in 64KB chunks and does not download remote recordings. "Delete my data" also queues the ID's audio for deletion within 24 hours.
- **Web dashboard:** points for days with a recording get a small marker, the tooltip says "Recording", and the entries table gets a recording column with an inline play button and duration.

## Audio transfer

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

## Already built (Phases 1–4)

- Audio record, playback, replace, and delete on the phone, with a 5-minute cap and interruption handling.
- Audio upload queue (upload before push, re-upload on `missingAudio`), lazy download with a local cache, and local file cleanup.
- Presigned audio upload with signed size/type, a HEAD check during sync, and the `missingAudio` response list. Presigned download.
- `audio_deletions` queue and the two cron jobs.
- Recording playback in the web entries table.

## To do

- Turn on `RECORDING_ENABLED`.
- Restore the microphone permission ("Used to record audio notes."): remove the `RECORD_AUDIO` block and set `microphonePermission` in `apps/mobile/app.config.ts`.
- Restore recordings in the privacy notice, `/privacy`, the landing copy, the "Delete my data" confirmation, and the store description.
- Add Audio Data to the store disclosures ([data protection](completed/identity.md#data-protection--compliance)).
- Set up and verify the R2 bucket on live infrastructure.
- Real-device testing of audio (interruptions, Bluetooth headsets, both platforms). The device checks are in the "Deferred: voice recording" section of [`RELEASE.md`](RELEASE.md).
- Fold the recording UI into [mobile app](completed/mobile-app.md), then move this plan to `completed/`.

## Tests

- Upload interrupted mid-way, then retried.
- Row pushed before its file finished uploading: the audio fields are held back.
- Replace/delete removes the old object on the server.
- Recording stopped by an interruption.
- A row referencing a file that's missing on the server is answered with `missingAudio`, and the file is re-uploaded.
- The cron jobs delete queued and orphaned objects, and nothing that's still referenced.
- Maestro: `tests/mobile/deferred/audio.yaml` and `playback.yaml`.
- Web E2E: change the dashboard check from "recordings stay hidden" back to playing a recording.
