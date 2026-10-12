# Visual direction: retro pixel

**Status: direction chosen; theme color picker and app icon implemented.** Retro-pixel panel and typography work remains.

## Direction

Use retro pixel, based on [`ConceptArt/UI/03-retro-pixel.png`](../ConceptArt/UI/03-retro-pixel.png):

- crisp stepped panel edges,
- readable pixel numerals,
- neutral keycaps,
- custom grid and paw tab art for Rate and Pawsitive.

Additional palette and control-art alternatives are in [`ConceptArt/UI/RETRO-PIXEL.md`](../ConceptArt/UI/RETRO-PIXEL.md) (mint cartridge, midnight blue, peach tickets, plum stickers). Settings now offers Neutral, Mint, Blue, Peach, and Plum color presets. Custom-control treatments remain exploratory.

## Rules the theme must keep

- All ten keys keep one neutral color family and identical art. Selection is shown by a bold neutral border and a checkmark, so it doesn't rely on color.
- Palette color belongs to surfaces and chrome, never to the numeric scale.
- The [data status icon](completed/data-status-icon.md) keeps its dedicated storage colors independently of the selected palette.
- Keys stay at least 64×64pt. Text scaling and contrast must be checked in the real app; the mockups are illustrative.
- No mood wording, emoji, gradients, or anything that reacts to the value. A Cerberus sprite on Pawsitive, if used, is static decoration.

## Done

- **App icon:** `OfficialAssets/10-cerberus-retro-pixel-icon.png` is the master. `scripts/icons.mjs` prepares `apps/mobile/assets/icon.png` from it. Earlier icons 09b (opaque) and 09c (transparent) stay as reference studies.
- **Theme color picker:** Settings offers five labeled swatches with a checkmark and selected border. The choice is saved locally in SQLite, applies across mobile screens and tabs, survives restarts and ID changes, and works with sync off. Light/dark appearance follows the phone. Neutral key surfaces and fixed status colors remain independent of the palette. Details are in [mobile app](completed/mobile-app.md#theme-colors).

## To do

- Implement the mobile theme: panel edges, pixel numerals, keycaps, the date panel, the note frame, and the custom tab art.
- Draw the data status icon's three shapes as pixel glyphs.
- Check font scaling, contrast, light and dark mode, and touch targets on both platforms.
- Decide whether the web dashboard adopts the direction.
