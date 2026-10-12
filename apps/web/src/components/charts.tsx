'use client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RECORDING_ENABLED } from '@down-up/shared';
type Point = {
  date: string;
  value: number | null;
  count: number;
  rolling: number | null;
  notePreview: string | null;
  audio: boolean;
};
export function Charts({
  points,
  counts,
  rolling,
  kind,
}: {
  points: Point[];
  counts: { value: number; count: number }[];
  rolling: boolean;
  kind: 'line' | 'counts';
}) {
  if (kind === 'counts')
    return (
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <BarChart data={counts} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="value"
              tickLine={false}
              axisLine={false}
              stroke="var(--muted)"
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              stroke="var(--muted)"
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                borderRadius: 10,
              }}
            />
            <Bar
              dataKey="count"
              name="Days"
              fill="var(--accent)"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  return (
    <div style={{ width: '100%', height: 310 }}>
      <ResponsiveContainer>
        <ComposedChart
          data={points}
          accessibilityLayer
          margin={{ top: 12, right: 12, left: -16, bottom: 8 }}
        >
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="date"
            minTickGap={36}
            tickFormatter={(date: string) => date.slice(5)}
            tickLine={false}
            axisLine={false}
            stroke="var(--muted)"
          />
          <YAxis
            domain={[1, 10]}
            ticks={[1, 3, 5, 7, 10]}
            tickLine={false}
            axisLine={false}
            stroke="var(--muted)"
          />
          <Tooltip
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as Point | undefined;
              return active && point ? (
                <div className="chart-tooltip">
                  <strong>{point.date}</strong>
                  <p>
                    {point.value?.toFixed(1) ?? '—'}
                    {point.count > 1 ? ` · ${point.count} days` : ''}
                  </p>
                  {point.notePreview && (
                    <p className="muted">{point.notePreview}</p>
                  )}
                  {RECORDING_ENABLED && point.audio && (
                    <p className="muted">Recording</p>
                  )}
                  {rolling && point.rolling !== null && (
                    <p className="muted">
                      7-day average: {point.rolling.toFixed(1)}
                    </p>
                  )}
                </div>
              ) : null;
            }}
          />
          <Line
            type="linear"
            dataKey="value"
            name="Value"
            stroke="var(--accent)"
            strokeWidth={2}
            connectNulls={false}
            isAnimationActive={false}
            dot={(props) => {
              const point = props.payload as Point;
              return point.value === null ? (
                <g key={point.date} />
              ) : (
                <circle
                  key={point.date}
                  cx={props.cx}
                  cy={props.cy}
                  r={
                    point.notePreview || (RECORDING_ENABLED && point.audio)
                      ? 4
                      : 2
                  }
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth={1}
                />
              );
            }}
          />
          {rolling && (
            <Line
              type="linear"
              dataKey="rolling"
              name="7-day average"
              stroke="var(--muted)"
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
