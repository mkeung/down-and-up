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
import reaction01 from '../assets/cerberus/reaction-01.png';
import reaction02 from '../assets/cerberus/reaction-02.png';
import reaction03 from '../assets/cerberus/reaction-03.png';
import reaction04 from '../assets/cerberus/reaction-04.png';
import reaction05 from '../assets/cerberus/reaction-05.png';
import reaction06 from '../assets/cerberus/reaction-06.png';
import reaction07 from '../assets/cerberus/reaction-07.png';
import reaction08 from '../assets/cerberus/reaction-08.png';
import reaction09 from '../assets/cerberus/reaction-09.png';
import reaction10 from '../assets/cerberus/reaction-10.png';
import timings from '../assets/cerberus/timings.json';
import {
  isOneShot,
  nextIdle,
  nextWalk,
  type CerberusBehavior,
} from './cerberus-motion';
import { useCerberus } from './cerberus-context';

const sheets = {
  walking,
  'sitting-idle': sitting,
  'tennis-ball': tennis,
  'yarn-ball': yarn,
  'food-can': food,
  'reaction-01': reaction01,
  'reaction-02': reaction02,
  'reaction-03': reaction03,
  'reaction-04': reaction04,
  'reaction-05': reaction05,
  'reaction-06': reaction06,
  'reaction-07': reaction07,
  'reaction-08': reaction08,
  'reaction-09': reaction09,
  'reaction-10': reaction10,
};
// Empty rows below the visible artwork in each 512px frame sequence.
const bottomPadding = {
  walking: 84,
  'sitting-idle': 71,
  'tennis-ball': 88,
  'yarn-ball': 67,
  'food-can': 75,
  'reaction-01': 83,
  'reaction-02': 79,
  'reaction-03': 74,
  'reaction-04': 72,
  'reaction-05': 88,
  'reaction-06': 86,
  'reaction-07': 71,
  'reaction-08': 90,
  'reaction-09': 97,
  'reaction-10': 83,
};

export function CerberusArtwork({ visible = true }: { visible?: boolean }) {
  const { request } = useCerberus();
  const handledRequest = useRef(0);
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
    if (
      !visible ||
      !active ||
      keyboardVisible ||
      reduceMotion !== true ||
      !request.animation ||
      request.sequence <= handledRequest.current
    )
      return;
    let disposed = false;
    progress.stopAnimation((position) => {
      if (disposed || !request.animation) return;
      handledRequest.current = request.sequence;
      const next = {
        animation: request.animation,
        facingRight: behavior.current?.facingRight ?? false,
        remaining: 0,
        target: position,
      };
      behavior.current = next;
      frameIndex.current = timings[next.animation].length - 1;
      setFrame(frameIndex.current);
      setPose({ animation: next.animation, facingRight: next.facingRight });
    });
    return () => {
      disposed = true;
    };
  }, [
    visible,
    active,
    keyboardVisible,
    reduceMotion,
    request.animation,
    request.sequence,
    progress,
  ]);

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
      if (request.animation && request.sequence > handledRequest.current) {
        handledRequest.current = request.sequence;
        frameIndex.current = 0;
        setFrame(0);
        begin({
          animation: request.animation,
          facingRight: behavior.current?.facingRight ?? false,
          remaining: timings[request.animation].reduce(
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
  }, [progress, running, travel, request.animation, request.sequence]);

  useEffect(() => {
    if (!running) return;
    let timer: ReturnType<typeof setTimeout>;
    const durations = timings[pose.animation];
    function advance() {
      timer = setTimeout(() => {
        if (
          isOneShot(pose.animation) &&
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
  }, [running, pose.animation, request.sequence]);

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
