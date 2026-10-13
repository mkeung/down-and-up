import { expect, it } from 'vitest';
import config from '../app.config';

it('restricts the mobile app to portrait, including existing iPad projects', () => {
  expect(config.orientation).toBe('portrait');
  expect(config.ios?.supportsTablet).toBe(true);
  expect(config.ios?.requireFullScreen).toBe(true);
  expect(
    config.ios?.infoPlist?.['UISupportedInterfaceOrientations~ipad'],
  ).toEqual([
    'UIInterfaceOrientationPortrait',
    'UIInterfaceOrientationPortraitUpsideDown',
  ]);
});
