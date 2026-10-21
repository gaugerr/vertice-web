import Big from 'big.js';
import type { Category, ShoppingItem, ShoppingList, ListReview } from '../models/shopping';
import { spentCents } from './money';

export class ReviewChangedError extends Error {
  constructor() {
    super('A lista mudou em outra aba. Confira o resumo atualizado e confirme novamente.');
    this.name = 'ReviewChangedError';
  }
}

export function buildListReview(
  list: ShoppingList,
  categories: Category[],
  items: ShoppingItem[],
): ListReview {
  // Explicit fields and deterministic ordering also catch changes within the same millisecond.
  const revision = JSON.stringify([
    [
      list.id,
      list.storeName,
      list.date,
      list.description,
      list.budgetCents,
      list.status,
      list.completedAt,
      list.purchaseDate,
      list.marketName,
      list.createdAt,
      list.updatedAt,
    ],
    [...categories]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((c) => [c.id, c.shoppingListId, c.title, c.position, c.createdAt, c.updatedAt]),
    [...items]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((i) => [
        i.id,
        i.shoppingListId,
        i.categoryId,
        i.name,
        i.unitPrice,
        i.quantity,
        i.unit,
        i.isPurchased,
        i.createdAt,
        i.updatedAt,
      ]),
  ]);
  const purchasedCount = items.filter((item) => item.isPurchased).length;
  return {
    list,
    categories,
    items,
    totalCents: spentCents(items),
    purchasedCount,
    pendingCount: items.length - purchasedCount,
    revision,
  };
}

export function unpricedPurchasedItems(items: ShoppingItem[]): ShoppingItem[] {
  return items.filter((item) => item.isPurchased && !new Big(item.unitPrice).gt(0));
}

export function assertCompletable(items: ShoppingItem[]): void {
  if (!items.some((item) => item.isPurchased))
    throw new Error('Marque pelo menos um produto como comprado antes de finalizar.');
  if (unpricedPurchasedItems(items).length)
    throw new Error('Informe um preço maior que zero em todos os produtos comprados.');
  spentCents(items);
}
