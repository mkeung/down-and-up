import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import {
  addDays,
  DEFAULT_SETTINGS,
  todayUTC,
  type StreakRun,
} from '@down-up/shared';
import { getDb } from './db';
import { entries, settings } from './schema';
import { serialize } from './sync';
export async function loadDashboardData(id: string, from: string, to: string) {
  try {
    const [history, page, first, streakRuns] = await Promise.all([
      getDb()
        .select({
          date: entries.date,
          value: entries.value,
          notePreview: sql<string | null>`left(${entries.note}, 80)`,
          audio: sql<boolean>`${entries.audioId} IS NOT NULL`,
        })
        .from(entries)
        .where(
          and(
            eq(entries.profileId, id),
            sql`${entries.date} BETWEEN ${addDays(from, -6)}::date AND ${to}::date`,
          ),
        )
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
      getDb()
        .select({ date: entries.date })
        .from(entries)
        .where(eq(entries.profileId, id))
        .orderBy(asc(entries.date))
        .limit(1),
      // Return only recent consecutive runs, including a UTC + 1 day margin.
      // The client resolves today/yesterday in its own local calendar.
      getDb().execute<StreakRun>(sql`
        WITH numbered AS (
          SELECT date, date - (row_number() OVER (ORDER BY date))::int AS island
          FROM entries WHERE profile_id = ${id} AND value IS NOT NULL
            AND date <= ${addDays(todayUTC(), 1)}::date
        )
        SELECT min(date)::text AS "from", max(date)::text AS "to"
        FROM numbered GROUP BY island ORDER BY max(date) DESC LIMIT 3
      `),
    ]);
    return {
      history,
      firstDate: first[0]?.date ?? null,
      streakRuns: [...streakRuns],
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
