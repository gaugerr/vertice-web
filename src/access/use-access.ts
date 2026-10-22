import { useEffect, useSyncExternalStore } from 'react';
import { accessController } from './controller';
export function useAccess() {
  const state = useSyncExternalStore(accessController.subscribe, accessController.snapshot);
  useEffect(() => {
    void accessController.start();
  }, []);
  return state;
}
