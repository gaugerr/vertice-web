import { useState, useSyncExternalStore } from 'react';
import { Download } from 'lucide-react';
import { getPwaState, installApp, subscribePwa } from '../registration';
import { Button } from '../../shared/ui/Button';
import { ErrorMessage } from '../../shared/ui/Feedback';

export function InstallButton() {
  const { installReady } = useSyncExternalStore(subscribePwa, getPwaState);
  const [error, setError] = useState('');
  if (!installReady) return null;
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          void installApp().catch(() =>
            setError('Use o menu do navegador para instalar o Vértice.'),
          );
        }}
      >
        <Download size={16} aria-hidden="true" />
        Instalar Vértice
      </Button>
      <ErrorMessage message={error} />
    </>
  );
}
