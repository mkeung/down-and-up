# Unique ID: access without accounts

**Status: completed.** The ID format, its lifecycle, web login, moving to a new phone, the security model, and data protection.

## Format

- **12 characters** from the **Crockford Base32** alphabet: digits `0–9` and letters `A–Z` **excluding `I`, `L`, `O`, `U`**. That leaves letters and numbers only, without the easily confused characters.
- **Size:** 60 bits of randomness, about 1.15 quintillion possible IDs.
  - 10 characters (50 bits) was considered and rejected. With ~100k users, a billion guesses spread across many IPs would have about a 9% chance of hitting someone's ID.
  - At 12 characters the same attack has about a 0.01% chance. The data (mood scores, and later voice recordings) justifies the two extra characters.
- **Display:** shown as three groups of four (`7K3M 9QX2 PDA4`). The spaces are only visual and are not part of the ID.
- **Lenient input:** typed IDs are case-insensitive, spaces and dashes are ignored, and look-alikes are mapped (`O`→`0`, `I`/`L`→`1`).
- **Generation:** uses a cryptographically secure random source (`expo-crypto` `getRandomBytes`).

## Lifecycle

1. **First launch:**
   - The app generates an ID and a 128-bit random **registration secret**.
   - It stores `{ id, secret, registered: false }` as a single secure-storage record. No network is needed.
2. **First online sync** (sync on): `POST /api/ids/register` with the ID in the Authorization header and `{ secret }` in the body. Registration is **idempotent**:
   - **ID is new:** the server creates the profile and stores a hash of the secret. Returns `200`.
   - **ID exists, same secret:** this is the same device re-registering (e.g., a reinstall, or a retry after a lost response). Returns `200`.
   - **ID exists, different secret:** a true collision (odds are negligible at 60 bits). Returns `409`, and the app generates a new ID and secret and retries.
     - At this point the ID may already have been displayed, so Settings shows it as "Not active on the web yet" until registration succeeds. Users should only rely on an ID once it's active.
   - On `200`, the app sets `registered: true` in the same secure-storage record.
3. **Every sync and API call** sends the ID as `Authorization: Bearer <ID>` over HTTPS. The secret is used only for registration. The ID alone grants access ([security model](#security-model-accepted-trade-offs)).
4. **Startup reconciliation.** The ID (secure storage) and data (SQLite) can survive independently. On iOS, Keychain items survive an uninstall but app files don't.
   - **ID present, database empty or missing:** treat as a reinstall. Reset the cursor, re-register (succeeds thanks to the secret), and do a full pull.
   - **Database has synced history (a cursor exists), but the ID is missing:** **don't** silently generate a new ID. Show a one-time prompt: "Enter your ID to keep syncing" with **Enter ID** (goes to [new phone / reinstall](#new-phone--reinstall)) or **Start new** (new ID, all rows marked dirty, all recordings re-queued for upload).
   - **Neither present:** this is a first launch.

## Web login

- `/` is a single field: "Enter your ID", plus a "View" button. Wording stays neutral.
- On success, the server creates a `sessions` row and sets a signed, `httpOnly`, `Secure`, `SameSite=Lax` cookie holding the session ID (30 days). Then it redirects to `/dashboard`. **Sign out** deletes the session row and clears the cookie.
- Invalid IDs get a generic "ID not found" error after a small fixed delay.
- The ID never appears in URLs, page titles, or logs. Server logs record a hash of it only.

## New phone / reinstall

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
- Several devices can use the same ID at once. They sync through the [per-field merge](sync.md#conflict-resolution-last-write-wins-per-field).

## Security model (accepted trade-offs)

- **The ID is the only key.** Anyone who has it can view and add data for it. There is no email, so **a lost ID can't be recovered**. The Settings screen makes this clear.
- **Brute-force protection** (counters live in Upstash Redis, since serverless instances share no memory):
  - **Per IP:** 10 failed lookups per minute, then increasing backoff.
  - **Global:** a cap on failed lookups across all IPs (e.g., 1,000 per minute). Above it, every lookup gets a short delay, and an alert fires. This covers attacks spread over many IPs, where per-IP limits alone don't help.
  - Return the same response for "wrong format" and "not found".
- **Replace ID** (Settings, low cost): generates a new ID and secret and moves the server data over to it, in case the old one was shared by accident. Other devices using the old ID get `401` and are asked to enter the new one. Web sessions for the old ID stop working.
- **Failed server operations:** Delete and Replace ID stop sync while making their requests. If a request fails, sync resumes using the current consent and connectivity state; Replace keeps its operation ID for a safe retry. Successful deletion with "Keep on this device" leaves sync off.
- **Web sessions:** the session cookie holds a signed session ID, never the ID itself. The profile is looked up on every request, so deleted or replaced IDs lose access right away.
- **CSRF:** cookie-authenticated mutations (`PUT /api/settings`, `DELETE /api/session`, `DELETE /api/data`) also check the `Origin` header.
- All traffic is HTTPS only. Audio is only reachable through short-lived signed URLs handed out after an ID check.

## Data protection & compliance

Mood scores (and, once they ship, voice recordings) are likely **health-related data** (a special category under GDPR), so:

- **Encryption:** TLS in transit. Encryption at rest for Postgres and R2 (the default on Neon/Supabase and R2, but confirm it for whichever provider is chosen).
- **Consent:** the first-launch sync notice ([offline-first behavior](mobile-app.md#offline-first-behavior)) is the explicit opt-in. Keeping data on the phone only is always available.
- **Retention and deletion:**
  - "Delete my data" removes database rows immediately and queues audio objects for deletion within 24 hours.
  - Database point-in-time backups expire within 7 days, and the privacy policy says so.
  - Profiles with no sync for 2+ years may be purged after a notice in the app.
- **Minimal collection:** no email, no name, no analytics or ad SDKs. IP addresses are used only transiently for rate limiting and are not stored with entries.
- **Store disclosures:**
  - **App Store privacy label:** Health, Other User Content (notes), User ID. Not used for tracking. Add Audio Data when [voice recording](../voice-recording.md) ships.
  - **Google Play Data Safety:** the matching categories, encrypted in transit, deletion available.
- **Privacy policy** (`/privacy`, linked in the app and the store listings) covers what's collected, why, the processors (Vercel, the Postgres host, Cloudflare, Upstash), retention, how to delete, and a contact address.
