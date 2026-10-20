import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListForm } from './ListForm';
import { repository } from '../../../app/services';
vi.mock('../../../app/services', () => ({ repository: { createListWithCategories: vi.fn() } }));
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
    fireEvent.change(screen.getByLabelText('Orçamento da compra (R$)'), { target: { value: '300,00' } });
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
});
