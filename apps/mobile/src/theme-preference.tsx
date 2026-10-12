import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { reportError } from './app-context';
import type { Repository } from './repository';
import {
  parseThemeId,
  THEME_STATE_KEY,
  themeColors,
  type ThemeId,
} from './themes';

type ThemePreference = {
  id: ThemeId;
  saving: boolean;
  choose: (id: ThemeId) => Promise<void>;
};
export const ThemeContext = createContext<ThemePreference | null>(null);
export function useThemePreference() {
  const preference = useContext(ThemeContext);
  if (!preference) throw new Error('Theme is starting');
  return preference;
}

export function ThemeProvider({
  store,
  children,
}: {
  store: Pick<Repository, 'state' | 'setState'>;
  children: ReactNode;
}) {
  const [id, setId] = useState<ThemeId | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const dark = useColorScheme() === 'dark';
  useEffect(() => {
    let alive = true;
    void store.state(THEME_STATE_KEY).then(
      (saved) => {
        if (alive) setId(parseThemeId(saved));
      },
      (error: unknown) => {
        if (alive) {
          setId('neutral');
          reportError(error);
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [store]);
  if (id === null) {
    const theme = themeColors('neutral', dark);
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator
          accessibilityLabel="Loading theme"
          color={theme.text}
        />
      </View>
    );
  }
  const choose = async (next: ThemeId) => {
    if (pending.current || next === id) return;
    pending.current = true;
    setSaving(true);
    try {
      await store.setState(THEME_STATE_KEY, next);
      setId(next);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  return (
    <ThemeContext.Provider value={{ id, saving, choose }}>
      {children}
    </ThemeContext.Provider>
  );
}
