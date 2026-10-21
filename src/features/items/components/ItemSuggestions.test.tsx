import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddItemForm } from './AddItemForm';
import { repository } from '../../../app/services';
import type { ItemSuggestion } from '../../../domain/services/item-suggestions';
vi.mock('../../../app/services', () => ({
  repository: {
    addItem: vi.fn(),
    addSuggestedItem: vi.fn(),
    getCompletedItemSuggestions: vi.fn(),
    getItemsForList: vi.fn(),
  },
}));
const suggestions: ItemSuggestion[] = ['Melitta', 'Pilão', 'Outra'].map((brand, index) => ({
  name: 'Café',
  brand,
  packageContent: { amount: '500', unit: 'g' },
  unit: 'un',
  itemId: String(index),
  purchaseDate: '2026-10-12',
  completedAt: '2026-10-12T12:00:00.000Z',
  updatedAt: '2026-10-12T11:00:00.000Z',
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repository.getCompletedItemSuggestions).mockResolvedValue(suggestions);
  vi.mocked(repository.getItemsForList).mockResolvedValue([]);
  vi.mocked(repository.addItem).mockResolvedValue('manual');
});
afterEach(cleanup);
async function mount() {
  const view = render(
    <>
      <AddItemForm listId="list" categoryId="category" />
      <button>Outro campo</button>
    </>,
  );
  const input = screen.getByRole('textbox');
  input.focus();
  fireEvent.change(input, { target: { value: 'ca' } });
  await screen.findByRole('list', { name: 'Sugestões de compras anteriores' });
  return { input, ...view };
}
describe('compact suggestion interaction', () => {
  it('filters locally, hides on Escape, blocks IME submission and keeps ordinary Enter manual', async () => {
    const { input } = await mount();
    const reads = vi.mocked(repository.getCompletedItemSuggestions).mock.calls.length;
    fireEvent.change(input, { target: { value: 'cafe' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(repository.getCompletedItemSuggestions).toHaveBeenCalledTimes(reads);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'caf' } });
    expect(screen.getByRole('list')).toBeInTheDocument();
    fireEvent.compositionStart(input);
    fireEvent.submit(input.closest('form')!);
    expect(repository.addItem).not.toHaveBeenCalled();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    fireEvent.compositionEnd(input);
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(input).toHaveValue(''));
    expect(repository.addItem).toHaveBeenCalledWith('list', 'category', 'caf');
    expect(repository.addSuggestedItem).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
  });
  it('locks suggestion writes, preserves new typing and never restores focus after leaving', async () => {
    let finish!: (id: string) => void;
    vi.mocked(repository.addSuggestedItem).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { input } = await mount();
    fireEvent.click(
      screen.getByRole('button', { name: 'Adicionar Café · Melitta · 500 g', exact: true }),
    );
    expect(input).toHaveFocus();
    expect(input).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Adicionar item', exact: true })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Adicionar Café · Pilão · 500 g', exact: true }),
    ).toBeDisabled();
    fireEvent.change(input, { target: { value: 'Arroz' } });
    screen.getByRole('button', { name: 'Outro campo' }).focus();
    await act(async () => finish('suggested'));
    expect(repository.addSuggestedItem).toHaveBeenCalledTimes(1);
    expect(repository.addSuggestedItem).toHaveBeenCalledWith('list', 'category', suggestions[0]);
    expect(input).toHaveValue('Arroz');
    expect(screen.getByRole('button', { name: 'Outro campo' })).toHaveFocus();
  });
  it('preserves the prefix after failure and hides suggestions when the list becomes read-only', async () => {
    vi.mocked(repository.addSuggestedItem).mockRejectedValueOnce(new Error('Sem espaço'));
    const { input, rerender } = await mount();
    fireEvent.click(
      screen.getByRole('button', { name: 'Adicionar Café · Melitta · 500 g', exact: true }),
    );
    await screen.findByRole('alert');
    expect(input).toHaveValue('ca');
    expect(input).toHaveFocus();
    rerender(<AddItemForm listId="list" categoryId="category" readOnly />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Adicionar item' })).toBeDisabled();
  });
  it('silently falls back to manual entry when historical reads fail', async () => {
    vi.mocked(repository.getCompletedItemSuggestions).mockRejectedValue(new Error('Read failed'));
    render(<AddItemForm listId="list" categoryId="category" />);
    const input = screen.getByRole('textbox');
    input.focus();
    fireEvent.change(input, { target: { value: 'Café' } });
    await waitFor(() => expect(repository.getCompletedItemSuggestions).toHaveBeenCalled());
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.submit(input.closest('form')!);
    await waitFor(() =>
      expect(repository.addItem).toHaveBeenCalledWith('list', 'category', 'Café'),
    );
  });
});
