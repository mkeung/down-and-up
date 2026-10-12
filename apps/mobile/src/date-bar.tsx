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
              style={{ color: theme.text, fontSize: 18, textAlign: 'center' }}
            >
              {date === today ? 'Today' : dateLabel(date, today)}
            </PixelText>
            {date === today ? (
              <Text
                style={{
                  color: theme.muted,
                  fontSize: 15,
                  textAlign: 'center',
                }}
              >
                {calendarDate(date).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            ) : null}
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
