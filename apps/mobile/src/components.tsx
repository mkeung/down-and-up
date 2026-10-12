import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './theme';
import { PixelBackdrop, PixelCheck, PixelText } from './retro';
export function Action({
  label,
  onPress,
  disabled = false,
  selected = false,
  showSelectionMark = false,
  style,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  showSelectionMark?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          minHeight: 48,
          paddingVertical: 12,
          paddingHorizontal: 16,
          opacity: disabled ? 0.4 : 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        style,
      ]}
    >
      <PixelBackdrop selected={selected} />
      {children ?? (
        <PixelText
          style={{
            color: theme.text,
            fontSize: 16,
            textAlign: 'center',
          }}
        >
          {label}
        </PixelText>
      )}
      {selected && showSelectionMark ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', bottom: 12, right: 12 }}
        >
          <PixelCheck color={theme.text} size={12} />
        </View>
      ) : null}
    </Pressable>
  );
}
export function Row({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
      }}
    >
      {children}
    </View>
  );
}
