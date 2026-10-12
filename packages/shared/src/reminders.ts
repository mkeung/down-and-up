import { addDays, calendarDate, todayLocal } from './dates';
import type { Settings } from './schemas';

export function reminderSchedule(
  settings: Settings,
  loggedDates: ReadonlySet<string>,
  now: Date,
  syncEnabled: boolean,
  permissionGranted: boolean,
) {
  if (!syncEnabled || !permissionGranted || !settings.reminderEnabled)
    return [];
  const [hour, minute] = settings.reminderTime.split(':').map(Number);
  const notifications: { date: string; at: Date }[] = [];
  for (let offset = 0; offset < 30; offset++) {
    const date = addDays(todayLocal(now), offset);
    const at = calendarDate(date);
    at.setHours(hour!, minute!, 0, 0);
    if (!loggedDates.has(date) && at > now) notifications.push({ date, at });
  }
  return notifications;
}
