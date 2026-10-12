# Youth UI concepts

Open [the local comparison gallery](index.html) to browse all nine PNG boards at full size. **Retro pixel is the selected direction.** Four additional color and custom-control explorations, the icon update, and their exact prompts are documented in [RETRO-PIXEL.md](RETRO-PIXEL.md).

Five visual explorations generated with the built-in image generation tool. Each board compares the same **Rate** and **Pawsitive** screens. These are visual concepts, not implemented app screens or a change to product behavior.

| Board                                     | Direction                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Soft clay](01-soft-clay.png)             | contemporary soft 3D clay UI, tactile matte ceramic rounded-square keycaps with subtle physical depth and fine ambient shadows.                        |
| [Bold graphic](02-bold-graphic.png)       | restrained neo-brutalist editorial UI with thick black outlines, crisp offset hard shadows, large confident grotesk sans numerals, square-ish corners. |
| [Retro pixel](03-retro-pixel.png)         | intentional handheld-era pixel interface, chunky stepped borders, large legible pixel numerals, crisp low-resolution pixel mascot.                     |
| [Paper scrapbook](04-paper-scrapbook.png) | tactile contemporary paper-cutout and quiet notebook UI.                                                                                               |
| [Manga ink](05-manga-ink.png)             | clean contemporary monochrome manga and ink UI.                                                                                                        |

All concepts retain the neutral 1–10 keypad, centered 10, selected 7 with a border/checkmark, shared day selector with forward disabled for today, and the two existing tabs. The mascot is a proposed static brand decoration on Pawsitive; it does not react to values. No recording UI is included. Image mockups are illustrative; production touch targets, text scaling and contrast require implementation checks.

## Generation prompts

Two boards received targeted visual corrections; their exact prompts are in [REFINEMENTS.md](REFINEMENTS.md).

### 01-soft-clay.png

Mascot reference: `../09b-cerberus-app-icon-front-paws.png` (identity only).

```text
Use case: ui-mockup.
Asset type: high-fidelity mobile UI concept board for Down & Up, a discreet daily 1–10 tracker for teens and young adults.
Composition: wide landscape design presentation with exactly TWO large front-facing flat phone-screen mockups side by side, each approximately 390x844 logical points. Screens are the hero, large and readable; thin device outlines, no perspective, no hands or physical scene. A small editorial title outside the phones says "Down & Up" and the style name. Each phone has a minimal status bar and bottom home indicator.
Left phone is Rate: same day selector near the top: left chevron, "Today", a small "Sun, Oct 11" below, and a visibly disabled faint right chevron. Centered keypad has EXACTLY four rows:
1 2 3
4 5 6
7 8 9
   10
The number 10 is alone and horizontally centered underneath 8. ALL keys are the same shape, size, and neutral color family. Large roughly square buttons at least 72x72 logical points with generous spacing. The selected number is 7: show a heavier double outline or bold border and tiny checkmark as well as a modest neutral fill difference. Never add extra numbers or remove numbers. Large high-contrast numerals. Small neutral "Synced" with checkmark underneath. Main screen contains only the day selector, keypad, sync status, and bottom tabs; no other prompts, titles, mascot, illustrations, decorative icons, statistics, or labels inside Rate.
Right phone is Pawsitive: IDENTICAL day selector, an expanded note card with label "Note" and text "Walked home. Found a new song." in readable clean type, abundant whitespace, and a small quiet decorative Cerberus mascot below the note. This is a static brand illustration, not an interactive pet, reward, or response to the selected value. Preserve reference mascot identity: exactly three heads joined to one shared body, small orange Pomeranian left, larger golden dog with dark muzzle middle, brown-gray striped tabby cat right; three distinct tails; no collars. Redraw the reference character to fit the UI art style. Do not fill the whole phone with the mascot.
Bottom navigation on BOTH screens has EXACTLY two equal-width tabs labeled "Rate" and "Pawsitive". Rate uses a simple keypad icon and Pawsitive uses a simple paw icon. Left phone has Rate active with an underline/outline; right phone has Pawsitive active with an underline/outline. No History or Settings tab, no center action button. Bottom navigation stays comfortably above home indicator.
Constraints: neutral discreet copy only. No mood, feelings, emotions, wellness, self-care, therapy wording. No emoji or faces on any key. No red-to-green gradients, color scale, rating semantics, hearts, scores, streak rewards, game levels, save/submit buttons, clearing controls, microphones, audio, recordings, accounts, IDs, reminders, network dependence indicators, ads, watermark, or invented app functionality. Plenty of room for readable text and touch targets; mature youth appeal, not preschool design. Exact spelling of "Pawsitive" (P-a-w-s-i-t-i-v-e).
Input image: mascot identity reference ONLY, not an edit target. Make new UI boards, not a standalone mascot illustration.
Style name (outside phones): "Soft clay".
Style/medium: contemporary soft 3D clay UI, tactile matte ceramic rounded-square keycaps with subtle physical depth and fine ambient shadows. Light oat background, warm gray neutral keys, dark charcoal clean rounded sans numerals; all ten keys identical material. Simple pill day selector and spacious rounded navigation. Note card looks like matte paper inset into the clay surface. Mascot a small tasteful softly sculpted clay figurine preserving reference identity. Crisp accessible contrast, premium friendly youthful industrial design. Avoid low-contrast neumorphism, plastic gloss, rainbow decoration.
```

