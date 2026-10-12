import { createElement } from 'react';
import { Image } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CerberusArtwork } from './cerberus-artwork';
import { RetroTabBar } from './retro-tab-bar';

const mocks = vi.hoisted(() => ({
  reduceMotion: false,
  query: vi.fn(),
  motionChanged: null as ((value: boolean) => void) | null,
  appChanged: null as ((value: string) => void) | null,
  keyboard: new Map<string, () => void>(),
  remove: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  loop: vi.fn(),
  timing: vi.fn(),
  setValue: vi.fn(),
  interpolate: vi.fn(),
  values: [] as { value: number }[],
}));
vi.mock('../assets/cerberus.png', () => ({ default: 1 }));
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }));
vi.mock('./theme', () => ({ useTheme: () => ({ background: '#f5e8ad' }) }));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  Text: 'Text',
  Image: 'Image',
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
      interpolate = mocks.interpolate;
    },
    timing: mocks.timing,
    sequence: (animations: unknown[]) => animations,
    loop: mocks.loop,
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
async function mount(width = 360) {
  await act(async () => {
    renderer = create(createElement(CerberusArtwork));
  });
  await act(async () =>
    area().props.onLayout({ nativeEvent: { layout: { width } } }),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.reduceMotion = false;
  mocks.keyboard.clear();
  mocks.values.length = 0;
  mocks.query.mockImplementation(async () => mocks.reduceMotion);
  mocks.loop.mockReturnValue({ start: mocks.start, stop: mocks.stop });
  mocks.interpolate.mockReturnValue('interpolated');
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

it('roams within the available width with no frame or touch/accessibility interception', async () => {
  await mount();
  expect(area().props.pointerEvents).toBe('none');
  expect(area().props.accessibilityElementsHidden).toBe(true);
  expect(area().props.style.backgroundColor).toBeUndefined();
  expect(area().props.style.borderWidth).toBeUndefined();
  expect(renderer.root.findAllByType(Image)).toHaveLength(1);
  expect(mocks.interpolate).toHaveBeenLastCalledWith({
    inputRange: [0, 1],
    outputRange: [-104, 104],
    extrapolate: 'clamp',
  });
  expect(mocks.start).toHaveBeenCalledTimes(1);
  expect(mocks.timing.mock.calls.map((call) => call[1].toValue)).toEqual([
    1, 0,
  ]);
  for (const [, config] of mocks.timing.mock.calls) {
    expect(config.useNativeDriver).toBe(true);
    expect(config.isInteraction).toBe(false);
  }
  await act(async () =>
    area().props.onLayout({ nativeEvent: { layout: { width: 280 } } }),
  );
  expect(mocks.stop).toHaveBeenCalledTimes(1);
  expect(mocks.interpolate).toHaveBeenLastCalledWith({
    inputRange: [0, 1],
    outputRange: [-64, 64],
    extrapolate: 'clamp',
  });
});

it('stays still for Reduce Motion, including live preference changes and read failures', async () => {
  mocks.reduceMotion = true;
  await mount();
  expect(mocks.start).not.toHaveBeenCalled();
  await act(async () => mocks.motionChanged!(false));
  expect(mocks.start).toHaveBeenCalledTimes(1);
  await act(async () => mocks.motionChanged!(true));
  expect(mocks.stop).toHaveBeenCalledTimes(1);
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

it('does not start moving before the accessibility preference resolves or in a narrow space', async () => {
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
});
