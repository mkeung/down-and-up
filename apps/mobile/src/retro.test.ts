import { createElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { ValueKeypad } from './value-keypad';
import { RetroTabBar } from './retro-tab-bar';
import { PixelCheck, PixelFontContext } from './retro';
import { EntryCheck } from './entry-check';
import { themeColors } from './themes';

// Button motion is covered by feedback-pressable.test.ts.
vi.mock('./feedback-pressable', async () => ({
  FeedbackPressable: (await import('react-native')).Pressable,
}));
vi.mock('react-native', () => ({
  useWindowDimensions: () => ({ fontScale: 1 }),
  ScrollView: 'ScrollView',
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));
vi.mock('./cerberus-artwork', () => ({ CerberusArtwork: () => null }));
vi.mock('./selected-date', () => ({
  useSelectedEntry: () => ({ entry: null, value: null }),
}));
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }));
vi.mock('./theme', () => ({
  useTheme: () => themeColors('neutral', false),
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
  expect(keys[6]!.findAllByType(EntryCheck)).toHaveLength(1);
  expect(renderer.root.findAllByType(EntryCheck)).toHaveLength(1);
  for (const key of keys) {
    const style = Object.assign({}, ...key.props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(64);
    expect(style.minHeight).toBeGreaterThanOrEqual(64);
    const numeral = key.findByType(Text);
    expect(numeral.props.allowFontScaling).not.toBe(false);
    expect(numeral.props.adjustsFontSizeToFit).toBe(true);
    expect(Object.assign({}, ...numeral.props.style).fontFamily).toBe(
      'Silkscreen',
    );
  }
  let tenRow = keys[9]!.parent;
  while (tenRow?.type !== View) tenRow = tenRow?.parent ?? null;
  expect(tenRow!.findAllByType(Pressable)).toHaveLength(1);
  expect(tenRow!.props.style.justifyContent).toBe('center');
  await act(async () => keys[6]!.props.onPress());
  expect(choose).not.toHaveBeenCalled();
  await act(async () => keys[9]!.props.onPress());
  expect(choose).toHaveBeenCalledWith(10);
});

it('moves the green circle to the saved number and hides it on an empty day', async () => {
  const choose = vi.fn();
  await act(async () => {
    renderer = create(
      createElement(ValueKeypad, { value: 1, onChoose: choose }),
    );
  });
  await act(async () =>
    renderer.update(
      createElement(ValueKeypad, { value: 10, onChoose: choose }),
    ),
  );
  const keys = renderer.root.findAllByType(Pressable);
  expect(keys[0]!.findAllByType(EntryCheck)).toHaveLength(0);
  const badge = keys[9]!.findByType(EntryCheck).findByType(View);
  expect(badge.props.style).toMatchObject({
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#26712b',
  });
  expect(badge.props.importantForAccessibility).toBe('no-hide-descendants');
  expect(badge.props.pointerEvents).toBe('none');
  await act(async () =>
    renderer.update(
      createElement(ValueKeypad, { value: null, onChoose: choose }),
    ),
  );
  expect(renderer.root.findAllByType(EntryCheck)).toHaveLength(0);
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
