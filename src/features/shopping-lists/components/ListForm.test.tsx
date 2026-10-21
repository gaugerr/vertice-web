import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListForm } from './ListForm';
import { repository } from '../../../app/services';
vi.mock('../../../app/services', () => ({
  repository: { createListWithCategories: vi.fn(), duplicateList: vi.fn() },
}));
describe('list creation form', () => {
  it('preserves a draft after failed storage and prevents duplicate submissions', async () => {
    let reject: (cause: Error) => void = () => {};
    vi.mocked(repository.createListWithCategories).mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const close = vi.fn();
    render(<ListForm onClose={close} />);
    fireEvent.change(screen.getByLabelText('Nome da lista'), {
      target: { value: 'Compra da semana' },
    });
    fireEvent.change(screen.getByLabelText('Orçamento da compra (R$)'), {
      target: { value: '300,00' },
    });
    const submit = screen.getByRole('button', { name: 'Criar lista' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(repository.createListWithCategories).toHaveBeenCalledTimes(1);
    reject(new Error('Sem espaço no aparelho.'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sem espaço'));
    expect(screen.getByLabelText('Nome da lista')).toHaveValue('Compra da semana');
    expect(screen.getByLabelText('Orçamento da compra (R$)')).toHaveValue('300,00');
    expect(close).not.toHaveBeenCalled();
  });
  it('prefills a bounded copy name and passes editable metadata without completion data', async () => {
    vi.mocked(repository.duplicateList).mockResolvedValueOnce('new-id');
    const source = {
      id: crypto.randomUUID(),
      storeName: 'x'.repeat(50),
      date: '2020-01-01',
      description: 'Lembrete',
      budgetCents: 10000,
      status: 'completed' as const,
      completedAt: '2026-10-21T12:00:00.000Z',
      purchaseDate: '2026-10-20',
      marketName: 'Mercado A',
      createdAt: '2020-01-01T12:00:00.000Z',
      updatedAt: '2026-10-21T12:00:00.000Z',
    };
    const created = vi.fn();
    render(<ListForm copySource={source} onClose={vi.fn()} onCreated={created} />);
    expect(
      (screen.getByLabelText('Nome da lista') as HTMLInputElement).value.length,
    ).toBeLessThanOrEqual(50);
    expect(screen.getByText(/com os preços zerados/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nome da lista'), { target: { value: 'Nova compra' } });
    fireEvent.change(screen.getByLabelText('Orçamento da compra (R$)'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar cópia' }));
    await waitFor(() => expect(created).toHaveBeenCalledWith('new-id'));
    expect(repository.duplicateList).toHaveBeenCalledWith(
      source.id,
      expect.objectContaining({
        storeName: 'Nova compra',
        description: 'Lembrete',
        budgetCents: null,
      }),
    );
  });
});
