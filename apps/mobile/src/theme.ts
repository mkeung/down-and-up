import { useColorScheme } from 'react-native';
export function useTheme() {
  const dark = useColorScheme() === 'dark';
  return dark
    ? {
        background: '#161917',
        surface: '#222824',
        text: '#edf0e9',
        muted: '#abb4a9',
        line: '#626e61',
        selected: '#394738',
        accent: '#c6d4bb',
      }
    : {
        background: '#f4f3ee',
        surface: '#fffef9',
        text: '#26382c',
        muted: '#697367',
        line: '#9ca696',
        selected: '#dce5d6',
        accent: '#3b5540',
      };
}
