import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { reactionForValue, type OneShotAnimation } from './cerberus-motion';

export type CerberusRequest = {
  sequence: number;
  animation: OneShotAnimation | null;
};
const CerberusContext = createContext({
  request: { sequence: 0, animation: null } as CerberusRequest,
  playNoteSubmit: () => {},
  playReaction: (_value: number) => {},
});

export function CerberusProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<CerberusRequest>({
    sequence: 0,
    animation: null,
  });
  const play = useCallback((animation: OneShotAnimation) => {
    setRequest((previous) => ({ sequence: previous.sequence + 1, animation }));
  }, []);
  const playNoteSubmit = useCallback(
    () => play(Math.random() < 0.5 ? 'food-can' : 'backflip'),
    [play],
  );
  const playReaction = useCallback(
    (value: number) => {
      const animation = reactionForValue(value);
      if (animation) play(animation);
    },
    [play],
  );
  return (
    <CerberusContext.Provider value={{ request, playNoteSubmit, playReaction }}>
      {children}
    </CerberusContext.Provider>
  );
}

export const useCerberus = () => useContext(CerberusContext);
