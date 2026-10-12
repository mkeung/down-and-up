import { useState } from 'react';
import { Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  addDays,
  calendarDate,
  dateLabel,
  SYNC_DATE_FLOOR,
  todayLocal,
} from '@down-up/shared';
import { Action, Row } from './components';
import { useSelectedDate } from './selected-date';
import { useTheme } from './theme';
import { PixelChevron, PixelText } from './retro';

export function DateBar() {
  const theme = useTheme();
  const { date, today, selectDate, recording } = useSelectedDate();
  const [picker, setPicker] = useState(false);
  // Always two single-line rows so the button never changes height.
  const relative =
    date === today ? 'Today' : date === addDays(today, -1) ? 'Yesterday' : null;
  const heading =
    relative ??
    calendarDate(date).toLocaleDateString(undefined, { weekday: 'long' });
  return (
    <>
      <Row>
        <Action
          label="Previous day"
          disabled={recording || date === '0001-01-01'}
          onPress={() => selectDate(addDays(date, -1))}
        >
          <PixelChevron direction="left" color={theme.text} />
        </Action>
        <Action
          label={`Choose date, ${dateLabel(date, today)}`}
          disabled={recording}
          onPress={() => setPicker(true)}
          style={{ flex: 1, minWidth: 100 }}
        >
          <View style={{ gap: 4, alignItems: 'center' }}>
            <PixelText
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ color: theme.text, fontSize: 18, textAlign: 'center' }}
            >
              {heading}
            </PixelText>
            <PixelText
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ color: theme.muted, fontSize: 15, textAlign: 'center' }}
            >
              {calendarDate(date).toLocaleDateString(undefined, {
                weekday: relative ? 'short' : undefined,
                month: 'short',
                day: 'numeric',
                year:
                  date.slice(0, 4) === today.slice(0, 4)
                    ? undefined
                    : 'numeric',
              })}
            </PixelText>
          </View>
        </Action>
        <Action
          label="Next day"
          disabled={recording || date >= today}
          onPress={() => selectDate(addDays(date, 1))}
        >
          <PixelChevron direction="right" color={theme.text} />
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
      {date < SYNC_DATE_FLOOR && (
        <Text style={{ color: theme.muted }}>
          Dates before 1900 are saved on this phone only.
        </Text>
      )}
    </>
  );
}