### 02-bold-graphic.png

Mascot reference: `../09b-cerberus-app-icon-front-paws.png` (identity only).

```text
Use case: ui-mockup.
Asset type: high-fidelity mobile UI concept board for Down & Up, a discreet daily 1–10 tracker for teens and young adults.
Composition: wide landscape design presentation with exactly TWO large front-facing flat phone-screen mockups side by side, each approximately 390x844 logical points. Screens are the hero, large and readable; thin device outlines, no perspective, no hands or physical scene. A small editorial title outside the phones says "Down & Up" and the style name. Each phone has a minimal status bar and bottom home indicator.
Left phone is Rate: same day selector near the top: left chevron, "Today", a small "Sun, Oct 11" below, and a visibly disabled faint right chevron. Centered keypad has EXACTLY four rows:
1 2 3
4 5 6
7 8 9
   10
The number 10 is alone and horizontally centered underneath 8. ALL keys are the same shape, size, and neutral color family. Large roughly square buttons at least 72x72 logical points with generous spacing. The selected number is 7: show a heavier double outline or bold border and tiny checkmark as well as a modest neutral fill difference. Never add extra numbers or remove numbers. Large high-contrast numerals. Small neutral "Synced" with checkmark underneath. Main screen contains only the day selector, keypad, sync status, and bottom tabs; no other prompts, titles, mascot, illustrations, decorative icons, statistics, or labels inside Rate.
Right phone is Pawsitive: IDENTICAL day selector, an expanded note card with label "Note" and text "Walked home. Found a new song." in readable clean type, abundant whitespace, and a small quiet decorative Cerberus mascot below the note. This is a static brand illustration, not an interactive pet, reward, or response to the selected value. Preserve reference mascot identity: exactly three heads joined to one shared body, small orange Pomeranian left, larger golden dog with dark muzzle middle, brown-gray striped tabby cat right; three distinct tails; no collars. Redraw the reference character to fit the UI art style. Do not fill the whole phone with the mascot.
Bottom navigation on BOTH screens has EXACTLY two equal-width tabs labeled "Rate" and "Pawsitive". Rate uses a simple keypad icon and Pawsitive uses a simple paw icon. Left phone has Rate active with an underline/outline; right phone has Pawsitive active with an underline/outline. No History or Settings tab, no center action button. Bottom navigation stays comfortably above home indicator.
Constraints: neutral discreet copy only. No mood, feelings, emotions, wellness, self-care, therapy wording. No emoji or faces on any key. No red-to-green gradients, color scale, rating semantics, hearts, scores, streak rewards, game levels, save/submit buttons, clearing controls, microphones, audio, recordings, accounts, IDs, reminders, network dependence indicators, ads, watermark, or invented app functionality. Plenty of room for readable text and touch targets; mature youth appeal, not preschool design. Exact spelling of "Pawsitive" (P-a-w-s-i-t-i-v-e).
Input image: mascot identity reference ONLY, not an edit target. Make new UI boards, not a standalone mascot illustration.
Style name (outside phones): "Bold graphic".
Style/medium: restrained neo-brutalist editorial UI with thick black outlines, crisp offset hard shadows, large confident grotesk sans numerals, square-ish corners. Off-white canvas, light stone-gray keys ALL identical, black ink. Selected 7 has especially thick black double frame. Note card as a bold rectangular outlined panel, mascot as a small flat screenprinted sticker with simplified reference colors. Energetic independent zine sensibility, sophisticated teen streetwear graphic design; clean grid, strong readability, no excess decorations or slogans.
```

