import { useEffect, useRef, useState } from 'react';
import type { DataStatus } from './data-status';

export function useDataStatusIndicator(status: DataStatus): DataStatus {
  const previousSaved = useRef<DataStatus>(
    status === 'cloud' ? 'cloud' : 'local',
  );
  const [showUnsaved, setShowUnsaved] = useState(false);
  useEffect(() => {
    if (status !== 'unsaved') {
      previousSaved.current = status;
      setShowUnsaved(false);
      return;
    }
    const timer = setTimeout(() => setShowUnsaved(true), 500);
    return () => clearTimeout(timer);
  }, [status]);
  if (status !== 'unsaved') return status;
  return showUnsaved ? 'unsaved' : previousSaved.current;
}
