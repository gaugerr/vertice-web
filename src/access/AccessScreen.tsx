import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { accessController } from './controller';
import { signIn } from './client';
import { useAccess } from './use-access';
import { accessConfigured } from './config';
import { hasPendingWrites } from '../data/database/writes';
import { hasUnsavedChanges } from '../shared/lib/drafts';
export function AccessScreen({
  frozen = false,
  onDiscard,
  onExport,
}: {
  frozen?: boolean;
  onDiscard?: () => void;
  onExport?: () => Promise<void>;
}) {
  const state = useAccess();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function run(action: () => Promise<unknown>) {
    setPending(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setPending(false);
    }
  }
  const busy = pending || state.busy;
  return (
    <section className="access-card" aria-labelledby="access-title">
      <p className="eyebrow">VÉRTICE</p>
      <h1 id="access-title">
        {state.phase === 'loading'
          ? 'Verificando acesso…'
          : state.phase === 'denied'
            ? 'Acesso aguardando liberação'
            : frozen
              ? 'Renove seu acesso'
              : 'Suas compras com clareza'}
      </h1>
      {state.account && <p className="account-email">{state.account.email}</p>}
      <p>
        {state.message ||
          (frozen
            ? 'Sua edição está preservada nesta tela. Conecte à internet ou entre novamente com a mesma conta para continuar.'
            : 'Entre com o Google usando o mesmo e-mail informado na compra.')}
      </p>
      {!accessConfigured && (
        <p role="status">O login está em preparação. A versão pública continua disponível.</p>
      )}
      <div className="access-actions">
        <Button disabled={busy || !accessConfigured} onClick={() => void run(signIn)}>
          Entrar com Google
        </Button>
        {state.account && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void run(() => accessController.refresh(true))}
          >
            Verificar acesso
          </Button>
        )}
        {onExport && (
          <Button variant="secondary" disabled={busy} onClick={() => void run(onExport)}>
            Exportar meus dados salvos
          </Button>
        )}
        {onDiscard && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (
                !hasPendingWrites() &&
                (!hasUnsavedChanges() ||
                  window.confirm('Descartar a edição não salva e continuar?'))
              )
                onDiscard();
            }}
          >
            Descartar edição e continuar
          </Button>
        )}
        {state.account && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (
                !hasPendingWrites() &&
                (!hasUnsavedChanges() ||
                  window.confirm('Descartar a edição não salva e sair da conta?'))
              )
                void run(() => accessController.logout());
            }}
          >
            Sair da conta
          </Button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <p className="field-help">
        Acesso vitalício. Após validar com internet, use offline por até sete dias. As compras ficam
        neste aparelho.
      </p>
      <Link to="/privacy">Privacidade</Link>
    </section>
  );
}
