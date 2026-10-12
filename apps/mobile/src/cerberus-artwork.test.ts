import { createElement } from 'react';
import { Animated, Image } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CerberusArtwork } from './cerberus-artwork';
import { RetroTabBar } from './retro-tab-bar';
import type { CerberusRequest } from './cerberus-context';
import { reactionAnimations } from './cerberus-motion';

const mocks = vi.hoisted(() => ({
  reduceMotion: false,
  windowHeight: 874,
  request: { sequence: 0, animation: null } as CerberusRequest,
  query: vi.fn(),
  motionChanged: null as ((value: boolean) => void) | null,
  appChanged: null as ((value: string) => void) | null,
  keyboard: new Map<string, () => void>(),
  remove: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  timing: vi.fn(),
  setValue: vi.fn(),
  interpolate: vi.fn(),
  values: [] as { value: number }[],
  movements: [] as {
    value: { value: number };
    config: { toValue: number; duration: number };
    finish?: (result: { finished: boolean }) => void;
  }[],
}));
vi.mock('../assets/cerberus/walking.png', () => ({ default: 1 }));
vi.mock('../assets/cerberus/sitting-idle.png', () => ({ default: 2 }));
vi.mock('../assets/cerberus/tennis-ball.png', () => ({ default: 3 }));
vi.mock('../assets/cerberus/yarn-ball.png', () => ({ default: 4 }));
vi.mock('../assets/cerberus/food-can.png', () => ({ default: 5 }));
vi.mock('../assets/cerberus/reaction-01.png', () => ({ default: 11 }));
vi.mock('../assets/cerberus/reaction-02.png', () => ({ default: 12 }));
vi.mock('../assets/cerberus/reaction-03.png', () => ({ default: 13 }));
vi.mock('../assets/cerberus/reaction-04.png', () => ({ default: 14 }));
vi.mock('../assets/cerberus/reaction-05.png', () => ({ default: 15 }));
vi.mock('../assets/cerberus/reaction-06.png', () => ({ default: 16 }));
vi.mock('../assets/cerberus/reaction-07.png', () => ({ default: 17 }));
vi.mock('../assets/cerberus/reaction-08.png', () => ({ default: 18 }));
vi.mock('../assets/cerberus/reaction-09.png', () => ({ default: 19 }));
vi.mock('../assets/cerberus/reaction-10.png', () => ({ default: 20 }));
vi.mock('./cerberus-context', () => ({
  useCerberus: () => ({ request: mocks.request }),
}));
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }));
vi.mock('./theme', () => ({ useTheme: () => ({ background: '#f5e8ad' }) }));
vi.mock('react-native', () => ({
  useWindowDimensions: () => ({ height: mocks.windowHeight }),
  View: 'View',
  Pressable: 'Pressable',
  Text: 'Text',
  Image: 'Image',
  Easing: { linear: 'linear' },
  Animated: {
    View: 'AnimatedView',
    Value: class {
      value: number;
      constructor(value: number) {
        this.value = value;
        mocks.values.push(this);
      }
      setValue(value: number) {
        this.value = value;
        mocks.setValue(value);
      }
      stopAnimation(callback: (value: number) => void) {
        callback(this.value);
      }
      interpolate = mocks.interpolate;
    },
    timing: mocks.timing,
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: mocks.query,
    addEventListener: (_event: string, callback: (value: boolean) => void) => {
      mocks.motionChanged = callback;
      return { remove: mocks.remove };
    },
  },
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, callback: (value: string) => void) => {
      mocks.appChanged = callback;
      return { remove: mocks.remove };
    },
  },
  Keyboard: {
    isVisible() {
      if (!this) throw new Error('Keyboard receiver is required');
      return false;
    },
    addListener: (event: string, callback: () => void) => {
      mocks.keyboard.set(event, callback);
      return { remove: mocks.remove };
    },
  },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
const area = () =>
  renderer.root.findByProps({ testID: 'cerberus-roaming-area' });
const sprite = () => renderer.root.findByProps({ testID: 'cerberus-sprite' });
const image = () => renderer.root.findByType(Image);
async function mount(width = 360) {
  await act(async () => {
    renderer = create(createElement(CerberusArtwork));
  });
  await act(async () =>
    area().props.onLayout({ nativeEvent: { layout: { width } } }),
  );
}
async function finishWalk() {
  await act(async () => {
    const movement = mocks.movements.at(-1)!;
    movement.value.value = movement.config.toValue;
    movement.finish!({ finished: true });
  });
}
async function advance(milliseconds: number) {
  await act(async () => {
    vi.advanceTimersByTime(milliseconds);
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.spyOn(Math, 'random').mockReturnValue(0.1);
  mocks.reduceMotion = false;
  mocks.windowHeight = 874;
  mocks.request = { sequence: 0, animation: null };
  mocks.keyboard.clear();
  mocks.values.length = 0;
  mocks.movements.length = 0;
  mocks.query.mockImplementation(async () => mocks.reduceMotion);
  mocks.timing.mockImplementation((value, config) => {
    const movement = { value, config } as (typeof mocks.movements)[number];
    mocks.movements.push(movement);
    return {
      start: (callback: (result: { finished: boolean }) => void) => {
        movement.finish = callback;
        mocks.start();
      },
      stop: () => {
        mocks.stop();
        movement.finish?.({ finished: false });
      },
    };
  });
  mocks.interpolate.mockReturnValue('interpolated');
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('shows a larger walking sprite inside the available width without intercepting touches or accessibility', async () => {
  await mount();
  expect(area().props.pointerEvents).toBe('none');
  expect(area().props.accessibilityElementsHidden).toBe(true);
  expect(area().props.style.backgroundColor).toBeUndefined();
  expect(area().props.style.borderWidth).toBeUndefined();
  expect(sprite().props.style).toMatchObject({ width: 240, height: 240 });
  expect(image().props.source).toBe(1);
  expect(mocks.interpolate).toHaveBeenLastCalledWith({
    inputRange: [0, 1],
    outputRange: [-44, 44],
    extrapolate: 'clamp',
  });
  expect(mocks.start).toHaveBeenCalledTimes(1);
  expect(mocks.timing.mock.calls[0]![1]).toMatchObject({
    easing: 'linear',
    useNativeDriver: true,
    isInteraction: false,
  });
  await act(async () =>
    area().props.onLayout({ nativeEvent: { layout: { width: 320 } } }),
  );
  expect(mocks.stop).toHaveBeenCalledTimes(1);
  expect(mocks.interpolate).toHaveBeenLastCalledWith({
    inputRange: [0, 1],
    outputRange: [-24, 24],
    extrapolate: 'clamp',
  });
});

it('advances the walking sheet using its timing and loops all eight frames', async () => {
  await mount();
  expect(image().props.style).toMatchObject({ left: -0, top: -0 });
  await advance(160);
  expect(image().props.style).toMatchObject({ left: -240, top: -0 });
  await advance(480);
  expect(image().props.style).toMatchObject({ left: -0, top: -240 });
  await advance(640);
  expect(image().props.style).toMatchObject({ left: -0, top: -0 });
});

it.each([667, 402])(
  'leaves room for controls on a short %spt screen',
  async (height) => {
    mocks.windowHeight = height;
    await mount();
    expect(sprite().props.style.width).toBe(96);
    expect(area().props.style.height).toBeCloseTo(87.9375);
    expect(area().props.style.height).toBeLessThan(sprite().props.style.height);
    expect(area().props.pointerEvents).toBe('none');
  },
);

it('keeps the lowest paw 12pt above the tabs for sitting and walking, using the transparent sheet margins', async () => {
  await mount();
  const position = () => renderer.root.findByType(Animated.View).props.style;
  expect(position().bottom + (240 * 84) / 512).toBe(12);
  await finishWalk();
  expect(position().bottom + (240 * 71) / 512).toBe(12);
  expect(area().props.style.height).toBeCloseTo(201.84375);
});

it.each([
  [0.1, 2, 14000],
  [0.7, 3, 4500],
  [0.9, 4, 4500],
])(
  'stops to sit or play, retaining its right-facing orientation (choice %s)',
  async (choice, source, duration) => {
    await mount();
    expect(sprite().props.style.transform).toEqual([{ scaleX: -1 }]);
    vi.mocked(Math.random).mockReturnValueOnce(choice).mockReturnValue(0);
    await finishWalk();
    expect(image().props.source).toBe(source);
    expect(image().props.style).toMatchObject({ left: -0, top: -0 });
    await advance(500);
    expect(image().props.style.left).not.toBe(0);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(sprite().props.style.transform).toEqual([{ scaleX: -1 }]);
    await advance(duration - 501);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(image().props.source).toBe(1);
    expect(mocks.start).toHaveBeenCalledTimes(2);
  },
);

it('keeps left-facing play unflipped and turns right at the left edge', async () => {
  vi.mocked(Math.random).mockReturnValue(0.9);
  await mount();
  expect(mocks.movements[0]!.config.toValue).toBe(0);
  expect(sprite().props.style.transform).toEqual([{ scaleX: 1 }]);
  await finishWalk();
  expect(image().props.source).toBe(4);
  expect(sprite().props.style.transform).toEqual([{ scaleX: 1 }]);
  await advance(8550);
  expect(image().props.source).toBe(1);
  expect(sprite().props.style.transform).toEqual([{ scaleX: -1 }]);
});

it('freezes both movement and frame playback for Reduce Motion, including read failures', async () => {
  mocks.reduceMotion = true;
  await mount();
  expect(mocks.start).not.toHaveBeenCalled();
  expect(image().props.source).toBe(2);
  await advance(10000);
  expect(image().props.style.left).toBe(-0);
  await act(async () => mocks.motionChanged!(false));
  expect(mocks.start).toHaveBeenCalledTimes(1);
  await advance(160);
  await act(async () => mocks.motionChanged!(true));
  expect(mocks.stop).toHaveBeenCalledTimes(1);
  const frozen = image().props.style;
  await advance(10000);
  expect(image().props.style).toEqual(frozen);
  await act(async () => renderer.unmount());
  mocks.start.mockClear();
  mocks.query.mockRejectedValueOnce(new Error('Unavailable'));
  await mount();
  expect(mocks.start).not.toHaveBeenCalled();
});

it('pauses when backgrounded, hidden, or editing a note and cleans up on unmount', async () => {
  await mount();
  await act(async () => mocks.appChanged!('background'));
  expect(mocks.stop).toHaveBeenCalledTimes(1);
  await act(async () => mocks.appChanged!('active'));
  expect(mocks.start).toHaveBeenCalledTimes(2);
  await act(async () =>
    renderer.update(createElement(CerberusArtwork, { visible: false })),
  );
  expect(mocks.stop).toHaveBeenCalledTimes(2);
  await act(async () =>
    renderer.update(createElement(CerberusArtwork, { visible: true })),
  );
  expect(mocks.start).toHaveBeenCalledTimes(3);
  await act(async () => mocks.keyboard.get('keyboardDidShow')!());
  expect(renderer.toJSON()).toBeNull();
  expect(mocks.stop).toHaveBeenCalledTimes(3);
  await act(async () => mocks.keyboard.get('keyboardDidHide')!());
  expect(area()).toBeDefined();
  expect(mocks.start).toHaveBeenCalledTimes(4);
  await act(async () => renderer.unmount());
  expect(mocks.stop).toHaveBeenCalledTimes(4);
  expect(mocks.remove).toHaveBeenCalledTimes(4);
});

it('retains the remaining seated pause, frame, and facing direction across a long background', async () => {
  await mount();
  vi.mocked(Math.random).mockReturnValueOnce(0).mockReturnValue(0.5);
  await finishWalk();
  // An ordinary seated pause lasts seven seconds with this random source.
  await advance(2000);
  await act(async () => mocks.appChanged!('background'));
  const frozen = image().props.style;
  await advance(60000);
  expect(image().props.style).toEqual(frozen);
  await act(async () => mocks.appChanged!('active'));
  expect(image().props.source).toBe(2);
  expect(sprite().props.style.transform).toEqual([{ scaleX: -1 }]);
  expect(image().props.style).toEqual(frozen);
  await advance(4999);
  expect(image().props.source).toBe(2);
  await advance(1);
  expect(image().props.source).toBe(1);
});

it('ignores a walking completion delivered after the app was paused', async () => {
  await mount();
  await act(async () => mocks.appChanged!('background'));
  await finishWalk();
  expect(image().props.source).toBe(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('plays food once after keyboard dismissal, preserving its facing and holding the final pose until completion', async () => {
  await mount();
  expect(sprite().props.style.transform).toEqual([{ scaleX: -1 }]);
  await act(async () => mocks.keyboard.get('keyboardDidShow')!());
  mocks.request = { sequence: 1, animation: 'food-can' };
  await act(async () => renderer.update(createElement(CerberusArtwork)));
  expect(renderer.toJSON()).toBeNull();
  await act(async () => mocks.keyboard.get('keyboardDidHide')!());
  expect(image().props.source).toBe(5);
  expect(sprite().props.style.transform).toEqual([{ scaleX: -1 }]);
  await advance(1900);
  expect(image().props.style).toMatchObject({ left: -720, top: -240 });
  await advance(699);
  expect(image().props.source).toBe(5);
  expect(image().props.style).toMatchObject({ left: -720, top: -240 });
  await advance(1);
  expect(image().props.source).toBe(1);
});

it.each(reactionAnimations)(
  'plays %s once at the current position and facing before resuming walking',
  async (animation) => {
    await mount();
    const progress = mocks.values[0]!;
    progress.value = 0.7;
    mocks.request = { sequence: 1, animation };
    await act(async () => renderer.update(createElement(CerberusArtwork)));
    const source = 11 + reactionAnimations.indexOf(animation);
    expect(image().props.source).toBe(source);
    expect(progress.value).toBe(0.7);
    expect(sprite().props.style.transform).toEqual([{ scaleX: -1 }]);
    expect(mocks.stop).toHaveBeenCalledTimes(1);
    await advance(1240);
    expect(image().props.style).toMatchObject({ left: -720, top: -240 });
    await advance(649);
    expect(image().props.source).toBe(source);
    await advance(1);
    expect(image().props.source).toBe(1);
  },
);

it('replaces a playing reaction with the latest request without changing its left-facing orientation', async () => {
  vi.mocked(Math.random).mockReturnValue(0.9);
  await mount();
  mocks.request = { sequence: 1, animation: 'reaction-01' };
  await act(async () => renderer.update(createElement(CerberusArtwork)));
  await advance(460);
  mocks.request = { sequence: 2, animation: 'reaction-10' };
  await act(async () => renderer.update(createElement(CerberusArtwork)));
  expect(image().props.source).toBe(20);
  expect(image().props.style).toMatchObject({ left: -0, top: -0 });
  expect(sprite().props.style.transform).toEqual([{ scaleX: 1 }]);
});

it('shows the final reaction pose without animation for Reduce Motion', async () => {
  mocks.reduceMotion = true;
  await mount();
  mocks.request = { sequence: 1, animation: 'reaction-10' };
  await act(async () => renderer.update(createElement(CerberusArtwork)));
  expect(image().props.source).toBe(20);
  expect(image().props.style).toMatchObject({ left: -720, top: -240 });
  expect(mocks.start).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('waits for the accessibility preference and stays still in a narrow space', async () => {
  let finish!: (value: boolean) => void;
  mocks.query.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  await mount();
  expect(mocks.start).not.toHaveBeenCalled();
  await act(async () => finish(false));
  expect(mocks.start).toHaveBeenCalledTimes(1);
  await act(async () =>
    area().props.onLayout({ nativeEvent: { layout: { width: 120 } } }),
  );
  expect(mocks.stop).toHaveBeenCalledTimes(1);
  expect(mocks.start).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps one animation and its current position when switching tabs, including the first visit', async () => {
  const props = {
    state: {
      index: 0,
      routes: [
        { key: 'rate', name: 'index' },
        { key: 'note', name: 'pawsitive' },
        { key: 'settings', name: 'settings' },
      ],
    },
    navigation: { emit: vi.fn(), navigate: vi.fn() },
    insets: { top: 0, left: 0, right: 0, bottom: 34 },
  };
  const tree = () =>
    createElement(
      RetroTabBar,
      props as unknown as Parameters<typeof RetroTabBar>[0],
    );
  await act(async () => {
    renderer = create(tree());
  });
  await act(async () =>
    area().props.onLayout({ nativeEvent: { layout: { width: 360 } } }),
  );
  expect(mocks.start).toHaveBeenCalledTimes(1);
  const progress = mocks.values[0]!;
  // Simulate the native driver moving the animal partway across the screen.
  progress.value = 0.8;
  for (const index of [1, 0, 1]) {
    props.state.index = index;
    await act(async () => renderer.update(tree()));
    expect(mocks.values).toHaveLength(1);
    expect(mocks.values[0]).toBe(progress);
    expect(progress.value).toBe(0.8);
    expect(mocks.setValue).not.toHaveBeenCalled();
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(mocks.stop).not.toHaveBeenCalled();
  }
  // Hidden routes pause the same animal; returning keeps its last position.
  props.state.index = 2;
  await act(async () => renderer.update(tree()));
  expect(
    renderer.root.findAllByProps({ testID: 'cerberus-roaming-area' }),
  ).toHaveLength(0);
  expect(mocks.stop).toHaveBeenCalledTimes(1);
  props.state.index = 0;
  await act(async () => renderer.update(tree()));
  expect(area()).toBeDefined();
  expect(mocks.values).toHaveLength(1);
  expect(progress.value).toBe(0.8);
  expect(mocks.setValue).not.toHaveBeenCalled();
  expect(mocks.start).toHaveBeenCalledTimes(2);
  expect(mocks.movements.at(-1)!.config.toValue).toBe(
    mocks.movements[0]!.config.toValue,
  );
});
