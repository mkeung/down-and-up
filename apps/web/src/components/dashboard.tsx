'use client';
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  chartGranularity,
  currentStreakFromRuns,
  isCalendarDate,
  presetRange,
  RANGE_PRESETS,
  todayLocal,
  type RangePreset,
  type ServerEntry,
  type StreakRun,
} from '@down-up/shared';
import type { DashboardPoint } from '../server/dashboard-data';
import { EntriesTable } from './entries-table';
// Recharts loads after hydration; fixed-height frames below prevent layout shift.
const Charts = dynamic(() => import('./charts').then((mod) => mod.Charts), {
  ssr: false,
});
const GRANULARITY_LABELS = {
  daily: 'Daily values',
  weekly: 'Weekly averages',
  monthly: 'Monthly averages',
} as const;
export function Dashboard({
  header,
  points,
  stats,
  counts,
  firstDate,
  streakRuns,
  from,
  to,
  initialRows,
  initialHasMore,
  hasRange,
}: {
  header: ReactNode;
  points: DashboardPoint[];
  stats: {
    average: number | null;
    min: number | null;
    max: number | null;
    logged: number;
    days: number;
  };
  counts: { value: number; count: number }[];
  firstDate: string | null;
  streakRuns: StreakRun[];
  from: string;
  to: string;
  initialRows: ServerEntry[];
  initialHasMore: boolean;
  hasRange: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  const [today, setToday] = useState(to);
  const [rolling, setRolling] = useState(false);
  const [rangeError, setRangeError] = useState('');
  useEffect(() => {
    const local = todayLocal();
    setToday(local);
    if (!hasRange) {
      // The server rendered its UTC 30D default; only refetch if the local range differs.
      const range = presetRange('30D', local);
      if (range.from !== from || range.to !== to)
        router.replace(`/dashboard?from=${range.from}&to=${range.to}`);
    }
  }, [hasRange, from, to, router]);
  useEffect(() => {
    setCustomFrom(from);
    setCustomTo(to);
  }, [from, to]);
  const streak = useMemo(
    () => currentStreakFromRuns(streakRuns, today),
    [streakRuns, today],
  );
  function changeRange(nextFrom: string, nextTo: string) {
    if (
      !isCalendarDate(nextFrom) ||
      !isCalendarDate(nextTo) ||
      nextFrom > nextTo ||
      nextTo > today ||
      nextFrom < '1900-01-01'
    ) {
      setRangeError(
        'Choose a range ending today or earlier, from 1900 onward.',
      );
      return;
    }
    setRangeError('');
    startTransition(() =>
      router.push(`/dashboard?from=${nextFrom}&to=${nextTo}`),
    );
  }
  function preset(preset: RangePreset) {
    const range = presetRange(preset, today, firstDate);
    changeRange(range.from, range.to);
  }
  const granularity = GRANULARITY_LABELS[chartGranularity(from, to)];
  return (
    <main aria-busy={pending}>
      {header}
      <div className="range-controls">
        <div className="presets">
          {RANGE_PRESETS.map((item) => {
            const range = presetRange(item, today, firstDate);
            return (
              <button
                key={item}
                disabled={pending}
                aria-pressed={from === range.from && to === range.to}
                onClick={() => preset(item)}
              >
                {item}
              </button>
            );
          })}
        </div>
        <form
          className="custom-range"
          onSubmit={(event) => {
            event.preventDefault();
            changeRange(customFrom, customTo);
          }}
        >
          <label>
            From
            <input
              aria-label="From date"
              type="date"
              value={customFrom}
              min="1900-01-01"
              max={today}
              onChange={(event) => setCustomFrom(event.target.value)}
              required
            />
          </label>
          <label>
            To
            <input
              aria-label="To date"
              type="date"
              value={customTo}
              min={customFrom}
              max={today}
              onChange={(event) => setCustomTo(event.target.value)}
              required
            />
          </label>
          <button disabled={pending}>Apply</button>
        </form>
      </div>
      {rangeError && <p role="alert">{rangeError}</p>}
      <div className="stats">
        {[
          {
            label: 'Average',
            value: stats.average?.toFixed(1) ?? '—',
            detail: 'in this range',
          },
          {
            label: 'Minimum',
            value: stats.min ?? '—',
            detail: 'in this range',
          },
          {
            label: 'Maximum',
            value: stats.max ?? '—',
            detail: 'in this range',
          },
          {
            label: 'Days logged',
            value: stats.logged,
            detail: `of ${stats.days} days`,
          },
          {
            label: 'Current streak',
            value: streak,
            detail: `${streak === 1 ? 'day' : 'days'}`,
          },
        ].map((stat) => (
          <div className="stat" key={stat.label}>
            <div className="stat-label">{stat.label}</div>
            <div className="stat-number">{stat.value}</div>
            <div className="stat-detail">{stat.detail}</div>
          </div>
        ))}
      </div>
      <section className="chart-card">
        <div className="chart-head">
          <div>
            <h2>{granularity}</h2>
            <span className="muted small">
              A gap means no value was recorded.
            </span>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={rolling}
              onChange={(event) => setRolling(event.target.checked)}
            />
            7-day rolling average
          </label>
        </div>
        {stats.logged ? (
          <div style={{ height: 310 }}>
            <Charts
              points={points}
              counts={counts}
              rolling={rolling}
              kind="line"
            />
          </div>
        ) : (
          <p className="empty">Nothing recorded yet</p>
        )}
      </section>
      <section className="chart-card">
        <h2>Value counts</h2>
        <div style={{ height: 200 }}>
          <Charts
            points={points}
            counts={counts}
            rolling={false}
            kind="counts"
          />
        </div>
      </section>
      <EntriesTable
        key={`${from}:${to}`}
        from={from}
        to={to}
        initialRows={initialRows}
        initialHasMore={initialHasMore}
      />
    </main>
  );
}