### 03-retro-pixel.png

Mascot reference: `../../Concepts/01d-cerberus-pixel-low-fidelity.png` (identity only).

```text
Use case: ui-mockup.
Asset type: high-fidelity mobile UI concept board for Down & Up, a discreet daily 1–10 tracker for teens and young adults.
Composition: wide landscape design presentation with exactly TWO large front-facing flat phone-screen mockups side by side, each approximately 390x844 logical points. Screens are the hero, large and readable; thin device outlines, no perspective, no hands or physical scene. A small editorial title outside the phones says "Down & Up" and the style name. Each phone has a minimal status bar and bottom home indicator.
Left phone is Rate: same day selector near the top: left chevron, "Today", a small "Sun, Oct 11" below, and a visibly disabled faint right chevron. Centered keypad has EXACTLY four rows:
1 2 3
4 5 6
7 8 9
   10
The number 10 is alone and horizontally centered underneath 8. ALL keys are the same shape, size, and neutral color family. Large roughly square buttons at least 72x72 logical points with generous spacing. The selected number is 7: show a heavier double outline or bold border and tiny checkmark as well as a modest neutral fill difference. Never add extra numbers or remove numbers. Large high-contrast numerals. Small neutral "Synced" with checkmark underneath. Main screen contains only the day selector, keypad, sync status, and bottom tabs; no other prompts, titles, mascot, illustrations, decorative icons, statistics, or labels inside Rate.
Right phone is Pawsitive: IDENTICAL day selector, an expanded note card with label "Note" and text "Walked home. Found a new song." in readable clean type, abundant whitespace, and a small quiet decorative Cerberus mascot below the note. This is a static brand illustration, not an interactive pet, reward, or response to the selected value. Preserve reference mascot identity: exactly three heads joined to one shared body, small orange Pomeranian left, larger golden dog with dark muzzle middle, brown-gray striped tabby cat right; three distinct tails; no collars. Redraw the reference character to fit the UI art style. Do not fill the whole phone with the mascot.
Bottom navigation on BOTH screens has EXACTLY two equal-width tabs labeled "Rate" and "Pawsitive". Rate uses a simple keypad icon and Pawsitive uses a simple paw icon. Left phone has Rate active with an underline/outline; right phone has Pawsitive active with an underline/outline. No History or Settings tab, no center action button. Bottom navigation stays comfortably above home indicator.
Constraints: neutral discreet copy only. No mood, feelings, emotions, wellness, self-care, therapy wording. No emoji or faces on any key. No red-to-green gradients, color scale, rating semantics, hearts, scores, streak rewards, game levels, save/submit buttons, clearing controls, microphones, audio, recordings, accounts, IDs, reminders, network dependence indicators, ads, watermark, or invented app functionality. Plenty of room for readable text and touch targets; mature youth appeal, not preschool design. Exact spelling of "Pawsitive" (P-a-w-s-i-t-i-v-e).
Input image: mascot identity reference ONLY, not an edit target. Make new UI boards, not a standalone mascot illustration.
Style name (outside phones): "Retro pixel".
Style/medium: intentional handheld-era pixel interface, chunky stepped borders, large legible pixel numerals, crisp low-resolution pixel mascot. Slate/charcoal dark background and matching warm-gray neutral key surfaces, light ivory numerals with strong contrast. Selected 7 has a bright thick stepped frame and pixel checkmark. Flat integer-aligned pixel shadows, simple panel shapes, readable typography for Note body. Subtle nostalgic late-90s handheld aesthetic, not an actual game: no XP, coins, badges, statistics, levels, missions, pixel background scenery, or action buttons. Reference sprite identity preserved in a small decorative note-screen illustration.
```

