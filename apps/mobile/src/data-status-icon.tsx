import { Pressable, type ColorValue } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { DATA_STATUS_TEXT, type DataStatus } from './data-status';
import { useApp } from './app-context';
import { useTheme } from './theme';

// Integer-only contours keep all three states crisp and distinct without color.
function Glyph({ status, color }: { status: DataStatus; color: ColorValue }) {
  const paths = {
    unsaved:
      'M6 2h12v2h2v2h2v12h-2v2h-2v2H6v-2H4v-2H2V6h2V4h2z M6 4v2H4v12h2v2h12v-2h2V6h-2V4z M11 6h2v8h-2z M11 16h2v2h-2z',
    local: 'M6 2h12v20H6z M8 4v16h8V4z M10 16h4v2h-4z',
    cloud:
      'M8 3h8v2h2v2h2v3h2v2h2v6h-2v2H2v-2H0v-6h2v-2h3V7h3z M10 5v2H8v5H4v2H2v2h2v2h16v-2h2v-2h-2v-2h-2V9h-2V7h-2V5z M7 12h2v2h2v-2h2v-2h2V8h2v4h-2v2h-2v2H9v-2H7z',
  };
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" accessible={false}>
      <Path d={paths[status]} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function DataStatusButton() {
  const { dataStatus } = useApp();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings"
      accessibilityValue={{ text: DATA_STATUS_TEXT[dataStatus] }}
      testID={`data-status-${dataStatus}`}
      onPress={() => router.navigate('/settings')}
      style={{
        alignSelf: 'flex-end',
        marginBottom: -16,
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Glyph status={dataStatus} color={theme.status[dataStatus]} />
    </Pressable>
  );
}
