import { createRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { PurchaseForm } from './PurchaseForm';
import type { ShoppingItem } from '../../../domain/models/shopping';
const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('../../../app/repository-context', () => ({
  useRepository: () => ({ updatePurchaseDetails: save }),
}));
vi.mock('./LastPriceReference', () => ({ LastPriceReference: () => null }));
const item: ShoppingItem = {
  id: 'item',
  shoppingListId: 'list',
  categoryId: 'category',
  name: 'Café',
  unitPrice: '0',
  quantity: '1',
  unit: 'un',
  isPurchased: true,
  brand: null,
  packageContent: null,
  createdAt: '2026-11-09T12:00:00.000Z',
  updatedAt: '2026-11-09T12:00:00.000Z',
};
beforeEach(() => {
  save.mockReset().mockResolvedValue(undefined);
});
test('Enter rápido aguarda a marcação e salva o preço uma única vez', async () => {
  const close = vi.fn(),
    input = createRef<HTMLInputElement>();
  const { rerender } = render(
    <PurchaseForm item={item} priceInput={input} marking onClose={close} />,
  );
  const price = screen.getByLabelText('Preço por un (R$)');
  fireEvent.change(price, { target: { value: '18,90' } });
  fireEvent.keyDown(price, { key: 'Enter' });
  fireEvent.keyDown(price, { key: 'Enter' });
  expect(save).not.toHaveBeenCalled();
  rerender(<PurchaseForm item={item} priceInput={input} marking={false} onClose={close} />);
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenCalledWith('item', expect.objectContaining({ unitPrice: '18,90' }));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
});
test('finalização em outra aba cancela o Enter pendente sem perder o preço', async () => {
  const close = vi.fn(),
    input = createRef<HTMLInputElement>();
  const { rerender } = render(
    <PurchaseForm item={item} priceInput={input} marking onClose={close} />,
  );
  const price = screen.getByLabelText('Preço por un (R$)');
  fireEvent.change(price, { target: { value: '18,90' } });
  fireEvent.keyDown(price, { key: 'Enter' });
  rerender(
    <PurchaseForm item={item} priceInput={input} marking={false} readOnly onClose={close} />,
  );
  expect(save).not.toHaveBeenCalled();
  expect(price).toHaveValue('18,90');
  expect(close).not.toHaveBeenCalled();
});
