import { createElement } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemePicker } from './theme-picker';
import { ThemeProvider, useThemePreference } from './theme-preference';
import { useTheme } from './theme';
import { THEME_STATE_KEY, themeColors } from './themes';

const mocks = vi.hoisted(() => ({
  scheme: 'light',
  reportError: vi.fn(),
}));
vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  ActivityIndicator: 'ActivityIndicator',
  useColorScheme: () => mocks.scheme,
}));
vi.mock('./app-context', () => ({ reportError: mocks.reportError }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
let colors: ReturnType<typeof useTheme>;
let preference: ReturnType<typeof useThemePreference>;
const saved = new Map<string, string>();
const store = {
  state: vi.fn(async (key: string) => saved.get(key) ?? null),
  setState: vi.fn(async (key: string, value: string | null) => {
    if (value === null) saved.delete(key);
    else saved.set(key, value);
  }),
};
function Probe() {
  colors = useTheme();
  preference = useThemePreference();
  return createElement(ThemePicker);
}
const tree = () =>
  createElement(ThemeProvider, { store, children: createElement(Probe) });
async function mount() {
  await act(async () => {
    renderer = create(tree());
  });
}
const option = (name: string) =>
  renderer.root.findByProps({ accessibilityLabel: `${name} theme` });
beforeEach(() => {
  saved.clear();
  mocks.scheme = 'light';
  mocks.reportError.mockReset();
  store.state.mockClear();
  store.state.mockImplementation(async (key) => saved.get(key) ?? null);
  store.setState.mockReset().mockImplementation(async (key, value) => {
    if (value === null) saved.delete(key);
    else saved.set(key, value);
  });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

describe('Settings theme color picker', () => {
  it('offers six labeled choices and marks selection without relying on color', async () => {
    await mount();
    expect(renderer.root.findAllByType(Pressable)).toHaveLength(6);
    expect(option('Neutral').props.accessibilityRole).toBe('radio');
    expect(option('Neutral').props.accessibilityState.selected).toBe(true);
    expect(option('Neutral').findByType(Text).children.join('')).toContain('✓');
    await act(async () => option('Neutral').props.onPress());
    expect(store.setState).not.toHaveBeenCalled();
  });

  it('applies the chosen theme and restores it after restarting', async () => {
    await mount();
    await act(async () => option('Yellow').props.onPress());
    expect(saved.get(THEME_STATE_KEY)).toBe('yellow');
    expect(colors).toEqual(themeColors('yellow', false));
    expect(option('Yellow').props.accessibilityState.selected).toBe(true);
    await act(async () => renderer.unmount());
    await mount();
    expect(preference.id).toBe('yellow');
    expect(colors.background).toBe(themeColors('yellow', false).background);
  });

  it('follows the phone appearance without changing the saved color', async () => {
    saved.set(THEME_STATE_KEY, 'yellow');
    await mount();
    mocks.scheme = 'dark';
    await act(async () => renderer.update(tree()));
    expect(colors).toEqual(themeColors('yellow', true));
    expect(saved.get(THEME_STATE_KEY)).toBe('yellow');
    expect(store.setState).not.toHaveBeenCalled();
  });

  it('keeps the prior theme after a failed save and allows retrying', async () => {
    await mount();
    const failure = new Error('Disk full');
    store.setState.mockRejectedValueOnce(failure);
    await act(async () => option('Mint').props.onPress());
    expect(preference.id).toBe('neutral');
    expect(mocks.reportError).toHaveBeenCalledWith(failure);
    expect(option('Mint').props.disabled).toBe(false);
    await act(async () => option('Mint').props.onPress());
    expect(preference.id).toBe('mint');
  });

  it('prevents overlapping choices while a save is pending', async () => {
    await mount();
    let finish!: () => void;
    store.setState.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await act(async () => option('Peach').props.onPress());
    expect(option('Blue').props.accessibilityState.disabled).toBe(true);
    await act(async () => option('Blue').props.onPress());
    expect(store.setState).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(preference.id).toBe('peach');
    expect(preference.saving).toBe(false);
  });

  it('waits for the stored preference before exposing editable choices', async () => {
    let finish!: (id: string) => void;
    store.state.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    await mount();
    expect(renderer.root.findAllByType(Pressable)).toHaveLength(0);
    expect(
      renderer.root.findByType(ActivityIndicator).props.accessibilityLabel,
    ).toBe('Loading theme');
    await act(async () => finish('peach'));
    expect(preference.id).toBe('peach');
  });

  it('recovers from a failed preference read with a usable Neutral theme', async () => {
    const failure = new Error('Read failed');
    store.state.mockRejectedValueOnce(failure);
    await mount();
    expect(preference.id).toBe('neutral');
    expect(mocks.reportError).toHaveBeenCalledWith(failure);
    await act(async () => option('Plum').props.onPress());
    expect(preference.id).toBe('plum');
  });
});
