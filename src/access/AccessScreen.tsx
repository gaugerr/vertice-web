import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { accessController } from './controller';
import { signIn } from './client';
import { useAccess } from './use-access';
import { accessConfigured } from './config';
import { hasPendingWrites } from '../data/database/writes';
import { hasUnsavedChanges } from '../shared/lib/drafts';
import { Brand } from '../shared/ui/Brand';
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
  const awaitingAccess = state.phase === 'denied';
  const supportMessage = `Olá! Comprei o Kit Vértice e ainda estou aguardando a liberação do acesso. Tentei entrar com o e-mail: ${state.account?.email ?? ''}. Pode verificar, por favor?`;
  return (
    <section className="access-card" aria-labelledby="access-title">
      <div className="access-brand">
        <Brand />
      </div>
      <h1 id="access-title">
        {state.phase === 'loading'
          ? 'Verificando acesso…'
          : state.phase === 'denied'
            ? 'Vamos conferir seu acesso'
            : frozen
              ? 'Vamos conferir seu acesso'
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
        {state.phase === 'active' && !frozen && (
          <Link className="button button-primary" to="/">
            Abrir minhas listas
          </Link>
        )}
        <Button disabled={busy || !accessConfigured} onClick={() => void run(signIn)}>
          {state.account ? 'Acessar com outra conta do Google' : 'Entrar com Google'}
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
        {state.account && !awaitingAccess && (
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
      {awaitingAccess && state.account?.email && (
        <aside className="access-support" aria-labelledby="access-support-title">
          <h2 id="access-support-title">Comprou e ainda não recebeu acesso?</h2>
          <p>
            Fale diretamente com o produtor. A mensagem já inclui o e-mail que você usou para
            entrar, para facilitar a conferência.
          </p>
          <a
            className="access-support-link"
            href={`https://wa.me/5551980614158?text=${encodeURIComponent(supportMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Falar com o produtor no WhatsApp<span className="sr-only"> (abre em outra aba)</span>
          </a>
          <p className="field-help">
            O WhatsApp abrirá com a mensagem pronta. Ela só será enviada quando você tocar em
            Enviar.
          </p>
        </aside>
      )}
      <p className="field-help">Acesso vitalício. Suas compras ficam salvas neste aparelho.</p>
      <Link to="/privacy">Privacidade</Link>
    </section>
  );
}
