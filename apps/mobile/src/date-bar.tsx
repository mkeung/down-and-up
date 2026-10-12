import { useState } from 'react';
import { Modal, Platform, ScrollView, Text, View } from 'react-native';
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
import { PixelChevron, PixelPanel, PixelText } from './retro';

export function DateBar() {
  const theme = useTheme();
  const { date, today, selectDate, recording } = useSelectedDate();
  const [picker, setPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(date);
  const ios = Platform.OS === 'ios';
  const pickerControl = (
    <DateTimePicker
      accessibilityLabel="Choose date"
      value={calendarDate(pickerDate)}
      mode="date"
      display={ios ? 'spinner' : 'default'}
      maximumDate={calendarDate(today)}
      onChange={(_event, chosen) => {
        if (!ios) setPicker(false);
        if (chosen) {
          const next = todayLocal(chosen);
          if (next <= today) {
            if (ios) setPickerDate(next);
            else selectDate(next);
          }
        }
      }}
    />
  );
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
          onPress={() => {
            setPickerDate(date);
            setPicker(true);
          }}
          style={{ flex: 1, minWidth: 100 }}
        >
          <View style={{ gap: 4, alignItems: 'center' }}>
            <PixelText
              font="Silkscreen"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ color: theme.text, fontSize: 18, textAlign: 'center' }}
            >
              {heading}
            </PixelText>
            <PixelText
              font="Silkscreen"
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
      {picker &&
        (ios ? (
          <Modal
            transparent
            animationType="fade"
            onRequestClose={() => setPicker(false)}
          >
            <ScrollView
              style={{ flex: 1, backgroundColor: '#0008' }}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                padding: 20,
              }}
            >
              <PixelPanel style={{ gap: 16 }}>
                {pickerControl}
                <Row>
                  <Action
                    label="Cancel"
                    onPress={() => setPicker(false)}
                    style={{ flex: 1 }}
                  />
                  <Action
                    label="Done"
                    onPress={() => {
                      selectDate(pickerDate);
                      setPicker(false);
                    }}
                    style={{ flex: 1 }}
                  />
                </Row>
              </PixelPanel>
            </ScrollView>
          </Modal>
        ) : (
          pickerControl
        ))}
      {date < SYNC_DATE_FLOOR && (
        <Text style={{ color: theme.muted }}>
          Dates before 1900 are saved on this phone only.
        </Text>
      )}
    </>
  );
}
