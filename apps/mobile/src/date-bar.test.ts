import { createElement } from 'react';
import { Modal, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DateBar } from './date-bar';
import { PixelFontContext } from './retro';

const selected = vi.hoisted(() => ({
  date: '2026-10-12',
  today: '2026-10-12',
  platform: 'ios',
  selectDate: vi.fn(),
}));
vi.mock('react-native', () => ({
  Text: 'Text',
  View: 'View',
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  Platform: {
    get OS() {
      return selected.platform;
    },
  },
}));
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }));
vi.mock('@react-native-community/datetimepicker', () => ({
  default: 'DatePicker',
}));
vi.mock('./components', () => ({ Action: 'Action', Row: 'Row' }));
vi.mock('./theme', () => ({ useTheme: () => ({}) }));
vi.mock('./selected-date', () => ({
  useSelectedDate: () => ({
    ...selected,
    selectDate: selected.selectDate,
    recording: false,
  }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
beforeEach(() => {
  selected.platform = 'ios';
  selected.selectDate.mockClear();
});
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
        'Silkscreen',
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

const action = (label: string) =>
  renderer.root.find(
    (node) => (node.type as unknown) === 'Action' && node.props.label === label,
  );

it('opens the iOS picker in an overlay and removes it on Cancel without changing the day', async () => {
  await lines('2026-10-12');
  expect(renderer.root.findAllByType(DateTimePicker)).toHaveLength(0);
  const choose = renderer.root.find(
    (node) =>
      (node.type as unknown) === 'Action' &&
      String(node.props.label).startsWith('Choose date'),
  );
  await act(async () => choose.props.onPress());
  expect(
    renderer.root.findByType(Modal).findByType(DateTimePicker).props.display,
  ).toBe('spinner');
  await act(async () => action('Cancel').props.onPress());
  expect(renderer.root.findAllByType(DateTimePicker)).toHaveLength(0);
  expect(selected.selectDate).not.toHaveBeenCalled();
});

it('applies the iOS draft date only on Done and prevents future dates', async () => {
  await lines('2026-10-12');
  const choose = renderer.root.find(
    (node) =>
      (node.type as unknown) === 'Action' &&
      String(node.props.label).startsWith('Choose date'),
  );
  await act(async () => choose.props.onPress());
  await act(async () =>
    renderer.root
      .findByType(DateTimePicker)
      .props.onChange({}, new Date(2026, 9, 10)),
  );
  expect(selected.selectDate).not.toHaveBeenCalled();
  await act(async () =>
    renderer.root
      .findByType(DateTimePicker)
      .props.onChange({}, new Date(2026, 9, 13)),
  );
  await act(async () => action('Done').props.onPress());
  expect(selected.selectDate).toHaveBeenCalledWith('2026-10-10');
  expect(renderer.root.findAllByType(DateTimePicker)).toHaveLength(0);
});

it('closes the Android native picker after selection', async () => {
  selected.platform = 'android';
  await lines('2026-10-12');
  const choose = renderer.root.find(
    (node) =>
      (node.type as unknown) === 'Action' &&
      String(node.props.label).startsWith('Choose date'),
  );
  await act(async () => choose.props.onPress());
  expect(renderer.root.findAllByType(Modal)).toHaveLength(0);
  await act(async () =>
    renderer.root
      .findByType(DateTimePicker)
      .props.onChange({}, new Date(2026, 9, 10)),
  );
  expect(selected.selectDate).toHaveBeenCalledWith('2026-10-10');
  expect(renderer.root.findAllByType(DateTimePicker)).toHaveLength(0);
});
