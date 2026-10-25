import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ShoppingList } from '../../../domain/models/shopping';
import { Plus, ShoppingBasket, ArrowRight } from 'lucide-react';
import { useRepository } from '../../../app/repository-context';
import { useQuery } from '../../../shared/hooks/useQuery';
import { Button } from '../../../shared/ui/Button';
import { Loading, QueryError } from '../../../shared/ui/Feedback';
import { ListForm } from '../components/ListForm';
import { ListCard } from '../components/ListCard';
import { ComparisonButton } from '../../comparator/components/ComparisonButton';
import { FinanceEntry } from '../../finance/components/FinanceEntry';

export default function ListsPage() {
  const repository = useRepository();
  const result = useQuery(() => repository.getListSummaries(), []);
  const [creating, setCreating] = useState(false);
  const [dialog, setDialog] = useState<{ kind: 'edit' | 'copy'; source: ShoppingList } | null>(
    null,
  );
  const navigate = useNavigate();
  const source = dialog
    ? ((result.status === 'ready'
        ? result.data.find(({ list }) => list.id === dialog.source.id)?.list
        : undefined) ?? dialog.source)
    : undefined;
  const [status, setStatus] = useState<'active' | 'completed'>('active');
  const visible =
    result.status === 'ready'
      ? result.data
          .filter(({ list }) => list.status === status)
          .sort((a, b) =>
            status === 'completed'
              ? (b.list.purchaseDate ?? '').localeCompare(a.list.purchaseDate ?? '') ||
                b.list.updatedAt.localeCompare(a.list.updatedAt)
              : b.list.updatedAt.localeCompare(a.list.updatedAt),
          )
      : [];
  return (
    <>
      <section className="hero" aria-labelledby="home-title">
        <h1 id="home-title">
          Onde suas compras
          <br />
          <span>encontram o equilíbrio.</span>
        </h1>
      </section>
      <FinanceEntry />
      <div className="section-heading has-actions">
        <div>
          <h2>
            Minhas listas{' '}
            {result.status === 'ready' && <span className="count-badge">{visible.length}</span>}
          </h2>
        </div>
        <div className="section-actions">
          <ComparisonButton />
          <Button onClick={() => setCreating(true)}>
            <Plus size={19} aria-hidden="true" />
            <span>Nova lista</span>
          </Button>
        </div>
      </div>
      <div className="filter-bar list-status-filters" role="group" aria-label="Filtrar listas">
        <button aria-pressed={status === 'active'} onClick={() => setStatus('active')}>
          Em andamento
        </button>
        <button aria-pressed={status === 'completed'} onClick={() => setStatus('completed')}>
          Finalizadas
        </button>
      </div>
      {result.status === 'loading' ? (
        <Loading />
      ) : result.status === 'error' ? (
        <QueryError error={result.error} />
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            <ShoppingBasket size={36} aria-hidden="true" />
          </span>
          <h2>
            {status === 'completed'
              ? 'Suas compras finalizadas aparecerão aqui'
              : result.data.length
                ? 'Nenhuma lista em andamento'
                : 'Sua próxima compra começa aqui'}
          </h2>
          <p>
            {status === 'completed'
              ? 'Ao terminar uma compra, finalize a lista para guardar os produtos e valores.'
              : 'Crie uma lista ou copie uma compra finalizada para começar.'}
          </p>
          <Button onClick={() => setCreating(true)}>
            {result.data.length ? 'Criar nova lista' : 'Criar minha primeira lista'}{' '}
            <ArrowRight size={17} aria-hidden="true" />
          </Button>
          <small>Seus dados ficam salvos neste aparelho.</small>
        </div>
      ) : (
        <div className="lists-grid">
          {visible.map(({ list, totalCents }) => (
            <ListCard
              key={list.id}
              list={list}
              totalCents={totalCents}
              onEdit={(source) => setDialog({ kind: 'edit', source })}
              onCopy={(source) => setDialog({ kind: 'copy', source })}
            />
          ))}
        </div>
      )}
      {creating && <ListForm onClose={() => setCreating(false)} />}
      {dialog && source ? (
        <ListForm
          list={dialog.kind === 'edit' ? source : undefined}
          copySource={dialog.kind === 'copy' ? source : undefined}
          onClose={() => setDialog(null)}
          onCreated={(id) => navigate(`/lists/${id}`)}
        />
      ) : null}
    </>
  );
}
