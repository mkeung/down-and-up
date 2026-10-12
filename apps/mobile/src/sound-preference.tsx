import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Repository } from './repository';
import {
  DEFAULT_SOUND_PREFERENCES,
  parseSoundPreferences,
  SOUND_STATE_KEY,
  type SoundPreferences,
} from './sound-preferences';
import { setSoundPreferences } from './sounds';

type SoundPreference = SoundPreferences & {
  ready: boolean;
  error: boolean;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  save: () => void;
};
const SoundContext = createContext<SoundPreference | null>(null);
export function useSoundPreference() {
  const preference = useContext(SoundContext);
  if (!preference) throw new Error('Sound settings are starting');
  return preference;
}

export function SoundProvider({
  store,
  children,
}: {
  store: Pick<Repository, 'state' | 'setState'>;
  children: ReactNode;
}) {
  const [preference, setPreference] = useState(DEFAULT_SOUND_PREFERENCES);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const current = useRef(preference);
  const loaded = useRef(false);
  const alive = useRef(false);
  const revision = useRef(0);
  const queue = useRef(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let disposed = false;
    alive.current = true;
    loaded.current = false;
    setReady(false);
    setSoundPreferences(null);
    const apply = (next: SoundPreferences) => {
      if (disposed) return;
      current.current = next;
      loaded.current = true;
      setSoundPreferences(next);
      setPreference(next);
      setReady(true);
    };
    void store.state(SOUND_STATE_KEY).then(
      (saved) => apply(parseSoundPreferences(saved)),
      () => {
        if (disposed) return;
        setError(true);
        apply({ ...DEFAULT_SOUND_PREFERENCES, muted: true });
      },
    );
    return () => {
      disposed = true;
      alive.current = false;
      loaded.current = false;
      clearTimeout(timer.current);
      setSoundPreferences(null);
    };
  }, [store]);

  const save = () => {
    clearTimeout(timer.current);
    if (!loaded.current) return;
    const snapshot = JSON.stringify(current.current);
    const version = ++revision.current;
    // Serialize whole preference records so an older write cannot win.
    queue.current = queue.current
      .then(() => store.setState(SOUND_STATE_KEY, snapshot))
      .then(
        () => {
          if (alive.current && revision.current === version) setError(false);
        },
        () => {
          if (alive.current && revision.current === version) setError(true);
        },
      );
  };
  const update = (next: SoundPreferences) => {
    if (!loaded.current) return false;
    if (
      next.muted === current.current.muted &&
      next.volume === current.current.volume
    )
      return false;
    current.current = next;
    setSoundPreferences(next);
    setPreference(next);
    return true;
  };
  return (
    <SoundContext.Provider
      value={{
        ...preference,
        ready,
        error,
        save,
        setMuted: (muted) => {
          if (update({ ...current.current, muted })) save();
        },
        setVolume: (volume) => {
          if (!Number.isFinite(volume)) return;
          if (
            update({
              ...current.current,
              volume: Math.round(Math.max(0, Math.min(1, volume)) * 100) / 100,
            })
          ) {
            clearTimeout(timer.current);
            timer.current = setTimeout(save, 250);
          }
        },
      }}
    >
      {children}
    </SoundContext.Provider>
  );
}
