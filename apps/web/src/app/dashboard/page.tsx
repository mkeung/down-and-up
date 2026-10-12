import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  addDays,
  isCalendarDate,
  presetRange,
  todayUTC,
} from '@down-up/shared';
import { sessionProfile } from '../../server/auth';
import { loadDashboardData } from '../../server/dashboard-data';
import { Dashboard } from '../../components/dashboard';
import { SignOut } from '../../components/sign-out';
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
      header={
        <div className="page-top">
          <div>
            <p className="eyebrow">Your record</p>
            <h1>A view over time.</h1>
            <p className="muted">
              {from} — {to}
            </p>
          </div>
          <nav className="nav-actions" aria-label="Dashboard">
            <Link href="/settings">Reminder</Link>
            <SignOut />
          </nav>
        </div>
      }
      points={data.points}
      stats={data.stats}
      counts={data.counts}
      firstDate={data.firstDate}
      streakRuns={data.streakRuns}
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
