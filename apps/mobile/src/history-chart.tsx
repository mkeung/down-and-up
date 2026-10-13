import { useMemo, useState } from 'react';
import {
  PanResponder,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import {
  chartDateLabel,
  chartPoints,
  valueCounts,
  weekdayAverages,
  type Entry,
} from '@down-up/shared';
import { useTheme } from './theme';
const x = (index: number, count: number, width: number) =>
  28 + (index * (width - 48)) / Math.max(1, count - 1);
const y = (value: number) => 160 - (value - 1) * 15;
export function HistoryChart({
  entries,
  from,
  to,
  counts,
}: {
  entries: readonly Entry[];
  from: string;
  to: string;
  counts: boolean;
}) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(320);
  const [selected, setSelected] = useState<number | null>(null);
  const points = useMemo(
    () => chartPoints(entries, from, to),
    [entries, from, to],
  );
  const distribution = useMemo(
    () => valueCounts(entries, from, to),
    [entries, from, to],
  );
  const count = points.length;
  const dateTicks = useMemo(() => {
    const tickCount = Math.min(
      count,
      Math.max(2, Math.floor((width - 48) / (52 * fontScale)) + 1),
    );
    return Array.from({ length: tickCount }, (_, index) => {
      const pointIndex = Math.round(
        (index * (count - 1)) / Math.max(1, tickCount - 1),
      );
      const point = points[pointIndex]!;
      return {
        ...chartDateLabel(point.date),
        x: x(pointIndex, count, width),
        key: point.date,
        anchor:
          index === 0
            ? ('start' as const)
            : index === tickCount - 1
              ? ('end' as const)
              : ('middle' as const),
      };
    });
  }, [points, count, width, fontScale]);
  // Created only when the hit-test inputs change, not on every drag update.
  const responder = useMemo(() => {
    const inspect = (event: GestureResponderEvent) =>
      setSelected(
        Math.max(
          0,
          Math.min(
            count - 1,
            Math.round(
              ((event.nativeEvent.locationX - 28) * Math.max(1, count - 1)) /
                (width - 48),
            ),
          ),
        ),
      );
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !counts,
      onMoveShouldSetPanResponder: () => !counts,
      onPanResponderGrant: inspect,
      onPanResponderMove: inspect,
    });
  }, [count, counts, width]);
  // Plotted positions only change with the data or the chart width.
  const plotted = useMemo(
    () =>
      points.map((point, index) =>
        point.value === null
          ? null
          : { date: point.date, x: x(index, count, width), y: y(point.value) },
      ),
    [points, count, width],
  );
  const path = useMemo(() => {
    let path = '';
    let previous = false;
    for (const point of plotted) {
      if (!point) {
        previous = false;
        continue;
      }
      path += `${previous ? 'L' : 'M'}${point.x},${point.y} `;
      previous = true;
    }
    return path;
  }, [plotted]);
  const bars = useMemo(() => {
    const barWidth = (width - 50) / 10;
    const most = Math.max(1, ...distribution.map((row) => row.count));
    return distribution.map((item, index) => ({
      value: item.value,
      x: 30 + index * barWidth,
      width: barWidth - 6,
      height: (item.count * 130) / most,
    }));
  }, [distribution, width]);
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      {...responder.panHandlers}
    >
      <Svg
        width={width}
        height={counts ? 195 : 180 + 38 * fontScale}
        accessibilityLabel={counts ? 'Value counts' : 'Values over time'}
      >
        {[1, 5, 10].map((value) => (
          <SvgText
            key={value}
            x={2}
            y={y(value) + 4}
            fontSize={12}
            fill={theme.muted}
          >
            {value}
          </SvgText>
        ))}
        <Line x1={26} y1={174} x2={width - 12} y2={174} stroke={theme.line} />
        {counts ? (
          bars.map((item) => (
            <ViewForSvg key={item.value}>
              <Rect
                x={item.x}
                y={170 - item.height}
                width={item.width}
                height={item.height}
                fill={theme.accent}
              />
              <SvgText x={item.x} y={191} fontSize={12} fill={theme.text}>
                {item.value}
              </SvgText>
            </ViewForSvg>
          ))
        ) : (
          <>
            <Path d={path} stroke={theme.accent} strokeWidth={2} fill="none" />
            {dateTicks.map((tick) => (
              <ViewForSvg key={tick.key}>
                <SvgText
                  x={tick.x}
                  y={174 + 16 * fontScale}
                  textAnchor={tick.anchor}
                  fontSize={11 * fontScale}
                  fill={theme.muted}
                >
                  {tick.weekday}
                </SvgText>
                <SvgText
                  x={tick.x}
                  y={174 + 32 * fontScale}
                  textAnchor={tick.anchor}
                  fontSize={11 * fontScale}
                  fill={theme.muted}
                >
                  {tick.date}
                </SvgText>
              </ViewForSvg>
            ))}
            {plotted.map((point, index) =>
              point === null ? null : (
                <Rect
                  key={point.date}
                  x={point.x - (index === selected ? 5 : 3)}
                  y={point.y - (index === selected ? 5 : 3)}
                  width={index === selected ? 10 : 6}
                  height={index === selected ? 10 : 6}
                  fill={theme.accent}
                />
              ),
            )}
          </>
        )}
      </Svg>
      <Text
        accessibilityLiveRegion="polite"
        style={{ color: theme.muted, minHeight: 24 }}
      >
        {counts
          ? distribution
              .map((item) => `${item.value}: ${item.count}`)
              .join(' · ')
          : selected !== null && points[selected]
            ? `${points[selected]!.date} · ${points[selected]!.value?.toFixed(1) ?? '—'}`
            : 'Touch the chart to inspect'}
      </Text>
    </View>
  );
}

