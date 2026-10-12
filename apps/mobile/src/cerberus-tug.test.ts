import { expect, it } from 'vitest';
import { hitsSprite, ropePath, spriteOrigin, withinArea } from './cerberus-tug';

it('maps pointer coordinates through sprite scale, native travel, ground alignment, and both facings', () => {
  const origin = spriteOrigin(360, 202, 240, 88, 0.75, 84);
  expect(origin.x).toBe(82);
  expect(origin.y).toBeCloseTo(-10.625);
  // Tile (4,8) is opaque. All other tiles, including transparent image margins, are empty.
  const index = 8 * 32 + 4;
  const mask = '0'.repeat(index / 4) + '1' + '0'.repeat(255 - index / 4);
  const point = {
    x: origin.x + (4.5 / 32) * 240,
    y: origin.y + (8.5 / 32) * 240,
  };
  expect(hitsSprite(point, origin, 240, false, mask)).toBe(true);
  expect(hitsSprite(point, origin, 240, true, mask)).toBe(false);
  expect(
    hitsSprite(
      { ...point, x: origin.x + 240 - (4.5 / 32) * 240 },
      origin,
      240,
      true,
      mask,
    ),
  ).toBe(true);
  expect(
    hitsSprite({ ...point, x: origin.x - 1 }, origin, 240, false, mask),
  ).toBe(false);
  expect(
    hitsSprite({ ...point, y: origin.y + 240 }, origin, 240, false, mask),
  ).toBe(false);
});

it('limits the rope interaction to finite coordinates inside the reserved area', () => {
  expect(withinArea({ x: 0, y: 0 }, 360, 202)).toBe(true);
  expect(withinArea({ x: 360, y: 202 }, 360, 202)).toBe(true);
  for (const point of [
    { x: -1, y: 100 },
    { x: 361, y: 100 },
    { x: 100, y: 203 },
    { x: NaN, y: 10 },
  ])
    expect(withinArea(point, 360, 202)).toBe(false);
});

it('anchors the rope at the mouth and finger with a bounded bend in either direction', () => {
  expect(ropePath({ x: 100, y: 100 }, { x: 200, y: 100 })).toBe(
    'M 100 100 Q 150 104 200 100',
  );
  expect(ropePath({ x: 200, y: 100 }, { x: 100, y: 100 })).toBe(
    'M 200 100 Q 150 104 100 100',
  );
  expect(ropePath({ x: 0, y: 0 }, { x: 1000, y: 0 })).toBe(
    'M 0 0 Q 500 8 1000 0',
  );
});
