import { createElement } from 'react';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Rate from '../app/index';

const mocks = vi.hoisted(() => ({
  setField: vi.fn(),
  haptic: vi.fn(),
  value: null as number | null,
  playReaction: vi.fn(),
  reportError: vi.fn(),
}));
// Button motion is covered by feedback-pressable.test.ts.
vi.mock('./feedback-pressable', async () => ({
  FeedbackPressable: (await import('react-native')).Pressable,
}));
vi.mock('react-native', () => ({
  useWindowDimensions: () => ({ fontScale: 1 }),
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
  Pressable: 'Pressable',
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }));
vi.mock('expo-router', () => ({ router: { navigate: vi.fn() } }));
vi.mock('./sounds', () => ({ playSound: vi.fn() }));
vi.mock('expo-haptics', () => ({ selectionAsync: mocks.haptic }));
vi.mock('./app-context', () => ({
  useApp: () => ({ repo: { setField: mocks.setField }, needsConsent: false }),
  reportError: mocks.reportError,
}));
vi.mock('./cerberus-context', () => ({
  useCerberus: () => ({ playReaction: mocks.playReaction }),
}));
vi.mock('./theme', () => ({
  useTheme: () => ({
    background: '#eee',
    entryCheck: { fill: '#26712b', ink: '#ffffff' },
  }),
}));
vi.mock('./selected-date', () => ({
  useSelectedDate: () => ({ date: '2026-10-12' }),
  useEntry: () => ({ value: mocks.value }),
}));
vi.mock('./date-bar', () => ({ DateBar: () => null }));
vi.mock('./data-status-icon', () => ({ DataStatusButton: () => null }));
vi.mock('./privacy-notice', () => ({ PrivacyNotice: () => null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.value = null;
  mocks.setField.mockResolvedValue(true);
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

it('keeps all keypad rows together below the header with 10 outside the upper-row scroller', async () => {
  await act(async () => {
    renderer = create(createElement(Rate));
  });
  const header = renderer.root.findByProps({ testID: 'entry-header' });
  expect(header.findAllByType(Pressable)).toHaveLength(0);
  const scroller = renderer.root.findByProps({
    testID: 'value-keypad-upper-rows',
  });
  expect(
    scroller
      .findAllByType(Pressable)
      .map((key) => key.props.accessibilityLabel),
  ).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  const keypad = renderer.root.findByProps({ testID: 'value-keypad' });
  expect(keypad.findAllByType(Pressable)).toHaveLength(10);
  expect(keypad.props.style.gap).toBe(12);
  expect(scroller.props.style.overflow).toBe('hidden');
  expect(scroller.props.bounces).toBe(false);
  const ten = keypad.findAllByType(Pressable)[9]!;
  expect(ten.props.accessibilityLabel).toBe('10');
  const style = Object.assign({}, ...ten.props.style);
  expect(style.minWidth).toBeGreaterThanOrEqual(64);
  expect(style.minHeight).toBeGreaterThanOrEqual(64);
  expect(renderer.root.findByType(SafeAreaView).props.edges).toEqual([
    'top',
    'left',
    'right',
  ]);
  await act(async () => ten.props.onPress());
  expect(mocks.setField).toHaveBeenCalledWith('2026-10-12', 'value', 10);
  expect(mocks.haptic).toHaveBeenCalledTimes(1);
});

it('keeps selection on the pinned 10 and ignores tapping it again', async () => {
  mocks.value = 10;
  await act(async () => {
    renderer = create(createElement(Rate));
  });
  const ten = renderer.root
    .findByProps({ testID: 'value-keypad' })
    .findAllByType(Pressable)[9]!;
  expect(ten.props.accessibilityState.selected).toBe(true);
  await act(async () => ten.props.onPress());
  expect(mocks.setField).not.toHaveBeenCalled();
  expect(mocks.playReaction).not.toHaveBeenCalled();
});

it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
  'requests reaction %s after saving the new selection',
  async (value) => {
    await act(async () => {
      renderer = create(createElement(Rate));
    });
    const key = renderer.root
      .findByProps({ testID: 'value-keypad' })
      .findAllByType(Pressable)[value - 1]!;
    await act(async () => key.props.onPress());
    expect(mocks.setField).toHaveBeenCalledWith('2026-10-12', 'value', value);
    expect(mocks.playReaction).toHaveBeenCalledExactlyOnceWith(value);
  },
);

it('does not play a reaction when storage rejects the write', async () => {
  const error = new Error('Disk full');
  mocks.setField.mockRejectedValueOnce(error);
  await act(async () => {
    renderer = create(createElement(Rate));
  });
  await act(async () =>
    renderer.root
      .findByProps({ testID: 'value-keypad' })
      .findAllByType(Pressable)[0]!
      .props.onPress(),
  );
  expect(mocks.reportError).toHaveBeenCalledWith(error);
  expect(mocks.playReaction).not.toHaveBeenCalled();
});

it('does not let an older save completion override a newer reaction after quick taps', async () => {
  let finishFirst!: (changed: boolean) => void;
  mocks.setField.mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      finishFirst = resolve;
    }),
  );
  await act(async () => {
    renderer = create(createElement(Rate));
  });
  const keys = renderer.root
    .findByProps({ testID: 'value-keypad' })
    .findAllByType(Pressable);
  await act(async () => keys[0]!.props.onPress());
  await act(async () => keys[9]!.props.onPress());
  await act(async () => finishFirst(true));
  expect(mocks.playReaction.mock.calls).toEqual([[10]]);
});
