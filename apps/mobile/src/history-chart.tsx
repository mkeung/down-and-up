import { useMemo, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { chartPoints, valueCounts, type Entry } from '@down-up/shared';
import { useTheme } from './theme';
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
  const x = (index: number) =>
    28 + (index * (width - 48)) / Math.max(1, points.length - 1);
  const y = (value: number) => 160 - (value - 1) * 15;
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => !counts,
    onMoveShouldSetPanResponder: () => !counts,
    onPanResponderGrant: (event) =>
      setSelected(
        Math.max(
          0,
          Math.min(
            points.length - 1,
            Math.round(
              ((event.nativeEvent.locationX - 28) *
                Math.max(1, points.length - 1)) /
                (width - 48),
            ),
          ),
        ),
      ),
    onPanResponderMove: (event) =>
      setSelected(
        Math.max(
          0,
          Math.min(
            points.length - 1,
            Math.round(
              ((event.nativeEvent.locationX - 28) *
                Math.max(1, points.length - 1)) /
                (width - 48),
            ),
          ),
        ),
      ),
  });
  let path = '';
  let previous = false;
  points.forEach((point, index) => {
    if (point.value === null) {
      previous = false;
      return;
    }
    path += `${previous ? 'L' : 'M'}${x(index)},${y(point.value)} `;
    previous = true;
  });
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
          distribution.map((item, index) => {
            const barWidth = (width - 50) / 10;
            const height =
              (item.count * 130) /
              Math.max(1, ...distribution.map((row) => row.count));
            return (
              <ViewForSvg key={item.value}>
                <Rect
                  x={30 + index * barWidth}
                  y={170 - height}
                  width={barWidth - 6}
                  height={height}
                  fill={theme.accent}
                />
                <SvgText
                  x={30 + index * barWidth}
                  y={191}
                  fontSize={12}
                  fill={theme.text}
                >
                  {item.value}
                </SvgText>
              </ViewForSvg>
            );
          })
        ) : (
          <>
            <Path d={path} stroke={theme.accent} strokeWidth={2} fill="none" />
            {points.map((point, index) =>
              point.value === null ? null : (
                <Rect
                  key={point.date}
                  x={x(index) - (index === selected ? 5 : 3)}
                  y={y(point.value) - (index === selected ? 5 : 3)}
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
