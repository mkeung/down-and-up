# Data status icon

**Status: planned** (part of the [v1 launch](v1-launch.md)).

One icon in the top-right corner of the Rate and Pawsitive tabs, above the day selector, shows whether the user's entries are safe. It's also the way into Settings: tapping it opens Settings. It replaces the text status line at the bottom of Rate ([mobile app](completed/mobile-app.md#sync-status-indicator)), and it gives Settings a visible entry point again.

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

## States

The icon describes all of the user's data, not just the selected day. When more than one state applies, the first match below wins.

| State            | Color  | Shape                   | When                                                                                                                                                                                                                                                                                                           |
| ---------------- | ------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unsaved**      | Red    | Circle with `!`         | A change isn't on the phone yet: a note edit waiting for its ~1s autosave, a write in progress, or a local write that failed. Taps on the keypad write immediately, so red is normally brief. It stays red only if a write fails.                                                                              |
| **Saved here**   | Yellow | Phone outline           | Everything is saved in SQLite, but the server doesn't have all of it: a field is still dirty, a sync is running or failed, the phone is offline, the ID needs to be entered ([identity: lifecycle](completed/identity.md#lifecycle)), the server isn't configured, or sync is off ("Keep on this phone only"). |
| **In the cloud** | Green  | Cloud with a check mark | Sync is on, no field is dirty, no local write is pending, and the last sync succeeded.                                                                                                                                                                                                                         |

- **Sync off stays yellow.** With "Keep on this phone only", entries really are only on the phone, so the icon is yellow for as long as sync is off.
- **Sync errors stay yellow, not red.** The data is safe on the phone. Details go in Settings.
- **No animation.** While a sync runs, the icon stays yellow until the server accepts the changes, then turns green. There's no spinner or pulse.

## Design

- **Not color alone.** Each state has its own shape, so the status reads without color (color blindness, grayscale mode).
- **Colors:** three dedicated theme colors for status only, with light and dark variants that keep at least 3:1 contrast against the background. They're never used on the keypad, which keeps one neutral color, and they never depend on the value, so they don't suggest that a value is good or bad.
- **Size:** about 24pt, with a touch target of at least 44×44pt.
- **Accessibility:** a button labeled "Settings", with the status as its value: "Not saved yet", "Saved on this phone", or "Saved to the cloud". The text is neutral, like the rest of the app.
- **Where it appears:** Rate and Pawsitive only. History and Settings don't show it.
- **Retro-pixel art:** when the [visual direction](visual-direction.md) lands, the three shapes are drawn as pixel glyphs in the same style.

## Changes to other screens

- **Rate:** remove the text status line at the bottom. Manual sync moves to "Sync now" in Settings, which already exists.
- **Settings:** opens from the icon. The tab bar stays visible, so tapping Rate or Pawsitive returns. The Sync section shows the data status in words, matching the icon, plus the last sync time and "Sync now". If the last sync failed, it says so here.

## Implementation

- **One source of truth:** a pure function in the mobile app turns the inputs into a state: pending or failed local writes, whether any field is dirty, whether sync is on, and the last sync result. It's unit-tested.
- The note editor reports its pending autosave, and the repository reports write failures.
- The dirty check re-runs after every local change and every sync.

## Tests

- **Unit:** each state, the order when several apply, sync off staying yellow, a failed sync staying yellow, and a failed local write showing red.
- **Maestro:** red while a note autosave is pending, yellow after it saves with sync off or offline, green after a successful sync. Tapping the icon opens Settings on both tabs.

When this ships, fold the screen changes into [mobile app](completed/mobile-app.md) and the tests into [testing](completed/testing.md), then move this plan to `completed/`.
