import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Keyboard,
  Modal,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  addDays,
  calendarDate,
  dateLabel,
  isCalendarDate,
  isFutureDate,
  SYNC_DATE_FLOOR,
  todayLocal,
  type LocalEntry,
} from '@down-up/shared';
import { Action, Row } from '../src/components';
import { reportError, useApp } from '../src/app-context';
import { useTheme } from '../src/theme';
import { NoteEditor } from '../src/note-editor';
import { AudioNote } from '../src/audio-note';
import { PrivacyNotice } from '../src/privacy-notice';

export default function Today() {
  const app = useApp();
  const theme = useTheme();
  const params = useLocalSearchParams<{
    date?: string;
    notification?: string;
  }>();
  const [today, setToday] = useState(todayLocal);
  const [date, setDate] = useState(todayLocal);
  const [entry, setEntry] = useState<LocalEntry | null>(null);
  const [picker, setPicker] = useState(false);
  const [recording, setRecording] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const previousToday = useRef(today);
  const onRecording = useCallback(
    (active: boolean) => setRecording(active),
    [],
  );
  useEffect(() => {
    if (
      params.date &&
      isCalendarDate(params.date) &&
      !isFutureDate(params.date)
    )
      setDate(params.date);
  }, [params.date, params.notification]);
  useEffect(() => {
    let active = true;
    void app.repo
      .get(date)
      .then((row) => {
        if (active) setEntry(row);
      })
      .catch(reportError);
    return () => {
      active = false;
    };
  }, [app.repo, app.revision, date]);
  useEffect(() => {
    const refresh = () => {
      const next = todayLocal();
      const previous = previousToday.current;
      setToday(next);
      if (!recording && previous !== next) {
        previousToday.current = next;
        setDate((selected) => (selected === previous ? next : selected));
      }
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const timer = setInterval(refresh, 30_000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [recording]);
  const choose = (value: number) => {
    void app.repo
      .setField(date, 'value', value)
      .then((changed) => (changed ? Haptics.selectionAsync() : undefined))
      .catch(reportError);
  };
  const selectedEntry = entry?.date === date ? entry : null;
  const selectDate = (next: string) => {
    setDate(next);
    router.setParams({ date: next });
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, gap: 22, alignItems: 'center' }}
      >
        <View style={{ width: '100%', maxWidth: 420, gap: 24 }}>
          <Row>
            <Action
              label="Previous day"
              disabled={recording || date === '0001-01-01'}
              onPress={() => selectDate(addDays(date, -1))}
            >
              <Text style={{ color: theme.text, fontSize: 24 }}>‹</Text>
            </Action>
            <Action
              label={`Choose date, ${dateLabel(date, today)}`}
              disabled={recording}
              onPress={() => setPicker(true)}
              style={{ flex: 1 }}
            >
              <Text
                style={{ color: theme.text, fontSize: 17, textAlign: 'center' }}
              >
                {dateLabel(date, today)}
              </Text>
            </Action>
            <Action
              label="Next day"
              disabled={recording || date >= today}
              onPress={() => selectDate(addDays(date, 1))}
            >
              <Text style={{ color: theme.text, fontSize: 24 }}>›</Text>
            </Action>
          </Row>
          {picker && (
            <DateTimePicker
              accessibilityLabel="Choose date"
              value={calendarDate(date)}
              mode="date"
              maximumDate={calendarDate(today)}
              onChange={(_event, chosen) => {
                setPicker(false);
                if (chosen) {
                  const next = todayLocal(chosen);
                  if (next <= today) selectDate(next);
                }
              }}
            />
          )}
          <View style={{ gap: 12 }}>
            {[0, 1, 2, 3].map((row) => (
              <View
                key={row}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 12,
                }}
              >
                {(row === 3
                  ? [10]
                  : [row * 3 + 1, row * 3 + 2, row * 3 + 3]
                ).map((value) => (
                  <Action
                    key={value}
                    label={String(value)}
                    selected={selectedEntry?.value === value}
                    onPress={() => choose(value)}
                    style={{
                      width: '29%',
                      minWidth: 64,
                      minHeight: 76,
                      aspectRatio: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 30,
                        color: theme.text,
                        fontWeight:
                          selectedEntry?.value === value ? '800' : '400',
                      }}
                    >
                      {value}
                    </Text>
                  </Action>
                ))}
              </View>
            ))}
          </View>
          {date < SYNC_DATE_FLOOR && (
            <Text style={{ color: theme.muted }}>
              Dates before 1900 are saved on this phone only.
            </Text>
          )}
          <NoteEditor
            key={date}
            date={date}
            note={selectedEntry?.note ?? null}
          />
          <AudioNote
            date={date}
            entry={selectedEntry}
            onRecording={onRecording}
          />
          {app.needsIdentity && (
            <>
              <Text style={{ color: theme.text }}>
                Enter your ID to keep syncing
              </Text>
              <Action
                label="Enter ID"
                onPress={() => router.navigate('/settings')}
              />
            </>
          )}
          <Action
            label={app.syncEnabled ? app.status : 'Saved on this phone'}
            onPress={() => {
              void app.engine.sync();
            }}
            disabled={!app.syncEnabled}
            style={{ borderWidth: 0, backgroundColor: theme.background }}
          />
        </View>
      </ScrollView>
      <Modal
        visible={app.needsConsent && !privacyVisible}
        transparent
        animationType="fade"
        onRequestClose={() => undefined}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#0008',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 24,
              padding: 28,
              gap: 20,
            }}
          >
            <Text
              style={{ color: theme.text, fontSize: 24, fontWeight: '600' }}
            >
              Down & Up
            </Text>
            <Text style={{ color: theme.text, fontSize: 18 }}>
              Your entries are saved on this phone and synced to our server so
              you can view them on the web.
            </Text>
            <Action
              label="Privacy policy"
              onPress={() => setPrivacyVisible(true)}
            />
            <Action
              label="Continue"
              onPress={() => {
                void app.consent(true).catch(reportError);
              }}
            />
            <Action
              label="Keep on this phone only"
              onPress={() => {
                void app.consent(false).catch(reportError);
              }}
            />
          </View>
        </View>
      </Modal>
      <Modal
        visible={privacyVisible}
        animationType="slide"
        onRequestClose={() => setPrivacyVisible(false)}
      >
        <PrivacyNotice close={() => setPrivacyVisible(false)} />
      </Modal>
    </SafeAreaView>
  );
}
