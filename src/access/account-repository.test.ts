import { afterEach, describe, expect, it } from 'vitest';
import { VerticeDatabase } from '../data/database/database';
import { accountDatabaseName, guardedRepository } from './account-repository';
import {
  loadComparisonSession,
  saveComparisonSession,
  emptyComparisonSession,
} from '../features/comparator/session';
const databases: VerticeDatabase[] = [];
const input = {
  storeName: 'Compras privadas',
  date: '2026-10-21',
  description: '',
  budgetCents: null,
};
afterEach(async () => {
  await Promise.all(databases.map((db) => db.delete()));
  databases.length = 0;
  sessionStorage.clear();
});
describe('account data boundary', () => {
  it('keeps shopping and comparator drafts isolated between accounts', async () => {
    const a = new VerticeDatabase(accountDatabaseName('test', crypto.randomUUID()));
    const b = new VerticeDatabase(accountDatabaseName('test', crypto.randomUUID()));
    databases.push(a, b);
    const first = guardedRepository(
      a,
      () => true,
      () => true,
    );
    const second = guardedRepository(
      b,
      () => true,
      () => true,
    );
    await first.createListWithCategories(input);
    expect(await second.getLists()).toHaveLength(0);
    const draft = emptyComparisonSession();
    draft.drafts.weight[0].price = '7';
    saveComparisonSession(draft, a.name);
    expect(loadComparisonSession(b.name).session.drafts.weight[0].price).toBe('');
    expect(loadComparisonSession(a.name).session.drafts.weight[0].price).toBe('7');
  });
  it('blocks writes after local authorization changes, preserving already committed records', async () => {
    const db = new VerticeDatabase(`test-${crypto.randomUUID()}`);
    databases.push(db);
    let active = true;
    let readable = true;
    const repository = guardedRepository(
      db,
      () => readable,
      () => active,
    );
    const id = await repository.createListWithCategories(input);
    active = false;
    await expect(repository.deleteListCascade(id)).rejects.toThrow('Reconecte');
    expect(await repository.getLists()).toHaveLength(1);
    readable = false;
    await expect(repository.exportSnapshot()).rejects.toThrow('Reconecte');
    expect(await db.lists.count()).toBe(1);
  });
});
