import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompletionDialog } from './CompletionDialog';
import { repository } from '../../../app/services';
import { useQuery } from '../../../shared/hooks/useQuery';
import { buildListReview } from '../../../domain/services/completion';
import { ACTIVE_PURCHASE, type ListReview } from '../../../domain/models/shopping';

vi.mock('../../../app/services', () => ({
  repository: { getListReview: vi.fn(), completeList: vi.fn() },
}));
vi.mock('../../../shared/hooks/useQuery', () => ({ useQuery: vi.fn() }));
let review: ListReview;
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const timestamps = {
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
  };
  const list = {
    ...ACTIVE_PURCHASE,
    ...timestamps,
    id: crypto.randomUUID(),
    storeName: 'Semana',
    date: '2026-10-21',
    description: '',
    budgetCents: 1000,
  };
  const category = {
    ...timestamps,
    id: crypto.randomUUID(),
    shoppingListId: list.id,
    title: 'Essenciais',
    position: 0,
  };
  review = buildListReview(
    list,
    [category],
    [
      {
        ...timestamps,
        id: crypto.randomUUID(),
        shoppingListId: list.id,
        categoryId: category.id,
        name: 'Café',
        unitPrice: '12.5',
        quantity: '0.5',
        unit: 'kg',
        isPurchased: true,
      },
    ],
  );
  vi.mocked(useQuery).mockReturnValue({ status: 'ready', data: review });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe('purchase review', () => {
  it('preserves metadata on a failed write and prevents duplicate confirmation', async () => {
    let reject!: (cause: Error) => void;
    vi.mocked(repository.completeList).mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const close = vi.fn();
    render(<CompletionDialog listId={review.list.id} onClose={close} />);
    fireEvent.change(screen.getByLabelText(/Mercado/), { target: { value: 'Meu mercado' } });
    const button = screen.getByRole('button', { name: 'Confirmar finalização' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(repository.completeList).toHaveBeenCalledTimes(1);
    reject(new Error('Sem espaço no aparelho.'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sem espaço'));
    expect(screen.getByLabelText(/Mercado/)).toHaveValue('Meu mercado');
    expect(close).not.toHaveBeenCalled();
  });
  it('requires acknowledgement of a changed review before saving the new revision', async () => {
    vi.mocked(repository.completeList).mockResolvedValue(undefined);
    const close = vi.fn();
    const { rerender } = render(<CompletionDialog listId={review.list.id} onClose={close} />);
    review = buildListReview(review.list, review.categories, [
      { ...review.items[0], unitPrice: '20' },
    ]);
    vi.mocked(useQuery).mockReturnValue({ status: 'ready', data: review });
    rerender(<CompletionDialog listId={review.list.id} onClose={close} />);
    expect(screen.getByLabelText('Total para finalizar')).toHaveTextContent(/10,00/);
    fireEvent.click(screen.getByRole('button', { name: 'Conferir resumo atualizado' }));
    expect(repository.completeList).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar finalização' }));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(repository.completeList).toHaveBeenCalledWith(
      review.list.id,
      expect.any(Object),
      review.revision,
    );
  });
  it('identifies unpriced products and blocks finalization', () => {
    review = buildListReview(review.list, review.categories, [
      { ...review.items[0], unitPrice: '0' },
    ]);
    vi.mocked(useQuery).mockReturnValue({ status: 'ready', data: review });
    render(<CompletionDialog listId={review.list.id} onClose={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Café · Essenciais');
    expect(screen.getByRole('button', { name: 'Confirmar finalização' })).toBeDisabled();
  });
});
