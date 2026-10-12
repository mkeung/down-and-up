# Concepts

Exploratory studies for Down & Up: character and icon art, UI directions, and audio. Nothing here ships in the app; official assets live in [OfficialAssets](../OfficialAssets/).

Youth-oriented app UI explorations are in [UI](UI/README.md). **Retro pixel is the selected direction.** Open the [comparison gallery](UI/index.html) to review the five initial art directions and four additional retro-pixel palette/control studies. The [design note](UI/RETRO-PIXEL.md) records the selection and the new pixel app icon.

PNG character and icon studies generated with the built-in image generation tool from the pet photos in `../DogsAndCat/`, including four edited versions of concept 01 and icon variants based on concept 08. Each combines the two dogs and cat into one creature with three heads and three tails; the icon variants show only the heads and a small chest.

The official retro-pixel character (**01e**) and icon (**10**) live in [OfficialAssets](../OfficialAssets/). Original character **01c** and earlier icon versions **09b** and **09c** live in `Concepts/` as reference studies. The new icon prompt is in [UI/RETRO-PIXEL.md](UI/RETRO-PIXEL.md); the original character and icon prompts are preserved below.

Start with **06–08** for the lowest-detail options. **01d** simplifies the standing character from 01c while retaining the tabby front legs and no collars. **01e** redraws 01c in the same chunky retro-pixel style as official icon 10. **01–05** retain more of the pets' appearance and explore different media. **10** is the current opaque retro-pixel app-icon master with two front paws and hidden legs. **09b** and its transparent companion **09c** preserve the previous illustrated icon. All other images have an opaque light background.

| File                                                                                                           | Direction                                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [01-cerberus-pixel.png](01-cerberus-pixel.png)                                                                 | Pixel art                                                                                                      |
| [01b-cerberus-pixel-cat-legs-collars.png](01b-cerberus-pixel-cat-legs-collars.png)                             | Version 01 with tabby front legs and paws; pink Pom collar, blue middle dog collar, green cat collar           |
| [01c-cerberus-pixel-cat-legs-no-collars.png](01c-cerberus-pixel-cat-legs-no-collars.png)     | Original character study; no collars, tabby front legs and paws                                              |
| [01d-cerberus-pixel-low-fidelity.png](01d-cerberus-pixel-low-fidelity.png)                                     | Lower-fidelity version 01c with chunky pixels, simpler faces and coat shapes, tabby front legs, and no collars |
| [01e-cerberus-retro-pixel-character.png](../OfficialAssets/01e-cerberus-retro-pixel-character.png) | Retro-pixel version of 01c matching icon 10; full body, tabby front legs, three tails, and no collars |
| [02-cerberus-watercolor.png](02-cerberus-watercolor.png)                                                       | Watercolor                                                                                                     |
| [03-cerberus-anime.png](03-cerberus-anime.png)                                                                 | Chibi anime                                                                                                    |
| [04-cerberus-paper-cutout.png](04-cerberus-paper-cutout.png)                                                   | Paper cutout                                                                                                   |
| [05-cerberus-ink-sketch.png](05-cerberus-ink-sketch.png)                                                       | Ink sketch                                                                                                     |
| [06-cerberus-minimal-pixel.png](06-cerberus-minimal-pixel.png)                                                 | Minimal pixel                                                                                                  |
| [07-cerberus-minimal-watercolor.png](07-cerberus-minimal-watercolor.png)                                       | Minimal watercolor                                                                                             |
| [08-cerberus-minimal-anime.png](08-cerberus-minimal-anime.png)                                                 | Minimal chibi anime                                                                                            |
| [09-cerberus-app-icon.png](09-cerberus-app-icon.png)                                                           | Three-head icon portrait in style 08; no paws or legs                                                          |
| [09b-cerberus-app-icon-front-paws.png](09b-cerberus-app-icon-front-paws.png)                 | Previous opaque icon; two small tabby front paws, legs hidden                                                  |
| [09c-cerberus-icon-front-paws-transparent.png](09c-cerberus-icon-front-paws-transparent.png) | Previous transparent icon; two front paws, legs hidden                                                         |
| [10-cerberus-retro-pixel-icon.png](../OfficialAssets/10-cerberus-retro-pixel-icon.png)                         | Current retro-pixel app-icon master; three heads and tails, two tabby paws, hidden legs                        |

