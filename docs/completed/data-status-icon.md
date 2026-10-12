# Data status icon

**Status: completed** (part of the [v1 launch](../v1-launch.md)).

One icon in the top-right corner of the Rate and Pawsitive tabs, above the day selector, shows whether the user's entries are safe. It's also the way into Settings: tapping it opens Settings. It replaced the text status line at the bottom of Rate, and it gives Settings a visible entry point.

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

| State            | Color  | Shape                   | When                                                                                                                                                                                                                                                                                                 |
| ---------------- | ------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unsaved**      | Red    | Circle with `!`         | A change isn't on the phone yet: a note edit waiting for its ~1s autosave, a write in progress, or a local write that failed. The icon turns red only after this state persists continuously for 500ms; faster saves skip red. It stays red while the change remains unsaved.                        |
| **Saved here**   | Yellow | Phone outline           | Everything is saved in SQLite, but the server doesn't have all of it: a field is still dirty, a sync is running or failed, the phone is offline, the ID needs to be entered ([identity: lifecycle](identity.md#lifecycle)), the server isn't configured, or sync is off ("Keep on this phone only"). |
| **In the cloud** | Green  | Cloud with a check mark | Sync is on, no field is dirty, no local write is pending, and the last sync succeeded.                                                                                                                                                                                                               |

- **Delay red by 500ms.** While an unsaved state is brief, retain the previous yellow/green icon. Cancel the delay as soon as the data is saved; each new unsaved period starts a fresh 500ms timer. Yellow and green changes (including recovery from red) display immediately. If no prior status exists, show yellow during the delay. The displayed glyph, color, accessibility value, and test ID all use this delayed state. One timer lives in the app provider so both tabs share it, including first visits and remounting screen consumers.
- **Sync off stays yellow.** With "Keep on this phone only", entries really are only on the phone, so the icon is yellow for as long as sync is off.
- **Sync errors stay yellow, not red.** The data is safe on the phone. Details go in Settings.
- **No animation.** While a sync runs, the icon stays yellow until the server accepts the changes, then turns green. There's no spinner or pulse.

## Design

- **Not color alone.** Each state has its own shape, so the status reads without color (color blindness, grayscale mode).
- **Colors:** three dedicated theme colors for status only, with light and dark variants that keep at least 3:1 contrast against the background. They're never used on the keypad, which keeps one neutral color, and they never depend on the value, so they don't suggest that a value is good or bad.
- **Size:** about 24pt, with a touch target of at least 44×44pt.
- **Accessibility:** a button labeled "Settings", with the status as its value: "Not saved yet", "Saved on this phone", or "Saved to the cloud". The text is neutral, like the rest of the app.
- **Where it appears:** Rate and Pawsitive only. History and Settings don't show it.
- **Retro-pixel art:** when the [visual direction](../visual-direction.md) lands, the three shapes are drawn as pixel glyphs in the same style.

## Changes to other screens

- **Rate:** the text status line at the bottom is gone. Manual sync is "Sync now" in Settings.
- **Settings:** opens from the icon. The tab bar stays visible, so tapping Rate or Pawsitive returns. The Sync section shows the immediate underlying data status in words (the icon alone delays red for 500ms), plus the last sync time and "Sync now". If the last sync failed, it says "The last sync failed. It will try again."

## Implementation

- **One source of truth:** `dataStatus()` in `apps/mobile/src/data-status.ts` turns the inputs into a state: a pending note autosave, writes in flight or failed, whether any field is dirty, whether sync is on, the server is configured, the ID is present, the phone is online, and the last sync result.
- **Presentation timing:** `useDataStatusIndicator()` in `apps/mobile/src/data-status-indicator.ts` retains the last saved state and waits 500ms before showing unsaved. `AppProvider` publishes this as `indicatorDataStatus`, alongside the unchanged immediate `dataStatus` used by Settings and other logic. The timer resets after recovery and is cleared on unmount.
- The note editor reports its pending autosave through the app context. The repository counts writes in flight and remembers whether the last one failed (`writeState()`, `onWriteState()`); a later successful write clears the failure.
- The dirty check (`hasDirty()`) re-runs after every local change and every sync.
- A sync that fails (not one that's stopped) reports "Could not sync, will retry", which keeps the icon yellow and drives the Settings message.
- The button is `DataStatusButton` in `apps/mobile/src/data-status-icon.tsx`, with `testID` `data-status-unsaved`, `data-status-local`, or `data-status-cloud`. Colors are `status` in the theme, fixed regardless of the chosen palette: light `#b3261e` / `#a36a00` / `#2e7d32`, dark `#ff8a80` / `#f2c94c` / `#7bc67e`, each at least 4:1 against the background.

## Tests

- **Unit:** the 499/500ms boundary, quick saves skipping red, immediate yellow/green recovery, consecutive short writes not accumulating, rerenders not resetting the timer, unmount cleanup, and tab consumers sharing one presentation timer while the underlying status stays immediate.
- **Unit:** each state, the order when several apply, sync off staying yellow, a failed sync staying yellow, and a failed local write showing red.
- **Unit:** the repository's write tracking and dirty check, and the sync engine's failure status.
- **Maestro** (`tests/mobile/local.yaml`): yellow with sync off, and tapping the icon opens Settings on both tabs. Red is delayed by 500ms and can appear during the note autosave interval, so it's covered by unit tests rather than Maestro, which would be flaky. Green needs a server and is checked against staging.
