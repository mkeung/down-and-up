# v1 launch (Phase 5: polish and release)

**Status: in progress.** About 2 weeks, including store review buffer. The concrete device, infrastructure, and store checklist is [`RELEASE.md`](RELEASE.md).

## Done

- Portrait-only mobile orientation on iOS and Android, including tablets. Rotation checks remain in [`RELEASE.md`](RELEASE.md).

- Performance review fixes: bounded sync/database work, faster shared chart calculations, range-scoped history reads, lazy mobile calendar rows, and nonblocking local startup. See [implementation review](completed/implementation-review.md#performance-and-responsiveness). Real-device responsiveness during restore remains a release check.

- App icon, splash screen, dark mode, and store listing draft.
- CSV export and Replace ID.
- [Data status icon](completed/data-status-icon.md): replaces the text indicator at the bottom of Rate and is the way into Settings.
- **Ship without voice recording:** recording controls, markers, and playback are hidden in the app and on the web behind `RECORDING_ENABLED` (`packages/shared`). The microphone permission is dropped from the app config, and `RECORD_AUDIO` is blocked on Android. The audio columns and sync field group stay, empty. See [voice recording](voice-recording.md).

## To do

- [Visual direction](visual-direction.md): implement the retro-pixel theme.
- Keep the icon, display name ("Down & Up"), and listing text neutral, with no mention of mood.
- Privacy policy, App Store privacy label, and Play Data Safety form ([data protection](completed/identity.md#data-protection--compliance)). Confirm encryption at rest and the backup retention settings with the chosen providers.
- Real-device testing of two-phone sync.
- EAS build and submission to TestFlight and Play internal testing, then production.

When everything here is done, move this plan to `completed/`.
