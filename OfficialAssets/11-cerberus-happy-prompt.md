# Happy splash portrait

Created with the built-in image-generation tool using official icon 10 as the edit target. A generated happy portrait in a mint circle was then extracted with the built-in tool to preserve the character's alpha. The final cutout is `11-cerberus-happy-transparent.png`; intermediate circle studies were discarded.

`node scripts/icons.mjs` composes this cutout with a native SVG circle of solid `#b7d7bd`, without changing the portrait. The 1024px output uses a centered 480px-radius circle and an 832px portrait. Transparent corners let the same emblem work on light and dark splash backgrounds.

## Happy portrait prompt

```text
Use case: precise-object-edit.
Asset type: transparent PNG splash emblem for the Down & Up mobile app.
Input image 1 is the EDIT TARGET: the official chunky retro-pixel Cerberus icon.
Primary request: make a happy version of this exact icon and place it inside one flat soft mint-green colored circle (#b7d7bd). Change the facial expressions so ALL THREE heads look cheerful: friendly smiling mouths and relaxed happy eyes; the two dogs may have tiny pink tongues and the cat a clear little smile. Keep it subtle and recognizable.
Preserve the orange Pomeranian on the left, larger golden dog with dark muzzle in the middle, gray-brown striped tabby cat on the right, exactly three heads, exactly three distinct existing tails, cream chest, exactly two small tabby front paws, hidden legs, no collars, same compact portrait pose and warm natural coat palette. Match the coarse square pixel clusters, thick stepped dark-brown outlines and crisp edges of the reference; no additional fine detail.
Composition: centered emblem on a square transparent canvas. One perfectly round solid mint disk behind the entire character, occupying about 90% of canvas width. Fit ALL character features comfortably INSIDE the disk with a small mint margin around ears, tails and paws. Character should fill about 80% of the disk. Outside the circle is genuinely transparent alpha, not white or ivory. Remove the original ivory background, preserving pale fur as opaque.
Constraints: no text, lettering, symbols, hearts, sparkles, props, gradients, drop shadows, border around the circle, extra animals or limbs. Output only the happy Cerberus inside the mint circle with transparent surroundings.
```

## Transparent cutout prompt

```text
Use case: background-extraction. Asset type: transparent PNG splash mascot.
Edit target: the happy Cerberus portrait in input image 1.
Remove ONLY the mint-green background circle and ALL surrounding background and stray white specks. Output the isolated happy Cerberus on a genuinely transparent background, clean alpha 0 everywhere outside the character, including gaps between the three tails and heads. No colored circle, white background, backdrop, shadow, border or extra details. Preserve all three happy faces, happy eyes and smiles, two tiny pink dog tongues, three distinct tails, two tabby front paws, cream chest, exact pose, crisp dark pixel outlines, natural coat colors and pale opaque fur. Keep the entire character uncropped with a generous even transparent margin.
```
