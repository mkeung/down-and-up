'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  chartPoints,
  currentStreak,
  daysInRange,
  isCalendarDate,
  presetRange,
  RANGE_PRESETS,
  rollingAverage,
  summary,
  todayLocal,
  valueCounts,
  type RangePreset,
  type ServerEntry,
} from '@down-up/shared';
import { Charts } from './charts';
import { EntriesTable } from './entries-table';
import { SignOut } from './sign-out';
export type ChartEntry = {
  date: string;
  value: number | null;
  notePreview: string | null;
  audio: boolean;
};
export function Dashboard({
  history,
  from,
  to,
  initialRows,
  initialHasMore,
  hasRange,
}: {
  history: ChartEntry[];
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
      const range = presetRange('30D', local);
      router.replace(`/dashboard?from=${range.from}&to=${range.to}`);
    }
  }, [hasRange, router]);
  useEffect(() => {
    setCustomFrom(from);
    setCustomTo(to);
  }, [from, to]);
  const stats = useMemo(() => summary(history, from, to), [history, from, to]);
  const streak = useMemo(() => currentStreak(history, today), [history, today]);
  const points = useMemo(() => {
    const chart = chartPoints(history, from, to);
    const averages = rolling
      ? chartPoints(rollingAverage(history, from, to), from, to)
      : [];
    const byDate = new Map(history.map((row) => [row.date, row]));
    return chart.map((point, index) => ({
      ...point,
      rolling: averages[index]?.value ?? null,
      notePreview: byDate.get(point.date)?.notePreview ?? null,
      audio: byDate.get(point.date)?.audio ?? false,
    }));
  }, [history, from, to, rolling]);
  const counts = useMemo(
    () => valueCounts(history, from, to),
    [history, from, to],
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
    const range = presetRange(preset, today, history[0]?.date);
    changeRange(range.from, range.to);
  }
  const granularity =
    daysInRange(from, to) <= 90
      ? 'Daily values'
      : daysInRange(from, to) <= 730
        ? 'Weekly averages'
        : 'Monthly averages';
  return (
    <main aria-busy={pending}>
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
      <div className="range-controls">
        <div className="presets">
          {RANGE_PRESETS.map((item) => {
            const range = presetRange(item, today, history[0]?.date);
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
          <Charts
            points={points}
            counts={counts}
            rolling={rolling}
            kind="line"
          />
        ) : (
          <p className="empty">Nothing recorded yet</p>
        )}
      </section>
      <section className="chart-card">
        <h2>Value counts</h2>
        <Charts points={points} counts={counts} rolling={false} kind="counts" />
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
