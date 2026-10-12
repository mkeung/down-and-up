import { createElement } from 'react';
import { ActivityIndicator, Switch } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SoundProvider, useSoundPreference } from './sound-preference';
import { SoundSettings } from './sound-settings';
import { parseSoundPreferences, SOUND_STATE_KEY } from './sound-preferences';

const mocks = vi.hoisted(() => ({ setSoundPreferences: vi.fn() }));
vi.mock('./sounds', () => ({ setSoundPreferences: mocks.setSoundPreferences }));
vi.mock('./feedback-pressable', async () => ({
  FeedbackPressable: (await import('react-native')).Pressable,
}));
vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Switch: 'Switch',
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
}));
vi.mock('./theme', () => ({ useTheme: () => ({}) }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
let preference: ReturnType<typeof useSoundPreference>;
const saved = new Map<string, string>();
const store = {
  state: vi.fn(async (key: string) => saved.get(key) ?? null),
  setState: vi.fn(async (key: string, value: string | null) => {
    if (value === null) saved.delete(key);
    else saved.set(key, value);
  }),
};
function Probe() {
  preference = useSoundPreference();
  return createElement(SoundSettings);
}
const tree = () =>
  createElement(SoundProvider, { store, children: createElement(Probe) });
async function mount() {
  await act(async () => {
    renderer = create(tree());
  });
}
const slider = () =>
  renderer.root.findByProps({ testID: 'sound-volume-slider' });
const position = (locationX: number) => ({ nativeEvent: { locationX } });
beforeEach(() => {
  vi.useFakeTimers();
  saved.clear();
  vi.clearAllMocks();
  store.state
    .mockReset()
    .mockImplementation(async (key) => saved.get(key) ?? null);
  store.setState.mockReset().mockImplementation(async (key, value) => {
    if (value === null) saved.delete(key);
    else saved.set(key, value);
  });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  vi.useRealTimers();
});

it('waits for saved settings before making sound or exposing editable controls', async () => {
  let finish!: (value: string) => void;
  store.state.mockReturnValueOnce(
    new Promise<string>((resolve) => {
      finish = resolve;
    }),
  );
  await mount();
  expect(
    renderer.root.findByType(ActivityIndicator).props.accessibilityLabel,
  ).toBe('Loading sound settings');
  expect(renderer.root.findAllByType(Switch)).toHaveLength(0);
  expect(mocks.setSoundPreferences).toHaveBeenLastCalledWith(null);
  await act(async () => finish(JSON.stringify({ muted: true, volume: 0.35 })));
  expect(preference).toMatchObject({ ready: true, muted: true, volume: 0.35 });
  expect(mocks.setSoundPreferences).toHaveBeenLastCalledWith({
    muted: true,
    volume: 0.35,
  });
});

it('mutes immediately, preserves the level, and restores both settings on restart', async () => {
  await mount();
  await act(async () => preference.setVolume(0.42));
  await act(async () =>
    renderer.root.findByType(Switch).props.onValueChange(true),
  );
  expect(preference).toMatchObject({ muted: true, volume: 0.42 });
  expect(mocks.setSoundPreferences).toHaveBeenLastCalledWith({
    muted: true,
    volume: 0.42,
  });
  expect(JSON.parse(saved.get(SOUND_STATE_KEY)!)).toEqual({
    muted: true,
    volume: 0.42,
  });
  await act(async () => renderer.unmount());
  await mount();
  expect(preference).toMatchObject({ muted: true, volume: 0.42 });
  await act(async () =>
    renderer.root.findByType(Switch).props.onValueChange(false),
  );
  expect(preference).toMatchObject({ muted: false, volume: 0.42 });
});

it('drags continuously, clamps at either end, and saves on release', async () => {
  await mount();
  await act(async () =>
    slider().props.onLayout({ nativeEvent: { layout: { width: 224 } } }),
  );
  await act(async () => slider().props.onResponderGrant(position(12)));
  expect(preference.volume).toBe(0);
  await act(async () => slider().props.onResponderMove(position(92)));
  expect(preference.volume).toBe(0.4);
  expect(store.setState).not.toHaveBeenCalled();
  await act(async () => slider().props.onResponderRelease(position(112)));
  expect(preference.volume).toBe(0.5);
  expect(JSON.parse(saved.get(SOUND_STATE_KEY)!)).toEqual({
    muted: false,
    volume: 0.5,
  });
  await act(async () => slider().props.onResponderMove(position(400)));
  expect(preference.volume).toBe(1);
  await act(async () => slider().props.onResponderMove(position(-100)));
  expect(preference.volume).toBe(0);
  await act(async () => slider().props.onResponderTerminate());
  expect(JSON.parse(saved.get(SOUND_STATE_KEY)!).volume).toBe(0);
});

it('lets screen readers adjust volume in five-percent steps while muted', async () => {
  saved.set(SOUND_STATE_KEY, JSON.stringify({ muted: true, volume: 0.5 }));
  await mount();
  expect(slider().props.accessibilityRole).toBe('adjustable');
  expect(slider().props.style.minHeight).toBeGreaterThanOrEqual(48);
  expect(slider().props.accessibilityValue).toEqual({
    min: 0,
    max: 100,
    now: 50,
    text: '50%',
  });
  for (const [actionName, volume] of [
    ['increment', 0.55],
    ['decrement', 0.5],
  ] as const) {
    await act(async () =>
      slider().props.onAccessibilityAction({ nativeEvent: { actionName } }),
    );
    expect(preference).toMatchObject({ muted: true, volume });
    expect(JSON.parse(saved.get(SOUND_STATE_KEY)!).volume).toBe(volume);
  }
});

it('serializes rapid changes so the newest mute and volume survive', async () => {
  await mount();
  let finish!: () => void;
  store.setState.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => preference.setMuted(true));
  await act(async () => preference.setVolume(0.3));
  await act(async () => preference.save());
  await act(async () => preference.setMuted(false));
  expect(store.setState).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(store.setState).toHaveBeenCalledTimes(3);
  expect(JSON.parse(saved.get(SOUND_STATE_KEY)!)).toEqual({
    muted: false,
    volume: 0.3,
  });
});

it('keeps live settings after a failed save and retries the complete record', async () => {
  await mount();
  store.setState.mockRejectedValueOnce(new Error('Disk full'));
  await act(async () => preference.setMuted(true));
  expect(preference).toMatchObject({ muted: true, error: true });
  await act(async () => preference.setVolume(0.25));
  await act(async () => preference.save());
  expect(preference.error).toBe(false);
  expect(JSON.parse(saved.get(SOUND_STATE_KEY)!)).toEqual({
    muted: true,
    volume: 0.25,
  });
});

it('recovers from a failed read in mute and allows saving a preference', async () => {
  store.state.mockRejectedValueOnce(new Error('Read failed'));
  await mount();
  expect(preference).toMatchObject({ ready: true, muted: true, error: true });
  await act(async () => preference.setMuted(false));
  expect(preference).toMatchObject({ muted: false, error: false });
});

it('debounces slider writes and releases sound playback on unmount', async () => {
  await mount();
  await act(async () => preference.setVolume(0.3));
  await act(async () => preference.setVolume(0.6));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(store.setState).toHaveBeenCalledTimes(1);
  expect(JSON.parse(saved.get(SOUND_STATE_KEY)!).volume).toBe(0.6);
  await act(async () => renderer.unmount());
  expect(mocks.setSoundPreferences).toHaveBeenLastCalledWith(null);
});

it.each([
  'invalid',
  '{}',
  '{"muted":false,"volume":2}',
  '{"muted":"no","volume":0.4}',
])('keeps malformed saved preferences silent: %s', (saved) =>
  expect(parseSoundPreferences(saved)).toEqual({ muted: true, volume: 1 }),
);
