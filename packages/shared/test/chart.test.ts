import { afterEach, describe, expect, it } from 'vitest';
import { chartDateLabel, weekdayAverages, WEEKDAY_LABELS } from '../src';

describe('weekday chart dates', () => {
  const originalTimezone = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTimezone;
  });

  it.each([
    'America/Los_Angeles',
    'America/New_York',
    'Pacific/Kiritimati',
    'Pacific/Honolulu',
  ])(
    'keeps labels and weekday averages on their calendar days in %s',
    (timezone) => {
      process.env.TZ = timezone;
      for (const [date, weekday, label] of [
        ['2026-03-08', 'Sun', '03/08'],
        ['2026-03-09', 'Mon', '03/09'],
        ['2026-11-01', 'Sun', '11/01'],
        ['2026-11-02', 'Mon', '11/02'],
        ['2024-02-29', 'Thu', '02/29'],
        ['1899-12-31', 'Sun', '12/31'],
      ]) {
        expect(chartDateLabel(date!)).toEqual({ weekday, date: label });
        expect(
          weekdayAverages([{ date: date!, value: 7 }], date!, date!).find(
            (point) => point.weekday === weekday,
          ),
        ).toEqual({ weekday, average: 7, count: 1 });
      }
    },
  );
});

it('averages recorded daily values in the inclusive range, ordered Monday to Sunday', () => {
  const rows = [
    { date: '2026-09-28', value: 10 }, // lookback Monday: excluded
    { date: '2026-10-05', value: 2 },
    { date: '2026-10-12', value: 8 },
    { date: '2026-10-19', value: 5 },
    { date: '2026-10-26', value: 1 },
    { date: '2026-11-02', value: 9 },
    { date: '2026-10-06', value: 3 },
    { date: '2026-10-13', value: null },
    { date: '2026-10-11', value: 10 },
    { date: '2026-11-09', value: 10 }, // after range: excluded
  ];
  expect(weekdayAverages(rows, '2026-10-05', '2026-11-02')).toEqual([
    { weekday: 'Mon', average: 5, count: 5 },
    { weekday: 'Tue', average: 3, count: 1 },
    { weekday: 'Wed', average: null, count: 0 },
    { weekday: 'Thu', average: null, count: 0 },
    { weekday: 'Fri', average: null, count: 0 },
    { weekday: 'Sat', average: null, count: 0 },
    { weekday: 'Sun', average: 10, count: 1 },
  ]);
  expect(weekdayAverages(rows, '2026-10-12', '2026-10-12')[0]).toEqual({
    weekday: 'Mon',
    average: 8,
    count: 1,
  });
});

it('keeps all seven empty weekdays without inventing zero averages', () => {
  for (const rows of [[], [{ date: '2026-10-12', value: null }]])
    expect(weekdayAverages(rows, '2026-10-01', '2026-10-31')).toEqual(
      WEEKDAY_LABELS.map((weekday) => ({ weekday, average: null, count: 0 })),
    );
});
