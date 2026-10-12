export const THEME_OPTIONS = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'mint', label: 'Mint' },
  { id: 'blue', label: 'Blue' },
  { id: 'peach', label: 'Peach' },
  { id: 'plum', label: 'Plum' },
  { id: 'yellow', label: 'Yellow' },
] as const;
export type ThemeId = (typeof THEME_OPTIONS)[number]['id'];
export const THEME_STATE_KEY = 'ui_theme';
export function parseThemeId(value: string | null): ThemeId {
  return THEME_OPTIONS.find((option) => option.id === value)?.id ?? 'neutral';
}

const palettes = {
  neutral: { light: ['#f4f3ee', '#e6e3dc'], dark: ['#201f1e', '#34312e'] },
  mint: { light: ['#cfe1d5', '#b4cbbb'], dark: ['#172c25', '#2b463a'] },
  blue: { light: ['#d7e3f2', '#b8cde6'], dark: ['#0d2037', '#233d5c'] },
  peach: { light: ['#f6d7c6', '#ebbea4'], dark: ['#34251f', '#50372b'] },
  plum: { light: ['#e8dced', '#d2bfdc'], dark: ['#2c1d31', '#49304f'] },
  yellow: { light: ['#f5e8ad', '#e5cf82'], dark: ['#2c2715', '#443b21'] },
} as const;

export function themeColors(id: ThemeId, dark: boolean) {
  const [background, chrome] = palettes[id][dark ? 'dark' : 'light'];
  return {
    background,
    chrome,
    // Key surfaces, selection, text and chart ink stay neutral in every palette.
    ...(dark
      ? {
          surface: '#35312e',
          text: '#f4efe3',
          muted: '#c3bbb0',
          line: '#9c9184',
          selected: '#4a4540',
          accent: '#ede5d8',
          entryCheck: { fill: '#7bc67e', ink: '#201f1e' },
          status: { unsaved: '#ff8a80', local: '#f2c94c', cloud: '#7bc67e' },
        }
      : {
          surface: '#f4f1ea',
          text: '#252321',
          muted: '#49443f',
          line: '#655d54',
          selected: '#ddd8ce',
          accent: '#49433d',
          entryCheck: { fill: '#26712b', ink: '#ffffff' },
          status: { unsaved: '#b3261e', local: '#a36a00', cloud: '#2e7d32' },
        }),
  };
}
