import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  InputAccessoryView,
  Keyboard,
  Platform,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { PixelPanel, PixelText, usePixelType } from './retro';
import { MAX_NOTE_LENGTH } from '@down-up/shared';
import { reportError, useApp } from './app-context';
import { useTheme } from './theme';
import { keypadLayout } from './entry-layout';
import { useCerberus } from './cerberus-context';
import { Action } from './components';
export function NoteEditor({
  date,
  note,
}: {
  date: string;
  note: string | null;
}) {
  const { repo, setNotePending } = useApp();
  const theme = useTheme();
  const pixelType = usePixelType();
  const { fontScale } = useWindowDimensions();
  const { playFood } = useCerberus();
  const [text, setText] = useState(note ?? '');
  const [focused, setFocused] = useState(false);
  const latest = useRef(note ?? '');
  const changed = useRef(false);
  const version = useRef(0);
  const savingVersion = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!changed.current || savingVersion.current === version.current) return;
    const savedVersion = version.current;
    savingVersion.current = savedVersion;
    void repo
      .setField(date, 'note', latest.current || null)
      .then(() => {
        if (version.current === savedVersion) {
          changed.current = false;
          setNotePending(false);
        }
      })
      .catch((error: unknown) => {
        reportError(error);
      })
      .finally(() => {
        if (savingVersion.current === savedVersion)
          savingVersion.current = null;
      });
  }, [repo, date, setNotePending]);
  useEffect(() => {
    if (!focused && !changed.current) {
      setText(note ?? '');
      latest.current = note ?? '';
    }
  }, [note, focused]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flush();
    });
    return () => {
      subscription.remove();
      flush();
      // Any write still in flight is tracked by the repository.
      setNotePending(false);
    };
  }, [flush, setNotePending]);
  const submit = () => {
    flush();
    setFocused(false);
    Keyboard.dismiss();
    playFood();
  };
  return (
    <PixelPanel
      testID="note-editor-panel"
      style={{ height: keypadLayout(fontScale).height, gap: 12 }}
    >
      <PixelText
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ color: theme.muted, fontSize: 16 }}
      >
        Note
      </PixelText>
      <TextInput
        accessibilityLabel="Note"
        placeholder="Note…"
        placeholderTextColor={theme.muted}
        value={text}
        multiline
        returnKeyType="done"
        returnKeyLabel="Submit"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={submit}
        inputAccessoryViewID={Platform.OS === 'ios' ? 'note-submit' : undefined}
        maxLength={MAX_NOTE_LENGTH}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          flush();
          setFocused(false);
        }}
        onChangeText={(next) => {
          setText(next);
          latest.current = next;
          changed.current = true;
          setNotePending(true);
          version.current++;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(flush, 1000);
        }}
        style={{
          ...pixelType,
          color: theme.text,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: 0,
          fontSize: 18,
          padding: 16,
          flex: 1,
          minHeight: 64,
          textAlignVertical: 'top',
        }}
      />
      {Platform.OS === 'ios' && (
        <InputAccessoryView
          nativeID="note-submit"
          backgroundColor={theme.background}
        >
          <View style={{ padding: 8, alignItems: 'flex-end' }}>
            <Action label="Submit" onPress={submit} />
          </View>
        </InputAccessoryView>
      )}
    </PixelPanel>
  );
}
