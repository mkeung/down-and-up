import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Image,
  Keyboard,
  View,
  useWindowDimensions,
} from 'react-native';
import walking from '../assets/cerberus/walking.png';
import sitting from '../assets/cerberus/sitting-idle.png';
import tennis from '../assets/cerberus/tennis-ball.png';
import yarn from '../assets/cerberus/yarn-ball.png';
import food from '../assets/cerberus/food-can.png';
import timings from '../assets/cerberus/timings.json';
import { nextIdle, nextWalk, type CerberusBehavior } from './cerberus-motion';
import { useCerberus } from './cerberus-context';

const sheets = {
  walking,
  'sitting-idle': sitting,
  'tennis-ball': tennis,
  'yarn-ball': yarn,
  'food-can': food,
};
// Empty rows below the visible artwork in each 512px frame sequence.
const bottomPadding = {
  walking: 84,
  'sitting-idle': 71,
  'tennis-ball': 88,
  'yarn-ball': 67,
  'food-can': 75,
};

export function CerberusArtwork({ visible = true }: { visible?: boolean }) {
  const { foodRequest } = useCerberus();
  const handledFoodRequest = useRef(0);
  const { height } = useWindowDimensions();
  const size = Math.min(240, Math.max(96, height - 620));
  const [width, setWidth] = useState(0);
  const [progress] = useState(() => new Animated.Value(0.5));
  const behavior = useRef<CerberusBehavior | null>(null);
  const [pose, setPose] = useState({
    animation: 'sitting-idle' as CerberusBehavior['animation'],
    facingRight: false,
  });
  const [frame, setFrame] = useState(0);
  const frameIndex = useRef(0);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [keyboardVisible, setKeyboardVisible] = useState(() =>
    Keyboard.isVisible(),
  );
  const travel = Math.max(0, width - size - 32);
  const running =
    visible &&
    reduceMotion === false &&
    active &&
    !keyboardVisible &&
    travel > 0;

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

  useEffect(() => {
    if (!running) return;
    let disposed = false;
    let deadline: number | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let movement: Animated.CompositeAnimation | undefined;

    function begin(next: CerberusBehavior) {
      if (disposed) return;
      if (behavior.current?.animation !== next.animation) {
        frameIndex.current = 0;
        setFrame(0);
      }
      behavior.current = next;
      setPose({ animation: next.animation, facingRight: next.facingRight });
      deadline = Date.now() + next.remaining;
      if (next.animation === 'walking') {
        movement = Animated.timing(progress, {
          toValue: next.target,
          duration: next.remaining,
          easing: Easing.linear,
          useNativeDriver: true,
          isInteraction: false,
        });
        movement.start(({ finished }) => {
          if (finished && !disposed) begin(nextIdle(next));
        });
      } else {
        idleTimer = setTimeout(
          () => begin(nextWalk(next.target, travel)),
          next.remaining,
        );
      }
    }

    // Read the native driver's stopped position before resuming a walking leg.
    progress.stopAnimation((position) => {
      if (disposed) return;
      if (foodRequest > handledFoodRequest.current) {
        handledFoodRequest.current = foodRequest;
        frameIndex.current = 0;
        setFrame(0);
        begin({
          animation: 'food-can',
          facingRight: behavior.current?.facingRight ?? false,
          remaining: timings['food-can'].reduce(
            (total, duration) => total + duration,
            0,
          ),
          target: position,
        });
      } else begin(behavior.current ?? nextWalk(position, travel));
    });
    return () => {
      disposed = true;
      if (behavior.current && deadline !== undefined)
        behavior.current.remaining = Math.max(0, deadline - Date.now());
      clearTimeout(idleTimer);
      movement?.stop();
    };
  }, [progress, running, travel, foodRequest]);

  useEffect(() => {
    if (!running) return;
    let timer: ReturnType<typeof setTimeout>;
    const durations = timings[pose.animation];
    function advance() {
      timer = setTimeout(() => {
        if (
          pose.animation === 'food-can' &&
          frameIndex.current === durations.length - 1
        )
          return;
        frameIndex.current = (frameIndex.current + 1) % durations.length;
        setFrame(frameIndex.current);
        advance();
      }, durations[frameIndex.current]);
    }
    advance();
    return () => clearTimeout(timer);
  }, [running, pose.animation, foodRequest]);

  if (!visible || keyboardVisible) return null;
  return (
    <View
      testID="cerberus-roaming-area"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{
        height: size * (1 - (67 + 40) / 512) + 12,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: '50%',
          marginLeft: -size / 2,
          bottom: 12 - (size * bottomPadding[pose.animation]) / 512,
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
        <View
          testID="cerberus-sprite"
          accessible={false}
          style={{
            width: size,
            height: size,
            overflow: 'hidden',
            transform: [{ scaleX: pose.facingRight ? -1 : 1 }],
          }}
        >
          <Image
            source={sheets[pose.animation]}
            accessible={false}
            fadeDuration={0}
            resizeMode="stretch"
            style={{
              position: 'absolute',
              width: size * 4,
              height: size * 2,
              left: -(frame % 4) * size,
              top: -Math.floor(frame / 4) * size,
            }}
          />
        </View>
      </Animated.View>
    </View>
  );
}
