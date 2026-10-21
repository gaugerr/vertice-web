import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VerticeDatabase } from '../database/database';
import { DexieShoppingRepository } from './dexie-shopping-repository';
import { encodeBackup, parseBackup } from '../backup/backup';
import { productIdentity } from '../../domain/services/price-history';
import type { SuggestedProduct } from '../../domain/services/item-suggestions';
let db: VerticeDatabase;
let repo: DexieShoppingRepository;
const input = { storeName: 'Lista', date: '2026-10-12', description: '', budgetCents: null };
const product: SuggestedProduct = { name: 'Café', brand: 'Melitta', packageContent: { amount: '500', unit: 'g' }, unit: 'un' };
beforeEach(() => { db = new VerticeDatabase(`suggestions-${crypto.randomUUID()}`); repo = new DexieShoppingRepository(db); });
afterEach(async () => { await db.delete(); });
async function list() { const id = await repo.createListWithCategories(input); return { id, categories: await repo.getCategories(id) }; }
async function finish(id: string) { await repo.completeList(id, { marketName: null, purchaseDate: input.date }, (await repo.getListReview(id)).revision); }
describe('historical item suggestions repository', () => {
  it('uses purchased finalized records including incomplete products and follows reopen/delete/backup restore', async () => {
    const source = await list();
    const full = await repo.addSuggestedItem(source.id, source.categories[0].id, product);
    const generic = await repo.addItem(source.id, source.categories[0].id, 'Arroz');
    await repo.updatePurchaseDetails(full, { unitPrice: '18.9', quantity: '3', unit: 'un' });
    await repo.updatePurchaseDetails(generic, { unitPrice: '5', quantity: '2', unit: 'un' });
    await repo.setPurchased(full, true); await repo.setPurchased(generic, true);
    await repo.addItem(source.id, source.categories[1].id, 'Pendente');
    expect(await repo.getCompletedItemSuggestions('current')).toEqual([]);
    await finish(source.id);
    const records = await repo.getCompletedItemSuggestions('current');
    expect(records).toHaveLength(2);
    expect(records.find((p) => p.name === 'Arroz')).toMatchObject({ brand: null, packageContent: null });
    expect(await repo.getCompletedItemSuggestions(source.id)).toEqual([]);
    const backup = encodeBackup(await repo.exportSnapshot());
    expect(JSON.parse(backup).version).toBe(5);
    await repo.reopenList(source.id);
    expect(await repo.getCompletedItemSuggestions('current')).toEqual([]);
    await finish(source.id);
    expect(await repo.getCompletedItemSuggestions('current')).toHaveLength(2);
    await repo.deleteListCascade(source.id);
    expect(await repo.getCompletedItemSuggestions('current')).toEqual([]);
    await repo.replaceSnapshot(parseBackup(backup));
    expect(await repo.getCompletedItemSuggestions('current')).toEqual(records);
  });
  it('copies only product details into the selected category and connects to the existing price identity', async () => {
    const current = await list();
    const id = await repo.addSuggestedItem(current.id, current.categories[2].id, product);
    const added = (await repo.getItemsForList(current.id))[0];
    expect(added).toMatchObject({ ...product, id, categoryId: current.categories[2].id, unitPrice: '0', quantity: '1', isPurchased: false });
    expect(productIdentity(added)).toBe(productIdentity(product));
    const weighted = await repo.addSuggestedItem(current.id, current.categories[0].id, { name: 'Banana', brand: null, packageContent: null, unit: 'kg' });
    expect((await repo.getItemsForList(current.id)).find((i) => i.id === weighted)).toMatchObject({ unit: 'kg', quantity: '1' });
    await expect(repo.addSuggestedItem(current.id, current.categories[0].id, { ...product, name: ' ' })).rejects.toThrow();
    const another = await list();
    await expect(repo.addSuggestedItem(current.id, another.categories[0].id, { ...product, brand: 'Outra' })).rejects.toThrow('categoria');
  });
  it('serializes duplicate checks across connections and categories while leaving manual entry free', async () => {
    const current = await list();
    const connection = new VerticeDatabase(db.name);
    try {
      const other = new DexieShoppingRepository(connection);
      const results = await Promise.allSettled([
        repo.addSuggestedItem(current.id, current.categories[0].id, product),
        other.addSuggestedItem(current.id, current.categories[1].id, { ...product, packageContent: { amount: '0.5', unit: 'kg' } }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
      expect(await repo.getItemsForList(current.id)).toHaveLength(1);
      await repo.addItem(current.id, current.categories[0].id, 'Café');
      await repo.addItem(current.id, current.categories[0].id, 'Café');
      expect(await repo.getItemsForList(current.id)).toHaveLength(3);
    } finally { connection.close(); }
  });
  it('rolls back all fields on a failed transaction and protects completed lists', async () => {
    const current = await list();
    const original = await repo.getList(current.id);
    const fail = () => { throw new Error('Falha simulada'); };
    db.lists.hook('updating', fail);
    await expect(repo.addSuggestedItem(current.id, current.categories[0].id, product)).rejects.toThrow('Falha simulada');
    db.lists.hook('updating').unsubscribe(fail);
    expect(await repo.getItemsForList(current.id)).toEqual([]);
    expect(await repo.getList(current.id)).toEqual(original);
    const id = await repo.addSuggestedItem(current.id, current.categories[0].id, product);
    await repo.updatePurchaseDetails(id, { unitPrice: '1', quantity: '1', unit: 'un' });
    await repo.setPurchased(id, true); await finish(current.id);
    await expect(repo.addSuggestedItem(current.id, current.categories[0].id, { ...product, brand: 'Outra' })).rejects.toThrow('finalizada');
  });
});
