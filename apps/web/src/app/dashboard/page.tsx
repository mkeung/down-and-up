import { redirect } from 'next/navigation';
import {
  addDays,
  isCalendarDate,
  presetRange,
  todayUTC,
} from '@down-up/shared';
import { sessionProfile } from '../../server/auth';
import { loadDashboardData } from '../../server/dashboard-data';
import { Dashboard } from '../../components/dashboard';
export const dynamic = 'force-dynamic';
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const id = await sessionProfile();
  if (!id) redirect('/');
  const search = await searchParams;
  const initial = presetRange('30D', todayUTC());
  const from =
    typeof search.from === 'string' &&
    isCalendarDate(search.from) &&
    search.from >= '1900-01-01' &&
    search.from <= addDays(todayUTC(), 1)
      ? search.from
      : initial.from;
  const to =
    typeof search.to === 'string' &&
    isCalendarDate(search.to) &&
    search.to <= addDays(todayUTC(), 1) &&
    search.to >= from
      ? search.to
      : initial.to;
  const data = await loadDashboardData(id, from, to);
  return (
    <Dashboard
      history={data.history}
      from={from}
      to={to}
      initialRows={data.rows}
      initialHasMore={data.hasMore}
      hasRange={
        typeof search.from === 'string' && typeof search.to === 'string'
      }
    />
  );
}
