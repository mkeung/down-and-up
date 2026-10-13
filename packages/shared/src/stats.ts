import {
  addDays,
  calendarDate,
  daysInRange,
  eachDay,
  isoWeekStart,
  localDate,
  weekdayIndex,
  WEEKDAY_LABELS,
} from './dates';
import type { Entry } from './schemas';

export type StatEntry = Pick<Entry, 'date' | 'value'>;
export type ChartPoint = { date: string; value: number | null; count: number };
export type WeekdayAverage = {
  weekday: string;
  average: number | null;
  count: number;
};

export function weekdayAverages(
  entries: readonly StatEntry[],
  from: string,
  to: string,
): WeekdayAverage[] {
  const buckets = WEEKDAY_LABELS.map((weekday) => ({
    weekday,
    sum: 0,
    count: 0,
  }));
  for (const row of entries) {
    if (row.date < from || row.date > to || row.value === null) continue;
    const bucket = buckets[weekdayIndex(row.date)]!;
    bucket.sum += row.value;
    bucket.count++;
  }
  return buckets.map(({ weekday, sum, count }) => ({
    weekday,
    average: count ? sum / count : null,
    count,
  }));
}

export function summary(
  entries: readonly StatEntry[],
  from: string,
  to: string,
) {
  let sum = 0;
  let logged = 0;
  let min: number | null = null;
  let max: number | null = null;
  for (const row of entries) {
    if (row.date < from || row.date > to || row.value === null) continue;
    sum += row.value;
    logged++;
    min = min === null ? row.value : Math.min(min, row.value);
    max = max === null ? row.value : Math.max(max, row.value);
  }
  return {
    average: logged ? sum / logged : null,
    min,
    max,
    logged,
    days: daysInRange(from, to),
  };
}

export function valueCounts(
  entries: readonly StatEntry[],
  from: string,
  to: string,
) {
  const counts = Array.from({ length: 10 }, (_, index) => ({
    value: index + 1,
    count: 0,
  }));
  for (const row of entries)
    if (row.date >= from && row.date <= to && row.value !== null)
      counts[row.value - 1]!.count++;
  return counts;
}

export function dailyPoints(
  entries: readonly StatEntry[],
  from: string,
  to: string,
): ChartPoint[] {
  const values = new Map(entries.map((row) => [row.date, row.value]));
  return Array.from(eachDay(from, to), (date) => ({
    date,
    value: values.get(date) ?? null,
    count: values.get(date) != null ? 1 : 0,
  }));
}

export type ChartGranularity = 'daily' | 'weekly' | 'monthly';

export function chartGranularity(from: string, to: string): ChartGranularity {
  const days = daysInRange(from, to);
  return days <= 90 ? 'daily' : days <= 730 ? 'weekly' : 'monthly';
}

export function chartPoints(
  entries: readonly StatEntry[],
  from: string,
  to: string,
): ChartPoint[] {
  const granularity = chartGranularity(from, to);
  if (granularity === 'daily') return dailyPoints(entries, from, to);
  const weekly = granularity === 'weekly';
  const key = weekly
    ? isoWeekStart
    : (date: string) => `${date.slice(0, 7)}-01`;
  const buckets = new Map<string, { sum: number; count: number }>();
  const start = calendarDate(key(from));
  for (
    let date = localDate(start);
    start.getFullYear() <= 9999 && date <= to;
    date = localDate(start)
  ) {
    buckets.set(date, { sum: 0, count: 0 });
    if (weekly) start.setDate(start.getDate() + 7);
    else start.setMonth(start.getMonth() + 1);
  }
  for (const row of entries) {
    if (row.date < from || row.date > to || row.value === null) continue;
    const bucket = buckets.get(key(row.date))!;
    bucket.sum += row.value;
    bucket.count++;
  }
  return Array.from(buckets, ([date, { sum, count }]) => ({
    date,
    value: count ? sum / count : null,
    count,
  }));
}

export function rollingAverage(
  entries: readonly StatEntry[],
  from: string,
  to: string,
): ChartPoint[] {
  const values = new Map(entries.map((row) => [row.date, row.value]));
  const window: (number | null)[] = Array(7).fill(null);
  let sum = 0;
  let count = 0;
  let index = 0;
  const points: ChartPoint[] = [];
  const lookback = from < '0001-01-07' ? '0001-01-01' : addDays(from, -6);
  for (const date of eachDay(lookback, to)) {
    const previous = window[index];
    if (previous != null) {
      sum -= previous;
      count--;
    }
    const value = values.get(date) ?? null;
    window[index] = value;
    index = (index + 1) % 7;
    if (value !== null) {
      sum += value;
      count++;
    }
    if (date >= from)
      points.push({ date, value: count >= 4 ? sum / count : null, count });
  }
  return points;
}

export type SeriesPoint = ChartPoint & { rolling: number | null };

// Chart points with the bucketed 7-day rolling average alongside each point.
// `entries` should include the six days before `from` for the rolling lookback.
export function chartSeries(
  entries: readonly StatEntry[],
  from: string,
  to: string,
): SeriesPoint[] {
  const averages = chartPoints(rollingAverage(entries, from, to), from, to);
  return chartPoints(entries, from, to).map((point, index) => ({
    ...point,
    rolling: averages[index]?.value ?? null,
  }));
}

export function currentStreak(
  entries: readonly StatEntry[],
  today: string,
): number {
  const dates = new Set(
    entries.filter((row) => row.value !== null).map((row) => row.date),
  );
  let end = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.has(end)) {
    streak++;
    end = addDays(end, -1);
  }
  return streak;
}

export type StreakRun = { from: string; to: string };

export function currentStreakFromRuns(
  runs: readonly StreakRun[],
  today: string,
): number {
  for (const end of [today, addDays(today, -1)]) {
    const run = runs.find((run) => run.from <= end && run.to >= end);
    if (run) return daysInRange(run.from, end);
  }
  return 0;
}
