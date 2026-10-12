import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { isFutureDate, todayLocal, type LocalEntry } from '@down-up/shared';
import { reportError, useAppRuntime, useRevision } from './app-context';

type SelectedDate = {
  date: string;
  today: string;
  selectDate: (next: string) => void;
  recording: boolean;
  setRecording: (active: boolean) => void;
};
type SelectedEntry = {
  // undefined while the selected day's row is loading; null when it has none.
  entry: LocalEntry | null | undefined;
  // The value to highlight: a tapped value shows before its write finishes.
  value: number | null;
  chooseValue: (value: number) => Promise<boolean>;
};
const Context = createContext<SelectedDate | null>(null);
const EntryContext = createContext<SelectedEntry | null>(null);

// The Rate and Pawsitive tabs share one selected day, so switching tabs never
// changes which day is being edited.
export function SelectedDateProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState(todayLocal);
  const [date, setDate] = useState(todayLocal);
  const [recording, setRecording] = useState(false);
  const previousToday = useRef(today);
  const selectDate = useCallback((next: string) => {
    if (!isFutureDate(next)) setDate(next);
  }, []);
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
  const value = useMemo(
    () => ({
      date,
      today,
      selectDate,
      recording,
      setRecording,
    }),
    [date, today, selectDate, recording],
  );
  return (
    <Context.Provider value={value}>
      <SelectedEntryProvider date={date}>{children}</SelectedEntryProvider>
    </Context.Provider>
  );
}

// One read of the selected day is shared by the Rate screen and the tab bar.
function SelectedEntryProvider({
  date,
  children,
}: {
  date: string;
  children: ReactNode;
}) {
  const { repo } = useAppRuntime();
  const revision = useRevision();
  const [loaded, setLoaded] = useState<{
    date: string;
    entry: LocalEntry | null;
  } | null>(null);
  // `settled` marks a finished write still waiting for a fresh read to land.
  const [pending, setPending] = useState<{
    date: string;
    value: number;
    choice: number;
    settled: boolean;
  } | null>(null);
  const choices = useRef(0);
  useEffect(() => {
    let active = true;
    void repo
      .get(date)
      .then((row) => {
        if (!active) return;
        setLoaded({ date, entry: row });
        setPending((current) => (current?.settled ? null : current));
      })
      .catch(reportError);
    return () => {
      active = false;
    };
  }, [repo, revision, date]);
  const chooseValue = useCallback(
    (next: number) => {
      const choice = ++choices.current;
      setPending({ date, value: next, choice, settled: false });
      return repo.setField(date, 'value', next).then(
        (changed) => {
          // An unchanged write means storage already holds this value.
          setPending((current) =>
            current?.choice !== choice
              ? current
              : changed
                ? { ...current, settled: true }
                : null,
          );
          return changed;
        },
        (error: unknown) => {
          setPending((current) =>
            current?.choice === choice ? null : current,
          );
          throw error;
        },
      );
    },
    [date, repo],
  );
  const entry = loaded?.date === date ? loaded.entry : undefined;
  const value = pending?.date === date ? pending.value : (entry?.value ?? null);
  const selected = useMemo(
    () => ({ entry, value, chooseValue }),
    [entry, value, chooseValue],
  );
  return (
    <EntryContext.Provider value={selected}>{children}</EntryContext.Provider>
  );
}

export function useSelectedDate() {
  const value = useContext(Context);
  if (!value) throw new Error('SelectedDateProvider is missing');
  return value;
}

export function useSelectedEntry() {
  const value = useContext(EntryContext);
  if (!value) throw new Error('SelectedDateProvider is missing');
  return value;
}
