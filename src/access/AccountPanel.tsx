import { Link } from 'react-router-dom';
import { useAccess } from './use-access';
import { accessController } from './controller';
import { Button } from '../shared/ui/Button';
import { hasUnsavedChanges } from '../shared/lib/drafts';
import { hasPendingWrites } from '../data/database/writes';
export default function AccountPanel() {
  const state = useAccess();
  return (
    <section className="settings-card">
      <h2>Sua conta</h2>
      <p>{state.account?.email}</p>
      <p>
        Acesso vitalício
        {state.lease
          ? ` · offline até ${new Date(state.lease.expiresAt).toLocaleString('pt-BR')}`
          : ''}
      </p>
      <p>As compras continuam salvas neste aparelho. O login ainda não sincroniza suas listas.</p>
      <div className="access-actions">
        <Button
          disabled={state.busy}
          variant="secondary"
          onClick={() => void accessController.refresh(true)}
        >
          Validar agora
        </Button>
        <Button
          disabled={state.busy}
          variant="secondary"
          onClick={() => {
            if (
              !hasPendingWrites() &&
              (!hasUnsavedChanges() || window.confirm('Descartar alterações não salvas e sair?'))
            )
              void accessController.logout();
          }}
        >
          Sair da conta
        </Button>
        {state.phase === 'active' && state.account && state.adminUid === state.account.uid && (
          <Link to="/admin">Administrar licenças</Link>
        )}
      </div>
      {state.message && <p role="status">{state.message}</p>}
    </section>
  );
}
