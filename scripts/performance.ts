import { performance } from 'node:perf_hooks';
import { chartPoints, rollingAverage } from '../packages/shared/src';

const to = '2026-10-12';
const cases = ['2026-09-13', '2016-10-13', '1900-01-01'];
const results = cases.map((from) => {
  const entries = [
    { date: from, value: 5 },
    { date: to, value: 7 },
  ];
  const measure = (operation: () => unknown) => {
    operation();
    const samples = Array.from({ length: 3 }, () => {
      const start = performance.now();
      operation();
      return performance.now() - start;
    }).sort((a, b) => a - b);
    return Math.round(samples[1]! * 10) / 10;
  };
  return {
    from,
    to,
    points: chartPoints(entries, from, to).length,
    chartMs: measure(() => chartPoints(entries, from, to)),
    rollingOverlayMs: measure(() =>
      chartPoints(rollingAverage(entries, from, to), from, to),
    ),
  };
});
console.table(results);
