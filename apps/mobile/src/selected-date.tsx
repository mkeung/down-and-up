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
import { reportError, useApp } from './app-context';

type SelectedDate = {
  date: string;
  today: string;
  selectDate: (next: string) => void;
  recording: boolean;
  setRecording: (active: boolean) => void;
};
const Context = createContext<SelectedDate | null>(null);

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
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSelectedDate() {
  const value = useContext(Context);
  if (!value) throw new Error('SelectedDateProvider is missing');
  return value;
}

export function useEntry(date: string) {
  const app = useApp();
  const [loaded, setLoaded] = useState<{
    date: string;
    entry: LocalEntry | null;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void app.repo
      .get(date)
      .then((row) => {
        if (active) setLoaded({ date, entry: row });
      })
      .catch(reportError);
    return () => {
      active = false;
    };
  }, [app.repo, app.revision, date]);
  return loaded?.date === date ? loaded.entry : undefined;
}
