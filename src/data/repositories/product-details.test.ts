import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { VerticeDatabase } from '../database/database';
import { DexieShoppingRepository } from './dexie-shopping-repository';
import { productDetailsDraft, productDetailsPatch } from '../../domain/services/product-details';
import { encodeBackup, parseBackup } from '../backup/backup';

let db: VerticeDatabase;
let repo: DexieShoppingRepository;
const listInput = { storeName: 'Semana', description: '', date: '2026-10-21', budgetCents: 10000 };
const details = { brand: 'Marca X', packageContent: { amount: '500', unit: 'g' as const } };
beforeEach(() => { db = new VerticeDatabase(`details-${crypto.randomUUID()}`); repo = new DexieShoppingRepository(db); });
afterEach(async () => { await db.delete(); });
async function seed() {
  const id = await repo.createListWithCategories(listInput);
  const category = (await repo.getCategories(id))[0];
  const item = await repo.addItem(id, category.id, 'Café');
  return { id, item };
}
async function save(id: string, extra = {}) {
  await repo.updatePurchaseDetails(id, { unitPrice: '18.9', quantity: '3', unit: 'un', ...extra });
}
describe('stored product details', () => {
  it('stores optional metadata canonically and keeps money and base names independent', async () => {
    const { id, item } = await seed();
    expect((await repo.getItemsForList(id))[0]).toMatchObject({ brand: null, packageContent: null });
    await save(item, { brand: ' Marca X ', packageContent: { amount: '500,000', unit: 'g' } });
    await repo.setPurchased(item, true);
    const review = await repo.getListReview(id);
    expect(review.items[0]).toMatchObject({ name: 'Café', ...details });
    expect(review.totalCents).toBe(5670);
    expect(parseBackup(encodeBackup(await repo.exportSnapshot()))).toEqual(await repo.exportSnapshot());
  });
  it('preserves concurrent metadata during price-only edits and clears fields independently', async () => {
    const { id, item } = await seed();
    const original = productDetailsDraft((await repo.getItemsForList(id))[0]);
    const connection = new VerticeDatabase(db.name);
    try {
      await new DexieShoppingRepository(connection).updatePurchaseDetails(item, { unitPrice: '20', quantity: '1', unit: 'un', ...details });
      await save(item, productDetailsPatch(original, original));
      expect((await repo.getItemsForList(id))[0]).toMatchObject(details);
      await save(item, { brand: null });
      expect((await repo.getItemsForList(id))[0]).toMatchObject({ brand: null, packageContent: details.packageContent });
      await save(item, { brand: undefined, packageContent: undefined });
      expect((await repo.getItemsForList(id))[0].packageContent).toEqual(details.packageContent);
      await save(item, { packageContent: null });
      expect((await repo.getItemsForList(id))[0].packageContent).toBeNull();
    } finally { connection.close(); }
  });
  it('rejects invalid metadata and rolls back a failed financial/detail write', async () => {
    const { id, item } = await seed();
    const before = await repo.exportSnapshot();
    await expect(save(item, { packageContent: { amount: '0', unit: 'g' } })).rejects.toThrow();
    expect(await repo.exportSnapshot()).toEqual(before);
    db.lists.hook('updating', () => { throw new Error('Sem espaço'); });
    await expect(save(item, details)).rejects.toThrow('Sem espaço');
    expect(await repo.exportSnapshot()).toEqual(before);
    expect((await repo.getItemsForList(id))[0].unitPrice).toBe('0');
  });
  it('copies details into independent active and completed lists and protects completed metadata', async () => {
    const { id, item } = await seed(); await save(item, details); await repo.setPurchased(item, true);
    for (const closed of [false, true]) {
      if (closed) await repo.completeList(id, { marketName: null, purchaseDate: listInput.date }, (await repo.getListReview(id)).revision);
      const before = await repo.getListReview(id);
      const copy = await repo.duplicateList(id, listInput);
      const copied = (await repo.getItemsForList(copy))[0];
      expect(copied).toMatchObject({ ...details, unitPrice: '0', quantity: '3', isPurchased: false });
      expect(copied.id).not.toBe(item);
      await save(copied.id, { brand: 'Outra marca' });
      expect(await repo.getListReview(id)).toEqual(before);
    }
    await expect(save(item, { brand: null })).rejects.toThrow('Reabra');
  });
  it('invalidates an open completion review when metadata changes within the same timestamp', async () => {
    const { id, item } = await seed(); await save(item); await repo.setPurchased(item, true);
    const before = await repo.getListReview(id);
    await db.items.update(item, details);
    await expect(repo.completeList(id, { purchaseDate: listInput.date, marketName: null }, before.revision)).rejects.toThrow('mudou');
    expect((await repo.getListReview(id)).totalCents).toBe(before.totalCents);
  });
  it('upgrades a populated v3 database with a completed purchase without inferring names or changing values', async () => {
    const id = crypto.randomUUID(), categoryId = crypto.randomUUID(), itemId = crypto.randomUUID();
    const old = new Dexie(db.name);
    old.version(3).stores({ lists: 'id, updatedAt, status', categories: 'id, shoppingListId, [shoppingListId+position]', items: 'id, shoppingListId, categoryId, [categoryId+createdAt]' });
    const times = { createdAt: '2026-10-20T12:00:00.000Z', updatedAt: '2026-10-20T12:00:00.000Z' };
    const list = { ...listInput, ...times, id, status: 'completed', completedAt: times.updatedAt, purchaseDate: listInput.date, marketName: 'Mercado A' };
    const category = { ...times, id: categoryId, shoppingListId: id, title: 'Essenciais', position: 0 };
    const item = { ...times, id: itemId, shoppingListId: id, categoryId, name: 'Café 500 g', unitPrice: '18.9', quantity: '3', unit: 'un', isPurchased: true };
    await old.table('lists').add(list); await old.table('categories').add(category); await old.table('items').add(item); old.close();
    const review = await repo.getListReview(id);
    expect(review.list).toEqual(list);
    expect(review.categories).toEqual([category]);
    expect(review.items).toEqual([{ ...item, brand: null, packageContent: null }]);
    expect(review.totalCents).toBe(5670);
  });
});
