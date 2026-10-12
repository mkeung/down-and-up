import { useEffect, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  dateLabel,
  eachDay,
  presetRange,
  RECORDING_ENABLED,
  RANGE_PRESETS,
  summary,
  todayLocal,
  type LocalEntry,
  type RangePreset,
} from '@down-up/shared';
import { useTheme } from '../src/theme';
import { reportError, useApp } from '../src/app-context';
import { Action, Row } from '../src/components';
import { HistoryChart } from '../src/history-chart';
import { useSelectedDate } from '../src/selected-date';
export default function History() {
  const app = useApp();
  const theme = useTheme();
  const { selectDate } = useSelectedDate();
  const [entries, setEntries] = useState<LocalEntry[]>([]);
  const [preset, setPreset] = useState<RangePreset>('30D');
  const [counts, setCounts] = useState(false);
  const [today, setToday] = useState(todayLocal);
  const reload = useCallback(() => {
    setToday(todayLocal());
    void app.repo.list().then(setEntries).catch(reportError);
  }, [app.repo]);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  useEffect(reload, [reload, app.revision]);
  const range = presetRange(preset, today, entries.at(-1)?.date);
  const stats = summary(entries, range.from, range.to);
  const byDate = useMemo(
    () => new Map(entries.map((entry) => [entry.date, entry])),
    [entries],
  );
  const dates = useMemo(
    () => Array.from(eachDay(range.from, range.to)).reverse(),
    [range.from, range.to],
  );
  const rowsInRange = entries.filter(
    (entry) => entry.date >= range.from && entry.date <= range.to,
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={dates}
        keyExtractor={(date) => date}
        contentContainerStyle={{ padding: 24 }}
        refreshing={app.status === 'Syncing…'}
        onRefresh={() => {
          reload();
          void app.engine.sync();
        }}
        ListHeaderComponent={
          <View style={{ gap: 16, paddingBottom: 24 }}>
            <Text
              style={{ fontSize: 30, color: theme.text, fontWeight: '600' }}
            >
              History
            </Text>
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
            {rowsInRange.length ? (
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
