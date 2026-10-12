import { createElement } from 'react';
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
} from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FeedbackPressable } from './feedback-pressable';
import { ValueKeypad } from './value-keypad';

const mocks = vi.hoisted(() => ({
  readMotion: vi.fn(),
  changed: null as null | ((value: boolean) => void),
  remove: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  timing: vi.fn(),
  values: [] as { value: number }[],
  playSound: vi.fn(),
}));
vi.mock('./sounds', () => ({ playSound: mocks.playSound }));
vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  View: 'View',
  Text: 'Text',
  useWindowDimensions: () => ({ fontScale: 1 }),
  StyleSheet: {
    flatten: (style: object | object[]) =>
      Array.isArray(style) ? Object.assign({}, ...style.flat(Infinity)) : style,
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: mocks.readMotion,
    addEventListener: (_event: string, listener: (value: boolean) => void) => {
      mocks.changed = listener;
      return { remove: mocks.remove };
    },
  },
  Animated: {
    createAnimatedComponent: (component: unknown) => component,
    Value: class {
      value: number;
      constructor(value: number) {
        this.value = value;
        mocks.values.push(this);
      }
      setValue(value: number) {
        this.value = value;
      }
      interpolate(config: { inputRange: number[]; outputRange: number[] }) {
        return { progress: this, ...config };
      }
    },
    timing: mocks.timing,
  },
}));
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }));
vi.mock('./theme', () => ({
  useTheme: () => ({ entryCheck: { fill: '#26712b', ink: '#fff' } }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
const event = {} as GestureResponderEvent;
const button = () => renderer.root.findByType(Pressable);
const props = {
  accessibilityRole: 'button' as const,
  accessibilityLabel: 'Test',
  onPress: vi.fn(),
  onPressIn: vi.fn(),
  onPressOut: vi.fn(),
  style: { minWidth: 64, minHeight: 64 },
};
async function mount(disabled = false) {
  await act(async () => {
    renderer = create(createElement(FeedbackPressable, { ...props, disabled }));
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.values.length = 0;
  mocks.readMotion.mockResolvedValue(false);
  mocks.timing.mockReturnValue({ start: mocks.start, stop: mocks.stop });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

it('animates down on press and back on release without delaying the action', async () => {
  await mount();
  await act(async () => button().props.onPressIn(event));
  expect(mocks.timing).toHaveBeenLastCalledWith(mocks.values[0], {
    toValue: 1,
    duration: 70,
    useNativeDriver: true,
  });
  expect(props.onPressIn).toHaveBeenCalledWith(event);
  expect(mocks.playSound).not.toHaveBeenCalled();
  await act(async () => button().props.onPress(event));
  expect(props.onPress).toHaveBeenCalledExactlyOnceWith(event);
  expect(mocks.playSound).toHaveBeenCalledExactlyOnceWith('click');
  await act(async () => button().props.onPressOut(event));
  expect(mocks.timing).toHaveBeenLastCalledWith(mocks.values[0], {
    toValue: 0,
    duration: 120,
    useNativeDriver: true,
  });
  expect(props.onPressOut).toHaveBeenCalledWith(event);
  expect(mocks.stop).toHaveBeenCalled();
  expect(Object.assign({}, ...button().props.style)).toMatchObject(props.style);
  // A canceled gesture restores the visual state without invoking the action.
  await act(async () => button().props.onPressIn(event));
  await act(async () => button().props.onPressOut(event));
  expect(props.onPress).toHaveBeenCalledTimes(1);
  expect(mocks.playSound).toHaveBeenCalledTimes(1);
});

it('uses static opacity feedback when Reduce Motion is enabled or unreadable', async () => {
  mocks.readMotion.mockRejectedValueOnce(new Error('Unavailable'));
  await mount();
  await act(async () => button().props.onPressIn(event));
  expect(mocks.timing).not.toHaveBeenCalled();
  expect(mocks.values[0]?.value).toBe(1);
  const style = Object.assign({}, ...button().props.style);
  expect(style.transform).toEqual([{ translateY: 0 }]);
  expect(style.opacity.outputRange).toEqual([1, 0.78]);
  await act(async () => button().props.onPressOut(event));
  expect(mocks.values[0]?.value).toBe(0);
});

it('responds to live motion changes and ignores a stale preference read', async () => {
  let resolve!: (value: boolean) => void;
  mocks.readMotion.mockReturnValueOnce(
    new Promise<boolean>((done) => {
      resolve = done;
    }),
  );
  await mount();
  await act(async () => mocks.changed?.(true));
  await act(async () => resolve(false));
  expect(mocks.timing).not.toHaveBeenCalled();
  await act(async () => mocks.changed?.(false));
  await act(async () => button().props.onPressIn(event));
  await act(async () => mocks.changed?.(true));
  expect(mocks.stop).toHaveBeenCalled();
  expect(Object.assign({}, ...button().props.style).transform).toEqual([
    { translateY: 0 },
  ]);
  await act(async () => renderer.unmount());
  expect(mocks.remove).toHaveBeenCalledTimes(1);
});

it('keeps disabled buttons still and preserves their base opacity', async () => {
  await mount(true);
  mocks.timing.mockClear();
  await act(async () => button().props.onPressIn(event));
  expect(mocks.timing).not.toHaveBeenCalled();
  expect(props.onPressIn).not.toHaveBeenCalled();
  expect(button().props.disabled).toBe(true);
  await act(async () => {
    renderer.update(
      createElement(FeedbackPressable, {
        ...props,
        disabled: true,
        style: { opacity: 0.4 },
      }),
    );
  });
  expect(
    Object.assign({}, ...button().props.style).opacity.outputRange,
  ).toEqual([0.4, 0.4 * 0.78]);
});

it('gives all ten keys feedback while a selected key remains a no-op', async () => {
  const choose = vi.fn();
  await act(async () => {
    renderer = create(
      createElement(ValueKeypad, { value: 7, onChoose: choose }),
    );
  });
  const keys = renderer.root.findAllByType(Pressable);
  expect(keys).toHaveLength(10);
  for (const key of keys) {
    await act(async () => key.props.onPressIn(event));
    expect(mocks.timing.mock.lastCall?.[1].toValue).toBe(1);
    await act(async () => key.props.onPressOut(event));
    expect(mocks.timing.mock.lastCall?.[1].toValue).toBe(0);
    const style = StyleSheet.flatten(key.props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(64);
    expect(style.minHeight).toBeGreaterThanOrEqual(64);
  }
  await act(async () => keys[6]!.props.onPress());
  expect(keys[6]!.props.accessibilityState.selected).toBe(true);
  expect(choose).not.toHaveBeenCalled();
  await act(async () => keys[9]!.props.onPress());
  expect(choose).toHaveBeenCalledExactlyOnceWith(10);
});
