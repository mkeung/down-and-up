import {
  addDays,
  calendarDate,
  daysInRange,
  eachDay,
  isoWeekStart,
  localDate,
} from './dates';
import type { Entry } from './schemas';

export type StatEntry = Pick<Entry, 'date' | 'value'>;
export type ChartPoint = { date: string; value: number | null; count: number };

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

export function chartPoints(
  entries: readonly StatEntry[],
  from: string,
  to: string,
): ChartPoint[] {
  const days = daysInRange(from, to);
  if (days <= 90) return dailyPoints(entries, from, to);
  const key =
    days <= 730 ? isoWeekStart : (date: string) => `${date.slice(0, 7)}-01`;
  const buckets = new Map<string, { sum: number; count: number }>();
  const start = calendarDate(key(from));
  for (
    let date = localDate(start);
    start.getFullYear() <= 9999 && date <= to;
    date = localDate(start)
  ) {
    buckets.set(date, { sum: 0, count: 0 });
    if (days <= 730) start.setDate(start.getDate() + 7);
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
