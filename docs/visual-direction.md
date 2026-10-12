# Visual direction: retro pixel

**Status: direction chosen; mobile UI not implemented.** The app icon is done.

## Direction

Use retro pixel, based on [`ConceptArt/UI/03-retro-pixel.png`](../ConceptArt/UI/03-retro-pixel.png):

- crisp stepped panel edges,
- readable pixel numerals,
- neutral keycaps,
- custom grid and paw tab art for Rate and Pawsitive.

Additional palette and control-art alternatives are in [`ConceptArt/UI/RETRO-PIXEL.md`](../ConceptArt/UI/RETRO-PIXEL.md) (mint cartridge, midnight blue, peach tickets, plum stickers). Their colors and treatments are still exploratory; picking one is part of this plan.

## Rules the theme must keep

- All ten keys keep one neutral color family and identical art. Selection is shown by a bold neutral border and a checkmark, so it doesn't rely on color.
- Palette color belongs to surfaces and chrome, never to the numeric scale.
- The only exception is the [data status icon](data-status-icon.md), whose colors describe storage only.
- Keys stay at least 64×64pt. Text scaling and contrast must be checked in the real app; the mockups are illustrative.
- No mood wording, emoji, gradients, or anything that reacts to the value. A Cerberus sprite on Pawsitive, if used, is static decoration.

## Done

- **App icon:** `OfficialAssets/10-cerberus-retro-pixel-icon.png` is the master. `scripts/icons.mjs` prepares `apps/mobile/assets/icon.png` from it. Earlier icons 09b (opaque) and 09c (transparent) stay as reference studies.

## To do

- Choose the palette from the alternatives.
- Implement the mobile theme: panel edges, pixel numerals, keycaps, the date panel, the note frame, and the custom tab art.
- Draw the data status icon's three shapes as pixel glyphs.
- Check font scaling, contrast, light and dark mode, and touch targets on both platforms.
- Decide whether the web dashboard adopts the direction.
