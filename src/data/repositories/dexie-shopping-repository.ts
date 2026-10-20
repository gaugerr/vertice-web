import { type ShoppingRepository } from '../../domain/models/repository';
import {
  DEFAULT_CATEGORIES,
  type ItemInput,
  type PurchaseDetails,
  type ListInput,
  type ShoppingSnapshot,
} from '../../domain/models/shopping';
import {
  itemInputSchema,
  listInputSchema,
  nameSchema,
  purchaseDetailsSchema,
} from '../../domain/schemas/shopping';
import { VerticeDatabase } from '../database/database';
import { trackWrite } from '../database/writes';
import { validateSnapshot } from '../backup/backup';
import { spentCents } from '../../domain/services/money';

export class DexieShoppingRepository implements ShoppingRepository {
  constructor(private db: VerticeDatabase) {}
  getLists() {
    return this.db.lists.orderBy('updatedAt').reverse().toArray();
  }
  getList(id: string) {
    return this.db.lists.get(id);
  }
  getCategories(listId: string) {
    return this.db.categories.where('shoppingListId').equals(listId).sortBy('position');
  }
  getCategory(id: string) {
    return this.db.categories.get(id);
  }
  getItemsForList(id: string) {
    return this.db.items.where('shoppingListId').equals(id).toArray();
  }
  getItemsForCategory(id: string) {
    return this.db.items.where('categoryId').equals(id).sortBy('createdAt');
  }

  async createListWithCategories(input: ListInput): Promise<string> {
    const data = listInputSchema.parse(input);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await trackWrite(() =>
      this.db.transaction('rw', this.db.lists, this.db.categories, async () => {
        await this.db.lists.add({ ...data, id, createdAt: now, updatedAt: now });
        await this.db.categories.bulkAdd(
          DEFAULT_CATEGORIES.map((title, position) => ({
            id: crypto.randomUUID(),
            shoppingListId: id,
            title,
            position,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }),
    );
    return id;
  }
  async updateList(id: string, input: ListInput): Promise<void> {
    const data = listInputSchema.parse(input);
    await trackWrite(async () => {
      if (!(await this.db.lists.update(id, { ...data, updatedAt: new Date().toISOString() })))
        throw new Error('Esta lista foi excluída.');
    });
  }
  async deleteListCascade(id: string): Promise<void> {
    await trackWrite(() =>
      this.db.transaction('rw', this.db.lists, this.db.categories, this.db.items, async () => {
        await this.db.items.where('shoppingListId').equals(id).delete();
        await this.db.categories.where('shoppingListId').equals(id).delete();
        await this.db.lists.delete(id);
      }),
    );
  }
  async addItem(listId: string, categoryId: string, name: string): Promise<string> {
    const itemName = nameSchema.parse(name);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await trackWrite(() =>
      this.db.transaction('rw', this.db.lists, this.db.categories, this.db.items, async () => {
        const category = await this.db.categories.get(categoryId);
        if (category?.shoppingListId !== listId || !(await this.db.lists.get(listId)))
          throw new Error('Esta categoria não pertence à lista.');
        await this.db.items.add({
          id,
          name: itemName,
          shoppingListId: listId,
          categoryId,
          unitPrice: '0',
          quantity: '1',
          unit: 'un',
          isPurchased: false,
          createdAt: now,
          updatedAt: now,
        });
        await this.db.lists.update(listId, { updatedAt: now });
      }),
    );
    return id;
  }
  async updateItem(id: string, input: ItemInput): Promise<void> {
    const data = itemInputSchema.parse(input);
    await this.changeItem(id, data);
  }
  async setPurchased(id: string, isPurchased: boolean): Promise<void> {
    await this.changeItem(id, { isPurchased });
  }
  async updatePurchaseDetails(id: string, input: PurchaseDetails): Promise<void> {
    // Reuse monetary validation while preserving names and checkboxes changed in other tabs.
    await this.changeItem(id, purchaseDetailsSchema.parse(input));
  }
  private async changeItem(
    id: string,
    patch: Partial<ItemInput> & { isPurchased?: boolean },
  ): Promise<void> {
    await trackWrite(() =>
      this.db.transaction('rw', this.db.lists, this.db.items, async () => {
        const item = await this.db.items.get(id);
        if (!item) throw new Error('Este item foi excluído.');
        const now = new Date().toISOString();
        await this.db.items.update(id, { ...patch, updatedAt: now });
        spentCents(
          await this.db.items.where('shoppingListId').equals(item.shoppingListId).toArray(),
        );
        if (!(await this.db.lists.update(item.shoppingListId, { updatedAt: now })))
          throw new Error('Esta lista foi excluída.');
      }),
    );
  }
  async deleteItem(id: string): Promise<void> {
    await trackWrite(() =>
      this.db.transaction('rw', this.db.lists, this.db.items, async () => {
        const item = await this.db.items.get(id);
        if (!item) return;
        await this.db.items.delete(id);
        await this.db.lists.update(item.shoppingListId, { updatedAt: new Date().toISOString() });
      }),
    );
  }
  exportSnapshot(): Promise<ShoppingSnapshot> {
    return this.db.transaction('r', this.db.lists, this.db.categories, this.db.items, async () => ({
      lists: await this.db.lists.toArray(),
      categories: await this.db.categories.toArray(),
      items: await this.db.items.toArray(),
    }));
  }
  async replaceSnapshot(snapshot: ShoppingSnapshot): Promise<void> {
    const data = validateSnapshot(snapshot);
    await trackWrite(() =>
      this.db.transaction('rw', this.db.lists, this.db.categories, this.db.items, async () => {
        await this.db.items.clear();
        await this.db.categories.clear();
        await this.db.lists.clear();
        await this.db.lists.bulkAdd(data.lists);
        await this.db.categories.bulkAdd(data.categories);
        await this.db.items.bulkAdd(data.items);
      }),
    );
  }
}