Reference order: `IMG_4564.jpg` (both dogs), `IMG_1203.jpg` (larger dog), `IMG_1021.jpg` (cat), `IMG_20240625_181700362.jpg` (Pom and plume tail). The other supplied photos were also reviewed before generation.

The images have been visually checked for one body or connected portrait, three recognizable heads, three visible tails, and uncropped extremities. The minimal studies favor tiny facial marks over eye detail. Icon 09b and its transparent companion have exactly two front paws and no visible legs.

## Exact generation prompts

### 01e-cerberus-retro-pixel-character.png

Built-in image generation edit of original character 01c, with official icon 10 as the style reference. Saved to `OfficialAssets/01e-cerberus-retro-pixel-character.png`. Visually checked for three heads, three separate tails, two tabby front legs, two golden rear legs, no collars, and uncropped extremities. Original 01c is preserved in `Concepts/`.

```text
Use case: style-transfer.
Asset type: official full-body Cerberus character artwork for Down & Up.
Input images: Image 1 is the EDIT TARGET, character 01c. Image 2 is the STYLE REFERENCE, official icon 10; use its chunky stepped outlines, flat natural coat colors and simple square facial marks, not its portrait pose.
Primary request: Redraw character 01c as a clean, much simpler retro game pixel sprite that belongs to the same visual family as icon 10.
Preserve the standing three-quarter full-body pose and anatomy of image 1: ONE shared golden quadruped torso, exactly THREE recognizable attached heads (small orange Pom on viewer LEFT, larger golden dog with dark brown muzzle in MIDDLE, brown/charcoal tabby cat on RIGHT); exactly FOUR legs with BOTH FRONT legs and paws striped brown/charcoal feline legs and BOTH REAR legs golden canine legs; exactly THREE separate tails attached to the rump on the RIGHT (golden sweeping dog tail, orange-and-cream curled Pom plume, fluffy dark striped cat tail). No collars or accessories.
Style: unmistakable coarse retro pixel art as if drawn on roughly a 64–80 pixel square grid and enlarged with crisp nearest-neighbor edges. Large square pixel clusters, thick stepped dark-brown outline like icon 10, sparse flat palette of about 10–12 colors, at most one flat shadow tone per coat. Tiny square eyes and noses, simplified dark muzzle, broad cream chest patch, a few bold tabby stripe bands, only a few stepped fur tufts. Remove fine fur detail, glossy eyes, fine whiskers and individual toe detail. No gradients, soft edges, photographic texture, dithering, or smooth vector curves.
Composition: square full-body character, every head, ear, paw and tail fully visible, ample ivory negative space around the complete silhouette. Fully opaque plain warm ivory background edge to edge.
Constraints: preserve 01c's character identity and full-body proportions; match 10's visual simplicity. No text, props, extra animals, extra heads, extra tails, extra limbs, collars, or emotive symbols.
```

### 09-cerberus-app-icon.png

Built-in image generation using concept 08 as the style reference. Three-head portrait with three tails, a small shared chest, and no visible legs.

