import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VerticeDatabase } from '../database/database';
import { DexieShoppingRepository } from './dexie-shopping-repository';
import { DEFAULT_CATEGORIES } from '../../domain/models/shopping';
import { encodeBackup, parseBackup } from '../backup/backup';
import { spentCents } from '../../domain/services/money';

let db: VerticeDatabase;
let repository: DexieShoppingRepository;
const input = { storeName: 'Mercado', date: '2026-10-19', description: '' };
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
  it('supports empty backup replacement and version 2 round trips', async () => {
    await seed();
    const original = await repository.exportSnapshot();
    expect(parseBackup(encodeBackup(original))).toEqual(original);
    await repository.replaceSnapshot({ lists: [], categories: [], items: [] });
    expect(await repository.getLists()).toEqual([]);
  });
});
