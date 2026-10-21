import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import type { ShoppingItem } from '../../../domain/models/shopping';
import { PurchaseForm } from './PurchaseForm';
import { repository } from '../../../app/services';

vi.mock('../../../app/services', () => ({
  repository: {
    updatePurchaseDetails: vi.fn(),
    getCompletedPriceReferences: vi.fn().mockResolvedValue([]),
  },
}));
const item: ShoppingItem = {
  id: 'item',
  shoppingListId: 'list',
  categoryId: 'category',
  name: 'Café',
  unitPrice: '18.9',
  quantity: '3',
  unit: 'un',
  brand: null,
  packageContent: null,
  isPurchased: true,
  createdAt: '2026-10-21T12:00:00.000Z',
  updatedAt: '2026-10-21T12:00:00.000Z',
};
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
describe('product detail fields in quick purchasing', () => {
  it('previews the name and retains all fields after failed storage without duplicate saves', async () => {
    let reject!: (cause: Error) => void;
    vi.mocked(repository.updatePurchaseDetails).mockImplementationOnce(
      () =>
        new Promise((_ok, fail) => {
          reject = fail;
        }),
    );
    const close = vi.fn();
    render(<PurchaseForm item={item} priceInput={createRef()} marking={false} onClose={close} />);
    expect(screen.queryByLabelText('Prévia do nome')).not.toBeInTheDocument();
    fill(/^Marca/, 'Marca X');
    fill(/^Embalagem/, '500');
    expect(screen.getByLabelText('Prévia do nome')).toHaveTextContent('Café · Marca X · 500 g');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar valores' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvando…' }));
    expect(repository.updatePurchaseDetails).toHaveBeenCalledTimes(1);
    expect(repository.updatePurchaseDetails).toHaveBeenCalledWith(item.id, {
      unitPrice: '18,9',
      quantity: '3',
      unit: 'un',
      brand: 'Marca X',
      packageContent: { amount: '500', unit: 'g' },
    });
    reject(new Error('Sem espaço'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sem espaço'));
    expect(screen.getByLabelText(/^Marca/)).toHaveValue('Marca X');
    expect(screen.getByLabelText(/^Embalagem/)).toHaveValue('500');
    expect(close).not.toHaveBeenCalled();
  });
  it('blocks invalid content and removes only the detail explicitly cleared', async () => {
    vi.mocked(repository.updatePurchaseDetails).mockResolvedValue(undefined);
    render(
      <PurchaseForm
        item={{ ...item, brand: 'Marca X', packageContent: { amount: '500', unit: 'g' } }}
        priceInput={createRef()}
        marking={false}
        onClose={vi.fn()}
      />,
    );
    fill(/^Embalagem/, '0');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar valores' }));
    await waitFor(() =>
      expect(screen.getByLabelText(/^Embalagem/)).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(repository.updatePurchaseDetails).not.toHaveBeenCalled();
    fill(/^Embalagem/, '500');
    fill(/^Marca/, '');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar valores' }));
    await waitFor(() => expect(repository.updatePurchaseDetails).toHaveBeenCalledTimes(1));
    expect(repository.updatePurchaseDetails).toHaveBeenCalledWith(item.id, {
      unitPrice: '18,9',
      quantity: '3',
      unit: 'un',
      brand: null,
    });
  });
  it('preserves local fields when a concurrent finalization makes the form read-only', () => {
    const props = {
      item,
      priceInput: createRef<HTMLInputElement>(),
      marking: false,
      onClose: vi.fn(),
    };
    const { rerender } = render(<PurchaseForm {...props} />);
    fill(/^Marca/, 'Minha escolha');
    fill(/^Embalagem/, '1');
    rerender(<PurchaseForm {...props} readOnly />);
    expect(screen.getByLabelText(/^Marca/)).toHaveValue('Minha escolha');
    expect(screen.getByLabelText(/^Marca/)).toHaveAttribute('readonly', '');
    expect(screen.getByLabelText('Unidade da embalagem')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Salvar valores' })).toBeDisabled();
  });
});
