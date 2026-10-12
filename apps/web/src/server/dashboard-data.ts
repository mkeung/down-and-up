import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DEFAULT_SETTINGS } from '@down-up/shared';
import { getDb } from './db';
import { entries, settings } from './schema';
import { serialize } from './sync';
export async function loadDashboardData(id: string, from: string, to: string) {
  try {
    const [history, page] = await Promise.all([
      getDb()
        .select({
          date: entries.date,
          value: entries.value,
          notePreview: sql<string | null>`left(${entries.note}, 80)`,
          audio: sql<boolean>`${entries.audioId} IS NOT NULL`,
        })
        .from(entries)
        .where(eq(entries.profileId, id))
        .orderBy(asc(entries.date)),
      getDb()
        .select()
        .from(entries)
        .where(
          and(
            eq(entries.profileId, id),
            sql`${entries.date} BETWEEN ${from}::date AND ${to}::date`,
          ),
        )
        .orderBy(sql`${entries.date} DESC`)
        .limit(51),
    ]);
    return {
      history,
      rows: page.slice(0, 50).map(serialize),
      hasMore: page.length > 50,
    };
  } catch {
    throw new Error('Could not load saved entries');
  }
}
export async function loadReminder(id: string) {
  try {
    const [initial] = await getDb()
      .select({
        reminderEnabled: settings.reminderEnabled,
        reminderTime: settings.reminderTime,
      })
      .from(settings)
      .where(eq(settings.profileId, id));
    return initial ?? DEFAULT_SETTINGS;
  } catch {
    throw new Error('Could not load reminder settings');
  }
}
