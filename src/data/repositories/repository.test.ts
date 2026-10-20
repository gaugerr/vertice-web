import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VerticeDatabase } from '../database/database';
import { DexieShoppingRepository } from './dexie-shopping-repository';
import { DEFAULT_CATEGORIES } from '../../domain/models/shopping';
import { encodeBackup, parseBackup } from '../backup/backup';
import { spentCents } from '../../domain/services/money';
import Dexie from 'dexie';

let db: VerticeDatabase;
let repository: DexieShoppingRepository;
const input = { storeName: 'Mercado', date: '2026-10-19', description: '', budgetCents: null };
beforeEach(() => {
  db = new VerticeDatabase(`test-${crypto.randomUUID()}`);
  repository = new DexieShoppingRepository(db);
});
afterEach(async () => {
  await db.delete();
});
async function seed() {
  const listId = await repository.createListWithCategories(input);
  const category = (await repository.getCategories(listId))[0];
  const itemId = await repository.addItem(listId, category.id, 'Arroz');
  return { listId, category, itemId };
}
describe('local repository', () => {
  it('upgrades populated version 1 storage without losing shopping records', async () => {
    const id = crypto.randomUUID(),
      categoryId = crypto.randomUUID(),
      itemId = crypto.randomUUID();
    const timestamps = {
      createdAt: '2026-10-19T12:00:00.000Z',
      updatedAt: '2026-10-19T12:00:00.000Z',
    };
    const old = new Dexie(db.name);
    old.version(1).stores({
      lists: 'id, updatedAt',
      categories: 'id, shoppingListId, [shoppingListId+position]',
      items: 'id, shoppingListId, categoryId, [categoryId+createdAt]',
    });
    const oldLists = old.table('lists');
    const oldCategories = old.table('categories');
    await oldLists.add({
      id,
      storeName: 'Compra existente',
      date: input.date,
      description: 'Preservar',
      ...timestamps,
    });
    await oldCategories.add({
      id: categoryId,
      shoppingListId: id,
      title: 'Essenciais',
      position: 0,
      ...timestamps,
    });
    const item = {
      id: itemId,
      shoppingListId: id,
      categoryId,
      name: 'Arroz',
      unitPrice: '20',
      quantity: '0.5',
      unit: 'kg',
      isPurchased: true,
      ...timestamps,
    };
    await old.table('items').add(item);
    old.close();
    expect(await repository.getList(id)).toMatchObject({
      id,
      description: 'Preservar',
      budgetCents: null,
      ...timestamps,
    });
    expect(await repository.getItemsForList(id)).toEqual([item]);
    expect(await repository.getCategories(id)).toHaveLength(1);
  });

  it('changes and removes a list budget independently of metadata, items and other lists', async () => {
    const first = await seed(),
      second = await seed();
    await repository.setListBudget(first.listId, 30000);
    const otherConnection = new VerticeDatabase(db.name);
    try {
      const reopened = new DexieShoppingRepository(otherConnection);
      expect((await reopened.getList(first.listId))?.budgetCents).toBe(30000);
      expect((await reopened.getList(second.listId))?.budgetCents).toBeNull();
      await repository.updateList(first.listId, {
        ...input,
        storeName: 'Nome novo',
        budgetCents: 30000,
      });
      await reopened.setListBudget(first.listId, 12000);
      expect(await repository.getList(first.listId)).toMatchObject({
        storeName: 'Nome novo',
        date: input.date,
        budgetCents: 12000,
      });
      expect(await repository.getItemsForList(first.listId)).toHaveLength(1);
      for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
        await expect(repository.setListBudget(first.listId, value)).rejects.toThrow();
      expect((await repository.getList(first.listId))?.budgetCents).toBe(12000);
      await repository.setListBudget(first.listId, null);
      expect((await reopened.getList(first.listId))?.budgetCents).toBeNull();
      await expect(repository.setListBudget(crypto.randomUUID(), 100)).rejects.toThrow('excluída');
    } finally {
      otherConnection.close();
    }
  });
  it('saves quick purchase values without overwriting a concurrent rename or uncheck', async () => {
    const { itemId, listId } = await seed();
    await repository.setPurchased(itemId, true);
    await repository.updateItem(itemId, {
      name: 'Arroz integral',
      unitPrice: '3',
      quantity: '1',
      unit: 'un',
    });
    await repository.setPurchased(itemId, false);
    await repository.updatePurchaseDetails(itemId, {
      unitPrice: '12,50',
      quantity: '0,5',
      unit: 'kg',
    });
    expect((await repository.getItemsForList(listId))[0]).toMatchObject({
      name: 'Arroz integral',
      unitPrice: '12.5',
      quantity: '0.5',
      unit: 'kg',
      isPurchased: false,
    });
    await expect(
      repository.updatePurchaseDetails(itemId, {
        unitPrice: '99',
        quantity: '0',
        unit: 'kg',
      }),
    ).rejects.toThrow();
    expect((await repository.getItemsForList(listId))[0].unitPrice).toBe('12.5');
  });
  it('keeps the original Flutter item order after import', async () => {
    const data = parseBackup(
      JSON.stringify({
        format: 'vertice-backup',
        version: 1,
        lists: [{ id: 1, storeName: 'Mercado', date: 1792454400000, description: '' }],
        categories: [{ id: 1, title: 'Essenciais', shoppingListId: 1 }],
        items: ['Arroz', 'Feijão', 'Café'].map((name, index) => ({
          id: index + 1,
          name,
          price: 0,
          quantity: 1,
          unit: 'un',
          isPurchased: 0,
          categoryId: 1,
          shoppingListId: 1,
        })),
      }),
    );
    await repository.replaceSnapshot(data);
    expect(
      (await repository.getItemsForCategory(data.categories[0].id)).map((item) => item.name),
    ).toEqual(['Arroz', 'Feijão', 'Café']);
  });

  it('creates the list and exactly six ordered categories atomically', async () => {
    const listId = await repository.createListWithCategories(input);
    expect((await repository.getCategories(listId)).map((c) => c.title)).toEqual(
      DEFAULT_CATEGORIES,
    );
    expect((await repository.getList(listId))?.description).toBe('');
  });
  it('rolls back list creation if creating a category fails', async () => {
    db.categories.hook('creating', () => {
      throw new Error('Storage failed');
    });
    await expect(repository.createListWithCategories(input)).rejects.toThrow();
    expect(await repository.getLists()).toEqual([]);
  });
  it('preserves defaults, edits, checked state and reload persistence', async () => {
    const { listId, category, itemId } = await seed();
    expect((await repository.getItemsForCategory(category.id))[0]).toMatchObject({
      unitPrice: '0',
      quantity: '1',
      unit: 'un',
      isPurchased: false,
    });
    await repository.setPurchased(itemId, true);
    await repository.updateItem(itemId, {
      name: 'Arroz integral',
      unitPrice: '20',
      quantity: '0,5',
      unit: 'kg',
    });
    const otherConnection = new VerticeDatabase(db.name);
    const reopened = new DexieShoppingRepository(otherConnection);
    const items = await reopened.getItemsForList(listId);
    expect(items[0]).toMatchObject({
      name: 'Arroz integral',
      unitPrice: '20',
      quantity: '0.5',
      isPurchased: true,
    });
    expect(spentCents(items)).toBe(1000);
    await repository.updateList(listId, { ...input, storeName: 'Outra compra' });
    expect((await repository.getList(listId))?.storeName).toBe('Outra compra');
    // Close the additional connection before deleting the test database.
    otherConnection.close();
  });
  it('scopes reads and totals to the correct list', async () => {
    const first = await seed();
    const second = await seed();
    await repository.updateItem(first.itemId, {
      name: 'Arroz',
      unitPrice: '20',
      quantity: '0.5',
      unit: 'kg',
    });
    await repository.setPurchased(first.itemId, true);
    await repository.updateItem(second.itemId, {
      name: 'Outro',
      unitPrice: '999',
      quantity: '1',
      unit: 'un',
    });
    await repository.setPurchased(second.itemId, true);
    expect(spentCents(await repository.getItemsForList(first.listId))).toBe(1000);
  });
  it('rejects an item linked to a category from another list', async () => {
    const first = await seed();
    const second = await seed();
    await expect(
      repository.addItem(first.listId, second.category.id, 'Inválido'),
    ).rejects.toThrow();
    expect(await repository.getItemsForList(first.listId)).toHaveLength(1);
  });
  it('rolls back failed edits and preserves committed state', async () => {
    const { itemId, category } = await seed();
    await expect(
      repository.updateItem(itemId, {
        name: 'Changed',
        unitPrice: '-2',
        quantity: '1',
        unit: 'un',
      }),
    ).rejects.toThrow();
    expect((await repository.getItemsForCategory(category.id))[0].name).toBe('Arroz');
  });
  it('deletes the list and all its dependents', async () => {
    const { listId } = await seed();
    await repository.deleteListCascade(listId);
    expect(await repository.exportSnapshot()).toEqual({ lists: [], categories: [], items: [] });
  });
  it('restores transactionally and rolls back a storage failure', async () => {
    const { category } = await seed();
    const original = await repository.exportSnapshot();
    const changed = structuredClone(original);
    changed.items[0].name = 'Quebrar';
    db.items.hook('creating', (_key, item) => {
      if (item.name === 'Quebrar') throw new Error('Storage failed');
    });
    await expect(repository.replaceSnapshot(changed)).rejects.toThrow();
    expect((await repository.getItemsForCategory(category.id))[0].name).toBe('Arroz');
    expect(await repository.exportSnapshot()).toEqual(original);
  });
  it('supports empty backup replacement and version 3 round trips', async () => {
    await seed();
    const original = await repository.exportSnapshot();
    expect(parseBackup(encodeBackup(original))).toEqual(original);
    await repository.replaceSnapshot({ lists: [], categories: [], items: [] });
    expect(await repository.getLists()).toEqual([]);
  });
});
