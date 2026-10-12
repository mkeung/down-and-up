import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VirtualizedList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useIsFocused } from 'expo-router';
import {
  dateLabel,
  addDays,
  presetRange,
  RECORDING_ENABLED,
  RANGE_PRESETS,
  summary,
  todayLocal,
  type LocalEntry,
  type RangePreset,
} from '@down-up/shared';
import { useTheme } from '../src/theme';
import { PixelText } from '../src/retro';
import { reportError, useApp } from '../src/app-context';
import { Action, Row } from '../src/components';
import { HistoryChart } from '../src/history-chart';
import { useSelectedDate } from '../src/selected-date';
export default function History() {
  const app = useApp();
  const theme = useTheme();
  const { selectDate } = useSelectedDate();
  const focused = useIsFocused();
  const [preset, setPreset] = useState<RangePreset>('30D');
  const [counts, setCounts] = useState(false);
  const request = useRef({ version: 0 });
  const [loaded, setLoaded] = useState(() => ({
    entries: [] as LocalEntry[],
    today: todayLocal(),
    range: presetRange('30D', todayLocal()),
  }));
  const { entries, today, range } = loaded;
  const reload = useCallback(
    (active: () => boolean = () => true) => {
      const version = ++request.current.version;
      void (async () => {
        const today = todayLocal();
        const first = preset === 'All' ? await app.repo.firstDate() : null;
        const range = presetRange(preset, today, first);
        const entries = await app.repo.list(range.from, range.to);
        if (active() && request.current.version === version)
          setLoaded({ entries, today, range });
      })().catch(reportError);
    },
    [app.repo, preset],
  );
  useEffect(() => {
    if (!focused) return;
    const requests = request.current;
    let active = true;
    reload(() => active);
    return () => {
      active = false;
      requests.version++;
    };
  }, [reload, app.revision, focused]);
  const stats = useMemo(
    () => summary(entries, range.from, range.to),
    [entries, range.from, range.to],
  );
  const byDate = useMemo(
    () => new Map(entries.map((entry) => [entry.date, entry])),
    [entries],
  );
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <VirtualizedList<string>
        testID="history-list"
        data={range}
        getItem={(range: { to: string }, index) => addDays(range.to, -index)}
        getItemCount={() => stats.days}
        keyExtractor={(date) => date}
        contentContainerStyle={{ padding: 24 }}
        refreshing={app.status === 'Syncing…'}
        onRefresh={() => {
          reload();
          void app.engine.sync();
        }}
        ListHeaderComponent={
          <View style={{ gap: 16, paddingBottom: 24 }}>
            <PixelText style={{ fontSize: 28, color: theme.text }}>
              History
            </PixelText>
            <Row>
              {RANGE_PRESETS.map((rangePreset) => (
                <Action
                  key={rangePreset}
                  label={rangePreset}
                  selected={preset === rangePreset}
                  onPress={() => setPreset(rangePreset)}
                />
              ))}
            </Row>
            <Text style={{ color: theme.text, fontSize: 18 }}>
              avg {stats.average?.toFixed(1) ?? '—'} · min {stats.min ?? '—'} ·
              max {stats.max ?? '—'}
            </Text>
            <Text style={{ color: theme.muted }}>
              {stats.logged} of {stats.days} days
            </Text>
            {entries.length ? (
              <>
                <HistoryChart
                  entries={entries}
                  from={range.from}
                  to={range.to}
                  counts={counts}
                />
                <Row>
                  <Action
                    label="Chart"
                    selected={!counts}
                    onPress={() => setCounts(false)}
                  />
                  <Action
                    label="Counts"
                    selected={counts}
                    onPress={() => setCounts(true)}
                  />
                </Row>
              </>
            ) : (
              <Text style={{ color: theme.muted }}>Nothing recorded yet</Text>
            )}
          </View>
        }
        renderItem={({ item: date }) => {
          const row = byDate.get(date);
          return (
            <Action
              label={`${dateLabel(date, today)}, ${row?.value ?? 'no value'}${row?.note ? ', note' : ''}${RECORDING_ENABLED && row?.audioId ? ', recording' : ''}`}
              onPress={() => {
                selectDate(date);
                router.navigate('/');
              }}
              style={{ marginBottom: 8, alignItems: 'stretch' }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <Text
                  style={{ color: theme.text, fontSize: 16, flexShrink: 1 }}
                >
                  {dateLabel(date, today)}
                </Text>
                <Text style={{ color: theme.text }}>
                  {row?.value ?? '—'} {row?.note ? '✎' : ''}{' '}
                  {RECORDING_ENABLED && row?.audioId ? '●' : ''}{' '}
                  {row && Object.values(row.dirtyFields).some(Boolean)
                    ? '·'
                    : ''}
                </Text>
              </View>
              {row?.note && (
                <Text
                  numberOfLines={1}
                  style={{ color: theme.muted, marginTop: 6 }}
                >
                  {row.note}
                </Text>
              )}
            </Action>
          );
        }}
      />
    </SafeAreaView>
  );
}
