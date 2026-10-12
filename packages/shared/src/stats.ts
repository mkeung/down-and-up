import { addDays, daysInRange, eachDay, isoWeekStart } from './dates';
import type { Entry } from './schemas';

export type StatEntry = Pick<Entry, 'date' | 'value'>;
export type ChartPoint = { date: string; value: number | null; count: number };

export function summary(
  entries: readonly StatEntry[],
  from: string,
  to: string,
) {
  const values = entries
    .filter((row) => row.date >= from && row.date <= to && row.value !== null)
    .map((row) => row.value as number);
  return {
    average: values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    logged: values.length,
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
  for (const date of eachDay(from, to))
    if (!buckets.has(key(date))) buckets.set(key(date), { sum: 0, count: 0 });
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
  return Array.from(eachDay(from, to), (date) => {
    let sum = 0;
    let count = 0;
    for (let offset = 0; offset < 7; offset++) {
      const value = values.get(addDays(date, -offset));
      if (value != null) {
        sum += value;
        count++;
      }
    }
    return { date, value: count >= 4 ? sum / count : null, count };
  });
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
