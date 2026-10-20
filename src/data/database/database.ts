import Dexie, { type EntityTable } from 'dexie';
import type { Category, ShoppingItem, ShoppingList } from '../../domain/models/shopping';

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
  }
}
