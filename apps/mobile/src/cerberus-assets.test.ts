import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { expect, it } from 'vitest';
import timings from '../assets/cerberus/timings.json';
import hitMasks from '../assets/cerberus/hit-masks.json';
import actions from '../../../OfficialAssets/Animations/01e/manifest.json';
import reactions from '../../../OfficialAssets/Animations/01e/reactions/manifest.json';

const animations = [...actions.animations, ...reactions.animations];

it('bundles every action and reaction with its original timing and hit masks', () => {
  const ids = animations.map(({ id }) => id).sort();
  expect(ids).toHaveLength(17);
  expect(Object.keys(timings).sort()).toEqual(ids);
  expect(Object.keys(hitMasks).sort()).toEqual(ids);
  for (const animation of animations) {
    const id = animation.id as keyof typeof timings;
    expect(timings[id]).toEqual(animation.durations);
    expect(hitMasks[id]).toHaveLength(animation.frames.length);
    expect(hitMasks[id].every((mask) => /^[0-9a-f]{256}$/.test(mask))).toBe(
      true,
    );
  }
});

it.each(animations)(
  'uses a smaller transparent sheet for $id and retains the full-size original',
  (animation) => {
    const mobile = readFileSync(
      new URL(`../assets/cerberus/${animation.id}.png`, import.meta.url),
    );
    const root = animation.id.startsWith('reaction-') ? 'reactions/' : '';
    const original = readFileSync(
      new URL(
        `../../../OfficialAssets/Animations/01e/${root}${animation.sheet}`,
        import.meta.url,
      ),
    );
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(mobile.subarray(0, 8)).toEqual(signature);
    expect(original.subarray(0, 8)).toEqual(signature);
    // Both sheets keep eight row-major cells; only the raster size changes.
    expect(mobile.readUInt32BE(16)).toBe(1024);
    expect(mobile.readUInt32BE(20)).toBe(512);
    expect(original.readUInt32BE(16)).toBe(2048);
    expect(original.readUInt32BE(20)).toBe(1024);
    expect(mobile[25]).toBe(6); // RGBA with full alpha, no palette quantization.
    expect(mobile.length).toBeLessThan(original.length / 2);
  },
);
