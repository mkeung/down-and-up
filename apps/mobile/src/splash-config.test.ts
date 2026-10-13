import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { expect, it } from 'vitest';
import config from '../app.config';

it('uses the official launcher icon on both native platforms', () => {
  expect(config.icon).toBe('./assets/icon.png');
  expect(config.ios?.icon ?? config.icon).toBe(config.icon);
  expect(config.android?.icon ?? config.icon).toBe(config.icon);

  const png = readFileSync(new URL('../assets/icon.png', import.meta.url));
  expect(png.readUInt32BE(16)).toBe(1024);
  expect(png.readUInt32BE(20)).toBe(1024);
});

it('uses a dedicated adaptive foreground for a larger Android launcher portrait', () => {
  expect(config.android?.adaptiveIcon).toEqual({
    foregroundImage: './assets/android-icon-foreground.png',
    backgroundColor: '#f4f3ec',
  });
  const png = readFileSync(
    new URL('../assets/android-icon-foreground.png', import.meta.url),
  );
  expect(png.readUInt32BE(16)).toBe(1024);
  expect(png.readUInt32BE(20)).toBe(1024);
});

it('bundles a separate transparent splash at an Android-safe size', () => {
  const splash = config.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  );
  if (!Array.isArray(splash)) throw new Error('Splash plugin is missing');
  const options = splash[1];
  expect(options.image).not.toBe(config.icon);
  expect(options.resizeMode).toBe('contain');
  // Android uses a 288dp canvas with a 192dp circular safe area.
  expect(options.imageWidth).toBeLessThanOrEqual(192);
  expect(options.backgroundColor).toBe('#f4f3ec');
  expect(options.dark.backgroundColor).toBe('#171e19');

  const png = readFileSync(new URL(`../${options.image}`, import.meta.url));
  expect(png.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  expect(png.readUInt32BE(16)).toBe(1024);
  expect(png.readUInt32BE(20)).toBe(1024);
  expect(png[25]).toBe(6); // RGBA: transparent corners on light and dark screens.
});