```text
Use case: stylized-concept.
Reference image: concept 08, supplied as the character and visual-style reference.
Create a finished square APP ICON image for this same three-pet Cerberus character, in the extremely simple rounded chibi anime sticker style of reference 08: thick clean dark-brown contour, very few lines, tiny dot eyes, tiny noses, large flat areas of natural coat color, no fur texture, no complex shading.
Redesign the framing into a compact THREE-HEAD PORTRAIT with only a small tapering cream-and-gold chest visible below the heads. NO LEGS OR PAWS VISIBLE. Do not draw the reference's broad sausage torso or four stubby legs. Keep the body mostly hidden behind the faces, with a graceful, lightly tapered lower silhouette.
Exactly THREE attached heads: small orange-gold Pom on the LEFT with pointed ears and cream muzzle; larger golden dog slightly higher in the MIDDLE with dark-brown muzzle, dark-edged ears, cream throat; brown/gray tabby cat on the RIGHT with just three simple forehead stripes. They belong to one shared creature, with the small chest connecting them.
Keep exactly THREE distinctive tails curling behind the head group as simple separated shapes: orange/cream curled Pom plume behind the left side, golden sweeping dog tail behind the middle, fluffy charcoal/brown striped cat tail behind the right side. Make tails secondary to the faces and avoid an excessively tall center tail. A few rounded tufts only.
Icon composition: one centered recognizable emblem, large friendly three-head group, balanced compact roughly circular silhouette, clearly readable at tiny sizes. All outer features sit comfortably within the central 75–80 percent of the square canvas, leaving generous safety margin for app icon masks. Fully filled opaque warm ivory background edge to edge, no baked-in rounded square corners, no border around the canvas, no text, no shadows or decorative backdrop.
No collars, accessories, extra heads, extra tails, or extra animals. No leg shapes at the bottom. Low detail is essential. Preserve the pets' distinct silhouettes and the reference's simple face language.
```

### 09b-cerberus-app-icon-front-paws.png

Built-in image edit using version 09. Updated opaque app-icon master with exactly two small tabby front paws and hidden legs.

```text
Use case: precise-object-edit.
Edit target: the supplied three-head Cerberus app icon, version 09.
Add exactly TWO SMALL FRONT PAWS at the lower edge of the small shared chest. Keep the legs completely hidden behind the chest: only the little rounded paws peek out, as if gently resting on the lower edge. These are the tabby cat's front paws: simple muted brown/gray with one or two dark tabby marks, compact rounded shapes in the same thick dark-outline chibi anime style. Keep paws modest and close together so they do not widen the body or create a broad four-foot silhouette. No visible forelegs, no rear legs or rear paws. Do not make four paws. Use only a couple of simple toe marks, no claws.
Preserve the current three pet heads and faces, the three separated tails behind them, small tapering golden/cream chest, overall compact portrait composition, thick dark-brown outlines, simple colors, no collars, generous icon margins, square canvas, and opaque ivory background. Make only the two-paw addition; do not redesign or add detail to the rest of the icon. No text or props.
```

### 09c-cerberus-icon-front-paws-transparent.png

Built-in background extraction using version 09b. Transparent companion for use on other backgrounds; retains both front paws. Generated companion may differ slightly in framing from the opaque master.

```text
Use case: background-extraction.
Edit target: the supplied Cerberus app icon with TWO small front paws and hidden legs.
Remove ONLY the opaque ivory background and replace it with genuinely transparent alpha. Preserve the entire character artwork, including BOTH small gray-brown FRONT PAWS along the bottom, their toe marks, three faces, three tails, small golden-and-cream chest, all dark outlines and internal colors. Keep pose, proportions and framing. The cream fur inside the Pom tail and dog muzzle/chest must remain opaque. No legs, no collars, no extra paws, no text, no new details. Clean antialiased edges. No painted checkerboard.
```

### 01d-cerberus-pixel-low-fidelity.png

Built-in image edit using `01c-cerberus-pixel-cat-legs-no-collars.png` as the edit target. Visually checked for simplified pixel shapes, three heads and tails, tabby front legs, and no collars. This is a generated enlarged pixel-art concept, not a literal 64×64 production sprite. Earlier versions are preserved.

