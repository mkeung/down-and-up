import { createElement } from 'react';
import { Pressable } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { emptyEntry, todayLocal, type LocalEntry } from '@down-up/shared';
import { RetroTabBar } from './retro-tab-bar';
import { EntryCheck } from './entry-check';
import { SelectedDateProvider, useSelectedDate } from './selected-date';
import { themeColors } from './themes';

const mocks = vi.hoisted(() => ({
  repo: { get: vi.fn() },
  revision: 0,
  reportError: vi.fn(),
}));
// Button motion is covered by feedback-pressable.test.ts.
vi.mock('./feedback-pressable', async () => ({
  FeedbackPressable: (await import('react-native')).Pressable,
}));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  Text: 'Text',
  AppState: { addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }));
vi.mock('./cerberus-artwork', () => ({ CerberusArtwork: () => null }));
vi.mock('./theme', () => ({ useTheme: () => themeColors('neutral', false) }));
vi.mock('./app-context', () => ({
  useApp: () => mocks,
  reportError: mocks.reportError,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
let selectDate: (date: string) => void;
const props = {
  state: {
    index: 0,
    routes: [
      { key: 'rate', name: 'index' },
      { key: 'note', name: 'pawsitive' },
    ],
  },
  navigation: { emit: vi.fn(), navigate: vi.fn() },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
function Probe() {
  selectDate = useSelectedDate().selectDate;
  return createElement(
    RetroTabBar,
    props as unknown as Parameters<typeof RetroTabBar>[0],
  );
}
const tree = () =>
  createElement(SelectedDateProvider, null, createElement(Probe));
async function mount() {
  await act(async () => {
    renderer = create(tree());
  });
}
function checks() {
  return renderer.root
    .findAllByType(Pressable)
    .map((tab) => tab.findAllByType(EntryCheck).length > 0);
}
beforeEach(() => {
  mocks.revision = 0;
  mocks.repo.get.mockReset().mockResolvedValue(null);
  mocks.reportError.mockReset();
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

it.each([
  { value: null, note: null, expected: [false, false] },
  { value: 1, note: null, expected: [true, false] },
  { value: 10, note: 'Saved note', expected: [true, true] },
  { value: null, note: 'Note only', expected: [false, true] },
  { value: null, note: '', expected: [false, false] },
])('checks each tab for its saved content: $value / $note', async (test) => {
  mocks.repo.get.mockResolvedValue({
    ...emptyEntry(todayLocal()),
    value: test.value,
    note: test.note,
  });
  await mount();
  expect(mocks.repo.get).toHaveBeenCalledWith(todayLocal());
  expect(checks()).toEqual(test.expected);
  const tabs = renderer.root.findAllByType(Pressable);
  expect(tabs[0]!.props.accessibilityHint).toBe(
    test.expected[0] ? 'Value saved for this day' : undefined,
  );
  expect(tabs[1]!.props.accessibilityHint).toBe(
    test.expected[1] ? 'Note saved for this day' : undefined,
  );
  expect(tabs[1]!.props.accessibilityState.selected).toBe(false);
});

it('refreshes after local saves and removes the note check when the note is cleared', async () => {
  await mount();
  expect(checks()).toEqual([false, false]);
  for (const note of ['Saved note', null]) {
    mocks.repo.get.mockResolvedValue({
      ...emptyEntry(todayLocal()),
      value: 7,
      note,
    });
    mocks.revision++;
    await act(async () => renderer.update(tree()));
    expect(checks()).toEqual([true, note !== null]);
  }
});

it('hides the previous day checks while loading and ignores a late read for another day', async () => {
  mocks.repo.get.mockResolvedValueOnce({
    ...emptyEntry(todayLocal()),
    value: 7,
    note: 'Saved note',
  });
  await mount();
  expect(checks()).toEqual([true, true]);
  let finish!: (entry: LocalEntry) => void;
  mocks.repo.get.mockReturnValueOnce(
    new Promise<LocalEntry>((resolve) => {
      finish = resolve;
    }),
  );
  await act(async () => selectDate('2020-01-01'));
  expect(checks()).toEqual([false, false]);
  await act(async () => selectDate('2020-01-02'));
  await act(async () =>
    finish({
      ...emptyEntry('2020-01-01'),
      value: 10,
      note: 'Earlier day',
      dirtyFields: { value: false, note: false, audio: false },
    }),
  );
  expect(checks()).toEqual([false, false]);
  expect(mocks.repo.get).toHaveBeenLastCalledWith('2020-01-02');
});