### 04-paper-scrapbook.png

Mascot reference: `../09b-cerberus-app-icon-front-paws.png` (identity only).

```text
Use case: ui-mockup.
Asset type: high-fidelity mobile UI concept board for Down & Up, a discreet daily 1–10 tracker for teens and young adults.
Composition: wide landscape design presentation with exactly TWO large front-facing flat phone-screen mockups side by side, each approximately 390x844 logical points. Screens are the hero, large and readable; thin device outlines, no perspective, no hands or physical scene. A small editorial title outside the phones says "Down & Up" and the style name. Each phone has a minimal status bar and bottom home indicator.
Left phone is Rate: same day selector near the top: left chevron, "Today", a small "Sun, Oct 11" below, and a visibly disabled faint right chevron. Centered keypad has EXACTLY four rows:
1 2 3
4 5 6
7 8 9
   10
The number 10 is alone and horizontally centered underneath 8. ALL keys are the same shape, size, and neutral color family. Large roughly square buttons at least 72x72 logical points with generous spacing. The selected number is 7: show a heavier double outline or bold border and tiny checkmark as well as a modest neutral fill difference. Never add extra numbers or remove numbers. Large high-contrast numerals. Small neutral "Synced" with checkmark underneath. Main screen contains only the day selector, keypad, sync status, and bottom tabs; no other prompts, titles, mascot, illustrations, decorative icons, statistics, or labels inside Rate.
Right phone is Pawsitive: IDENTICAL day selector, an expanded note card with label "Note" and text "Walked home. Found a new song." in readable clean type, abundant whitespace, and a small quiet decorative Cerberus mascot below the note. This is a static brand illustration, not an interactive pet, reward, or response to the selected value. Preserve reference mascot identity: exactly three heads joined to one shared body, small orange Pomeranian left, larger golden dog with dark muzzle middle, brown-gray striped tabby cat right; three distinct tails; no collars. Redraw the reference character to fit the UI art style. Do not fill the whole phone with the mascot.
Bottom navigation on BOTH screens has EXACTLY two equal-width tabs labeled "Rate" and "Pawsitive". Rate uses a simple keypad icon and Pawsitive uses a simple paw icon. Left phone has Rate active with an underline/outline; right phone has Pawsitive active with an underline/outline. No History or Settings tab, no center action button. Bottom navigation stays comfortably above home indicator.
Constraints: neutral discreet copy only. No mood, feelings, emotions, wellness, self-care, therapy wording. No emoji or faces on any key. No red-to-green gradients, color scale, rating semantics, hearts, scores, streak rewards, game levels, save/submit buttons, clearing controls, microphones, audio, recordings, accounts, IDs, reminders, network dependence indicators, ads, watermark, or invented app functionality. Plenty of room for readable text and touch targets; mature youth appeal, not preschool design. Exact spelling of "Pawsitive" (P-a-w-s-i-t-i-v-e).
Input image: mascot identity reference ONLY, not an edit target. Make new UI boards, not a standalone mascot illustration.
Style name (outside phones): "Paper scrapbook".
Style/medium: tactile contemporary paper-cutout and quiet notebook UI. Warm ivory paper canvas with very subtle paper fiber texture. Ten uniform putty-gray rounded paper key tiles with slightly imperfect dark hand-inked outlines and restrained layered-paper shadows. Clean high-contrast printed numerals and plain readable sans labels; selected 7 has a thicker hand-inked double contour and small checkmark. The note field is a spacious lightly ruled paper panel, a small reference mascot interpreted as a cut-paper collage near its lower edge, no clutter over text. Youth journal/sketchbook appeal, carefully balanced, subtle handcrafted details rather than childish craft overload.
```

