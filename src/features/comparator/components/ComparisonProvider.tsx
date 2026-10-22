import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAccountScope } from '../../../app/repository-context';
import { flushSync } from 'react-dom';
import { loadComparisonSession, saveComparisonSession } from '../session';
import { OpenComparisonContext } from '../context';
import { ComparisonDialog } from './ComparisonDialog';

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const scope = useAccountScope();
  const [initial] = useState(() => loadComparisonSession(scope));
  const [session, setSession] = useState(initial.session);
  const [storageFailed, setStorageFailed] = useState(initial.failed);
  const [opened, setOpened] = useState(false);
  const open = useCallback(() => {
    // Mount/show/focus before the trusted tap ends, so the mobile keyboard can open.
    flushSync(() => setOpened(true));
  }, []);
  useEffect(() => {
    setStorageFailed(!saveComparisonSession(session, scope));
  }, [session, scope]);
  return (
    <OpenComparisonContext.Provider value={open}>
      {children}
      {opened && (
        <ComparisonDialog
          session={session}
          setSession={setSession}
          storageFailed={storageFailed}
          onClose={() => setOpened(false)}
        />
      )}
    </OpenComparisonContext.Provider>
  );
}
