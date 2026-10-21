import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VerticeDatabase } from '../data/database/database';
import { DexieShoppingRepository } from '../data/repositories/dexie-shopping-repository';
import { inspectLegacy, migrateLegacy } from './legacy-migration';
const input = {
  storeName: 'Compras antigas',
  date: '2026-10-21',
  description: 'Preservar',
  budgetCents: 20000,
};
let source: VerticeDatabase;
let destination: VerticeDatabase;
beforeEach(async () => {
  await Dexie.delete('vertice_web');
  await Dexie.delete('vertice_account_migrations');
  source = new VerticeDatabase();
  destination = new VerticeDatabase(`test-${crypto.randomUUID()}`);
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: async (_: string, fn: () => Promise<unknown>) => fn() },
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await source.delete();
  await destination.delete();
  await Dexie.delete('vertice_account_migrations');
});
async function seed() {
  const repo = new DexieShoppingRepository(source);
  const id = await repo.createListWithCategories(input);
  const category = (await repo.getCategories(id))[0];
  await repo.addItem(id, category.id, 'Café');
  return id;
}
describe('confirmed legacy migration', () => {
  it('requires authorization, copies all shopping data once, and preserves the original', async () => {
    await seed();
    expect(await inspectLegacy('owner', destination)).toMatchObject({ count: 1, canImport: true });
    await expect(migrateLegacy('owner', destination, () => false)).rejects.toThrow('Valide');
    expect(await destination.lists.count()).toBe(0);
    await migrateLegacy('owner', destination, () => true);
    expect(await new DexieShoppingRepository(destination).exportSnapshot()).toEqual(
      await new DexieShoppingRepository(source).exportSnapshot(),
    );
    await migrateLegacy('owner', destination, () => true);
    expect(await destination.lists.count()).toBe(1);
    expect(await source.items.count()).toBe(1);
    expect(await inspectLegacy('other', destination)).toBeNull();
  });
  it('never overwrites a destination that already has purchases', async () => {
    await seed();
    const own = new DexieShoppingRepository(destination);
    await own.createListWithCategories({ ...input, storeName: 'Conta existente' });
    await expect(migrateLegacy('owner', destination, () => true)).rejects.toThrow('já tem dados');
    expect((await own.getLists())[0].storeName).toBe('Conta existente');
  });
  it('recovers a crash after copying but before the journal is completed', async () => {
    await seed();
    const original = destination.transaction.bind(destination);
    const fail = vi.spyOn(destination, 'transaction').mockImplementationOnce(
      (...args: Parameters<typeof destination.transaction>) =>
        original(...args).then(() => {
          throw new Error('Simulated interruption after commit');
        }) as ReturnType<typeof destination.transaction>,
    );
    await expect(migrateLegacy('owner', destination, () => true)).rejects.toThrow('Simulated');
    fail.mockRestore();
    expect(await destination.items.count()).toBe(1);
    await migrateLegacy('owner', destination, () => true);
    expect(await destination.items.count()).toBe(1);
    expect(await inspectLegacy('owner', destination)).toBeNull();
  });
  it('rolls back destination writes when IndexedDB rejects an item', async () => {
    await seed();
    vi.spyOn(destination.items, 'bulkAdd').mockRejectedValueOnce(new Error('Quota exceeded'));
    await expect(migrateLegacy('owner', destination, () => true)).rejects.toThrow('Quota');
    expect(await destination.lists.count()).toBe(0);
    expect(await source.lists.count()).toBe(1);
    await migrateLegacy('owner', destination, () => true);
    expect(await destination.lists.count()).toBe(1);
  });
});
