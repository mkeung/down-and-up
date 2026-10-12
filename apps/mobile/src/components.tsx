import type { ReactNode } from 'react';
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from './theme';
export function Action({
  label,
  onPress,
  disabled = false,
  selected = false,
  style,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
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
          borderRadius: 12,
          borderWidth: selected ? 2 : 1,
          borderColor: theme.line,
          backgroundColor: selected ? theme.selected : theme.surface,
          opacity: disabled ? 0.4 : 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        style,
      ]}
    >
      {children ?? (
        <Text
          style={{
            color: theme.text,
            fontSize: 16,
            fontWeight: selected ? '700' : '500',
          }}
        >
          {label}
        </Text>
      )}
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
