import { ActivityIndicator, Keyboard, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RECORDING_ENABLED } from '@down-up/shared';
import { useTheme } from '../src/theme';
import { DateBar } from '../src/date-bar';
import { DataStatusButton } from '../src/data-status-icon';
import { useEntry, useSelectedDate } from '../src/selected-date';
import { NoteEditor } from '../src/note-editor';
import { AudioNote } from '../src/audio-note';

export default function Pawsitive() {
  const theme = useTheme();
  const { date, setRecording } = useSelectedDate();
  const selectedEntry = useEntry(date);
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <ScrollView
        style={{ flex: 1 }}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          paddingTop: 4,
          gap: 22,
          alignItems: 'center',
        }}
      >
        <View style={{ width: '100%', maxWidth: 420, gap: 24 }}>
          <DataStatusButton />
          <DateBar />
          {selectedEntry === undefined ? (
            <ActivityIndicator accessibilityLabel="Loading note" />
          ) : (
            <NoteEditor
              key={date}
              date={date}
              note={selectedEntry?.note ?? null}
            />
          )}
          {RECORDING_ENABLED && (
            <AudioNote
              date={date}
              entry={selectedEntry ?? null}
              onRecording={setRecording}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
