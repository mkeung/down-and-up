import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, TextInput } from 'react-native';
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
  const { repo } = useApp();
  const theme = useTheme();
  const [text, setText] = useState(note ?? '');
  const [focused, setFocused] = useState(false);
  const latest = useRef(note ?? '');
  const changed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!changed.current) return;
    changed.current = false;
    void repo
      .setField(date, 'note', latest.current || null)
      .catch((error: unknown) => {
        changed.current = true;
        reportError(error);
      });
  }, [repo, date]);
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
    };
  }, [flush]);
  return (
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
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, 1000);
      }}
      style={{
        color: theme.text,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.line,
        borderRadius: 14,
        fontSize: 18,
        padding: 16,
        minHeight: focused ? 130 : 56,
        textAlignVertical: 'top',
      }}
    />
  );
}
