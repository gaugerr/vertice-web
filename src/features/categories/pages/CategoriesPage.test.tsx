import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CategoriesPage from './CategoriesPage';
import { useQuery } from '../../../shared/hooks/useQuery';
import {
  ACTIVE_PURCHASE,
  type Category,
  type ShoppingItem,
  type ShoppingList,
} from '../../../domain/models/shopping';

vi.mock('../../../shared/hooks/useQuery', () => ({ useQuery: vi.fn() }));
vi.mock('../../shopping-lists/components/ListActions', () => ({ ListActions: () => null }));
vi.mock('../../comparator/components/ComparisonButton', () => ({ ComparisonButton: () => null }));

const timestamps = {
  createdAt: '2026-10-29T00:00:00.000Z',
  updatedAt: '2026-10-29T00:00:00.000Z',
};
let list: ShoppingList;
let items: ShoppingItem[];
const category: Category = {
  ...timestamps,
  id: 'category',
  shoppingListId: 'list',
  title: 'Essenciais',
  position: 0,
};
function seed(purchased: boolean[]) {
  items = purchased.map((isPurchased, index) => ({
    ...timestamps,
    id: String(index),
    shoppingListId: 'list',
    categoryId: category.id,
    name: `Produto ${index + 1}`,
    unitPrice: '1.25',
    quantity: '2',
    unit: 'un',
    isPurchased,
    brand: null,
    packageContent: null,
  }));
}
function page() {
  vi.mocked(useQuery).mockReturnValue({
    status: 'ready',
    data: { list, categories: [category], items },
  });
  return (
    <MemoryRouter initialEntries={['/lists/list']}>
      <Routes>
        <Route path="/lists/:listId" element={<CategoriesPage />} />
      </Routes>
    </MemoryRouter>
  );
}
function card() {
  return screen.getByRole('heading', { name: category.title }).closest('a')!;
}
function names() {
  return within(card())
    .getAllByRole('listitem')
    .map((row) => row.querySelector('.category-item-name')?.textContent);
}
beforeEach(() => {
  list = {
    ...timestamps,
    ...ACTIVE_PURCHASE,
    id: 'list',
    storeName: 'Semana',
    date: '2026-10-29',
    description: '',
    budgetCents: null,
  };
  items = [];
});
afterEach(cleanup);

describe('category item previews', () => {
  it('keeps empty categories accessible without marking them complete', () => {
    render(page());
    expect(within(card()).getByText('Adicione os primeiros itens')).toBeVisible();
    expect(within(card()).queryByRole('list')).not.toBeInTheDocument();
    expect(card()).toHaveAttribute('href', '/lists/list/categories/category');
    expect(card()).not.toHaveTextContent('Concluída');
    expect(card()).not.toHaveTextContent('+');
  });

  it.each([1, 5])('shows all %i items without an overflow line', (count) => {
    seed(Array.from({ length: count }, () => false));
    render(page());
    expect(names()).toHaveLength(count);
    expect(card()).not.toHaveTextContent('+');
  });

  it('prioritizes pending items, preserves both orders and totals hidden purchases', () => {
    seed(Array.from({ length: 12 }, (_, index) => ![2, 6, 10].includes(index)));
    const original = structuredClone(items);
    render(page());
    expect(names()).toEqual(['Produto 3', 'Produto 7', 'Produto 11', 'Produto 1', 'Produto 2']);
    expect(within(card()).getByText('+ 7 itens…')).toBeVisible();
    expect(card()).toHaveTextContent('12 itens');
    expect(card().querySelector('.category-footer strong')).toHaveTextContent('22,50');
    expect(screen.getByLabelText('Total da lista')).toHaveTextContent('22,50');
    expect(card()).not.toHaveTextContent('Concluída');
    expect(items).toEqual(original);
  });

  it('keeps every item when a mixed category fits in the card', () => {
    seed([true, false, true, false]);
    render(page());
    expect(names()).toEqual(['Produto 2', 'Produto 4', 'Produto 1', 'Produto 3']);
    expect(card()).not.toHaveTextContent('+');
    expect(card().querySelector('.category-footer strong')).toHaveTextContent('5,00');
  });

  it('uses the singular and never exceeds five pending items', () => {
    seed(Array.from({ length: 6 }, () => false));
    render(page());
    expect(names()).toEqual(['Produto 1', 'Produto 2', 'Produto 3', 'Produto 4', 'Produto 5']);
    expect(within(card()).getByText('+ 1 item…')).toBeVisible();
  });

  it.each(['active', 'completed'] as const)(
    'keeps full totals and completion for an entirely purchased %s list',
    (status) => {
      seed(Array.from({ length: 6 }, () => true));
      list.status = status;
      render(page());
      expect(names()).toHaveLength(5);
      expect(card()).toHaveTextContent('6 itens · Concluída');
      expect(card().querySelector('.category-footer strong')).toHaveTextContent('15,00');
      expect(within(card()).getByText('+ 1 item…')).toBeVisible();
    },
  );

  it('keeps pending items first even in a completed list', () => {
    seed([true, true, true, true, true, false]);
    list.status = 'completed';
    render(page());
    expect(names()).toEqual(['Produto 6', 'Produto 1', 'Produto 2', 'Produto 3', 'Produto 4']);
    expect(card()).not.toHaveTextContent('Concluída');
    expect(card().querySelector('.category-footer strong')).toHaveTextContent('12,50');
  });

  it('recomputes the preview when the query returns a purchase or unpurchase', () => {
    seed([false, false, false, false, false, false]);
    const view = render(page());
    items = items.map((item, index) => ({ ...item, isPurchased: index === 0 }));
    view.rerender(page());
    expect(names()).toEqual(['Produto 2', 'Produto 3', 'Produto 4', 'Produto 5', 'Produto 6']);
    items = items.map((item) => ({ ...item, isPurchased: false }));
    view.rerender(page());
    expect(names()).toEqual(['Produto 1', 'Produto 2', 'Produto 3', 'Produto 4', 'Produto 5']);
  });
});