```text
Use case: style-transfer.
Edit target: supplied Cerberus version 01c with cat front legs and no collars.
Create a MUCH LOWER-FIDELITY version of this same design in chunky retro game pixel art. Redraw it as if the entire character fits in roughly a 64x64 pixel sprite, then enlarge with crisp blocky nearest-neighbor edges. Remove at least 80 percent of the visual detail. Use about 10–12 flat colors total. Faces use tiny simple pixel eyes and noses; the cat's eyes can be a couple of pale green pixels. Simplify the larger dog's dark muzzle into one dark shape. Cream chest is one broad flat shape. Fur silhouettes have only a few large stepped tufts. Tabby markings are a few large dark bands. At most one shadow color per coat. No gradients, no texture, no dithering, no tiny fur marks, no whiskers, no glossy eyes, no elaborate ear interiors, no individual toes. Make the large pixel clusters unmistakable, readable as a small game sprite.
Preserve the overall THREE-QUARTER STANDING POSE, proportions and arrangement of this particular character: ONE shared golden quadruped body; exactly THREE recognizable heads, smaller orange Pom on the LEFT, larger golden dog with dark muzzle in the MIDDLE, brown-charcoal tabby cat on the RIGHT. Exactly FOUR legs: both FRONT legs and paws are brown/charcoal striped CAT legs; both REAR legs remain golden dog legs. Exactly THREE distinct tails at the rump on the right: golden sweeping tail, orange/cream curled Pom plume, thick dark striped fluffy cat tail. Keep all tails clearly visible and separated.
No collars or accessories, no text or props. Opaque plain ivory background with ample margin. Prioritize sparse simplified pixel shapes over faithful detailed rendering. This must look dramatically simpler than the input, while remaining the same creature.
```

### 01c-cerberus-pixel-cat-legs-no-collars.png

Built-in image edit using `01b-cerberus-pixel-cat-legs-collars.png` as the edit target. Visually checked for removal of all collars and retention of both tabby front legs and paws. Earlier versions are preserved.

```text
Use case: precise-object-edit.
Edit target: supplied pixel-art Cerberus version 01b.
Remove all THREE collars completely: the pink collar and buckle on the left orange Pomeranian, the blue collar and buckle on the middle larger golden dog, and the green collar and buckle on the right tabby cat. Replace each removed band and buckle with the natural neck fur matching its pet and the existing surrounding pixel art. No collar fragments, jewelry, straps, or accessories.
Change only the collar areas. Preserve BOTH striped brown/charcoal CAT FRONT LEGS AND PAWS exactly as shown. Keep the two golden dog rear legs, the three pet faces and heads, one shared body, cream chest, all three tails, original pose, proportions, coarse square pixel rendering, and opaque ivory background unchanged. No extra limbs, no text, no new details.
```

### 01b-cerberus-pixel-cat-legs-collars.png

Built-in image edit using `01-cerberus-pixel.png` as the edit target. Visually checked for both striped feline front legs and the three requested collar colors. Original concept 01 is preserved.

```text
Use case: precise-object-edit.
Edit target: the supplied pixel-art Cerberus concept 01.
Make exactly these changes:
1. Replace BOTH FRONT LEGS AND FRONT PAWS with the tabby cat's legs and paws: brown/gray-charcoal fur, bold dark tabby stripes, softly rounded cat paws. These are the two legs under the chest at the lower left and lower middle of the image. Keep their positions and approximate lengths, but make them clearly feline and striped all the way from shoulder to paw. Keep both rear legs golden canine legs.
2. Add a clearly visible PINK collar around the orange Pomeranian's individual neck on the viewer's LEFT.
3. Add a clearly visible BLUE collar around the larger golden dog's individual neck in the MIDDLE.
4. Add a clearly visible GREEN collar around the tabby cat's individual neck on the viewer's RIGHT.
Collars should be simple solid-colored pixel bands across each individual neck, distinguishable even over the fluffy ruffs. Small simple buckles are fine; no writing or tags required.
Invariants: preserve the three recognizable pet heads, one shared golden body, cream chest, exactly four legs, all three existing tails, pose, framing, proportions, original coarse pixel-art technique, color palette everywhere other than the two front legs and the three collars, and the opaque ivory background. No new animals or extra limbs. Keep faces and tails unchanged. Do not redesign the illustration or add detail.
```

