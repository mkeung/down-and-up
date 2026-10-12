import { createElement } from 'react';
import { ActivityIndicator, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { emptyEntry, todayLocal, type LocalEntry } from '@down-up/shared';
import Pawsitive from '../app/pawsitive';
import { SelectedDateProvider, useSelectedDate } from './selected-date';

const mocks = vi.hoisted(() => ({ get: vi.fn(), setField: vi.fn() }));
vi.mock('react-native', () => ({
  useWindowDimensions: () => ({ fontScale: 1 }),
  Platform: { OS: 'ios' },
  InputAccessoryView: 'InputAccessoryView',
  Pressable: 'Pressable',
  ActivityIndicator: 'ActivityIndicator',
  TextInput: 'TextInput',
  Text: 'Text',
  Image: 'Image',
  ScrollView: 'ScrollView',
  View: 'View',
  Keyboard: { dismiss() {} },
  AppState: { addEventListener: () => ({ remove() {} }) },
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));
vi.mock('./app-context', () => ({
  useApp: () => ({ repo: mocks, revision: 0, setNotePending: () => undefined }),
  reportError: vi.fn(),
}));
vi.mock('./theme', () => ({ useTheme: () => ({}) }));
vi.mock('./date-bar', () => ({ DateBar: () => null }));
vi.mock('./data-status-icon', () => ({ DataStatusButton: () => null }));
vi.mock('./audio-note', () => ({ AudioNote: () => null }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
let selectDate: (date: string) => void;
function Probe() {
  selectDate = useSelectedDate().selectDate;
  return createElement(Pawsitive);
}
function loadLater() {
  let resolve!: (entry: LocalEntry | null) => void;
  const promise = new Promise<LocalEntry | null>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
beforeEach(() => {
  mocks.get.mockReset();
  mocks.setField.mockReset().mockResolvedValue(true);
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

it('waits for the initial SQLite read before mounting an editable note', async () => {
  const load = loadLater();
  mocks.get.mockReturnValueOnce(load.promise);
  await act(async () => {
    renderer = create(
      createElement(SelectedDateProvider, null, createElement(Probe)),
    );
  });
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  expect(
    renderer.root.findByType(ActivityIndicator).props.accessibilityLabel,
  ).toBe('Loading note');
  await act(async () =>
    load.resolve({
      ...emptyEntry(todayLocal()),
      note: 'existing note',
      noteUpdatedAt: 1,
      dirtyFields: { value: false, note: false, audio: false },
    }),
  );
  const input = renderer.root.findByType(TextInput);
  expect(input.props.value).toBe('existing note');
  await act(async () => {
    input.props.onFocus();
    input.props.onChangeText('existing note plus an edit');
    input.props.onBlur();
  });
  expect(mocks.setField).toHaveBeenCalledWith(
    todayLocal(),
    'note',
    'existing note plus an edit',
  );
});

it('treats a new day as loading and a loaded missing entry as an editable empty note', async () => {
  mocks.get.mockResolvedValueOnce(null);
  await act(async () => {
    renderer = create(
      createElement(SelectedDateProvider, null, createElement(Probe)),
    );
  });
  expect(renderer.root.findByType(TextInput).props.value).toBe('');
  const load = loadLater();
  mocks.get.mockReturnValueOnce(load.promise);
  await act(async () => selectDate('2026-01-01'));
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  await act(async () => load.resolve(null));
  expect(renderer.root.findByType(TextInput).props.value).toBe('');
  expect(mocks.get).toHaveBeenLastCalledWith('2026-01-01');
});
