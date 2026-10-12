import { describe, expect, it } from 'vitest';
import { parseThemeId, THEME_OPTIONS, themeColors } from './themes';

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
function contrast(a: string, b: string) {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high! + 0.05) / (low! + 0.05);
}

describe('theme palettes', () => {
  it('falls back to Neutral for missing or obsolete preferences', () => {
    expect(parseThemeId(null)).toBe('neutral');
    expect(parseThemeId('unknown')).toBe('neutral');
    expect(parseThemeId('')).toBe('neutral');
    expect(parseThemeId('blue')).toBe('blue');
  });
  for (const dark of [false, true]) {
    it(`keeps neutral keys and dedicated status colors in ${dark ? 'dark' : 'light'} mode`, () => {
      const neutral = themeColors('neutral', dark);
      for (const { id } of THEME_OPTIONS) {
        const theme = themeColors(id, dark);
        expect(theme.surface).toBe(neutral.surface);
        expect(theme.selected).toBe(neutral.selected);
        expect(theme.line).toBe(neutral.line);
        expect(theme.status).toEqual(neutral.status);
      }
    });
    it(`keeps text, controls and status readable in ${dark ? 'dark' : 'light'} mode`, () => {
      for (const { id } of THEME_OPTIONS) {
        const theme = themeColors(id, dark);
        for (const surface of [
          theme.background,
          theme.chrome,
          theme.surface,
          theme.selected,
        ]) {
          expect(
            contrast(theme.text, surface),
            `${id} text on ${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
          expect(
            contrast(theme.muted, surface),
            `${id} secondary text on ${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
          expect(
            contrast(theme.line, surface),
            `${id} frame on ${surface}`,
          ).toBeGreaterThanOrEqual(3);
        }
        for (const status of Object.values(theme.status)) {
          expect(
            contrast(status, theme.background),
            `${id} status ${status}`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    });
  }
});