### 01-cerberus-pixel.png

```text
Use case: stylized-concept.
Asset type: low-detail character concept art for the discreet Down & Up app.
Input images: image 1 is a reference of both pet dogs and their tails; image 2 is a reference of the larger dog's face; image 3 is a reference of the tabby cat's face; image 4 is a reference of the orange Pomeranian and its cream plume tail. Use only the pets' appearance, not the photographic scenes.
Primary request: Design a friendly Cerberus-inspired creature combining THESE THREE PETS into ONE compact quadruped body, with exactly THREE distinct heads connected to that single torso, and exactly THREE distinct tails attached to that body's rump. Not three separate animals.
Pet identities: larger medium-sized golden reddish-brown dog, noticeably larger head, long dark brown/black muzzle, dark-edged upright ears with slight flop, cream throat and chest; smaller orange-gold Pomeranian with small pointed upright ears, compact foxlike muzzle, black nose and cream ruff; fluffy brown/charcoal tabby cat with triangular ears, pale green eyes, warm tan muzzle and just a few dark forehead stripes.
Tails: one long gently sweeping golden feathered dog tail; one orange-and-cream Pom plume curling upward; one thick fluffy charcoal/brown striped cat tail. Keep all three tails visibly separated with clear silhouettes and attached to the shared rump.
Composition: square, one full-body character in a simple standing three-quarter pose so all three heads and all three tails can be counted, four short legs, generous empty margin around all extremities. The body is mostly golden brown with a simple cream chest patch. The larger dog head sits slightly higher, the Pom and cat heads smaller alongside. Quiet attentive expressions.
Constraints: very low fidelity and few details, prioritize recognizable ear/muzzle/tail shapes, readable at small app sizes, no individual fur hairs, no intricate markings, no props, no clothing, no collars, no scene copied from photos, no text, no watermark. No demon features, snakes, flames, spiky armor, or snarling. Plain light background.
Style/medium: chunky retro pixel art, visibly coarse square pixel clusters as if designed on a roughly 96x96 sprite grid then enlarged with crisp nearest-neighbor edges. Restrained palette of about 12 colors, flat blocks, very minimal one-step shading, no smooth gradients, no anti-aliased outlines, no detailed dithering. Sparse tabby stripes.
```

### 02-cerberus-watercolor.png

```text
Use case: stylized-concept.
Asset type: low-detail character concept art for the discreet Down & Up app.
Input images: image 1 is a reference of both pet dogs and their tails; image 2 is a reference of the larger dog's face; image 3 is a reference of the tabby cat's face; image 4 is a reference of the orange Pomeranian and its cream plume tail. Use only the pets' appearance, not the photographic scenes.
Primary request: Design a friendly Cerberus-inspired creature combining THESE THREE PETS into ONE compact quadruped body, with exactly THREE distinct heads connected to that single torso, and exactly THREE distinct tails attached to that body's rump. Not three separate animals.
Pet identities: larger medium-sized golden reddish-brown dog, noticeably larger head, long dark brown/black muzzle, dark-edged upright ears with slight flop, cream throat and chest; smaller orange-gold Pomeranian with small pointed upright ears, compact foxlike muzzle, black nose and cream ruff; fluffy brown/charcoal tabby cat with triangular ears, pale green eyes, warm tan muzzle and just a few dark forehead stripes.
Tails: one long gently sweeping golden feathered dog tail; one orange-and-cream Pom plume curling upward; one thick fluffy charcoal/brown striped cat tail. Keep all three tails visibly separated with clear silhouettes and attached to the shared rump.
Composition: square, one full-body character in a simple standing three-quarter pose so all three heads and all three tails can be counted, four short legs, generous empty margin around all extremities. The body is mostly golden brown with a simple cream chest patch. The larger dog head sits slightly higher, the Pom and cat heads smaller alongside. Quiet attentive expressions.
Constraints: very low fidelity and few details, prioritize recognizable ear/muzzle/tail shapes, readable at small app sizes, no individual fur hairs, no intricate markings, no props, no clothing, no collars, no scene copied from photos, no text, no watermark. No demon features, snakes, flames, spiky armor, or snarling. Plain light background.
Style/medium: loose minimal watercolor children's-book spot illustration on warm ivory paper. Broad transparent washes, softly irregular edges, a few tiny ink marks for eyes and noses; simplify fur into large silhouette shapes. No elaborate rendering, no fine hair strokes, no scenery; only a very faint grounding wash.
Simplicity is the highest priority: first-pass small mascot, large primitive shapes and only essential facial marks. Do not meticulously illustrate the photographs. Translate the identifying traits into a few simple marks.
```

