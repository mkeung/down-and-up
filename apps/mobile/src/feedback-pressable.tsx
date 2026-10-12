import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { playSound } from './sounds';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function FeedbackPressable({
  disabled,
  style,
  onPress,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [pressed, setPressed] = useState(false);
  // Keep movement off until the phone's preference is known.
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let alive = true;
    let receivedChange = false;
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        receivedChange = true;
        setReduceMotion(value);
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive && !receivedChange) setReduceMotion(value);
      })
      .catch(() => {
        /* Keep movement off if the preference cannot be read. */
      });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const toValue = pressed && !disabled ? 1 : 0;
    if (reduceMotion) {
      progress.setValue(toValue);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue,
      duration: toValue ? 70 : 120,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [disabled, pressed, progress, reduceMotion]);

  // Interpolations are native-driven nodes; rebuild them only when their
  // inputs change rather than on every parent render.
  const baseStyle = useMemo(() => StyleSheet.flatten(style), [style]);
  const opacity =
    typeof baseStyle?.opacity === 'number' ? baseStyle.opacity : 1;
  const pressedOpacity = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [opacity, opacity * 0.78],
      }),
    [progress, opacity],
  );
  const translateY = useMemo(
    () =>
      reduceMotion
        ? 0
        : progress.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }),
    [progress, reduceMotion],
  );
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPress={
        onPress &&
        ((event) => {
          playSound('click');
          onPress(event);
        })
      }
      onPressIn={(event) => {
        if (disabled) return;
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      style={[
        style,
        {
          opacity: pressedOpacity,
          transform: [
            ...(Array.isArray(baseStyle?.transform) ? baseStyle.transform : []),
            { translateY },
          ],
        },
      ]}
    />
  );
}
