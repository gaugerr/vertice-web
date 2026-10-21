import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { VerticeDatabase } from '../database/database';
import { DexieShoppingRepository } from './dexie-shopping-repository';
import { encodeBackup, parseBackup } from '../backup/backup';
import { buildListReview } from '../../domain/services/completion';

let db: VerticeDatabase;
let repo: DexieShoppingRepository;
const input = {
  storeName: 'Compra semanal',
  date: '2026-10-21',
  description: 'Lembrete',
  budgetCents: 500,
};
const completion = { marketName: 'Mercado do bairro', purchaseDate: '2026-10-20' };
beforeEach(() => {
  db = new VerticeDatabase(`complete-${crypto.randomUUID()}`);
  repo = new DexieShoppingRepository(db);
});
afterEach(async () => {
  await db.delete();
});
async function seed() {
  const id = await repo.createListWithCategories(input);
  const categories = await repo.getCategories(id);
  const bought = await repo.addItem(id, categories[0].id, 'Café');
  await repo.updatePurchaseDetails(bought, { unitPrice: '12,5', quantity: '0,5', unit: 'kg' });
  await repo.setPurchased(bought, true);
  const pending = await repo.addItem(id, categories[1].id, 'Banana');
  await repo.updatePurchaseDetails(pending, { unitPrice: '100', quantity: '2', unit: 'un' });
  return { id, categories, bought, pending };
}
async function finish(id: string) {
  await repo.completeList(id, completion, (await repo.getListReview(id)).revision);
}
describe('purchase completion and duplication', () => {
  it('completes a purchase including fractional values and keeps pending rows unchanged', async () => {
    const { id } = await seed();
    const before = await repo.getListReview(id);
    expect(before).toMatchObject({ totalCents: 625, purchasedCount: 1, pendingCount: 1 });
    await finish(id);
    const after = await repo.getListReview(id);
    expect(after.list).toMatchObject({ status: 'completed', ...completion, budgetCents: 500 });
    expect(after.list.completedAt).toMatch(/^\d{4}-/);
    expect(after.items).toEqual(before.items);
    expect(after.categories).toEqual(before.categories);
    expect(parseBackup(encodeBackup(await repo.exportSnapshot()))).toEqual(
      await repo.exportSnapshot(),
    );
  });
  it('also permits completion when every product is purchased', async () => {
    const { id, pending } = await seed();
    await repo.setPurchased(pending, true);
    await finish(id);
    expect(await repo.getListReview(id)).toMatchObject({
      purchasedCount: 2,
      pendingCount: 0,
      totalCents: 20625,
    });
  });
  it('rejects an empty list, no purchased products and purchased zero prices', async () => {
    const empty = await repo.createListWithCategories(input);
    await expect(finish(empty)).rejects.toThrow('pelo menos');
    const category = (await repo.getCategories(empty))[0];
    const item = await repo.addItem(empty, category.id, 'Sem preço');
    await expect(finish(empty)).rejects.toThrow('pelo menos');
    await repo.setPurchased(item, true);
    await expect(finish(empty)).rejects.toThrow('maior que zero');
    expect((await repo.getList(empty))?.status).toBe('active');
  });
  it('rejects invalid completion dates and markets without changing storage', async () => {
    const { id } = await seed();
    const before = await repo.exportSnapshot();
    for (const data of [
      { ...completion, purchaseDate: '2026-02-30' },
      { ...completion, marketName: 'x'.repeat(51) },
    ])
      await expect(
        repo.completeList(id, data, (await repo.getListReview(id)).revision),
      ).rejects.toThrow();
    expect(await repo.exportSnapshot()).toEqual(before);
  });
  it('blocks every edit on completed purchases, including requests from a stale connection', async () => {
    const { id, bought, categories } = await seed();
    const connection = new VerticeDatabase(db.name);
    const stale = new DexieShoppingRepository(connection);
    try {
      await stale.getList(id);
      await finish(id);
      const before = await repo.exportSnapshot();
      const attempts = [
        () => stale.updateList(id, input),
        () => stale.setListBudget(id, 1000),
        () => stale.addItem(id, categories[0].id, 'Novo'),
        () => stale.updateItem(bought, { name: 'Novo', unitPrice: '9', quantity: '1', unit: 'un' }),
        () => stale.updatePurchaseDetails(bought, { unitPrice: '9', quantity: '1', unit: 'un' }),
        () => stale.setPurchased(bought, false),
        () => stale.deleteItem(bought),
      ];
      for (const attempt of attempts) await expect(attempt()).rejects.toThrow('Reabra');
      expect(await repo.exportSnapshot()).toEqual(before);
    } finally {
      connection.close();
    }
  });
  it('reopens and corrects the same purchase without duplicating records', async () => {
    const { id, bought } = await seed();
    await finish(id);
    await repo.reopenList(id);
    expect(await repo.getList(id)).toMatchObject({
      status: 'active',
      completedAt: null,
      ...completion,
    });
    await repo.updatePurchaseDetails(bought, { unitPrice: '20', quantity: '0.5', unit: 'kg' });
    await repo.completeList(
      id,
      { ...completion, marketName: null },
      (await repo.getListReview(id)).revision,
    );
    expect(await repo.getLists()).toHaveLength(1);
    expect(await repo.getListReview(id)).toMatchObject({
      totalCents: 1000,
      list: { id, status: 'completed', marketName: null },
    });
  });
  it('requires a new review after concurrent changes, even if timestamps do not change', async () => {
    const { id, bought } = await seed();
    const review = await repo.getListReview(id);
    await db.items.update(bought, { quantity: '3' });
    await expect(repo.completeList(id, completion, review.revision)).rejects.toThrow('mudou');
    const fresh = await repo.getListReview(id);
    expect(fresh.totalCents).toBe(3750);
    expect(
      buildListReview(fresh.list, [...fresh.categories].reverse(), [...fresh.items].reverse())
        .revision,
    ).toBe(fresh.revision);
    await repo.completeList(id, completion, fresh.revision);
  });
  it('serializes two concurrent confirmations so only one can succeed', async () => {
    const { id } = await seed();
    const connection = new VerticeDatabase(db.name);
    try {
      const other = new DexieShoppingRepository(connection);
      const review = await repo.getListReview(id);
      const results = await Promise.allSettled([
        repo.completeList(id, completion, review.revision),
        other.completeList(id, completion, review.revision),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await repo.getLists()).toHaveLength(1);
    } finally {
      connection.close();
    }
  });
  it('rolls back a failed completion', async () => {
    const { id } = await seed();
    const before = await repo.exportSnapshot();
    db.lists.hook('updating', () => {
      throw new Error('Sem espaço');
    });
    await expect(finish(id)).rejects.toThrow('Sem espaço');
    expect(await repo.exportSnapshot()).toEqual(before);
  });
  it.each([false, true])(
    'duplicates an active/completed purchase (completed=%s) without changing the source',
    async (closed) => {
      const { id } = await seed();
      if (closed) await finish(id);
      const before = await repo.getListReview(id);
      const copy = await repo.duplicateList(id, {
        ...input,
        storeName: 'Nova compra',
        budgetCents: null,
      });
      const after = await repo.getListReview(copy);
      expect(after.list).toMatchObject({
        status: 'active',
        completedAt: null,
        purchaseDate: null,
        marketName: null,
        budgetCents: null,
      });
      expect(after.totalCents).toBe(0);
      expect(after.items).toHaveLength(2);
      expect(after.categories.map((c) => c.title)).toEqual(before.categories.map((c) => c.title));
      for (const item of after.items) {
        const original = before.items.find((i) => i.name === item.name)!;
        expect(item).toMatchObject({
          quantity: original.quantity,
          unit: original.unit,
          isPurchased: false,
          unitPrice: '0',
          shoppingListId: copy,
        });
        expect(before.items.some((i) => i.id === item.id)).toBe(false);
        expect(after.categories.find((c) => c.id === item.categoryId)?.title).toBe(
          before.categories.find((c) => c.id === original.categoryId)?.title,
        );
      }
      expect(await repo.getListReview(id)).toEqual(before);
    },
  );
  it('copies empty categories and an empty list', async () => {
    const id = await repo.createListWithCategories(input);
    const copy = await repo.duplicateList(id, input);
    expect((await repo.getListReview(copy)).categories).toHaveLength(6);
    expect((await repo.getListReview(copy)).items).toEqual([]);
  });
  it('rolls back failed duplication and reports a deleted source', async () => {
    const { id } = await seed();
    const before = await repo.exportSnapshot();
    db.items.hook('creating', () => {
      throw new Error('Sem espaço');
    });
    await expect(repo.duplicateList(id, input)).rejects.toThrow('Sem espaço');
    expect(await repo.exportSnapshot()).toEqual(before);
    await repo.deleteListCascade(id);
    await expect(repo.duplicateList(id, input)).rejects.toThrow('excluída');
    expect(await repo.getLists()).toHaveLength(0);
  });
  it('upgrades a populated version 2 database without changing the previous purchase', async () => {
    const id = crypto.randomUUID(),
      cat = crypto.randomUUID(),
      item = crypto.randomUUID();
    const old = new Dexie(db.name);
    old.version(2).stores({
      lists: 'id, updatedAt',
      categories: 'id, shoppingListId, [shoppingListId+position]',
      items: 'id, shoppingListId, categoryId, [categoryId+createdAt]',
    });
    const timestamps = {
      createdAt: '2026-10-20T12:00:00.000Z',
      updatedAt: '2026-10-20T12:00:00.000Z',
    };
    await old.table('lists').add({ ...input, id, ...timestamps });
    const category = {
      id: cat,
      shoppingListId: id,
      title: 'Personalizada',
      position: 0,
      ...timestamps,
    };
    const product = {
      id: item,
      shoppingListId: id,
      categoryId: cat,
      name: 'Antigo',
      unitPrice: '25',
      quantity: '0.4',
      unit: 'kg',
      isPurchased: true,
      ...timestamps,
    };
    await old.table('categories').add(category);
    await old.table('items').add(product);
    old.close();
    expect(await repo.getList(id)).toEqual({
      ...input,
      id,
      ...timestamps,
      status: 'active',
      completedAt: null,
      purchaseDate: null,
      marketName: null,
    });
    expect(await repo.getItemsForList(id)).toEqual([{ ...product, brand: null, packageContent: null }]);
    expect(await repo.getCategories(id)).toEqual([category]);
    expect((await repo.getListReview(id)).totalCents).toBe(1000);
  });
  it('can delete a completed purchase with its dependents', async () => {
    const { id } = await seed();
    await finish(id);
    await repo.deleteListCascade(id);
    expect(await repo.exportSnapshot()).toEqual({ lists: [], categories: [], items: [] });
  });
});
