import Dexie from 'dexie';
import { accountDatabaseName } from '../../src/access/account-repository.ts';
import { VerticeDatabase } from '../../src/data/database/database.ts';
import { DexieShoppingRepository } from '../../src/data/repositories/dexie-shopping-repository.ts';
import { validateSnapshot } from '../../src/data/backup/backup.ts';
import { shoppingRows, keyOf } from './mapping.mjs';

// Only account-owned shopping databases are eligible. Never probe global demo
// storage or claim the unowned legacy database on a shared device.
export async function importAccountShopping(client, environment) {
  if (environment.mode !== 'staging' || client.space.kind !== 'personal') return;
  if (environment.actor.uid !== client.actor.uid) throw Error('Conta diferente da origem.');
  const source = accountDatabaseName(environment.project, client.actor.uid);
  if (!(await Dexie.exists(source))) return;
  const old = new VerticeDatabase(source);
  let snapshot;
  try {
    snapshot = validateSnapshot(await new DexieShoppingRepository(old).exportSnapshot());
  } finally {
    old.close();
  }
  const db = client.db;
  const result = { imported: 0, existing: 0 };
  await db.transaction('rw', db.tables, async () => {
    await client.assertWrite();
    if (!(await db.workspaceMeta.get('snapshot-ready'))?.value)
      throw Error('Aguarde a sincronização antes de importar suas listas.');
    for (const list of snapshot.lists) {
      const key = `account-shopping-v1:${source}:${list.id}`;
      if (await db.workspaceMeta.get(key)) continue;
      const rows = shoppingRows({
        lists: [list],
        categories: snapshot.categories.filter((c) => c.shoppingListId === list.id),
        items: snapshot.items.filter((i) => i.shoppingListId === list.id),
      });
      // A collision (including tombstones) skips the whole list. Never combine
      // an old local child with a newer remote parent, or resurrect a deletion.
      const existing = await db.workspaceRecords.bulkGet(rows.map((r) => keyOf(r.entity, r.id)));
      const occupied = existing.some(Boolean);
      if (!occupied) {
        await client.enqueue(rows);
        result.imported++;
      } else result.existing++;
      // Receipt and outbox commit together; a failed transaction can retry.
      await db.workspaceMeta.put({ key, value: occupied ? 'existing' : 'queued' });
    }
    if (result.imported) await client.materializeShopping();
  });
  if (result.imported) client.notify();
  return result;
}
