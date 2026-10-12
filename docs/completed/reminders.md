# Daily reminder (set on the web, delivered by the phone)

**Status: completed.**

- **Settings:** an on/off switch and a time of day, both set on the web ([web: other pages](web.md#other-web-pages)). They're stored per ID, so every phone using the ID follows them. The phone shows them read-only.
- **Time zone:**
  - The time is a phone-local wall-clock time. "20:00" means 8 PM wherever the phone is.
  - If the phone changes time zones, the reminder follows it, and daylight saving time changes don't shift it.
- **Delivery:** **local notifications scheduled on the phone** with `expo-notifications`. Nothing is sent from the server, so reminders fire with no connection and there's no push infrastructure.
- **Getting settings to the phone:** every sync response includes the current settings ([sync protocol](sync.md#protocol-one-endpoint-push--pull-in-one-round-trip)). A change made on the web takes effect the next time the phone syncs: on app open, on foreground, on reconnect, or opportunistically in the background. The web page says so.
- **Scheduling:**
  - The app schedules **individual notifications for the next 30 days** rather than one repeating notification. iOS allows 64 pending notifications.
  - **The reminder is skipped on any day that already has a value.** Recording a value for today cancels today's notification.
  - The schedule is rebuilt on app start, on foreground, after every sync, after a value is recorded for today, and when the phone's time zone changes.
  - If the app isn't opened for 30 days, reminders stop until it's opened again. That's a deliberate quiet failure mode.
- **Android timing:** uses inexact scheduling, which can be a few minutes late. Exact alarms would need the `SCHEDULE_EXACT_ALARM` permission, which Google Play restricts to alarm and calendar apps.
- **Permission:**
  - The app asks for notification permission only once a reminder has been turned on, the next time the app is in the foreground, with a short neutral explanation first. This covers iOS and Android 13+.
  - "Not now" defers the explanation until the next foreground without recording an OS permission request. Syncs during the same foreground session do not repeat it. A previously stored request flag is ignored if OS permission is still undetermined.
  - If permission is denied, nothing is scheduled, and the app's Settings screen shows how to turn notifications back on.
- **Discreet text:** the title is "Down & Up" and the body is "Reminder". There's no mood wording, and the lock-screen preview gives nothing away.
- **Tapping the notification** opens the Rate tab with today selected.
- **Sync off:** reminders need the web, so they're unavailable while sync is off ("Turn on sync to set a reminder").
- **Multiple phones:** each phone sharing the ID schedules its own reminders. Logging on one phone cancels the reminder on the others only after they sync.
