# Cerberus 01e reaction studies

Open the [offline reaction gallery](index.html). Its keypad previews ten reactions based on [01e](../../../01e-cerberus-retro-pixel-character.png), from no stress at 1 to maximum stress at 10. The gallery initially shows the final poses for comparison and supports playback, pause, restart, frame scrubbing, speed changes, and ivory/dark/transparency backgrounds.

All ten reactions and the keypad preview are also included directly in the [main animation gallery](../index.html#reactions), alongside the seven character actions.

| Value | Reaction       | Visual treatment                                                 |
| ----- | -------------- | ---------------------------------------------------------------- |
| 1     | Carefree       | Happy soft eyes, buoyant lift, loose tail sway                   |
| 2     | Relaxed        | Half-lidded eyes, slow head tilt, calm tails                     |
| 3     | At ease        | Content open eyes, curious tilt, gentle blink                    |
| 4     | Alert          | Watchful faces, forward ears, tails pause                        |
| 5     | Uneasy         | Concerned brows, uncertain mouths, hesitant shift                |
| 6     | Worried        | Drooping ears, uneasy dip, lowered tails                         |
| 7     | Tense          | Worried brows, tight mouths, stiff shoulders                     |
| 8     | Highly anxious | Wide anxious faces, shallow crouch, head quiver                  |
| 9     | Overwhelmed    | Large worried eyes, deeper hunch, trembling shifts               |
| 10    | Most stressed  | Open worried grimaces, pinned ears, lowest crouch, quick tremble |

Each reaction contains eight **512×512 transparent PNG frames**, a **2048×1024 PNG sheet** (four columns × two rows, row-major), a transparent GIF and a lossless animated WebP. Each plays once for **1.89 seconds**, using frame durations `[300, 160, 160, 120, 120, 160, 220, 650]` milliseconds, then holds frame 8. [manifest.json](manifest.json) records the numeric mapping, paths, timing and playback behavior. PNG/WebP preserve full alpha; GIF uses palette transparency.

All three heads express the same level. Coat colors remain consistent; expressions, ears, posture and tails carry the progression. These are generated enlarged pixel-art studies, with eight distinct drawn poses rather than literal low-resolution production sprites. The initial pose and body anchor vary slightly between separately generated sequences; mobile plays the transparent PNG sheets at the current roaming position and facing, with common ground alignment. New keypad choices can interrupt the current one-shot; the final frame holds for its metadata duration before roaming resumes.

The built-in image-generation tool created the sheets; [generation.json](generation.json) records the exact prompts and repairs. Selected generated sheets are preserved in `sources/`. Corrections repair clipped tails in levels 8/9, soften level 7's expression, and remove detached motion marks in level 10. Level 10's revised front legs fold with elbows back toward the torso and forearms reaching down and forward to planted paws, correcting the reversed bend through the crouch. Its previous source is preserved as `sources/reaction-10.png`; the active sheet is `sources/reaction-10-v2.png`. Both tabby front legs, both golden hind legs, three heads and three tails remain attached to one golden body.

**Mobile integration:** each changed numeric choice now plays its corresponding reaction after the local SQLite save succeeds. Repeated selected taps and failed saves trigger nothing. The latest choice replaces older playback, keeping the character’s facing and position; no reaction titles appear in the app. The sheets and original timings are bundled by `node scripts/cerberus-assets.mjs` (verify with `--check`), so playback works offline. Reduce Motion displays the final pose immediately. Ambient roaming, history/date reads, sync, and note submission do not choose numeric reactions. The gallery stores no entries and sends no network requests. With Reduce Motion, keypad presses display final poses; manual Play remains available for inspection. Nothing plays automatically on page load.

Rebuild or verify from the repository root:

```sh
node scripts/animations.mjs --reactions
node scripts/animations.mjs --reactions --check
```

Verification checks eight frames, dimensions, distinct poses, clear margins, alpha, per-frame timing and one-shot GIF/WebP metadata. Rebuilding also rejects artwork crossing a source cell boundary and uses one common crop and nearest-neighbor scale per sequence to preserve relative movement.
