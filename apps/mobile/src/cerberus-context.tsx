import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { reactionForValue, type OneShotAnimation } from './cerberus-motion';

export type CerberusRequest = {
  sequence: number;
  animation: OneShotAnimation | null;
};
type CerberusActions = {
  playNoteSubmit: () => void;
  playReaction: (value: number) => void;
};
const initialRequest: CerberusRequest = { sequence: 0, animation: null };
// Actions never change, so screens that only trigger reactions do not
// re-render when a reaction is requested.
const ActionsContext = createContext<CerberusActions>({
  playNoteSubmit: () => {},
  playReaction: (_value: number) => {},
});
const RequestContext = createContext<CerberusRequest>(initialRequest);

export function CerberusProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<CerberusRequest>(initialRequest);
  const play = useCallback((animation: OneShotAnimation) => {
    setRequest((previous) => ({ sequence: previous.sequence + 1, animation }));
  }, []);
  const actions = useMemo<CerberusActions>(
    () => ({
      playNoteSubmit: () => play(Math.random() < 0.5 ? 'food-can' : 'backflip'),
      playReaction: (value: number) => {
        const animation = reactionForValue(value);
        if (animation) play(animation);
      },
    }),
    [play],
  );
  return (
    <ActionsContext.Provider value={actions}>
      <RequestContext.Provider value={request}>
        {children}
      </RequestContext.Provider>
    </ActionsContext.Provider>
  );
}

export const useCerberusActions = () => useContext(ActionsContext);
export const useCerberusRequest = () => useContext(RequestContext);
export const useCerberus = () => ({
  ...useCerberusActions(),
  request: useCerberusRequest(),
});
