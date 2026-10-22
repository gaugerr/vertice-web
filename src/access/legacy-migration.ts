import Dexie, { type Table } from 'dexie';
import { VerticeDatabase } from '../data/database/database';
import type { ShoppingSnapshot } from '../domain/models/shopping';
import { validateSnapshot } from '../data/backup/backup';
import { trackWrite } from '../data/database/writes';
interface Claim {
  id: string;
  owner: string;
  state: 'reserved' | 'complete';
  digest: string;
}
class MigrationJournal extends Dexie {
  claims!: Table<Claim, string>;
  constructor() {
    super('vertice_account_migrations');
    this.version(1).stores({ claims: 'id' });
  }
}
const claimId = 'legacy:vertice_web';
async function snapshot(db: VerticeDatabase): Promise<ShoppingSnapshot> {
  return db.transaction('r', db.lists, db.categories, db.items, async () => ({
    lists: await db.lists.toArray(),
    categories: await db.categories.toArray(),
    items: await db.items.toArray(),
  }));
}
export async function snapshotDigest(data: ShoppingSnapshot): Promise<string> {
  const stable = {
    lists: [...data.lists].sort((a, b) => a.id.localeCompare(b.id)),
    categories: [...data.categories].sort((a, b) => a.id.localeCompare(b.id)),
    items: [...data.items].sort((a, b) => a.id.localeCompare(b.id)),
  };
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, v]) => [key, canonical(v)]),
          )
        : value;
  return [
    ...new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(canonical(stable))),
      ),
    ),
  ]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}
export async function inspectLegacy(owner: string, destination: VerticeDatabase) {
  const journal = new MigrationJournal();
  const source = new VerticeDatabase();
  try {
    const claim = await journal.claims.get(claimId);
    if (claim && (claim.owner !== owner || claim.state === 'complete')) return null;
    if (!(await Dexie.exists(source.name))) return null;
    const count = await source.lists.count();
    if (!count) return null;
    const receipt = await destination.migrations.get(claimId);
    const occupied =
      (await destination.lists.count()) +
      (await destination.categories.count()) +
      (await destination.items.count());
    return { count, canImport: !occupied || receipt?.owner === owner, pending: Boolean(claim) };
  } finally {
    journal.close();
    source.close();
  }
}
async function copyLegacy(owner: string, destination: VerticeDatabase, authorize: () => boolean) {
  return trackWrite(async () => {
    if (!authorize()) throw new Error('Valide seu acesso antes de transferir os dados.');
    const source = new VerticeDatabase();
    const journal = new MigrationJournal();
    try {
      await journal.transaction('rw', journal.claims, async () => {
        const claim = await journal.claims.get(claimId);
        if (claim && claim.owner !== owner)
          throw new Error('Esses dados já foram vinculados a outra conta.');
        if (!claim) await journal.claims.add({ id: claimId, owner, state: 'reserved', digest: '' });
      });
      const claim = (await journal.claims.get(claimId))!;
      if (claim.state === 'complete') return;
      const data = validateSnapshot(await snapshot(source));
      const digest = await snapshotDigest(data);
      if (!authorize()) throw new Error('Seu acesso precisa ser renovado.');
      await destination.transaction(
        'rw',
        destination.lists,
        destination.categories,
        destination.items,
        destination.migrations,
        async () => {
          const receipt = await destination.migrations.get(claimId);
          const existing = await snapshot(destination);
          const occupied =
            existing.lists.length + existing.categories.length + existing.items.length > 0;
          // The source digest is computed before the transaction; recovery checks use
          // Dexie.waitFor to keep it alive while Web Crypto verifies the prior copy.
          // A receipt allows recovery but never replacement of subsequently edited data.
          if (occupied && (!receipt || receipt.owner !== owner))
            throw new Error(
              'A conta já tem dados. A transferência não substitui compras existentes.',
            );
          if (occupied && (await Dexie.waitFor(snapshotDigest(existing))) !== receipt?.digest)
            throw new Error(
              'Os dados da conta mudaram. Exporte um backup para revisar a transferência.',
            );
          await destination.lists.clear();
          await destination.categories.clear();
          await destination.items.clear();
          await destination.lists.bulkAdd(data.lists);
          await destination.categories.bulkAdd(data.categories);
          await destination.items.bulkAdd(data.items);
          await destination.migrations.put({
            id: claimId,
            owner,
            digest,
          });
        },
      );
      await journal.claims.update(claimId, { digest });
      const copied = await snapshot(destination);
      if ((await snapshotDigest(copied)) !== digest)
        throw new Error('A cópia não pôde ser verificada. Os originais continuam salvos.');
      if ((await snapshotDigest(await snapshot(source))) !== digest)
        throw new Error(
          'As listas antigas mudaram durante a cópia. Feche outras abas e tente novamente.',
        );
      await journal.claims.update(claimId, { state: 'complete', digest });
    } finally {
      source.close();
      journal.close();
    }
  });
}

export async function migrateLegacy(
  owner: string,
  destination: VerticeDatabase,
  authorize: () => boolean,
) {
  if (!navigator.locks)
    throw new Error('Use uma versão atual do navegador para transferir os dados com segurança.');
  return navigator.locks.request('vertice:legacy-migration', () =>
    copyLegacy(owner, destination, authorize),
  );
}
