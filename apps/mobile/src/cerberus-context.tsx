import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

const CerberusContext = createContext({ foodRequest: 0, playFood: () => {} });

export function CerberusProvider({ children }: { children: ReactNode }) {
  const [foodRequest, setFoodRequest] = useState(0);
  const playFood = useCallback(
    () => setFoodRequest((request) => request + 1),
    [],
  );
  return (
    <CerberusContext.Provider value={{ foodRequest, playFood }}>
      {children}
    </CerberusContext.Provider>
  );
}

export const useCerberus = () => useContext(CerberusContext);
