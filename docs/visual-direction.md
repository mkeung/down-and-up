# Visual direction: retro pixel

**Status: mobile retro-pixel UI, theme picker, and app icon implemented; device accessibility checks remain.**

## Direction

Use retro pixel, based on [`ConceptArt/UI/03-retro-pixel.png`](../ConceptArt/UI/03-retro-pixel.png):

- crisp stepped panel edges,
- readable pixel numerals,
- neutral keycaps,
- custom grid and paw tab art for Rate and Pawsitive.

Additional palette and control-art alternatives are in [`ConceptArt/UI/RETRO-PIXEL.md`](../ConceptArt/UI/RETRO-PIXEL.md) (mint cartridge, midnight blue, peach tickets, plum stickers). Settings now offers Neutral, Mint, Blue, Peach, Plum, and Yellow color presets. All six presets share stepped controls and custom pixel tabs; the different control treatments in the boards remain reference studies.

## Rules the theme must keep

- All ten keys keep one neutral color family and identical art. Selection is shown by a bold neutral border and a checkmark, so it doesn't rely on color.
- Palette color belongs to surfaces and chrome, never to the numeric scale.
- The [data status icon](completed/data-status-icon.md) keeps its dedicated storage colors independently of the selected palette.
- Keys stay at least 64×64pt. Text scaling and contrast must be checked in the real app; the mockups are illustrative.
- No mood wording, emoji, gradients, or anything that reacts to the value. A Cerberus sprite roams gently at the bottom of Rate and Pawsitive, independently of entries. It is decoration, with no rewards, gameplay, or response to values.

## Done

- **Reaction asset studies:** ten one-shot 01e reactions map 1 (carefree/no stress) through 10 (most stressed) in `OfficialAssets/Animations/01e/reactions/`. The [offline gallery](../OfficialAssets/Animations/01e/reactions/index.html) offers a keypad preview and final-pose comparison; exports include transparent PNG frames/sheets, GIF/WebP, timing and exact prompts. The user chose assets and gallery first. No mobile keypad behavior or value-dependent animation is implemented; the roaming character retains the existing discretion rule.

- **Animation assets:** five sequences based on 01e (walking, seated idle, tennis ball, yarn ball, and food-can opening) are prepared in `OfficialAssets/Animations/01e/`, with transparent frames, sprite sheets, GIF/WebP previews, timing metadata, and an [offline review gallery](../OfficialAssets/Animations/01e/index.html). These sequences are asset studies and are not wired into mobile playback; they remain independent of values.
  Walking now uses eight individually drawn poses with staggered front/hind footfalls and visible movement in both golden hind legs, following gait review. The 1.28 s loop and preserved original source are documented in [gait notes](../OfficialAssets/Animations/01e/walking/gait.md).
  Tail revisions add broader wags to all three walking tails, both dog tails in the tennis-ball loop, and only the cat tail in the yarn-ball loop. The revised sheets retain the gait/prop actions; preceding sources and exact generation prompts remain available.

- **App icon:** `OfficialAssets/10-cerberus-retro-pixel-icon.png` is the master. `scripts/icons.mjs` prepares `apps/mobile/assets/icon.png` from it. Earlier icons 09b (opaque) and 09c (transparent) live in `ConceptArt/` as reference studies; 10 is the only official icon master.
- **Character artwork:** `OfficialAssets/01e-cerberus-retro-pixel-character.png` is a full-body retro-pixel variant of 01c, matching icon 10. It retains three heads, three tails, tabby front legs, golden rear legs, and no collars. The original 01c is preserved in `ConceptArt/` as a reference study. The exact prompt is in [concept art](../ConceptArt/README.md#01e-cerberus-retro-pixel-characterpng).
- **Theme color picker:** Settings offers six labeled swatches with a checkmark and selected border. The choice is saved locally in SQLite, applies across mobile screens and tabs, survives restarts and ID changes, and works with sync off. Light/dark appearance follows the phone. Neutral key surfaces and fixed status colors remain independent of the palette. Details are in [mobile app](completed/mobile-app.md#theme-colors).

- **Mobile controls:** shared stepped frames with block shadows, double selection rims, pixel chevrons, a two-line Today/date panel, and a framed note editor. Keypad labels remain just the numbers; the selected key has a pixel checkmark and tapping it does nothing. All keycaps have the same neutral art. Keys grow vertically with text and scroll with the screen.
- **Typography:** bundled Silkscreen Regular is used for numerals, headings, and controls. Notes, explanations, and IDs keep readable system text. Font loading is local; a font-load failure falls back to the system font. The font and OFL license are in `apps/mobile/assets/fonts/`.
- **Tabs and status:** Rate uses a nine-square glyph and Pawsitive a stepped paw, each in a custom frame. The active tab has a double rim, underline, and accessibility selection state. Only those two tabs appear, including on Settings/History. Save-status glyphs use integer pixel contours and retain their labels and dedicated colors.
- **Roaming artwork:** `OfficialAssets/01f-cerberus-retro-pixel-transparent.png` is a transparent cutout of 01e, prepared as `apps/mobile/assets/cerberus.png` with alpha preserved. A small unframed character moves gently across the bottom of both Rate and Pawsitive, above navigation. One instance lives above the tab bar, keeping the same position and ongoing animation when switching between Rate and Pawsitive, including the first visit. Its space is separate from the scrollable controls, it never intercepts touches or reacts to values, and it is hidden from the accessibility tree. Movement stops on hidden tabs, in the background, and with Reduce Motion (including when the preference cannot be read). It hides while the keyboard is open. The original opaque art and icon remain available. The exact built-in image-generation prompt is in [official artwork](../OfficialAssets/README.md#transparent-cutout-prompt).
- **Verification:** component tests cover keypad layout, minimum targets, neutral selection, repeated taps, scalable labels, and tab navigation event cancellation. Existing note/theme tests, contrast checks, lint, typecheck, iOS native build, and both platform exports pass. The iOS Rate screen was inspected in the simulator.

## To do

- Check font scaling, contrast, light and dark mode, and touch targets on both platforms.
- Decide whether the web dashboard adopts the direction.
