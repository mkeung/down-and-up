import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, TextInput } from 'react-native';
import { PixelPanel, PixelText } from './retro';
import { MAX_NOTE_LENGTH } from '@down-up/shared';
import { reportError, useApp } from './app-context';
import { useTheme } from './theme';
export function NoteEditor({
  date,
  note,
}: {
  date: string;
  note: string | null;
}) {
  const { repo, setNotePending } = useApp();
  const theme = useTheme();
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
  return (
    <PixelPanel style={{ gap: 12 }}>
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
          color: theme.text,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: 0,
          fontSize: 18,
          padding: 16,
          minHeight: 156,
          textAlignVertical: 'top',
        }}
      />
    </PixelPanel>
  );
}
