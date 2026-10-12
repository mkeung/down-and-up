import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(
  realpathSync(
    new URL('../apps/web/node_modules/next/package.json', import.meta.url),
  ),
);
const sharp = require('sharp');
const root = 'OfficialAssets/Animations/01e';
const size = 512;
const { animations } = JSON.parse(
  await readFile(path.join(root, 'generation.json'), 'utf8'),
);
const manifest = {
  character: '01e',
  width: size,
  height: size,
  animations: [],
};

function bounds(data, width, height) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 32) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  assert(right >= left && bottom >= top, 'Empty frame');
  return { left, top, right, bottom };
}

for (const animation of animations) {
  const { id, title, durations } = animation;
  assert.equal(durations.length, 8);
  const directory = path.join(root, id);
  const frames = Array.from(
    { length: 8 },
    (_, i) => `${id}/frames/${String(i + 1).padStart(2, '0')}.png`,
  );
  const loop = id !== 'food-can';
  const entry = {
    id,
    title,
    frames,
    durations,
    loop,
    gif: `${id}/preview.gif`,
    webp: `${id}/preview.webp`,
    sheet: `${id}/sheet.png`,
  };

  if (!process.argv.includes('--check')) {
    const source = path.join(root, animation.source);
    const metadata = await sharp(source).metadata();
    assert(metadata.hasAlpha, `${id}: source must have alpha`);
    const cellWidth = Math.ceil(metadata.width / 4);
    const cellHeight = Math.ceil(metadata.height / 2);
    const extracted = [];
    const union = { left: cellWidth, top: cellHeight, right: -1, bottom: -1 };
    for (let i = 0; i < 8; i++) {
      const column = i % 4;
      const row = Math.floor(i / 4);
      const left = Math.round((column * metadata.width) / 4);
      const top = Math.round((row * metadata.height) / 2);
      const width = Math.round(((column + 1) * metadata.width) / 4) - left;
      const height = Math.round(((row + 1) * metadata.height) / 2) - top;
      const frame = await sharp(source)
        .extract({ left, top, width, height })
        .extend({
          right: cellWidth - width,
          bottom: cellHeight - height,
          background: '#00000000',
        })
        .ensureAlpha()
        .raw()
        .toBuffer();
      const box = bounds(frame, cellWidth, cellHeight);
      assert(
        box.left > 0 &&
          box.top > 0 &&
          box.right < width - 1 &&
          box.bottom < height - 1,
        `${id} frame ${i + 1}: artwork touches a source cell boundary`,
      );
      for (const axis of ['left', 'top'])
        union[axis] = Math.min(union[axis], box[axis]);
      for (const axis of ['right', 'bottom'])
        union[axis] = Math.max(union[axis], box[axis]);
      extracted.push(frame);
    }
    // A common crop and scale preserve motion and camera position within each sequence.
    const crop = {
      left: Math.max(0, union.left - 2),
      top: Math.max(0, union.top - 2),
      width: Math.min(
        cellWidth - Math.max(0, union.left - 2),
        union.right - union.left + 5,
      ),
      height: Math.min(
        cellHeight - Math.max(0, union.top - 2),
        union.bottom - union.top + 5,
      ),
    };
    const buffers = [];
    await mkdir(path.join(directory, 'frames'), { recursive: true });
    for (let i = 0; i < 8; i++) {
      const buffer = await sharp(extracted[i], {
        raw: { width: cellWidth, height: cellHeight, channels: 4 },
      })
        .extract(crop)
        .resize(416, 416, {
          fit: 'contain',
          kernel: 'nearest',
          background: '#00000000',
        })
        .extend({
          top: 48,
          bottom: 48,
          left: 48,
          right: 48,
          background: '#00000000',
        })
        .png()
        .toBuffer();
      await writeFile(path.join(root, frames[i]), buffer);
      buffers.push(buffer);
    }
    const rgba = await Promise.all(
      buffers.map((buffer) => sharp(buffer).ensureAlpha().raw().toBuffer()),
    );
    const animationInput = {
      raw: { width: size, height: size * 8, channels: 4, pageHeight: size },
    };
    await sharp(Buffer.concat(rgba), animationInput)
      .gif({ delay: durations, loop: loop ? 0 : 1, dither: 0, effort: 7 })
      .toFile(path.join(root, entry.gif));
    await sharp(Buffer.concat(rgba), animationInput)
      .webp({ delay: durations, loop: loop ? 0 : 1, lossless: true, effort: 6 })
      .toFile(path.join(root, entry.webp));
    await sharp({
      create: {
        width: size * 4,
        height: size * 2,
        channels: 4,
        background: '#00000000',
      },
    })
      .composite(
        buffers.map((input, i) => ({
          input,
          left: (i % 4) * size,
          top: Math.floor(i / 4) * size,
        })),
      )
      .png()
      .toFile(path.join(root, entry.sheet));
  }

  const hashes = new Set();
  for (const frame of frames) {
    const { data, info } = await sharp(path.join(root, frame))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(info.width, size);
    assert.equal(info.height, size);
    const box = bounds(data, size, size);
    assert(
      box.left >= 40 &&
        box.top >= 40 &&
        box.right < size - 40 &&
        box.bottom < size - 40,
    );
    hashes.add(data.toString('base64'));
  }
  assert(hashes.size >= 4, `${id}: expected at least four distinct poses`);
  for (const filename of [entry.gif, entry.webp]) {
    const metadata = await sharp(path.join(root, filename), {
      animated: true,
    }).metadata();
    assert.equal(metadata.width, size);
    assert.equal(metadata.pageHeight, size);
    assert.equal(metadata.pages, 8);
    assert.deepEqual(metadata.delay, durations);
    assert.equal(metadata.loop, loop ? 0 : 1);
    assert(metadata.hasAlpha);
  }
  manifest.animations.push(entry);
  console.log(`${id}: 8 frames, timing, transparency, and margins verified`);
}
if (!process.argv.includes('--check')) {
  await writeFile(
    path.join(root, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
}
