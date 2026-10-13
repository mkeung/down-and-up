# Official artwork

- [01e animation gallery](Animations/01e/index.html): walking, sitting idle, tennis-ball distraction, yarn-ball distraction, food-can opening, backflip, tug of war, and all ten 1–10 reactions with a keypad preview. [Asset notes](Animations/01e/README.md) include frame formats and timing.
- [01e reaction set](Animations/01e/reactions/index.html): ten reactions from carefree at 1 to most stressed at 10, with a keypad review preview. Assets only; mobile playback is unchanged. [Reaction notes](Animations/01e/reactions/README.md) cover the mapping and formats.

- [10 — app icon](10-cerberus-retro-pixel-icon.png): the official icon master. `scripts/icons.mjs` prepares `apps/mobile/assets/icon.png` from it.
- [11 — happy splash portrait](11-cerberus-happy-transparent.png): a transparent, cheerful version of icon 10. `scripts/icons.mjs` places it inside a flat mint circle and prepares `apps/mobile/assets/splash.png`. The native splash centers the emblem at 192pt/dp on ivory (light) or dark green (dark). The launcher icon continues to use master 10. [Creation prompts](11-cerberus-happy-prompt.md).
- [01e — retro-pixel character](01e-cerberus-retro-pixel-character.png): the full-body version of 01c in the same chunky style as icon 10.
- [01f — transparent character](01f-cerberus-retro-pixel-transparent.png): the background-extracted version of 01e, used by both mobile tabs. The original opaque artwork is preserved. `scripts/icons.mjs` preserves alpha when preparing `apps/mobile/assets/cerberus.png`.

## Transparent cutout prompt

Created with the built-in image-generation tool, using 01e as the edit target and requesting a transparent background.

```text
Use case: background-extraction.
Asset type: transparent PNG mascot sprite for a retro-pixel mobile app.
Input image 1 is the edit target: the approved full-body Cerberus artwork. Remove ONLY the opaque white/ivory background and make all surrounding areas and gaps between legs and tails truly transparent (alpha 0). Preserve the entire character, its exact pixel contours, warm natural coat colors, facial expressions, pose, three heads (orange Pom left, golden dog center, gray-brown tabby right), exactly three tails, two tabby front legs and two golden rear legs, and no collars. Keep pale fur patches opaque. Keep all feet, ears, and tails fully visible. No frame, box, panel, ground, shadow, extra objects, text, watermark, new pose, or redesign. Output only the same isolated character on a genuinely transparent background, with a small transparent margin.
```

Original character [01c](../Concepts/01c-cerberus-pixel-cat-legs-no-collars.png) and earlier icons [09b](../Concepts/09b-cerberus-app-icon-front-paws.png) and [09c](../Concepts/09c-cerberus-icon-front-paws-transparent.png) are concept studies. Generation prompts are recorded in [Concepts](../Concepts/README.md) and the [retro-pixel direction note](../Concepts/UI/RETRO-PIXEL.md).
