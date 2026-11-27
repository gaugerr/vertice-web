import 'fake-indexeddb/auto';
import { test, expect } from 'vitest';
import { WorkspaceClient } from './core.mjs';
import { DemoTransport, DEMO_ACTORS } from './demo.mjs';
import { VerticeDatabase } from '../../src/data/database/database.ts';
import { accountDatabaseName } from '../../src/access/account-repository.ts';
import { importAccountShopping } from './local-import.mjs';

test('importa uma vez, preserva original e sincroniza sem duplicar nem ressuscitar exclusões', async () => {
  const project = 'import-' + crypto.randomUUID();
  const actor = DEMO_ACTORS[0];
  const transport = new DemoTransport(actor, { name: project });
  const space = (await transport.request('list'))[0];
  const client = await new WorkspaceClient({ project, actor, space, transport }).initialize();
  const source = new VerticeDatabase(accountDatabaseName(project, actor.uid));
  const now = new Date().toISOString();
  const list = {
    id: crypto.randomUUID(),
    storeName: 'Mercado',
    date: '2026-11-09',
    description: '',
    budgetCents: 12000,
    status: 'active',
    completedAt: null,
    purchaseDate: null,
    marketName: null,
    createdAt: now,
    updatedAt: now,
  };
  const environment = { mode: 'staging', project, actor };
  try {
    await source.lists.put(list);
    const categoryId = crypto.randomUUID();
    await source.categories.put({
      id: categoryId,
      shoppingListId: list.id,
      title: 'Carnes',
      position: 0,
      createdAt: now,
      updatedAt: now,
    });
    await source.items.put({
      id: crypto.randomUUID(),
      shoppingListId: list.id,
      categoryId,
      name: 'Carne',
      unitPrice: '23.4',
      quantity: '2.5',
      unit: 'kg',
      isPurchased: true,
      brand: null,
      packageContent: null,
      createdAt: now,
      updatedAt: now,
    });
    await expect(
      importAccountShopping(client, { ...environment, actor: DEMO_ACTORS[1] }),
    ).rejects.toThrow('Conta diferente');
    expect(await importAccountShopping(client, { ...environment, mode: 'demo' })).toBeUndefined();
    expect(await client.db.workspaceOutbox.count()).toBe(0);
    expect((await importAccountShopping(client, environment)).imported).toBe(1);
    expect(await source.lists.get(list.id)).toEqual(list);
    expect((await importAccountShopping(client, environment)).imported).toBe(0);
    expect(await client.db.workspaceOutbox.count()).toBe(1);
    await client.flush();
    expect(await client.db.workspaceOutbox.count()).toBe(0);
    expect(await client.db.lists.count()).toBe(1);
    expect(await client.db.categories.count()).toBe(1);
    expect((await client.db.items.toArray())[0]).toMatchObject({
      unitPrice: '23.4',
      quantity: '2.5',
      isPurchased: true,
    });
    // Another browser has no local receipt, but sees the server's record.
    await client.db.workspaceMeta.where('key').startsWith('account-shopping-v1:').delete();
    expect((await importAccountShopping(client, environment)).existing).toBe(1);
    await client.db.workspaceMeta.where('key').startsWith('account-shopping-v1:').delete();
    await client.db.workspaceRecords.update('shopping_lists/' + list.id, {
      'body.deleted_at': now,
    });
    expect((await importAccountShopping(client, environment)).existing).toBe(1);
    expect(await client.db.workspaceOutbox.count()).toBe(0);
    client.space.kind = 'shared';
    expect(await importAccountShopping(client, environment)).toBeUndefined();
  } finally {
    await source.delete();
    await client.db.delete();
    await transport.db.delete();
  }
});

test('falha na fila reverte recibo e dados locais; nova tentativa funciona', async () => {
  const project = 'import-' + crypto.randomUUID(),
    actor = DEMO_ACTORS[0];
  const transport = new DemoTransport(actor, { name: project });
  const space = (await transport.request('list'))[0];
  const client = await new WorkspaceClient({ project, actor, space, transport }).initialize();
  const source = new VerticeDatabase(accountDatabaseName(project, actor.uid));
  const now = new Date().toISOString();
  try {
    await source.lists.put({
      id: crypto.randomUUID(),
      storeName: 'Teste',
      date: '2026-11-09',
      description: '',
      budgetCents: null,
      status: 'active',
      completedAt: null,
      purchaseDate: null,
      marketName: null,
      createdAt: now,
      updatedAt: now,
    });
    const enqueue = client.enqueue.bind(client);
    client.enqueue = async (rows) => {
      await enqueue(rows);
      throw Error('disk failure');
    };
    const env = { mode: 'staging', project, actor };
    await expect(importAccountShopping(client, env)).rejects.toThrow('disk failure');
    expect(await client.db.workspaceOutbox.count()).toBe(0);
    expect(await client.db.workspaceRecords.count()).toBe(0);
    expect(
      await client.db.workspaceMeta.where('key').startsWith('account-shopping-v1:').count(),
    ).toBe(0);
    client.enqueue = enqueue;
    expect((await importAccountShopping(client, env)).imported).toBe(1);
  } finally {
    await source.delete();
    await client.db.delete();
    await transport.db.delete();
  }
});
