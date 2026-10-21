import { Link, useParams } from 'react-router-dom';
import { Check, ChevronRight, Leaf, ShoppingBasket } from 'lucide-react';
import { repository } from '../../../app/services';
import { useQuery } from '../../../shared/hooks/useQuery';
import { Loading, Missing, QueryError } from '../../../shared/ui/Feedback';
import { formatMoney, spentCents } from '../../../domain/services/money';
import { formatDate } from '../../../shared/lib/date';
import { BudgetPanel } from '../../budget/components/BudgetPanel';
import { ListActions } from '../../shopping-lists/components/ListActions';
import { ComparisonButton } from '../../comparator/components/ComparisonButton';

export default function CategoriesPage() {
  const { listId = '' } = useParams();
  const result = useQuery(async () => {
    const [list, categories, items] = await Promise.all([
      repository.getList(listId),
      repository.getCategories(listId),
      repository.getItemsForList(listId),
    ]);
    return { list, categories, items };
  }, [listId]);
  if (result.status === 'loading') return <Loading />;
  if (result.status === 'error') return <QueryError error={result.error} />;
  const { list, categories, items } = result.data;
  if (!list) return <Missing />;
  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const group = grouped.get(item.categoryId) ?? [];
    group.push(item);
    grouped.set(item.categoryId, group);
  }
  const purchased = items.filter((item) => item.isPurchased).length;
  return (
    <>
      <Link to="/" className="back-link">
        ← Minhas listas
      </Link>
      <div className="page-heading">
        <p className="eyebrow">SUA LISTA DE COMPRAS</p>
        <h1>{list.storeName}</h1>
        <p>
          {formatDate(list.date)}
          {list.description ? ` · ${list.description}` : ''}
        </p>
      </div>
      <section className="summary-card">
        <div>
          <span className="eyebrow">TOTAL DA LISTA</span>
          <strong aria-label="Total da lista">{formatMoney(spentCents(items))}</strong>
          <p>
            {purchased} de {items.length} itens comprados
            {list.status === 'completed' ? ` · ${items.length - purchased} não comprados` : ''}
          </p>
        </div>
        <span className="summary-icon">
          <ShoppingBasket size={32} aria-hidden="true" />
        </span>
      </section>
      <BudgetPanel list={list} spent={spentCents(items)} />
      <ListActions list={list} />
      <div className="section-heading">
        <div>
          <h2>Por categoria</h2>
          <p>Organize cada parte das suas compras.</p>
        </div>
        <div className="section-actions">
          <span className="count-badge">{categories.length}</span>
          <ComparisonButton />
        </div>
      </div>
      <div className="categories-grid">
        {categories.map((category, index) => {
          const group = grouped.get(category.id) ?? [];
          const complete = group.length > 0 && group.every((item) => item.isPurchased);
          return (
            <Link
              key={category.id}
              to={`/lists/${listId}/categories/${category.id}`}
              className={`category-card ${complete ? 'complete' : ''}`}
            >
              <div className="category-top">
                <span className={`category-icon tone-${index % 3}`}>
                  {complete ? (
                    <Check size={21} aria-hidden="true" />
                  ) : (
                    <Leaf size={21} aria-hidden="true" />
                  )}
                </span>
                <ChevronRight size={19} className="muted" aria-hidden="true" />
              </div>
              <h2>{category.title}</h2>
              <p className="category-preview">
                {group.length
                  ? group
                      .slice(0, 4)
                      .map((item) => item.name)
                      .join(' · ')
                  : list.status === 'completed' ? 'Nenhum produto nesta compra' : 'Adicione os primeiros itens'}
                {group.length > 4 ? ` · +${group.length - 4}` : ''}
              </p>
              <div className="category-footer">
                <span>
                  {group.length} {group.length === 1 ? 'item' : 'itens'}
                  {complete ? ' · Concluída' : ''}
                </span>
                <strong>{formatMoney(spentCents(group))}</strong>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
