import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { PurchaseForm } from './PurchaseForm';
import { repository } from '../../../app/services';
import { productIdentity, type PriceReference } from '../../../domain/services/price-history';
import type { ShoppingItem } from '../../../domain/models/shopping';
vi.mock('../../../app/services', () => ({ repository: { updatePurchaseDetails: vi.fn(), getCompletedPriceReferences: vi.fn() } }));
const item: ShoppingItem = { id: 'item', shoppingListId: 'current', categoryId: 'category', name: 'Café', brand: 'Marca X', packageContent: { amount: '500', unit: 'g' }, unitPrice: '0', quantity: '3', unit: 'un', isPurchased: true, createdAt: '2026-10-21T12:00:00.000Z', updatedAt: '2026-10-21T12:00:00.000Z' };
const record: PriceReference = { productKey: productIdentity(item)!, itemId: 'previous', unitPrice: '18.9', purchaseDate: '2026-10-12', completedAt: '2026-10-12T12:00:00.000Z', updatedAt: '2026-10-12T11:00:00.000Z', marketName: 'Mercado X' };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(repository.getCompletedPriceReferences).mockResolvedValue([record]); vi.mocked(repository.updatePurchaseDetails).mockResolvedValue(undefined); });
afterEach(() => { cleanup(); });
function mount() { const priceInput = createRef<HTMLInputElement>(); render(<PurchaseForm item={item} priceInput={priceInput} marking={false} onClose={vi.fn()} />); return priceInput; }
describe('last price in the quick form', () => {
  it('updates differences from the draft without rereading storage, changing quantity totals or stealing focus', async () => {
    const price = mount();
    const reference = await screen.findByLabelText('Preço da última compra');
    expect(reference).toHaveTextContent('R$ 18,90/un');
    expect(reference).toHaveTextContent('Mercado X');
    expect(reference).not.toHaveTextContent('Mesmo preço');
    const reads = vi.mocked(repository.getCompletedPriceReferences).mock.calls.length;
    price.current!.focus();
    for (const [value, expected] of [['20,90', 'R$ 2,00 a mais por unidade'], ['16,90', 'R$ 2,00 a menos por unidade'], ['18,90', 'Mesmo preço da última compra']]) {
      fireEvent.change(price.current!, { target: { value } });
      expect(reference).toHaveTextContent(expected);
      expect(price.current).toHaveFocus();
    }
    expect(repository.getCompletedPriceReferences).toHaveBeenCalledTimes(reads);
    fireEvent.change(screen.getByLabelText('Quantidade', { exact: true }), { target: { value: '10' } });
    expect(reference).toHaveTextContent('Mesmo preço');
    fireEvent.change(screen.getByLabelText('Marca'), { target: { value: '' } });
    expect(screen.queryByLabelText('Preço da última compra')).not.toBeInTheDocument();
  });
  it('omits empty results and matches equivalent packaging entered before saving', async () => {
    mount();
    await screen.findByLabelText('Preço da última compra');
    fireEvent.change(screen.getByLabelText('Embalagem'), { target: { value: '0,5' } });
    expect(screen.queryByLabelText('Preço da última compra')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Unidade da embalagem'), { target: { value: 'kg' } });
    expect(screen.getByLabelText('Preço da última compra')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Unidade', { exact: true }), { target: { value: 'kg' } });
    expect(screen.queryByLabelText('Preço da última compra')).not.toBeInTheDocument();
  });
  it('keeps saving available when the historical read fails', async () => {
    vi.mocked(repository.getCompletedPriceReferences).mockRejectedValue(new Error('Storage read failed'));
    const price = mount();
    await screen.findByText('Referência indisponível');
    fireEvent.change(price.current!, { target: { value: '20,90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar valores' }));
    await waitFor(() => expect(repository.updatePurchaseDetails).toHaveBeenCalledWith(item.id, { unitPrice: '20,90', quantity: '3', unit: 'un' }));
  });
});
