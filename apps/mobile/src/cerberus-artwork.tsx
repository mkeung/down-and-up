import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Image,
  Keyboard,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import character from '../assets/cerberus.png';

const SIZE = 120;

export function CerberusArtwork() {
  const [width, setWidth] = useState(0);
  const [progress] = useState(() => new Animated.Value(0.5));
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [keyboardVisible, setKeyboardVisible] = useState(() =>
    Keyboard.isVisible(),
  );
  const travel = Math.max(0, width - SIZE - 32);

  useEffect(() => {
    let alive = true;
    let receivedChange = false;
    const motion = AccessibilityInfo.addEventListener(
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
    const state = AppState.addEventListener('change', (value) =>
      setActive(value === 'active'),
    );
    const show = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardVisible(false),
    );
    return () => {
      alive = false;
      motion.remove();
      state.remove();
      show.remove();
      hide.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      progress.setValue(0.5);
      if (reduceMotion !== false || !active || keyboardVisible || travel === 0)
        return;
      const duration = Math.max(6000, travel * 35);
      const wander = Animated.loop(
        Animated.sequence([
          Animated.timing(progress, {
            toValue: 1,
            duration,
            delay: 800,
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.timing(progress, {
            toValue: 0,
            duration,
            delay: 1200,
            useNativeDriver: true,
            isInteraction: false,
          }),
        ]),
        { resetBeforeIteration: false },
      );
      wander.start();
      return () => wander.stop();
    }, [progress, reduceMotion, active, keyboardVisible, travel]),
  );

  if (keyboardVisible) return null;
  return (
    <View
      testID="cerberus-roaming-area"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height: SIZE + 8, flexShrink: 0 }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: '50%',
          marginLeft: -SIZE / 2,
          bottom: 4,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-travel / 2, travel / 2],
                extrapolate: 'clamp',
              }),
            },
          ],
        }}
      >
        <Image
          source={character}
          accessible={false}
          resizeMode="contain"
          style={{ width: SIZE, height: SIZE }}
        />
      </Animated.View>
    </View>
  );
}
