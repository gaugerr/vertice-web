import { recentSuggestions, suggestionKey, type ItemSuggestion, type SuggestedProduct } from '../../domain/services/item-suggestions';
import Big from 'big.js';
import { productIdentity, type PriceReference } from '../../domain/services/price-history';
import { type ShoppingRepository } from '../../domain/models/repository';
import {
  DEFAULT_CATEGORIES,
  ACTIVE_PURCHASE,
  EMPTY_PRODUCT_DETAILS,
  type CompletionInput,
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
  budgetCentsSchema,
  completionInputSchema,
} from '../../domain/schemas/shopping';
import { VerticeDatabase } from '../database/database';
import { trackWrite } from '../database/writes';
import { validateSnapshot } from '../backup/backup';
import { spentCents } from '../../domain/services/money';
import {
  assertCompletable,
  buildListReview,
  ReviewChangedError,
} from '../../domain/services/completion';

export class DexieShoppingRepository implements ShoppingRepository {
  constructor(private db: VerticeDatabase) {}
  async getCompletedItemSuggestions(excludeListId: string): Promise<ItemSuggestion[]> {
    return this.db.transaction('r', this.db.lists, this.db.items, async () => {
      const lists = (await this.db.lists.where('status').equals('completed').toArray())
        .filter((list) => list.id !== excludeListId && list.purchaseDate && list.completedAt);
      const items = await this.db.items.where('shoppingListId').anyOf(lists.map((list) => list.id)).toArray();
      const byId = new Map(lists.map((list) => [list.id, list]));
      const candidates: ItemSuggestion[] = [];
      for (const item of items) {
        const list = byId.get(item.shoppingListId);
        if (!list || !item.isPurchased || !new Big(item.unitPrice).gt(0)) continue;
        candidates.push({ name: item.name, brand: item.brand, packageContent: item.packageContent, unit: item.unit, itemId: item.id, purchaseDate: list.purchaseDate!, completedAt: list.completedAt!, updatedAt: item.updatedAt });
      }
      return recentSuggestions(candidates);
    });
  }
  async addSuggestedItem(listId: string, categoryId: string, product: SuggestedProduct): Promise<string> {
    const data = itemInputSchema.parse({ name: product.name, brand: product.brand, packageContent: product.packageContent, unit: product.unit, unitPrice: '0', quantity: '1' });
    const details = { ...data, brand: data.brand ?? null, packageContent: data.packageContent ?? null };
    const key = suggestionKey(details);
    if (!key) throw new Error('Essa sugestão não é válida.');
    const id = crypto.randomUUID();
    await trackWrite(() => this.db.transaction('rw', this.db.lists, this.db.categories, this.db.items, async () => {
      await this.requireList(listId, true);
      const category = await this.db.categories.get(categoryId);
      if (category?.shoppingListId !== listId) throw new Error('Esta categoria não pertence à lista.');
      const existing = await this.db.items.where('shoppingListId').equals(listId).toArray();
      if (existing.some((item) => suggestionKey(item) === key)) throw new Error('Esse produto já está na lista.');
      const now = new Date().toISOString();
      await this.db.items.add({ ...details, id, shoppingListId: listId, categoryId, isPurchased: false, createdAt: now, updatedAt: now });
      await this.db.lists.update(listId, { updatedAt: now });
    }));
    return id;
  }
  async getCompletedPriceReferences(excludeListId: string): Promise<PriceReference[]> {
    return this.db.transaction('r', this.db.lists, this.db.items, async () => {
      const lists = (await this.db.lists.where('status').equals('completed').toArray()).filter(
        (list) => list.id !== excludeListId && list.purchaseDate && list.completedAt,
      );
      const items = await this.db.items
        .where('shoppingListId')
        .anyOf(lists.map((list) => list.id))
        .toArray();
      const byId = new Map(lists.map((list) => [list.id, list]));
      const records: PriceReference[] = [];
      for (const item of items) {
        const list = byId.get(item.shoppingListId);
        if (!list || !item.isPurchased || !new Big(item.unitPrice).gt(0)) continue;
        const productKey = productIdentity(item);
        if (!productKey) continue;
        records.push({
          productKey,
          itemId: item.id,
          unitPrice: item.unitPrice,
          purchaseDate: list.purchaseDate!,
          completedAt: list.completedAt!,
          updatedAt: item.updatedAt,
          marketName: list.marketName,
        });
      }
      return records;
    });
  }
  getLists() {
    return this.db.lists.orderBy('updatedAt').reverse().toArray();
  }
  async getListSummaries() {
    return this.db.transaction('r', this.db.lists, this.db.items, async () => {
      const [lists, items] = await Promise.all([this.getLists(), this.db.items.toArray()]);
      const grouped = new Map<string, typeof items>();
      for (const item of items) {
        const group = grouped.get(item.shoppingListId) ?? [];
        group.push(item);
        grouped.set(item.shoppingListId, group);
      }
      return lists.map((list) => ({ list, totalCents: spentCents(grouped.get(list.id) ?? []) }));
    });
  }
  getList(id: string) {
    return this.db.lists.get(id);
  }
  private async requireList(id: string, active = false) {
    const list = await this.db.lists.get(id);
    if (!list) throw new Error('Esta lista foi excluída.');
    if (active && list.status !== 'active')
      throw new Error('Esta compra foi finalizada. Reabra a compra para fazer alterações.');
    return list;
  }
  async getListReview(id: string) {
    return this.db.transaction('r', this.db.lists, this.db.categories, this.db.items, async () => {
      const list = await this.requireList(id);
      const [categories, items] = await Promise.all([
        this.getCategories(id),
        this.getItemsForList(id),
      ]);
      return buildListReview(list, categories, items);
    });
  }
  async completeList(id: string, input: CompletionInput, expectedRevision: string): Promise<void> {
    const data = completionInputSchema.parse(input);
    await trackWrite(() =>
      this.db.transaction('rw', this.db.lists, this.db.categories, this.db.items, async () => {
        await this.requireList(id, true);
        const review = await this.getListReview(id);
        if (review.revision !== expectedRevision) throw new ReviewChangedError();
        assertCompletable(review.items);
        const now = new Date().toISOString();
        await this.db.lists.update(id, {
          ...data,
          status: 'completed',
          completedAt: now,
          updatedAt: now,
        });
      }),
    );
  }
  async reopenList(id: string): Promise<void> {
    await trackWrite(() =>
      this.db.transaction('rw', this.db.lists, async () => {
        const list = await this.requireList(id);
        if (list.status === 'active') return;
        await this.db.lists.update(id, {
          status: 'active',
          completedAt: null,
          updatedAt: new Date().toISOString(),
        });
      }),
    );
  }
  async duplicateList(sourceId: string, input: ListInput): Promise<string> {
    const data = listInputSchema.parse(input);
    const id = crypto.randomUUID();
    await trackWrite(() =>
      this.db.transaction('rw', this.db.lists, this.db.categories, this.db.items, async () => {
        const review = await this.getListReview(sourceId);
        const now = new Date().toISOString();
        const timestamps = { createdAt: now, updatedAt: now };
        const categoryIds = new Map(
          review.categories.map((category) => [category.id, crypto.randomUUID()]),
        );
        await this.db.lists.add({ ...data, ...ACTIVE_PURCHASE, id, ...timestamps });
        await this.db.categories.bulkAdd(
          review.categories.map((category) => ({
            ...category,
            id: categoryIds.get(category.id)!,
            shoppingListId: id,
            ...timestamps,
          })),
        );
        // A distinct timestamp per row preserves order when all products are copied at once.
        const ordered = [...review.items].sort(
          (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
        );
        await this.db.items.bulkAdd(
          ordered.map((item, index) => ({
            ...item,
            id: crypto.randomUUID(),
            shoppingListId: id,
            categoryId: categoryIds.get(item.categoryId)!,
            unitPrice: '0',
            isPurchased: false,
            ...timestamps,
            createdAt: new Date(Date.parse(now) - ordered.length + index + 1).toISOString(),
          })),
        );
      }),
    );
    return id;
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
        await this.db.lists.add({
          ...data,
          ...ACTIVE_PURCHASE,
          id,
          createdAt: now,
          updatedAt: now,
        });
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
    await trackWrite(() =>
      this.db.transaction('rw', this.db.lists, async () => {
        await this.requireList(id, true);
        await this.db.lists.update(id, { ...data, updatedAt: new Date().toISOString() });
      }),
    );
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
  async setListBudget(id: string, budgetCents: number | null): Promise<void> {
    const value = budgetCentsSchema.parse(budgetCents);
    await trackWrite(() =>
      this.db.transaction('rw', this.db.lists, async () => {
        await this.requireList(id, true);
        await this.db.lists.update(id, { budgetCents: value, updatedAt: new Date().toISOString() });
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
        await this.requireList(listId, true);
        if (category?.shoppingListId !== listId)
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
          ...EMPTY_PRODUCT_DETAILS,
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
    inputPatch: Partial<ItemInput> & { isPurchased?: boolean },
  ): Promise<void> {
    const patch = { ...inputPatch };
    if (patch.brand === undefined) delete patch.brand;
    if (patch.packageContent === undefined) delete patch.packageContent;
    await trackWrite(() =>
      this.db.transaction('rw', this.db.lists, this.db.items, async () => {
        const item = await this.db.items.get(id);
        if (!item) throw new Error('Este item foi excluído.');
        await this.requireList(item.shoppingListId, true);
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
        await this.requireList(item.shoppingListId, true);
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
