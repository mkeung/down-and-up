import 'server-only';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import {
  addDays,
  chartGranularity,
  chartSeries,
  DEFAULT_SETTINGS,
  summary,
  todayUTC,
  valueCounts,
  weekdayAverages,
  type SeriesPoint,
  type StreakRun,
} from '@down-up/shared';
import { getDb } from './db';
import { entries, settings } from './schema';
import { serialize } from './sync';
// Daily points may carry a note preview; bucketed points never describe a single day.
export type DashboardPoint = SeriesPoint & {
  notePreview?: string;
  audio?: true;
};
type HistoryRow = {
  date: string;
  value: number | null;
  notePreview?: string | null;
  audio?: boolean;
};
export async function loadDashboardData(id: string, from: string, to: string) {
  const daily = chartGranularity(from, to) === 'daily';
  const range = sql`${entries.date} BETWEEN ${addDays(from, -6)}::date AND ${to}::date`;
  try {
    const [rows, page, [meta]] = await Promise.all([
      // Statistics need only logged values; notes are fetched only for daily ranges.
      daily
        ? getDb()
            .select({
              date: entries.date,
              value: entries.value,
              notePreview: sql<string | null>`left(${entries.note}, 80)`,
              audio: sql<boolean>`${entries.audioId} IS NOT NULL`,
            })
            .from(entries)
            .where(and(eq(entries.profileId, id), range))
        : getDb()
            .select({ date: entries.date, value: entries.value })
            .from(entries)
            .where(
              and(eq(entries.profileId, id), isNotNull(entries.value), range),
            ),
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
      // One round trip for lifetime metadata: the earliest entry (for All) and
      // only recent consecutive runs, including a UTC + 1 day margin. The
      // client resolves today/yesterday in its own local calendar.
      getDb().execute<{ firstDate: string | null; streakRuns: StreakRun[] }>(
        sql`
        WITH numbered AS (
          SELECT date, date - (row_number() OVER (ORDER BY date))::int AS island
          FROM entries WHERE profile_id = ${id} AND value IS NOT NULL
            AND date <= ${addDays(todayUTC(), 1)}::date
        ), runs AS (
          SELECT min(date)::text AS "from", max(date)::text AS "to"
          FROM numbered GROUP BY island ORDER BY max(date) DESC LIMIT 3
        )
        SELECT
          (SELECT min(date)::text FROM entries WHERE profile_id = ${id}) AS "firstDate",
          coalesce(
            (SELECT json_agg(json_build_object('from', "from", 'to', "to")
              ORDER BY "to" DESC) FROM runs),
            '[]'::json
          ) AS "streakRuns"
      `,
      ),
    ]);
    const history: HistoryRow[] = rows;
    const notes = new Map(
      history.flatMap((row) =>
        row.notePreview || row.audio ? [[row.date, row] as const] : [],
      ),
    );
    const points: DashboardPoint[] = chartSeries(history, from, to).map(
      (point) => {
        const row = notes.get(point.date);
        return {
          ...point,
          ...(row?.notePreview ? { notePreview: row.notePreview } : {}),
          ...(row?.audio ? { audio: true as const } : {}),
        };
      },
    );
    return {
      points,
      stats: summary(history, from, to),
      counts: valueCounts(history, from, to),
      weekdays: weekdayAverages(history, from, to),
      firstDate: meta?.firstDate ?? null,
      streakRuns: meta?.streakRuns ?? [],
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
