# Cerberus 01e animations

Open [the animation gallery](index.html) to play, pause, restart, and scrub the five sequences. It works from a local file without a server or network connection. Reduced-motion preferences disable automatic playback.

| Sequence                                 | Action                                                                        | Playback                     | Duration |
| ---------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------- | -------- |
| [Walking](walking/preview.gif)           | Alternating tabby front legs and golden hind legs, head bob and tail movement | Loop                         | 0.96 s   |
| [Sitting idle](sitting-idle/preview.gif) | Seated breathing, blinking, ear twitch and tail sway                          | Loop                         | 2.24 s   |
| [Tennis ball](tennis-ball/preview.gif)   | Bouncing ball draws the two dog heads' attention; cat stays composed          | Loop                         | 2.20 s   |
| [Yarn ball](yarn-ball/preview.gif)       | Rolling yarn draws the cat's gaze and head tilt; dogs remain relaxed          | Loop                         | 2.24 s   |
| [Food can](food-can/preview.gif)         | Pull-tab opens, followed by all three heads perking up and tails wagging      | Plays once, holds final pose | 2.60 s   |

Each sequence contains eight 512×512 transparent PNG frames, a 2048×1024 transparent PNG sprite sheet (four columns × two rows, row-major order), a transparent GIF, and a lossless animated WebP. [manifest.json](manifest.json) provides paths, per-frame durations in milliseconds, dimensions, and loop behavior. PNG frames and WebP retain full alpha; GIF uses palette transparency.

These are generated enlarged pixel-art animation studies based on [official character 01e](../../01e-cerberus-retro-pixel-character.png), with stepped outlines and natural coat colors. They are not literal low-resolution production sprites. Original generated sheets are preserved in `sources/`. The built-in image generation tool created the art; [generation.json](generation.json) records the exact initial prompts and correction prompts. The yarn sequence uses head tracking with both front paws planted.

The assets are prepared for review and later use. These frame sequences are not wired into the mobile app and have no connection to daily values.

Rebuild from the saved source sheets:

```sh
node scripts/animations.mjs
```

Verify the exported frames and animation metadata without rebuilding:

```sh
node scripts/animations.mjs --check
```

Verification checks frame count, dimensions, at least four distinct poses per sequence, timing, loop settings, alpha, and clear margins. Rebuilding additionally checks that the source cell boundaries do not cut through the artwork. One common crop and nearest-neighbor scale per sequence preserve relative motion and camera position.
