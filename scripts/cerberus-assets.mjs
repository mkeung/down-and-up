import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const source = 'OfficialAssets/Animations/01e';
const destination = 'apps/mobile/assets/cerberus';
const ids = ['walking', 'sitting-idle', 'tennis-ball', 'yarn-ball', 'food-can'];
const manifest = JSON.parse(
  await readFile(path.join(source, 'manifest.json'), 'utf8'),
);
assert.equal(manifest.width, 512);
assert.equal(manifest.height, 512);
const check = process.argv.includes('--check');
if (!check) await mkdir(destination, { recursive: true });
const timings = {};
for (const id of ids) {
  const animation = manifest.animations.find((entry) => entry.id === id);
  assert(animation, `Missing animation: ${id}`);
  assert.equal(animation.frames.length, 8);
  assert.equal(animation.durations.length, 8);
  assert.equal(animation.loop, id !== 'food-can');
  timings[id] = animation.durations;
  const sheet = await readFile(path.join(source, animation.sheet));
  const output = path.join(destination, `${id}.png`);
  if (check)
    assert.deepEqual(await readFile(output), sheet, `${id}: stale sheet`);
  else await writeFile(output, sheet);
}
const output = path.join(destination, 'timings.json');
if (check)
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), timings);
else await writeFile(output, JSON.stringify(timings, null, 2) + '\n');
console.log(
  `Cerberus mobile sheets and timing ${check ? 'verified' : 'prepared'}`,
);
