import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BudgetForm } from './BudgetForm';
import { repository } from '../../../app/services';
import type { ShoppingList } from '../../../domain/models/shopping';

vi.mock('../../../app/services', () => ({ repository: { setListBudget: vi.fn() } }));

describe('quick budget editing', () => {
  it('keeps the amount after failed storage and does not duplicate a pending save', async () => {
    let reject!: (cause: Error) => void;
    vi.mocked(repository.setListBudget).mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const list: ShoppingList = {
      id: crypto.randomUUID(),
      storeName: 'Mercado',
      date: '2026-10-19',
      description: '',
      budgetCents: 10000,
      createdAt: '2026-10-19T12:00:00.000Z',
      updatedAt: '2026-10-19T12:00:00.000Z',
    };
    const close = vi.fn();
    render(<BudgetForm list={list} onClose={close} />);
    const input = screen.getByLabelText('Orçamento da compra (R$)');
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: '150,00' } });
    const save = screen.getByRole('button', { name: 'Salvar orçamento' });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(repository.setListBudget).toHaveBeenCalledTimes(1);
    expect(repository.setListBudget).toHaveBeenCalledWith(list.id, 15000);
    reject(new Error('Sem espaço.'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sem espaço'));
    expect(input).toHaveValue('150,00');
    expect(close).not.toHaveBeenCalled();
    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(close).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });
});
