import { useState } from 'react';
import { Plus, ShoppingBasket, ArrowRight } from 'lucide-react';
import { repository } from '../../../app/services';
import { useQuery } from '../../../shared/hooks/useQuery';
import { Button } from '../../../shared/ui/Button';
import { Loading, QueryError } from '../../../shared/ui/Feedback';
import { ListForm } from '../components/ListForm';
import { ListCard } from '../components/ListCard';
import { ComparisonButton } from '../../comparator/components/ComparisonButton';

export default function ListsPage() {
  const result = useQuery(() => repository.getLists(), []);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <section className="hero">
        <div className="eyebrow">
          <span className="status-dot" />
          COMPRAS COM CLAREZA
        </div>
        <h1>
          Planeje melhor.
          <br />
          <span>Gaste com consciência.</span>
        </h1>
        <p>
          Suas listas organizadas, do planejamento ao caixa.
          <br className="desktop-break" /> Com você, mesmo sem internet.
        </p>
      </section>
      <div className="section-heading has-actions">
        <div>
          <h2>
            Minhas listas{' '}
            {result.status === 'ready' && <span className="count-badge">{result.data.length}</span>}
          </h2>
          <p>Um lugar para cada compra.</p>
        </div>
        <div className="section-actions">
        <ComparisonButton />
        <Button onClick={() => setCreating(true)}>
          <Plus size={19} aria-hidden="true" />
          <span>Nova lista</span>
        </Button>
        </div>
      </div>
      {result.status === 'loading' ? (
        <Loading />
      ) : result.status === 'error' ? (
        <QueryError error={result.error} />
      ) : result.data.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            <ShoppingBasket size={36} aria-hidden="true" />
          </span>
          <h2>Sua próxima compra começa aqui</h2>
          <p>
            Crie uma lista, adicione o que precisa e acompanhe
            <br className="desktop-break" /> o total enquanto coloca os itens no carrinho.
          </p>
          <Button onClick={() => setCreating(true)}>
            Criar minha primeira lista <ArrowRight size={17} aria-hidden="true" />
          </Button>
          <small>Seus dados ficam salvos neste aparelho.</small>
        </div>
      ) : (
        <div className="lists-grid">
          {result.data.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      )}
      {creating && <ListForm onClose={() => setCreating(false)} />}
    </>
  );
}
