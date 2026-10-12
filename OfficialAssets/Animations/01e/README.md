# Cerberus 01e animations

Open [the animation gallery](index.html) to play, pause, restart, and scrub all seventeen sequences: seven character actions and ten 1–10 reactions. It works from a local file without a server or network connection. Reduced-motion preferences disable automatic playback. The reaction section includes a keypad preview and final-pose comparison; shared playback, speed and background controls cover both sets.

The [reaction-only gallery](reactions/index.html) remains available for focused review of the ten one-shot reactions, from carefree at 1 to most stressed at 10. See [reaction notes](reactions/README.md). They are also bundled in mobile and play once after their corresponding keypad values are changed and saved locally. Reactions initially show frame 8 and hold their final pose after playback; character actions retain their existing autoplay behavior when Reduce Motion is off.

| Sequence                                 | Action                                                                         | Playback                     | Duration |
| ---------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------- | -------- |
| [Walking](walking/preview.gif)           | Staggered footfalls, both hind paws lifting and swinging, and broad tail wags  | Loop                         | 1.28 s   |
| [Sitting idle](sitting-idle/preview.gif) | Seated breathing, blinking, ear twitch and tail sway                           | Loop                         | 2.24 s   |
| [Tennis ball](tennis-ball/preview.gif)   | Both dogs track the bounce and wag their tails excitedly; cat stays composed   | Loop                         | 2.20 s   |
| [Yarn ball](yarn-ball/preview.gif)       | Cat tracks the rolling yarn with a broad striped-tail swish; dogs stay relaxed | Loop                         | 2.24 s   |
| [Food can](food-can/preview.gif)         | Pull-tab opens, followed by all three heads perking up and tails wagging       | Plays once, holds final pose | 2.60 s   |
| [Backflip](backflip/preview.gif)         | Crouch, spring, full backward somersault, soft landing and recovery            | Plays once, holds final pose | 1.64 s   |
| [Tug of war](tug-of-war/preview.gif)     | Middle head grips a rope knot while four paws brace through a rocking pull     | Loop                         | 1.24 s   |

Each sequence contains eight 512×512 transparent PNG frames, a 2048×1024 transparent PNG sprite sheet (four columns × two rows, row-major order), a transparent GIF, and a lossless animated WebP. [manifest.json](manifest.json) provides paths, per-frame durations in milliseconds, dimensions, and loop behavior. PNG frames and WebP retain full alpha; GIF uses palette transparency.

These are generated enlarged pixel-art animation studies based on [official character 01e](../../01e-cerberus-retro-pixel-character.png), with stepped outlines and natural coat colors. They are not literal low-resolution production sprites. Original generated sheets are preserved in `sources/`. The built-in image generation tool created the art; [generation.json](generation.json) records the exact initial prompts and correction prompts. The yarn sequence uses head tracking with both front paws planted.

Tug of war adds a locally bundled interactive loop: hold empty space in the mobile animal area for 350ms to show a rope from the finger to the middle head. Release/cancellation resumes roaming. The sprite contains only the grip knot; the app draws the rope dynamically. Source frames share one scale, with planted paws aligned during export (`groundAlign`), and measured mouth endpoints keep the rope attached as poses change. Alpha hit masks are bundled for empty-space detection.

Backflip is an additional gallery study, with eight distinct poses and one-shot playback. Its generated source and exact prompt are preserved with the other sequences.

All five everyday sheets now play in the mobile navigation footer, independently of daily values. Walking, seated idle, tennis ball, and yarn ball run autonomously; explicit note Submit plays food can once. The ten reaction sequences now play once from matching mobile keypad choices, retaining the current position and facing before roaming resumes. `node scripts/cerberus-assets.mjs` copies all sixteen mobile sheets, original per-frame durations, and alpha hit masks into the mobile bundle; `node scripts/cerberus-assets.mjs --check` verifies those copies. Re-run preparation after rebuilding these official assets.

Walking was revised after review found uncoordinated front/hind motion and a nearly stationary hind leg. Eight individual pose edits in `sources/walking-v2/` establish the gait, made from the same saved `sources/walking-v1-template.png`; their assembled sheet is preserved as `sources/walking-v2-sheet.png`. The active `sources/walking-v3.png` adds broader wags to all three tails while retaining the revised leg phases. The earlier `sources/walking.png` sheet remains preserved. The timing is 160 ms per frame; [walking gait notes](walking/gait.md) describe the footfall phases. Its torso and heads stay steady so the leg movement reads clearly. Exact per-frame gait prompts are under walking `revision`, and tail edit prompts under `tailRevision`, in [generation.json](generation.json).

The active tennis and yarn sources are `sources/tennis-ball-v2.png` and `sources/yarn-ball-v2.png`. Tennis gives both dog tails a wider up/down wag, including a low sweep as the ball falls; its cat tail stays composed. Yarn gives only the striped cat tail a larger upward flick and downward swish; both dog tails remain relaxed. Original source sheets are preserved, and `tailRevision` records all exact built-in image-generation prompts and repairs.

Rebuild from the saved source sheets:

```sh
node scripts/animations.mjs
```

Verify the exported frames and animation metadata without rebuilding:

```sh
node scripts/animations.mjs --check
```

Check all seventeen previews and the keypad in Chromium:

```sh
node scripts/animation-gallery-check.mjs
```

This uses Playwright's installed Chromium. `ANIMATION_GALLERY_BROWSER` can select another Chromium executable; `ANIMATION_GALLERY_SCREENSHOTS` optionally saves desktop/mobile review images. The check covers reaction mapping, shared controls, one-shot holds, Reduce Motion, local-only loading and phone-width layout.

Verification checks frame count, dimensions, at least four distinct poses per sequence, timing, loop settings, alpha, and clear margins. Tennis additionally checks for a compact green ball in every frame and the rise/fall/rebound pattern, protecting against a lost prop during tail edits. Rebuilding checks that source cell boundaries do not cut through the artwork. One common crop and nearest-neighbor scale per sequence preserve relative motion and camera position. Ground-aligned tug exports also verify planted paws stay within one pixel of the same baseline. Gait, tail silhouettes and anatomy require visual review.
