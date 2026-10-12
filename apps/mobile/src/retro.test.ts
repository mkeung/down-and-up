import { createElement } from 'react';
import { Pressable, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { ValueKeypad } from './value-keypad';
import { RetroTabBar } from './retro-tab-bar';
import { PixelCheck, PixelFontContext } from './retro';

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));
vi.mock('./cerberus-artwork', () => ({ CerberusArtwork: () => null }));
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }));
vi.mock('./theme', () => ({
  useTheme: () => ({
    text: '#252321',
    muted: '#49443f',
    line: '#655d54',
    surface: '#f4f1ea',
    selected: '#ddd8ce',
    chrome: '#e6e3dc',
  }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

it('keeps the 3×3 + centered 10 keypad, neutral keys, and a checkmarked selection', async () => {
  const choose = vi.fn();
  await act(async () => {
    renderer = create(
      createElement(
        PixelFontContext.Provider,
        { value: true },
        createElement(ValueKeypad, { value: 7, onChoose: choose }),
      ),
    );
  });
  const keys = renderer.root.findAllByType(Pressable);
  expect(keys.map((key) => key.props.accessibilityLabel)).toEqual([
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
  ]);
  expect(keys.map((key) => key.props.accessibilityState.selected)).toEqual([
    false,
    false,
    false,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
  ]);
  expect(keys[6]!.findAllByType(PixelCheck)).toHaveLength(1);
  for (const key of keys) {
    const style = Object.assign({}, ...key.props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(64);
    expect(style.minHeight).toBeGreaterThanOrEqual(64);
    const numeral = key.findByType(Text);
    expect(numeral.props.allowFontScaling).not.toBe(false);
    expect(numeral.props.adjustsFontSizeToFit).toBe(true);
    expect(Object.assign({}, ...numeral.props.style).fontFamily).toBe(
      'PixelifySans',
    );
  }
  expect(keys[9]!.parent!.parent!.findAllByType(Pressable)).toHaveLength(1);
  expect(keys[9]!.parent!.parent!.props.style.justifyContent).toBe('center');
  await act(async () => keys[6]!.props.onPress());
  expect(choose).not.toHaveBeenCalled();
  await act(async () => keys[9]!.props.onPress());
  expect(choose).toHaveBeenCalledWith(10);
});

it('keeps only two tabs, announces selection, and honors navigation event cancellation', async () => {
  const props = {
    state: {
      index: 0,
      routes: [
        { key: 'rate', name: 'index' },
        { key: 'note', name: 'pawsitive' },
        { key: 'history', name: 'history' },
        { key: 'settings', name: 'settings' },
      ],
    },
    navigation: {
      emit: vi.fn(() => ({ defaultPrevented: false })),
      navigate: vi.fn(),
    },
    insets: { bottom: 34, left: 44, right: 0, top: 0 },
  };
  // Only the props exercised by the custom bar are needed in this fixture.
  await act(async () => {
    renderer = create(
      createElement(
        RetroTabBar,
        props as unknown as Parameters<typeof RetroTabBar>[0],
      ),
    );
  });
  const tabs = renderer.root.findAllByType(Pressable);
  expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual([
    'Rate',
    'Pawsitive',
  ]);
  expect(tabs[0]!.props.accessibilityState.selected).toBe(true);
  await act(async () => tabs[0]!.props.onPress());
  expect(props.navigation.navigate).not.toHaveBeenCalled();
  props.navigation.emit.mockReturnValueOnce({ defaultPrevented: true });
  await act(async () => tabs[1]!.props.onPress());
  expect(props.navigation.navigate).not.toHaveBeenCalled();
  await act(async () => tabs[1]!.props.onPress());
  expect(props.navigation.navigate).toHaveBeenCalledWith(
    'pawsitive',
    undefined,
  );
  expect(
    renderer.root.findByProps({ testID: 'retro-navigation-tabs' }).props.style
      .paddingBottom,
  ).toBe(34);
  expect(
    renderer.root.findByProps({ testID: 'retro-navigation-tabs' }).props.style
      .paddingLeft,
  ).toBe(44);
});
