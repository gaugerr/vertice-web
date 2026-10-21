import { VerticeDatabase } from '../data/database/database';
import { DexieShoppingRepository } from '../data/repositories/dexie-shopping-repository';
import type { ShoppingRepository } from '../domain/models/repository';
const reads = new Set([
  'getCompletedItemSuggestions',
  'getCompletedPriceReferences',
  'getLists',
  'getListSummaries',
  'getList',
  'getListReview',
  'getCategories',
  'getCategory',
  'getItemsForList',
  'getItemsForCategory',
  'exportSnapshot',
]);
export function accountDatabaseName(project: string, uid: string) {
  if (!/^[a-z0-9-]+$/.test(project) || !/^[a-f0-9-]{36}$/i.test(uid))
    throw new Error('Conta inválida.');
  return `vertice_web_${project}_${uid}`;
}
export function guardedRepository(
  db: VerticeDatabase,
  canRead: () => boolean,
  canWrite: () => boolean,
): ShoppingRepository {
  const target = new DexieShoppingRepository(db);
  return new Proxy(target, {
    get(repository, key) {
      const method = Reflect.get(repository, key);
      if (typeof method !== 'function') return method;
      return (...args: unknown[]) => {
        if (!canRead() || (!reads.has(String(key)) && !canWrite()))
          return Promise.reject(new Error('Reconecte e valide seu acesso para continuar.'));
        return method.apply(repository, args);
      };
    },
  });
}