### 03-cerberus-anime.png

```text
Use case: stylized-concept.
Asset type: low-detail character concept art for the discreet Down & Up app.
Input images: image 1 is a reference of both pet dogs and their tails; image 2 is a reference of the larger dog's face; image 3 is a reference of the tabby cat's face; image 4 is a reference of the orange Pomeranian and its cream plume tail. Use only the pets' appearance, not the photographic scenes.
Primary request: Design a friendly Cerberus-inspired creature combining THESE THREE PETS into ONE compact quadruped body, with exactly THREE distinct heads connected to that single torso, and exactly THREE distinct tails attached to that body's rump. Not three separate animals.
Pet identities: larger medium-sized golden reddish-brown dog, noticeably larger head, long dark brown/black muzzle, dark-edged upright ears with slight flop, cream throat and chest; smaller orange-gold Pomeranian with small pointed upright ears, compact foxlike muzzle, black nose and cream ruff; fluffy brown/charcoal tabby cat with triangular ears, pale green eyes, warm tan muzzle and just a few dark forehead stripes.
Tails: one long gently sweeping golden feathered dog tail; one orange-and-cream Pom plume curling upward; one thick fluffy charcoal/brown striped cat tail. Keep all three tails visibly separated with clear silhouettes and attached to the shared rump.
Composition: square, one full-body character in a simple standing three-quarter pose so all three heads and all three tails can be counted, four short legs, generous empty margin around all extremities. The body is mostly golden brown with a simple cream chest patch. The larger dog head sits slightly higher, the Pom and cat heads smaller alongside. Quiet attentive expressions.
Constraints: very low fidelity and few details, prioritize recognizable ear/muzzle/tail shapes, readable at small app sizes, no individual fur hairs, no intricate markings, no props, no clothing, no collars, no scene copied from photos, no text, no watermark. No demon features, snakes, flames, spiky armor, or snarling. Plain light background.
Style/medium: simple chibi anime mascot concept, clean thick rounded outlines, oversized heads and compact small torso, flat cel colors with at most one small shadow shape per region. Simple dot/oval eyes, no sparkly eye detail, no detailed fur or glossy rendering. Almost sticker-like simplicity.
Simplicity is the highest priority: first-pass small mascot, large primitive shapes and only essential facial marks. Do not meticulously illustrate the photographs. Translate the identifying traits into a few simple marks.
```

### 04-cerberus-paper-cutout.png

