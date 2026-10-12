import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Image,
  Keyboard,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import walking from '../assets/cerberus/walking.png';
import sitting from '../assets/cerberus/sitting-idle.png';
import tennis from '../assets/cerberus/tennis-ball.png';
import yarn from '../assets/cerberus/yarn-ball.png';
import food from '../assets/cerberus/food-can.png';
import backflip from '../assets/cerberus/backflip.png';
import tugSheet from '../assets/cerberus/tug-of-war.png';
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
import hitMasks from '../assets/cerberus/hit-masks.json';
import {
  isOneShot,
  nextIdle,
  nextWalk,
  type CerberusBehavior,
} from './cerberus-motion';
import { useCerberus } from './cerberus-context';
import { cueAnimationSounds } from './sounds';
import { CerberusRope } from './cerberus-rope';
import {
  HOLD_DELAY,
  HOLD_SLOP,
  hitsSprite,
  spriteOrigin,
  withinArea,
  type Point,
} from './cerberus-tug';

const sheets = {
  walking,
  'sitting-idle': sitting,
  'tennis-ball': tennis,
  'yarn-ball': yarn,
  'food-can': food,
  backflip,
  'tug-of-war': tugSheet,
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
  backflip: 49,
  'tug-of-war': 98,
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
// Rope-stub endpoints in the exported 512px cells, measured per drawn pose.
const tugMouths: Point[] = [
  { x: 117, y: 284 },
  { x: 104, y: 265 },
  { x: 112, y: 282 },
  { x: 104, y: 285 },
  { x: 117, y: 280 },
  { x: 104, y: 273 },
  { x: 119, y: 255 },
  { x: 119, y: 286 },
];

export function CerberusArtwork({ visible = true }: { visible?: boolean }) {
  const { request } = useCerberus();
  const handledRequest = useRef(0);
  const { height } = useWindowDimensions();
  const size = Math.min(240, Math.max(96, height - 620));
  const [width, setWidth] = useState(0);
  const [progress] = useState(() => new Animated.Value(0.5));
  const position = useRef(0.5);
  const behavior = useRef<CerberusBehavior | null>(null);
  const [pose, setPose] = useState({
    animation: 'sitting-idle' as CerberusBehavior['animation'],
    facingRight: false,
  });
  const [frame, setFrame] = useState(0);
  const frameIndex = useRef(0);
  const [tug, setTug] = useState<{
    finger: Point;
    facingRight: boolean;
  } | null>(null);
  const hold = useRef<{
    origin: Point;
    finger: Point;
    timer?: ReturnType<typeof setTimeout>;
    savedFrame?: number;
  } | null>(null);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [keyboardVisible, setKeyboardVisible] = useState(() =>
    Keyboard.isVisible(),
  );
  const travel = Math.max(0, width - size - 32);
  const areaHeight = size * (1 - (67 + 40) / 512) + 12;
  const interactive = visible && active && !keyboardVisible && width > 0;
  const running = interactive && reduceMotion === false && travel > 0 && !tug;
  const frameRunning =
    interactive && reduceMotion === false && (travel > 0 || !!tug);
  const displayPose = tug
    ? { animation: 'tug-of-war' as const, facingRight: tug.facingRight }
    : pose;
  const origin = spriteOrigin(
    width,
    areaHeight,
    size,
    travel,
    position.current,
    bottomPadding[displayPose.animation],
  );

  const endHold = useCallback(() => {
    const current = hold.current;
    hold.current = null;
    clearTimeout(current?.timer);
    if (current?.savedFrame !== undefined) {
      frameIndex.current = current.savedFrame;
      setFrame(current.savedFrame);
    }
    setTug(null);
  }, []);

  function startTug() {
    const current = hold.current;
    if (!current) return;
    current.savedFrame = frameIndex.current;
    frameIndex.current = 0;
    setFrame(0);
    const center = width / 2 + (position.current - 0.5) * travel;
    setTug({ finger: current.finger, facingRight: current.finger.x > center });
    progress.stopAnimation((value) => {
      if (hold.current !== current) return;
      position.current = value;
      const center = width / 2 + (value - 0.5) * travel;
      setTug({
        finger: current.finger,
        facingRight: current.finger.x > center,
      });
    });
  }

  function pointFrom(event: GestureResponderEvent): Point {
    return { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
  }

  function canHold(event: GestureResponderEvent) {
    const point = pointFrom(event);
    return (
      interactive &&
      !hold.current &&
      (event.nativeEvent.touches?.length ?? 1) === 1 &&
      withinArea(point, width, areaHeight) &&
      !hitsSprite(
        point,
        spriteOrigin(
          width,
          areaHeight,
          size,
          travel,
          position.current,
          bottomPadding[displayPose.animation],
        ),
        size,
        displayPose.facingRight,
        hitMasks[displayPose.animation][frame]!,
      )
    );
  }

  function grantHold(event: GestureResponderEvent) {
    if (!canHold(event)) return;
    const finger = pointFrom(event);
    hold.current = {
      origin: finger,
      finger,
      timer: setTimeout(startTug, HOLD_DELAY),
    };
  }

  function moveHold(event: GestureResponderEvent) {
    const current = hold.current;
    if (!current) return;
    const finger = pointFrom(event);
    if (
      !withinArea(finger, width, areaHeight) ||
      (event.nativeEvent.touches?.length ?? 1) !== 1
    ) {
      endHold();
      return;
    }
    current.finger = finger;
    if (current.savedFrame === undefined) {
      if (
        Math.hypot(finger.x - current.origin.x, finger.y - current.origin.y) >
        HOLD_SLOP
      )
        endHold();
    } else {
      const center = width / 2 + (position.current - 0.5) * travel;
      setTug({ finger, facingRight: finger.x > center });
    }
  }

  function toggleRope() {
    if (!interactive) return;
    if (tug || hold.current) endHold();
    else {
      const center = width / 2 + (position.current - 0.5) * travel;
      const finger = {
        x: center >= width / 2 ? 8 : width - 8,
        y: areaHeight / 3,
      };
      hold.current = { origin: finger, finger };
      startTug();
    }
  }

  useEffect(() => {
    const listener = progress.addListener(({ value }) => {
      position.current = value;
    });
    return () => progress.removeListener(listener);
  }, [progress]);

  useEffect(() => {
    endHold();
  }, [
    visible,
    active,
    keyboardVisible,
    width,
    size,
    request.sequence,
    endHold,
  ]);

  useEffect(
    () => () => {
      clearTimeout(hold.current?.timer);
      hold.current = null;
    },
    [],
  );

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
    let cancelCues: (() => void) | undefined;
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
      cancelCues = cueAnimationSounds(next.animation);
      frameIndex.current = timings[next.animation].length - 1;
      setFrame(frameIndex.current);
      setPose({ animation: next.animation, facingRight: next.facingRight });
    });
    return () => {
      disposed = true;
      cancelCues?.();
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
    let cancelCues: (() => void) | undefined;

    // A fresh start (not a resume after a tab change) plays the pose's sounds.
    function begin(next: CerberusBehavior, fresh = false) {
      if (disposed) return;
      if (fresh || behavior.current?.animation !== next.animation) {
        frameIndex.current = 0;
        setFrame(0);
        cancelCues?.();
        cancelCues = cueAnimationSounds(next.animation);
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
        begin(
          {
            animation: request.animation,
            facingRight: behavior.current?.facingRight ?? false,
            remaining: timings[request.animation].reduce(
              (total, duration) => total + duration,
              0,
            ),
            target: position,
          },
          true,
        );
      } else begin(behavior.current ?? nextWalk(position, travel));
    });
    return () => {
      disposed = true;
      if (behavior.current && deadline !== undefined)
        behavior.current.remaining = Math.max(0, deadline - Date.now());
      clearTimeout(idleTimer);
      movement?.stop();
      cancelCues?.();
    };
  }, [progress, running, travel, request.animation, request.sequence]);

  useEffect(() => {
    if (!frameRunning) return;
    let timer: ReturnType<typeof setTimeout>;
    const durations = timings[displayPose.animation];
    function advance() {
      timer = setTimeout(() => {
        if (
          isOneShot(displayPose.animation) &&
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
  }, [frameRunning, displayPose.animation, request.sequence]);

  if (!visible || keyboardVisible) return null;
  return (
    <View
      testID="cerberus-roaming-area"
      pointerEvents="box-only"
      accessible
      accessibilityRole="button"
      accessibilityLabel="Animal area"
      accessibilityHint="Touch and hold an empty space to hold the rope. Activate to hold or release it."
      accessibilityState={{ disabled: !interactive, selected: !!tug }}
      accessibilityActions={[
        { name: 'toggleRope', label: tug ? 'Release rope' : 'Hold rope' },
      ]}
      onAccessibilityTap={toggleRope}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'toggleRope') toggleRope();
      }}
      onStartShouldSetResponder={canHold}
      onResponderGrant={grantHold}
      onResponderMove={moveHold}
      onResponderRelease={endHold}
      onResponderTerminate={endHold}
      onResponderTerminationRequest={() => true}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{
        height: areaHeight,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: '50%',
          marginLeft: -size / 2,
          bottom: 12 - (size * bottomPadding[displayPose.animation]) / 512,
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
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: size,
            height: size,
            overflow: 'hidden',
            transform: [{ scaleX: displayPose.facingRight ? -1 : 1 }],
          }}
        >
          <Image
            source={sheets[displayPose.animation]}
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
      {tug && interactive ? (
        <CerberusRope
          width={width}
          height={areaHeight}
          finger={tug.finger}
          mouth={{
            x:
              origin.x +
              size *
                (tug.facingRight
                  ? 1 - tugMouths[frame]!.x / 512
                  : tugMouths[frame]!.x / 512),
            y: origin.y + (size * tugMouths[frame]!.y) / 512,
          }}
        />
      ) : null}
    </View>
  );
}
