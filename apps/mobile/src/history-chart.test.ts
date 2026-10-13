import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { emptyEntry } from '@down-up/shared';
import { HistoryChart, WeekdayChart } from './history-chart';

const dimensions = vi.hoisted(() => ({ fontScale: 1 }));

vi.mock('react-native', () => ({
  Text: 'Text',
  View: 'View',
  ScrollView: 'ScrollView',
  useWindowDimensions: () => dimensions,
  PanResponder: { create: () => ({ panHandlers: {} }) },
}));
vi.mock('react-native-svg', () => ({
  default: 'Svg',
  G: 'G',
  Line: 'Line',
  Path: 'Path',
  Rect: 'Rect',
  Text: 'SvgText',
}));
vi.mock('./theme', () => ({ useTheme: () => ({}) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
afterEach(async () => {
  await act(async () => renderer?.unmount());
  dimensions.fontScale = 1;
});
const nodes = (type: string) =>
  renderer.root.findAll((node) => (node.type as unknown) === type);

it('scales weekday labels and allows horizontal scrolling with large fonts', async () => {
  dimensions.fontScale = 2;
  await act(async () => {
    renderer = create(
      createElement(WeekdayChart, {
        entries: [],
        from: '2026-10-05',
        to: '2026-10-11',
      }),
    );
  });
  expect(nodes('ScrollView')[0]!.props.horizontal).toBe(true);
  expect(nodes('Svg')[0]!.props.width).toBeGreaterThan(320);
  expect(
    nodes('SvgText')
      .filter((node) => node.props.y === 214)
      .every((node) => node.props.fontSize === 22),
  ).toBe(true);
});

it('shows weekday and date ticks including missing days, and spaces them on narrow screens', async () => {
  await act(async () => {
    renderer = create(
      createElement(HistoryChart, {
        entries: [],
        from: '2026-10-05',
        to: '2026-10-11',
        counts: false,
      }),
    );
  });
  const labels = () =>
    nodes('SvgText')
      .filter((node) => node.props.y >= 190)
      .map((node) => node.props.children);
  expect(labels()).toContain('Mon');
  expect(labels()).toContain('10/05');
  expect(labels()).toContain('Sun');
  expect(labels()).toContain('10/11');
  const initialCount = labels().length;
  await act(async () =>
    nodes('View')[0]!.props.onLayout({
      nativeEvent: { layout: { width: 240 } },
    }),
  );
  expect(labels().length).toBeLessThan(initialCount);
  const positions = nodes('SvgText')
    .filter((node) => node.props.y === 190)
    .map((node) => node.props.x as number);
  for (let index = 1; index < positions.length; index++)
    expect(positions[index]! - positions[index - 1]!).toBeGreaterThanOrEqual(
      48,
    );
});

it('leaves the counts axis numeric', async () => {
  await act(async () => {
    renderer = create(
      createElement(HistoryChart, {
        entries: [],
        from: '2026-10-05',
        to: '2026-10-11',
        counts: true,
      }),
    );
  });
  expect(
    nodes('SvgText')
      .filter((node) => node.props.y === 191)
      .map((node) => node.props.children),
  ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

it('renders only recorded weekday bars, with averages and counts available as text', async () => {
  await act(async () => {
    renderer = create(
      createElement(WeekdayChart, {
        entries: [
          { ...emptyEntry('2026-10-05'), value: 2 },
          { ...emptyEntry('2026-10-12'), value: 8 },
          { ...emptyEntry('2026-10-13'), value: null, note: 'Note only' },
        ],
        from: '2026-10-05',
        to: '2026-10-13',
      }),
    );
  });
  expect(nodes('Rect')).toHaveLength(1);
  expect(
    nodes('SvgText')
      .filter((node) => node.props.y === 194)
      .map((node) => node.props.children),
  ).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  expect(nodes('Text')[0]!.props.children).toContain('Mon: 5.0 (2 days)');
  expect(nodes('Text')[0]!.props.children).toContain('Tue: — (0 days)');
});