```text
Use case: stylized-concept.
Asset type: low-detail character concept art for the discreet Down & Up app.
Input images: image 1 is a reference of both pet dogs and their tails; image 2 is a reference of the larger dog's face; image 3 is a reference of the tabby cat's face; image 4 is a reference of the orange Pomeranian and its cream plume tail. Use only the pets' appearance, not the photographic scenes.
Primary request: Design a friendly Cerberus-inspired creature combining THESE THREE PETS into ONE compact quadruped body, with exactly THREE distinct heads connected to that single torso, and exactly THREE distinct tails attached to that body's rump. Not three separate animals.
Pet identities: larger medium-sized golden reddish-brown dog, noticeably larger head, long dark brown/black muzzle, dark-edged upright ears with slight flop, cream throat and chest; smaller orange-gold Pomeranian with small pointed upright ears, compact foxlike muzzle, black nose and cream ruff; fluffy brown/charcoal tabby cat with triangular ears, pale green eyes, warm tan muzzle and just a few dark forehead stripes.
Tails: one long gently sweeping golden feathered dog tail; one orange-and-cream Pom plume curling upward; one thick fluffy charcoal/brown striped cat tail. Keep all three tails visibly separated with clear silhouettes and attached to the shared rump.
Composition: square, one full-body character in a simple standing three-quarter pose so all three heads and all three tails can be counted, four short legs, generous empty margin around all extremities. The body is mostly golden brown with a simple cream chest patch. The larger dog head sits slightly higher, the Pom and cat heads smaller alongside. Quiet attentive expressions.
Constraints: very low fidelity and few details, prioritize recognizable ear/muzzle/tail shapes, readable at small app sizes, no individual fur hairs, no intricate markings, no props, no clothing, no collars, no scene copied from photos, no text, no watermark. No demon features, snakes, flames, spiky armor, or snarling. Plain light background.
Style/medium: minimal layered paper-cutout collage. Large rounded cut-paper shapes, about 8 muted natural coat colors, tiny black oval eyes and noses, just two or three cut-paper stripes for the cat. Very subtle paper grain and shallow overlap shadows. No fine fur details, no complex lighting, no extra decorative elements.
Simplicity is the highest priority: first-pass small mascot, large primitive shapes and only essential facial marks. Do not meticulously illustrate the photographs. Translate the identifying traits into a few simple marks.
```

### 05-cerberus-ink-sketch.png

```text
Use case: stylized-concept.
Asset type: low-detail character concept art for the discreet Down & Up app.
Input images: image 1 is a reference of both pet dogs and their tails; image 2 is a reference of the larger dog's face; image 3 is a reference of the tabby cat's face; image 4 is a reference of the orange Pomeranian and its cream plume tail. Use only the pets' appearance, not the photographic scenes.
Primary request: Design a friendly Cerberus-inspired creature combining THESE THREE PETS into ONE compact quadruped body, with exactly THREE distinct heads connected to that single torso, and exactly THREE distinct tails attached to that body's rump. Not three separate animals.
Pet identities: larger medium-sized golden reddish-brown dog, noticeably larger head, long dark brown/black muzzle, dark-edged upright ears with slight flop, cream throat and chest; smaller orange-gold Pomeranian with small pointed upright ears, compact foxlike muzzle, black nose and cream ruff; fluffy brown/charcoal tabby cat with triangular ears, pale green eyes, warm tan muzzle and just a few dark forehead stripes.
Tails: one long gently sweeping golden feathered dog tail; one orange-and-cream Pom plume curling upward; one thick fluffy charcoal/brown striped cat tail. Keep all three tails visibly separated with clear silhouettes and attached to the shared rump.
Composition: square, one full-body character in a simple standing three-quarter pose so all three heads and all three tails can be counted, four short legs, generous empty margin around all extremities. The body is mostly golden brown with a simple cream chest patch. The larger dog head sits slightly higher, the Pom and cat heads smaller alongside. Quiet attentive expressions.
Constraints: very low fidelity and few details, prioritize recognizable ear/muzzle/tail shapes, readable at small app sizes, no individual fur hairs, no intricate markings, no props, no clothing, no collars, no scene copied from photos, no text, no watermark. No demon features, snakes, flames, spiky armor, or snarling. Plain light background.
Style/medium: very simple loose ink doodle with spare pencil-like earth-tone color fills on ivory paper. Confident imperfect rounded contour lines, tiny eyes, minimal muzzle shapes, only a few stripes. Huge economy of marks, no hatching, no realistic shading, no individual hairs; charming rough first-pass character sketch.
Simplicity is the highest priority: first-pass small mascot, large primitive shapes and only essential facial marks. Do not meticulously illustrate the photographs. Translate the identifying traits into a few simple marks.
```

