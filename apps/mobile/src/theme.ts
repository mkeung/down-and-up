import { useContext } from 'react';
import { useColorScheme } from 'react-native';
import { ThemeContext } from './theme-preference';
import { themeColors } from './themes';
export function useTheme() {
  const dark = useColorScheme() === 'dark';
  const preference = useContext(ThemeContext);
  return themeColors(preference?.id ?? 'neutral', dark);
}
