import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const source = 'OfficialAssets/Animations/01e';
const destination = 'apps/mobile/assets/cerberus';
const frameSize = 256;
const require = createRequire(
  realpathSync(
    new URL('../apps/web/node_modules/next/package.json', import.meta.url),
  ),
);
const sharp = require('sharp');
const ids = [
  'walking',
  'sitting-idle',
  'tennis-ball',
  'yarn-ball',
  'food-can',
  'backflip',
  'tug-of-war',
];
const manifest = JSON.parse(
  await readFile(path.join(source, 'manifest.json'), 'utf8'),
);
const reactions = JSON.parse(
  await readFile(path.join(source, 'reactions/manifest.json'), 'utf8'),
);
assert.deepEqual(
  reactions.animations.map((animation) => animation.value),
  Array.from({ length: 10 }, (_, i) => i + 1),
);
assert.equal(manifest.width, 512);
assert.equal(manifest.height, 512);
assert.equal(reactions.width, manifest.width);
assert.equal(reactions.height, manifest.height);
const check = process.argv.includes('--check');
if (!check) await mkdir(destination, { recursive: true });
const timings = {};
const hitMasks = {};
let originalBytes = 0;
let mobileBytes = 0;
for (const animation of [
  ...ids.map((id) => manifest.animations.find((entry) => entry.id === id)),
  ...reactions.animations,
]) {
  const id = animation?.id;
  assert(animation, `Missing animation: ${id}`);
  assert.equal(animation.frames.length, 8);
  assert.equal(animation.durations.length, 8);
  assert.equal(
    animation.loop,
    id !== 'food-can' && id !== 'backflip' && !id.startsWith('reaction-'),
  );
  timings[id] = animation.durations;
  // One bit per 16px tile: transparent space can receive holds, artwork cannot.
  const frameRoot = path.join(
    source,
    id.startsWith('reaction-') ? 'reactions' : '',
  );
  hitMasks[id] = [];
  for (const frame of animation.frames) {
    const data = await sharp(path.join(frameRoot, frame))
      .ensureAlpha()
      .raw()
      .toBuffer();
    const tiles = Array(32 * 32).fill(0);
    for (let y = 0; y < 512; y++)
      for (let x = 0; x < 512; x++)
        if (data[(y * 512 + x) * 4 + 3] > 32)
          tiles[Math.floor(y / 16) * 32 + Math.floor(x / 16)] = 1;
    let mask = '';
    for (let i = 0; i < tiles.length; i += 4)
      mask += (
        tiles[i] |
        (tiles[i + 1] << 1) |
        (tiles[i + 2] << 2) |
        (tiles[i + 3] << 3)
      ).toString(16);
    hitMasks[id].push(mask);
  }
  const sheet = await readFile(
    path.join(
      source,
      id.startsWith('reaction-') ? 'reactions' : '',
      animation.sheet,
    ),
  );
  const metadata = await sharp(sheet).metadata();
  assert.equal(metadata.width, manifest.width * 4);
  assert.equal(metadata.height, manifest.height * 2);
  assert(metadata.hasAlpha, `${id}: sheet must have alpha`);
  // Keep the 4x2 grid and full cell margins so playback, source-coordinate
  // mouth anchors, and conservative alpha hit masks retain their geometry.
  const optimized = await sharp(sheet)
    .resize(frameSize * 4, frameSize * 2, { kernel: 'nearest' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  assert(
    optimized.length < sheet.length / 2,
    `${id}: insufficient size saving`,
  );
  originalBytes += sheet.length;
  mobileBytes += optimized.length;
  const output = path.join(destination, `${id}.png`);
  if (check)
    assert.deepEqual(await readFile(output), optimized, `${id}: stale sheet`);
  else await writeFile(output, optimized);
}
const output = path.join(destination, 'timings.json');
if (check)
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), timings);
else await writeFile(output, JSON.stringify(timings, null, 2) + '\n');
const masksOutput = path.join(destination, 'hit-masks.json');
if (check)
  assert.deepEqual(JSON.parse(await readFile(masksOutput, 'utf8')), hitMasks);
else await writeFile(masksOutput, JSON.stringify(hitMasks, null, 2) + '\n');
console.log(
  `Cerberus mobile sheets (${frameSize}px frames), timing and hit masks ${check ? 'verified' : 'prepared'}: ` +
    `${(originalBytes / 1024 / 1024).toFixed(2)} MiB → ${(mobileBytes / 1024 / 1024).toFixed(2)} MiB ` +
    `(${((1 - mobileBytes / originalBytes) * 100).toFixed(1)}% smaller)`,
);
