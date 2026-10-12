import {
  addDays as shiftDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfISOWeek,
} from 'date-fns';

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000'))
    return false;
  const date = parseISO(value);
  return !Number.isNaN(date.getTime()) && format(date, 'yyyy-MM-dd') === value;
}

export function localDate(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid time value');
  return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

export function todayLocal(now = new Date()): string {
  return localDate(now);
}

export function todayUTC(now = new Date()): string {
  return `${now.getUTCFullYear().toString().padStart(4, '0')}-${(now.getUTCMonth() + 1).toString().padStart(2, '0')}-${now.getUTCDate().toString().padStart(2, '0')}`;
}

export function calendarDate(value: string): Date {
  if (!isCalendarDate(value)) throw new Error('Invalid date');
  return parseISO(value);
}

export function addDays(date: string, count: number): string {
  return localDate(shiftDays(calendarDate(date), count));
}

export function daysInRange(from: string, to: string): number {
  return Math.max(
    0,
    differenceInCalendarDays(calendarDate(to), calendarDate(from)) + 1,
  );
}

export function isFutureDate(date: string, now = new Date()): boolean {
  return calendarDate(date).getTime() > calendarDate(todayLocal(now)).getTime();
}

export function* eachDay(from: string, to: string): Generator<string> {
  const date = calendarDate(from);
  calendarDate(to);
  for (let day = localDate(date); day <= to; day = localDate(date)) {
    yield day;
    if (day === to) return;
    date.setDate(date.getDate() + 1);
  }
}

export function isoWeekStart(date: string): string {
  return localDate(startOfISOWeek(calendarDate(date)));
}

export type RangePreset = '7D' | '30D' | '90D' | '1Y' | 'All';
export const RANGE_PRESETS: RangePreset[] = ['7D', '30D', '90D', '1Y', 'All'];

export function presetRange(
  preset: RangePreset,
  today: string,
  firstDate?: string | null,
): { from: string; to: string } {
  const count = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 };
  return {
    from:
      preset === 'All'
        ? firstDate && firstDate <= today
          ? firstDate
          : today
        : addDays(today, 1 - count[preset]),
    to: today,
  };
}

export function dateLabel(date: string, today = todayLocal()): string {
  if (date === today)
    return `Today, ${format(calendarDate(date), 'EEE MMM d')}`;
  if (date === addDays(today, -1))
    return `Yesterday, ${format(calendarDate(date), 'EEE MMM d')}`;
  return format(
    calendarDate(date),
    date.slice(0, 4) === today.slice(0, 4) ? 'EEE MMM d' : 'EEE MMM d, yyyy',
  );
}
