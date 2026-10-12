import { createElement, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { addDays, todayLocal } from '@down-up/shared';
import History from '../app/history';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  firstDate: vi.fn(),
  revision: 0,
  focused: true,
  sync: vi.fn(),
}));
vi.mock('react-native', () => ({
  Text: 'Text',
  View: 'View',
  VirtualizedList: (props: { ListHeaderComponent: ReactNode }) =>
    createElement('VirtualizedList', props, props.ListHeaderComponent),
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));
vi.mock('expo-router', () => ({
  router: { navigate: vi.fn() },
  useIsFocused: () => mocks.focused,
}));
vi.mock('./app-context', () => ({
  useApp: () => ({
    repo: mocks,
    revision: mocks.revision,
    engine: { sync: mocks.sync },
  }),
  reportError: vi.fn(),
}));
vi.mock('./selected-date', () => ({
  useSelectedDate: () => ({ selectDate: vi.fn() }),
}));
vi.mock('./theme', () => ({ useTheme: () => ({}) }));
vi.mock('./retro', () => ({ PixelText: 'PixelText' }));
vi.mock('./components', () => ({ Action: 'Action', Row: 'Row' }));
vi.mock('./history-chart', () => ({ HistoryChart: () => null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
beforeEach(async () => {
  mocks.revision = 0;
  mocks.focused = true;
  mocks.list.mockReset().mockResolvedValue([]);
  mocks.firstDate.mockReset().mockResolvedValue('1800-01-01');
  mocks.sync.mockReset().mockResolvedValue(undefined);
  await act(async () => {
    renderer = create(createElement(History));
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});

it('loads only the selected range once and pauses reloads while hidden', async () => {
  expect(mocks.list).toHaveBeenCalledTimes(1);
  expect(mocks.list).toHaveBeenLastCalledWith(
    addDays(todayLocal(), -29),
    todayLocal(),
  );
  mocks.focused = false;
  await act(async () => renderer.update(createElement(History)));
  mocks.revision++;
  await act(async () => renderer.update(createElement(History)));
  expect(mocks.list).toHaveBeenCalledTimes(1);
  mocks.focused = true;
  await act(async () => renderer.update(createElement(History)));
  expect(mocks.list).toHaveBeenCalledTimes(2);
});
it('uses the earliest date for All and generates calendar rows only on demand', async () => {
  const all = renderer.root.findByProps({ label: 'All' });
  await act(async () => all.props.onPress());
  expect(mocks.firstDate).toHaveBeenCalledTimes(1);
  expect(mocks.list).toHaveBeenLastCalledWith('1800-01-01', todayLocal());
  const list = renderer.root.findByProps({ testID: 'history-list' });
  expect(Array.isArray(list.props.data)).toBe(false);
  const count = list.props.getItemCount(list.props.data);
  expect(count).toBeGreaterThan(80000);
  expect(list.props.getItem(list.props.data, count - 1)).toBe('1800-01-01');
});

it('ignores a late refresh after switching to another range', async () => {
  let release!: (rows: never[]) => void;
  mocks.list.mockReturnValueOnce(
    new Promise<never[]>((resolve) => {
      release = resolve;
    }),
  );
  const list = renderer.root.findByProps({ testID: 'history-list' });
  await act(async () => list.props.onRefresh());
  await act(async () =>
    renderer.root.findByProps({ label: '7D' }).props.onPress(),
  );
  await act(async () => release([]));
  expect(
    renderer.root.findByProps({ testID: 'history-list' }).props.data.from,
  ).toBe(addDays(todayLocal(), -6));
});
