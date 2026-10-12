import { createContext, useContext } from 'react';
import {
  Text,
  View,
  type ColorValue,
  type TextProps,
  type ViewProps,
} from 'react-native';
import { useTheme } from './theme';

export const PixelFontContext = createContext(false);
const pixelType = {
  fontFamily: 'PixelifySans',
  fontWeight: '400' as const,
};

export function usePixelType() {
  return useContext(PixelFontContext) ? pixelType : undefined;
}

export function PixelText({ style, ...props }: TextProps) {
  return <Text {...props} style={[usePixelType(), style]} />;
}

// Three overlapping rectangles make two square steps at every corner.
function StepLayer({
  color,
  inset = 0,
}: {
  color: ColorValue;
  inset?: number;
}) {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={{
        position: 'absolute',
        top: inset,
        bottom: inset,
        left: inset,
        right: inset,
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 8,
          bottom: 8,
          left: 0,
          right: 0,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 4,
          bottom: 4,
          left: 4,
          right: 4,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 8,
          right: 8,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function PixelBackdrop({
  selected = false,
  fill,
}: {
  selected?: boolean;
  fill?: ColorValue;
}) {
  const theme = useTheme();
  const surface = fill ?? (selected ? theme.selected : theme.surface);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
    >
      <View
        style={{ position: 'absolute', top: 4, bottom: -4, left: 0, right: 0 }}
      >
        <StepLayer color={theme.line} />
      </View>
      <StepLayer color={selected ? theme.text : theme.line} />
      <StepLayer color={surface} inset={2} />
      {selected ? (
        <>
          <StepLayer color={theme.text} inset={6} />
          <StepLayer color={surface} inset={8} />
        </>
      ) : null}
    </View>
  );
}

export function PixelPanel({ children, style, ...props }: ViewProps) {
  return (
    <View {...props} style={[{ padding: 16 }, style]}>
      <PixelBackdrop />
      {children}
    </View>
  );
}

export function PixelCheck({
  color,
  size = 18,
}: {
  color: ColorValue;
  size?: number;
}) {
  return (
    <View accessible={false} style={{ width: size, height: size }}>
      {[
        [0, 3],
        [1, 4],
        [2, 3],
        [3, 2],
        [4, 1],
      ].map(([x, y]) => (
        <View
          key={x}
          style={{
            position: 'absolute',
            left: (x! * size) / 5,
            top: (y! * size) / 5,
            width: size / 5,
            height: size / 5,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

export function PixelChevron({
  direction,
  color,
}: {
  direction: 'left' | 'right';
  color: ColorValue;
}) {
  return (
    <View accessible={false} style={{ width: 20, height: 28 }}>
      {[2, 1, 0, 1, 2].map((x, row) => (
        <View
          key={row}
          style={{
            position: 'absolute',
            left: (direction === 'left' ? x : 2 - x) * 4 + 4,
            top: row * 4 + 4,
            width: 4,
            height: 4,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}