### 06-cerberus-minimal-pixel.png

```text
Use the pet photos only as identity references. Create a VERY SIMPLE, LOW-FIDELITY app mascot: ONE small round golden-brown body, FOUR stubby legs, THREE heads (tiny orange Pom, larger tan dog with dark muzzle, gray-brown tabby cat with green eyes), and THREE separated tails (golden sweep, curled cream Pom plume, fluffy dark striped cat tail). Full body, blank ivory background, ample margins.
Design at tiny icon scale. Reduce anatomy to blobs and ears to triangles. Faces are two dots and a nose, with the larger dog's dark muzzle as one solid oval and the cat's markings as just three short stripes. Smooth round silhouettes: represent fluff using only TWO OR THREE large bumps. No hair strokes, no layered fur tufts, no muscle definition, no decorative highlights, no realistic eyes, no whisker details, no claws, no toes, no elaborate rendering. More like a rough tiny game mascot than a pet portrait. Three heads and three tails on one body must remain obvious. No text or props.
Style: Actual extremely coarse 32x32-style pixel sprite, enlarged. Only EIGHT flat colors, no gradients, no antialiasing, no texture or dithering. Single-pixel eyes. Heads each roughly 6-9 logical pixels wide. Big square pixels and simple block shapes. The entire creature must be tiny in visual complexity.
```

### 07-cerberus-minimal-watercolor.png

```text
Use the pet photos only as identity references. Create a VERY SIMPLE, LOW-FIDELITY app mascot: ONE small round golden-brown body, FOUR stubby legs, THREE heads (tiny orange Pom, larger tan dog with dark muzzle, gray-brown tabby cat with green eyes), and THREE separated tails (golden sweep, curled cream Pom plume, fluffy dark striped cat tail). Full body, blank ivory background, ample margins.
Design at tiny icon scale. Reduce anatomy to blobs and ears to triangles. Faces are two dots and a nose, with the larger dog's dark muzzle as one solid oval and the cat's markings as just three short stripes. Smooth round silhouettes: represent fluff using only TWO OR THREE large bumps. No hair strokes, no layered fur tufts, no muscle definition, no decorative highlights, no realistic eyes, no whisker details, no claws, no toes, no elaborate rendering. More like a rough tiny game mascot than a pet portrait. Three heads and three tails on one body must remain obvious. No text or props.
Style: VERY SPARE naive watercolor spot illustration. Only a handful of broad watery brush shapes, softly rounded color blobs, face marks in a few dark dots. Flat, almost preschool picture-book simplicity. No outlines except the essential face marks. No detailed brushwork or fur. Lots of blank paper.
```

### 08-cerberus-minimal-anime.png

```text
Use the pet photos only as identity references. Create a VERY SIMPLE, LOW-FIDELITY app mascot: ONE small round golden-brown body, FOUR stubby legs, THREE heads (tiny orange Pom, larger tan dog with dark muzzle, gray-brown tabby cat with green eyes), and THREE separated tails (golden sweep, curled cream Pom plume, fluffy dark striped cat tail). Full body, blank ivory background, ample margins.
Design at tiny icon scale. Reduce anatomy to blobs and ears to triangles. Faces are two dots and a nose, with the larger dog's dark muzzle as one solid oval and the cat's markings as just three short stripes. Smooth round silhouettes: represent fluff using only TWO OR THREE large bumps. No hair strokes, no layered fur tufts, no muscle definition, no decorative highlights, no realistic eyes, no whisker details, no claws, no toes, no elaborate rendering. More like a rough tiny game mascot than a pet portrait. Three heads and three tails on one body must remain obvious. No text or props.
Style: EXTREMELY SIMPLE chibi anime doodle, squat body and three round heads, single clean dark outline, flat colors, ZERO shading. Tiny dot eyes. No shiny eyes. Minimal round shapes with just two tufts per head. Like a tiny hand-drawn anime sticker with very few lines.
```
