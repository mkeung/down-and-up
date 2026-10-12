import { createElement } from 'react';
import { Image } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CerberusArtwork } from './cerberus-artwork';

const mocks = vi.hoisted(() => ({
  focused: true,
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
}));
vi.mock('../assets/cerberus.png', () => ({ default: 1 }));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (effect: () => (() => void) | undefined) => {
      const focused = mocks.focused;
      useEffect(() => {
        if (focused) return effect();
      }, [effect, focused]);
    },
  };
});
vi.mock('react-native', () => ({
  View: 'View',
  Image: 'Image',
  Animated: {
    View: 'AnimatedView',
    Value: class {
      setValue = mocks.setValue;
      interpolate = mocks.interpolate;
      constructor(value: number) {
        mocks.setValue(value);
      }
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
  mocks.focused = true;
  mocks.reduceMotion = false;
  mocks.keyboard.clear();
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
  mocks.focused = false;
  await act(async () => renderer.update(createElement(CerberusArtwork)));
  expect(mocks.stop).toHaveBeenCalledTimes(2);
  mocks.focused = true;
  await act(async () => renderer.update(createElement(CerberusArtwork)));
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