### 05-manga-ink.png

Mascot reference: `../09b-cerberus-app-icon-front-paws.png` (identity only).

```text
Use case: ui-mockup.
Asset type: high-fidelity mobile UI concept board for Down & Up, a discreet daily 1–10 tracker for teens and young adults.
Composition: wide landscape design presentation with exactly TWO large front-facing flat phone-screen mockups side by side, each approximately 390x844 logical points. Screens are the hero, large and readable; thin device outlines, no perspective, no hands or physical scene. A small editorial title outside the phones says "Down & Up" and the style name. Each phone has a minimal status bar and bottom home indicator.
Left phone is Rate: same day selector near the top: left chevron, "Today", a small "Sun, Oct 11" below, and a visibly disabled faint right chevron. Centered keypad has EXACTLY four rows:
1 2 3
4 5 6
7 8 9
   10
The number 10 is alone and horizontally centered underneath 8. ALL keys are the same shape, size, and neutral color family. Large roughly square buttons at least 72x72 logical points with generous spacing. The selected number is 7: show a heavier double outline or bold border and tiny checkmark as well as a modest neutral fill difference. Never add extra numbers or remove numbers. Large high-contrast numerals. Small neutral "Synced" with checkmark underneath. Main screen contains only the day selector, keypad, sync status, and bottom tabs; no other prompts, titles, mascot, illustrations, decorative icons, statistics, or labels inside Rate.
Right phone is Pawsitive: IDENTICAL day selector, an expanded note card with label "Note" and text "Walked home. Found a new song." in readable clean type, abundant whitespace, and a small quiet decorative Cerberus mascot below the note. This is a static brand illustration, not an interactive pet, reward, or response to the selected value. Preserve reference mascot identity: exactly three heads joined to one shared body, small orange Pomeranian left, larger golden dog with dark muzzle middle, brown-gray striped tabby cat right; three distinct tails; no collars. Redraw the reference character to fit the UI art style. Do not fill the whole phone with the mascot.
Bottom navigation on BOTH screens has EXACTLY two equal-width tabs labeled "Rate" and "Pawsitive". Rate uses a simple keypad icon and Pawsitive uses a simple paw icon. Left phone has Rate active with an underline/outline; right phone has Pawsitive active with an underline/outline. No History or Settings tab, no center action button. Bottom navigation stays comfortably above home indicator.
Constraints: neutral discreet copy only. No mood, feelings, emotions, wellness, self-care, therapy wording. No emoji or faces on any key. No red-to-green gradients, color scale, rating semantics, hearts, scores, streak rewards, game levels, save/submit buttons, clearing controls, microphones, audio, recordings, accounts, IDs, reminders, network dependence indicators, ads, watermark, or invented app functionality. Plenty of room for readable text and touch targets; mature youth appeal, not preschool design. Exact spelling of "Pawsitive" (P-a-w-s-i-t-i-v-e).
Input image: mascot identity reference ONLY, not an edit target. Make new UI boards, not a standalone mascot illustration.
Style name (outside phones): "Manga ink".
Style/medium: clean contemporary monochrome manga and ink UI. White screen background, uniform pale gray keys with precise black contour lines, subtle sparse screentone confined to key shadows and note-panel edges. Bold editorial sans numerals rather than handwritten numbers, small crisp labels. Selected 7 has a thick double black contour and checkmark. Bottom navigation outlined like quiet manga panels. Mascot on note screen drawn as a small refined monochrome chibi ink spot illustration with three recognizable animal heads and tails from reference. Elegant young-reader comics/sketchbook sensibility, huge whitespace, no speech bubbles, action lines, scene backgrounds, exaggerated faces, captions, or added text.
```
