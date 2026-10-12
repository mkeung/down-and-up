import { useMemo, useState } from 'react';
import {
  PanResponder,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { chartPoints, valueCounts, type Entry } from '@down-up/shared';
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
        height={195}
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
import { G } from 'react-native-svg';
const ViewForSvg = G;
