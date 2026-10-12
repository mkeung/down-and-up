import { View } from 'react-native';
import { PixelCheck } from './retro';
import { useTheme } from './theme';

export function EntryCheck() {
  const theme = useTheme();
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: theme.entryCheck.fill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <PixelCheck color={theme.entryCheck.ink} size={12} />
    </View>
  );
}
