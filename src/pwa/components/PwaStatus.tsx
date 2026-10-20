import {useState, useSyncExternalStore} from 'react';
import {CheckCircle2, RefreshCw, WifiOff} from 'lucide-react';
import {applyUpdate, getPwaState, subscribePwa} from '../registration';
import {Button} from '../../shared/ui/Button';
import {errorMessage} from '../../shared/lib/errors';

export function PwaStatus() {
  const state = useSyncExternalStore(subscribePwa, getPwaState);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function update() {setBusy(true); setError(''); try {await applyUpdate()} catch (cause) {setError(errorMessage(cause))} finally {setBusy(false)}}
  return <div className={`pwa-status ${state.online ? '' : 'offline'}`}>
    <div className="pwa-status-inner"><span role="status">{state.online ? <CheckCircle2 size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}{!state.online ? 'Offline · dados salvos neste aparelho' : state.offlineReady ? 'Pronto para usar offline' : state.failed ? 'Não foi possível preparar o uso offline' : import.meta.env.DEV ? 'Desenvolvimento · dados salvos neste aparelho' : 'Preparando uso offline…'}</span>
      {state.updateReady && <Button variant="secondary" disabled={busy} onClick={update}><RefreshCw size={14} aria-hidden="true" />{busy ? 'Atualizando…' : 'Nova versão disponível · Atualizar'}</Button>}
      {error && <span role="alert">{error}</span>}
    </div>
  </div>;
}
