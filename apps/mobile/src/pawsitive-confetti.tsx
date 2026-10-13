import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Keyboard,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useCerberusRequest } from './cerberus-context';

function PixelToy({ kind }: { kind: 'bone' | 'yarn' }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 24 20">
      {kind === 'bone' ? (
        <>
          <Path
            fill="#594439"
            d="M1 3H5V5H7V7H17V5H19V3H23V9H21V11H23V17H19V15H17V13H7V15H5V17H1V11H3V9H1Z"
          />
          <Path
            fill="#fff0cc"
            d="M3 5H5V7H7V9H17V7H19V5H21V7H19V13H21V15H19V13H17V11H7V13H5V15H3V13H5V7H3Z"
          />
          <Rect x={7} y={9} width={10} height={2} fill="#ffffff" />
        </>
      ) : (
        <>
          <Path
            fill="none"
            stroke="#594439"
            strokeWidth={2}
            d="M17 13H22V17H20V19H24"
          />
          <Path
            fill="#594439"
            d="M6 1H14V3H18V5H20V15H18V17H14V19H6V17H2V15H0V5H2V3H6Z"
          />
          <Path fill="#c7b8da" d="M6 3H14V5H18V15H14V17H6V15H2V5H6Z" />
          <Path
            fill="none"
            stroke="#eee3fa"
            strokeWidth={2}
            d="M4 5H6V7H8V9H10V11H12V13H14V15H16M10 3V5H12V7H14V9H16V11H18M2 9H4V11H6V13H8V15H10V17"
          />
          <Path
            fill="none"
            stroke="#8c70ad"
            strokeWidth={2}
            d="M4 13V11H6V9H8V7H10V5H14M8 17V15H10V13H12V11H14V9H16V7H18"
          />
        </>
      )}
    </Svg>
  );
}

type Burst = { sequence: number; width: number; height: number };

function FallingToys({
  burst,
  onComplete,
}: {
  burst: Burst;
  onComplete: (sequence: number) => void;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  const [particles] = useState(() =>
    Array.from({ length: 28 }, (_, index) => {
      const start = 0.02 + Math.random() * 0.22;
      const end = 0.78 + Math.random() * 0.22;
      const middle = start + (end - start) * 0.5;
      const drift = (Math.random() - 0.5) * 100;
      return {
        kind: index % 2 === 0 ? ('bone' as const) : ('yarn' as const),
        size: 26 + Math.floor(Math.random() * 15),
        left: ((index + 0.5) / 28) * Math.max(0, burst.width - 40),
        opacity: progress.interpolate({
          inputRange: [0, start, end - 0.06, end, 1],
          outputRange: [0, 1, 1, 0, 0],
        }),
        translateY: progress.interpolate({
          inputRange: [start, middle, end],
          outputRange: [-48, burst.height * 0.28, burst.height + 48],
          extrapolate: 'clamp',
        }),
        translateX: progress.interpolate({
          inputRange: [start, middle, end],
          outputRange: [0, -drift * 0.3, drift],
          extrapolate: 'clamp',
        }),
        rotate: progress.interpolate({
          inputRange: [start, end],
          outputRange: [
            `${Math.random() * 120 - 60}deg`,
            `${(index % 2 === 0 ? 1 : -1) * (180 + Math.random() * 180)}deg`,
          ],
          extrapolate: 'clamp',
        }),
      };
    }),
  );
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 2400,
      easing: Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start(({ finished }) => {
      if (finished) onComplete(burst.sequence);
    });
    return () => animation.stop();
  }, [progress, burst.sequence, onComplete]);
  return (
    <View
      testID="pawsitive-confetti"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
    >
      {particles.map((particle, index) => (
        <Animated.View
          key={index}
          testID={`confetti-${particle.kind}`}
          style={{
            position: 'absolute',
            top: 0,
            left: particle.left,
            width: particle.size,
            height: particle.size,
            opacity: particle.opacity,
            transform: [
              { translateX: particle.translateX },
              { translateY: particle.translateY },
              { rotate: particle.rotate },
            ],
          }}
        >
          <PixelToy kind={particle.kind} />
        </Animated.View>
      ))}
    </View>
  );
}

export function PawsitiveConfetti({ visible }: { visible: boolean }) {
  const request = useCerberusRequest();
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [keyboardVisible, setKeyboardVisible] = useState(() =>
    Keyboard.isVisible(),
  );
  const [burst, setBurst] = useState<Burst | null>(null);
  const seen = useRef(request.sequence);
  const pending = useRef<number | null>(null);
  useEffect(() => setBurst(null), [width, height]);
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
        /* Leave decorative motion off if the preference cannot be read. */
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
  useEffect(() => {
    if (request.sequence !== seen.current) {
      seen.current = request.sequence;
      pending.current =
        request.animation === 'food-can' || request.animation === 'backflip'
          ? request.sequence
          : null;
      setBurst(null);
    }
    if (!visible || !active || reduceMotion !== false) {
      pending.current = null;
      setBurst(null);
      return;
    }
    if (keyboardVisible) {
      setBurst(null);
      return;
    }
    if (pending.current !== null) {
      setBurst({ sequence: pending.current, width, height });
      pending.current = null;
    }
  }, [
    request.sequence,
    request.animation,
    visible,
    active,
    reduceMotion,
    keyboardVisible,
    width,
    height,
  ]);
  const complete = useCallback((sequence: number) => {
    setBurst((current) => (current?.sequence === sequence ? null : current));
  }, []);
  return burst && burst.width === width && burst.height === height ? (
    <FallingToys key={burst.sequence} burst={burst} onComplete={complete} />
  ) : null;
}
