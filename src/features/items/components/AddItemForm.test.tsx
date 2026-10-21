import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddItemForm } from './AddItemForm';
import { repository } from '../../../app/services';

vi.mock('../../../app/services', () => ({ repository: { addItem: vi.fn(), addSuggestedItem: vi.fn(), getCompletedItemSuggestions: vi.fn().mockResolvedValue([]), getItemsForList: vi.fn().mockResolvedValue([]) } }));

describe('continuous item entry', () => {
  it('keeps focus during storage and preserves text typed before the write finishes', async () => {
    let finish!: (id: string) => void;
    vi.mocked(repository.addItem).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<AddItemForm listId="list" categoryId="category" />);
    const input = screen.getByRole('textbox');
    input.focus();
    fireEvent.change(input, { target: { value: 'Arroz' } });
    fireEvent.submit(input.closest('form')!);
    expect(input).toHaveFocus();
    expect(input).toBeEnabled();
    fireEvent.change(input, { target: { value: 'Feijão' } });
    await act(async () => finish('saved'));
    expect(input).toHaveValue('Feijão');
    expect(input).toHaveFocus();
    expect(repository.addItem).toHaveBeenLastCalledWith('list', 'category', 'Arroz');
  });

  it('clears a committed name without moving focus back after the user leaves', async () => {
    let finish!: (id: string) => void;
    vi.mocked(repository.addItem).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <>
        <AddItemForm listId="list" categoryId="category" />
        <button>Outro campo</button>
      </>,
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Café' } });
    fireEvent.submit(input.closest('form')!);
    screen.getByText('Outro campo').focus();
    await act(async () => finish('saved'));
    expect(input).toHaveValue('');
    expect(screen.getByText('Outro campo')).toHaveFocus();
  });

  it('preserves the name and keyboard focus when storage fails', async () => {
    vi.mocked(repository.addItem).mockRejectedValueOnce(new Error('Sem espaço.'));
    render(<AddItemForm listId="list" categoryId="category" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Leite' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sem espaço'));
    expect(input).toHaveValue('Leite');
    expect(input).toHaveFocus();
    expect(input).toBeEnabled();
  });
});
