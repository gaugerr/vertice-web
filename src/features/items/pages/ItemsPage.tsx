import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, ListChecks } from 'lucide-react';
import { repository } from '../../../app/services';
import { useQuery } from '../../../shared/hooks/useQuery';
import { Loading, Missing, QueryError } from '../../../shared/ui/Feedback';
import { formatMoney, spentCents } from '../../../domain/services/money';
import { AddItemForm } from '../components/AddItemForm';
import { ItemRow } from '../components/ItemRow';
import { BudgetPanel } from '../../budget/components/BudgetPanel';
import { ComparisonButton } from '../../comparator/components/ComparisonButton';

export default function ItemsPage() {
  const { listId = '', id = '' } = useParams();
  const [filter, setFilter] = useState<'all' | 'pending' | 'purchased'>('all');
  const [purchaseEditors, setPurchaseEditors] = useState<Set<string>>(() => new Set());
  const onPurchaseEditingChange = useCallback((itemId: string, editing: boolean) => {
    setPurchaseEditors((previous) => {
      const next = new Set(previous);
      if (editing) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);
  const result = useQuery(async () => {
    const [list, category, allItems] = await Promise.all([
      repository.getList(listId),
      repository.getCategory(id),
      repository.getItemsForList(listId),
    ]);
    return {
      list,
      category,
      allItems,
      items: allItems
        .filter((item) => item.categoryId === id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    };
  }, [listId, id]);
  if (result.status === 'loading') return <Loading />;
  if (result.status === 'error') return <QueryError error={result.error} />;
  const { list, category, items, allItems } = result.data;
  if (!list || category?.shoppingListId !== listId)
    return <Missing label="Esta categoria não está mais disponível." />;
  const purchased = items.filter((item) => item.isPurchased).length;
  const visible = items.filter(
    (item) =>
      purchaseEditors.has(item.id) ||
      filter === 'all' ||
      (filter === 'purchased' ? item.isPurchased : !item.isPurchased),
  );
  return (
    <>
      <Link to={`/lists/${listId}`} className="back-link">
        ← {list.storeName}
      </Link>
      <div className="page-heading">
        <p className="eyebrow">SUA COMPRA, ITEM A ITEM</p>
        <h1>{category.title}</h1>
        <p>
          {purchased} de {items.length} itens no carrinho
        </p>
      </div>
      <AddItemForm listId={listId} categoryId={id} />
      <div className="shopping-tools">
        <div className="filter-bar" role="group" aria-label="Filtrar itens">
          {(
            [
              ['all', 'Todos'],
              ['pending', 'Pendentes'],
              ['purchased', 'Comprados'],
            ] as const
          ).map(([value, label]) => (
            <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        <ComparisonButton />
      </div>
      {visible.length ? (
        <ul className="items-list">
          {visible.map((item) => (
            <ItemRow key={item.id} item={item} onPurchaseEditingChange={onPurchaseEditingChange} />
          ))}
        </ul>
      ) : (
        <div className="empty-state compact">
          <ListChecks size={36} aria-hidden="true" />
          <h2>
            {items.length ? 'Nenhum item neste filtro' : 'O primeiro item está por sua conta'}
          </h2>
          <p>
            {items.length
              ? 'Escolha outro filtro para ver os produtos.'
              : 'Digite o nome acima e pressione Enter para começar.'}
          </p>
        </div>
      )}
      <aside className={`sticky-total ${purchaseEditors.size ? 'editing-purchase' : ''}`}>
        <div className="category-total-line">
          <div>
            <span className="eyebrow">TOTAL DA CATEGORIA</span>
            <strong aria-label="Total da categoria">{formatMoney(spentCents(items))}</strong>
          </div>
          <span className="total-count">
            <Check size={16} aria-hidden="true" />
            {purchased} comprados
          </span>
        </div>
        <BudgetPanel list={list} spent={spentCents(allItems)} compact />
      </aside>
    </>
  );
}