export function WeekdayChart({
  entries,
  from,
  to,
}: {
  entries: readonly Entry[];
  from: string;
  to: string;
}) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(320);
  const averages = useMemo(
    () => weekdayAverages(entries, from, to),
    [entries, from, to],
  );
  const chartWidth = Math.max(width, 40 + 7 * 36 * fontScale);
  const topPadding = Math.max(0, (fontScale - 1) * 24);
  const barWidth = (chartWidth - 40) / 7;
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <ScrollView horizontal accessibilityLabel="Average by weekday chart">
        <Svg
          width={chartWidth}
          height={180 + 32 * fontScale + topPadding}
          accessibilityLabel="Average by weekday"
        >
          <ViewForSvg transform={`translate(0 ${topPadding})`}>
            {[1, 5, 10].map((value) => (
              <SvgText
                key={value}
                x={2}
                y={174 - value * 14 + 4}
                fontSize={12 * fontScale}
                fill={theme.muted}
              >
                {value}
              </SvgText>
            ))}
            <Line
              x1={26}
              y1={174}
              x2={chartWidth - 12}
              y2={174}
              stroke={theme.line}
            />
            {averages.map((point, index) => {
              const center = 28 + (index + 0.5) * barWidth;
              return (
                <ViewForSvg key={point.weekday}>
                  {point.average !== null && (
                    <Rect
                      x={center - barWidth * 0.3}
                      y={174 - point.average * 14}
                      width={barWidth * 0.6}
                      height={point.average * 14}
                      fill={theme.accent}
                    />
                  )}
                  <SvgText
                    x={center}
                    y={
                      point.average === null
                        ? 174 - 8 * fontScale
                        : 174 - 8 * fontScale - point.average * 14
                    }
                    textAnchor="middle"
                    fontSize={11 * fontScale}
                    fill={theme.text}
                  >
                    {point.average?.toFixed(1) ?? '—'}
                  </SvgText>
                  <SvgText
                    x={center}
                    y={174 + 20 * fontScale}
                    textAnchor="middle"
                    fontSize={11 * fontScale}
                    fill={theme.muted}
                  >
                    {point.weekday}
                  </SvgText>
                </ViewForSvg>
              );
            })}
          </ViewForSvg>
        </Svg>
      </ScrollView>
      <Text style={{ color: theme.muted }}>
        {averages
          .map(
            (point) =>
              `${point.weekday}: ${point.average?.toFixed(1) ?? '—'} (${point.count} ${point.count === 1 ? 'day' : 'days'})`,
          )
          .join(' · ')}
      </Text>
    </View>
  );
}
import { G } from 'react-native-svg';
const ViewForSvg = G;
