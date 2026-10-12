import { createElement } from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { DateBar } from './date-bar';
import { PixelFontContext } from './retro';

const selected = vi.hoisted(() => ({
  date: '2026-10-12',
  today: '2026-10-12',
}));
vi.mock('react-native', () => ({ Text: 'Text', View: 'View' }));
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }));
vi.mock('@react-native-community/datetimepicker', () => ({
  default: () => null,
}));
vi.mock('./components', () => ({ Action: 'Action', Row: 'Row' }));
vi.mock('./theme', () => ({ useTheme: () => ({}) }));
vi.mock('./selected-date', () => ({
  useSelectedDate: () => ({
    ...selected,
    selectDate: vi.fn(),
    recording: false,
  }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

async function lines(date: string) {
  selected.date = date;
  await act(async () => {
    renderer = create(
      createElement(
        PixelFontContext.Provider,
        { value: true },
        createElement(DateBar),
      ),
    );
  });
  return renderer.root
    .find(
      (node) =>
        (node.type as unknown) === 'Action' &&
        String(node.props.label).startsWith('Choose date'),
    )
    .findAllByType(Text);
}

it.each(['2026-10-12', '2026-10-11', '2026-10-01', '2025-03-04'])(
  'keeps the date button at two single pixel lines for %s',
  async (date) => {
    const shown = await lines(date);
    expect(shown).toHaveLength(2);
    for (const line of shown) {
      expect(line.props.numberOfLines).toBe(1);
      expect(Object.assign({}, ...line.props.style).fontFamily).toBe(
        'PixelifySans',
      );
    }
  },
);

it('labels today and yesterday, and falls back to the weekday', async () => {
  const heading = async (date: string) =>
    (await lines(date))[0]!.props.children as string;
  expect(await heading('2026-10-12')).toBe('Today');
  expect(await heading('2026-10-11')).toBe('Yesterday');
  expect(await heading('2026-10-10')).not.toMatch(/Today|Yesterday/);
});
