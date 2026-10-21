import Dexie, { type EntityTable } from 'dexie';
import type { Category, ShoppingItem, ShoppingList } from '../../domain/models/shopping';
import { ACTIVE_PURCHASE, EMPTY_PRODUCT_DETAILS } from '../../domain/models/shopping';

export class VerticeDatabase extends Dexie {
  lists!: EntityTable<ShoppingList, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  items!: EntityTable<ShoppingItem, 'id'>;
  constructor(name = 'vertice_web') {
    super(name);
    this.version(1).stores({
      lists: 'id, updatedAt',
      categories: 'id, shoppingListId, [shoppingListId+position]',
      items: 'id, shoppingListId, categoryId, [categoryId+createdAt]',
    });
    this.version(2)
      .stores({ lists: 'id, updatedAt' })
      .upgrade((transaction) =>
        transaction.table('lists').toCollection().modify({ budgetCents: null }),
      );
    this.version(3)
      .stores({ lists: 'id, updatedAt, status' })
      .upgrade((transaction) =>
        transaction
          .table('lists')
          .toCollection()
          .modify({ ...ACTIVE_PURCHASE }),
      );
    this.version(4)
      .stores({ items: 'id, shoppingListId, categoryId, [categoryId+createdAt]' })
      .upgrade((transaction) =>
        transaction
          .table('items')
          .toCollection()
          .modify({ ...EMPTY_PRODUCT_DETAILS }),
      );
  }
}
