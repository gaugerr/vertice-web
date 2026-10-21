import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VerticeDatabase } from '../database/database';
import { DexieShoppingRepository } from './dexie-shopping-repository';
import { encodeBackup, parseBackup } from '../backup/backup';
let db: VerticeDatabase;
let repo: DexieShoppingRepository;
const input = { storeName: 'Lista', date: '2026-10-12', description: '', budgetCents: null };
beforeEach(() => {
  db = new VerticeDatabase(`history-${crypto.randomUUID()}`);
  repo = new DexieShoppingRepository(db);
});
afterEach(async () => {
  await db.delete();
});
async function seed() {
  const list = await repo.createListWithCategories(input);
  const category = (await repo.getCategories(list))[0].id;
  const item = await repo.addItem(list, category, 'Café');
  await repo.updatePurchaseDetails(item, {
    unitPrice: '18.9',
    quantity: '3',
    unit: 'un',
    brand: 'Marca X',
    packageContent: { amount: '500', unit: 'g' },
  });
  await repo.setPurchased(item, true);
  return { list, category, item };
}
async function finish(list: string) {
  await repo.completeList(
    list,
    { marketName: 'Mercado X', purchaseDate: input.date },
    (await repo.getListReview(list)).revision,
  );
}
describe('completed price references', () => {
  it('includes only purchased complete products in finalized lists and excludes the current list', async () => {
    const { list, category, item } = await seed();
    const pending = await repo.addItem(list, category, 'Café');
    await repo.updatePurchaseDetails(pending, {
      unitPrice: '1',
      quantity: '1',
      unit: 'un',
      brand: 'Marca X',
      packageContent: { amount: '500', unit: 'g' },
    });
    const incomplete = await repo.addItem(list, category, 'Arroz');
    await repo.updatePurchaseDetails(incomplete, { unitPrice: '5', quantity: '1', unit: 'un' });
    await repo.setPurchased(incomplete, true);
    expect(await repo.getCompletedPriceReferences('current')).toEqual([]);
    await finish(list);
    expect(await repo.getCompletedPriceReferences('current')).toMatchObject([
      { itemId: item, unitPrice: '18.9', marketName: 'Mercado X', purchaseDate: input.date },
    ]);
    expect(await repo.getCompletedPriceReferences(list)).toEqual([]);
  });
  it('reopening, refinalizing, copying and deleting never leave duplicate or stale history', async () => {
    const { list, item } = await seed();
    await finish(list);
    const copy = await repo.duplicateList(list, input);
    expect(await repo.getCompletedPriceReferences(copy)).toHaveLength(1);
    await repo.reopenList(list);
    expect(await repo.getCompletedPriceReferences(copy)).toHaveLength(0);
    await repo.updatePurchaseDetails(item, { unitPrice: '20.9', quantity: '3', unit: 'un' });
    await finish(list);
    expect(await repo.getCompletedPriceReferences(copy)).toMatchObject([{ unitPrice: '20.9' }]);
    await repo.deleteListCascade(list);
    expect(await repo.getCompletedPriceReferences(copy)).toHaveLength(0);
  });
  it('reconstructs references through existing v5 backups and database reopen without schema changes', async () => {
    const { list } = await seed();
    await finish(list);
    const before = await repo.getCompletedPriceReferences('current');
    const encoded = encodeBackup(await repo.exportSnapshot());
    expect(JSON.parse(encoded).version).toBe(5);
    await repo.replaceSnapshot({ lists: [], categories: [], items: [] });
    expect(await repo.getCompletedPriceReferences('current')).toEqual([]);
    await repo.replaceSnapshot(parseBackup(encoded));
    expect(await repo.getCompletedPriceReferences('current')).toEqual(before);
    db.close();
    await db.open();
    expect(await repo.getCompletedPriceReferences('current')).toEqual(before);
  });
});
