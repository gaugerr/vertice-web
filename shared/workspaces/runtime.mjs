import Dexie from 'dexie';
import { WorkspaceClient, WorkspaceFinanceStore, WorkspaceError } from './core.mjs';
import { DemoTransport, DEMO_ACTORS } from './demo.mjs';
import { financeRows, shoppingRows, changesBetween } from './mapping.mjs';
import { FinanceStore as LegacyFinanceStore } from '../../previews/controle-financeiro/finance-store.mjs';
import { VerticeDatabase } from '../../src/data/database/database.ts';
import { DexieShoppingRepository } from '../../src/data/repositories/dexie-shopping-repository.ts';
import { importAccountShopping } from './local-import.mjs';
export { WorkspaceClient, WorkspaceFinanceStore, DEMO_ACTORS };
export { HttpWorkspaceTransport } from './http.mjs';
export { verifyWorkspaceLease } from './lease.mjs';
export const demoActor = () =>
  DEMO_ACTORS.find((a) => a.uid === sessionStorage.getItem('vertice_demo_actor')) ?? DEMO_ACTORS[0];
export const selectionKey = (uid) => 'vertice_workspace_selection_' + uid;
export const demoTransport = () =>
  new DemoTransport(demoActor(), {
    online: () =>
      navigator.onLine &&
      localStorage.getItem('vertice_demo_offline_' + demoActor().uid) !== 'true',
  });
let currentPromise;
let environmentPromise;
export function workspaceEnvironment() {
  return (environmentPromise ??= (async () => {
    let staged = location.pathname.startsWith('/staging/');
    try {
      staged ||= window.parent.location.pathname.startsWith('/staging/');
    } catch {
      /* Cross-origin embedding does not grant access. */
    }
    if (staged) return (await import('./real.mjs')).stagingEnvironment();
    return {
      mode: 'demo',
      project: 'couple_preview',
      configured: true,
      actor: demoActor(),
      transport: demoTransport(),
    };
  })());
}
async function initialize() {
  const environment = await workspaceEnvironment();
  if (!environment.configured)
    throw Error('Não foi possível conectar sua conta. Tente novamente em instantes.');
  if (!environment.actor) throw Error('Entre com Google para abrir ou aceitar um espaço.');
  const { actor, transport } = environment;
  const spacesKey = `vertice_spaces_${environment.project}_${actor.uid}`;
  const cachedSpaces = () => {
    try {
      return JSON.parse(
        localStorage.getItem(spacesKey) ??
          localStorage.getItem('vertice_demo_spaces_' + actor.uid) ??
          '[]',
      );
    } catch {
      return [];
    }
  };
  environment.spaces = cachedSpaces();
  environment.refreshSpaces = async () => {
    if (environment.verifyIdentity) await environment.verifyIdentity();
    environment.spaces = await transport.request('list');
    localStorage.setItem(spacesKey, JSON.stringify(environment.spaces));
    return environment.spaces;
  };
  let spaces = environment.spaces;
  if (!spaces.length) spaces = await environment.refreshSpaces();
  const chosen = localStorage.getItem(selectionKey(actor.uid));
  const space = spaces.find((s) => s.id === chosen) ?? spaces.find((s) => s.status === 'active');
  if (!space) throw Error('Aceite um convite para abrir um espaço compartilhado.');
  localStorage.setItem(selectionKey(actor.uid), space.id);
  const client = await new WorkspaceClient({
    project: environment.mode === 'demo' ? 'couple_preview' : environment.project,
    actor,
    space,
    transport,
  }).initialize({ preferCache: environment.mode === 'staging' });
  if (
    environment.mode === 'demo' &&
    space.kind === 'personal' &&
    actor.uid === DEMO_ACTORS[0].uid &&
    !(await client.db.workspaceMeta.get('legacy-preview-import'))
  ) {
    const legacy = new LegacyFinanceStore(localStorage).load();
    let shopping = { lists: [], categories: [], items: [] };
    if (await Dexie.exists('vertice_shopping_navigation_preview_v1')) {
      const old = new VerticeDatabase('vertice_shopping_navigation_preview_v1');
      shopping = await new DexieShoppingRepository(old).exportSnapshot();
      old.close();
    }
    await client.db.transaction(
      'rw',
      client.db.lists,
      client.db.categories,
      client.db.items,
      client.db.migrations,
      client.db.workspaceRecords,
      client.db.workspaceOutbox,
      client.db.workspaceMeta,
      client.db.workspaceConflicts,
      async () => {
        if (await client.db.workspaceMeta.get('legacy-preview-import')) return;
        const existing = await client.db.workspaceRecords.count();
        if (!existing) {
          await client.enqueue(
            changesBetween([], financeRows(legacy).concat(shoppingRows(shopping))),
          );
          await client.materializeShopping();
          await client.db.workspaceMeta.put({ key: 'finance-revision', value: legacy.revision });
        }
        await client.db.workspaceMeta.put({ key: 'legacy-preview-import', value: true });
      },
    );
  }
  if (typeof window !== 'undefined')
    window.addEventListener(
      'vertice:workspace-auth-invalid',
      () => void client.authenticationFailed(),
    );
  client.start();
  void (async () => {
    try {
      const current = (await environment.refreshSpaces()).find((s) => s.id === client.space.id);
      if (!current) throw new WorkspaceError('removed', 'Você não participa mais deste espaço.');
      if (current.generation !== client.space.generation)
        throw new WorkspaceError('removed', 'Sua participação mudou. Reabra o espaço.');
      Object.assign(client.space, current);
      await client.flush();
      if (environment.mode === 'staging' && client.space.kind === 'personal') {
        // Refresh identity and remote records before examining legacy local data.
        if (client.syncError) throw client.syncError;
        await importAccountShopping(client, environment);
        await client.flush();
      }
    } catch (error) {
      client.syncError = error;
      if (error.code === 'unauthorized') await client.authenticationFailed();
      if (error.code === 'removed') {
        await client.db.workspaceMeta.put({
          key: 'revoked',
          value: true,
          generation: client.space.generation,
        });
        await client.db.workspaceOutbox
          .filter((o) => o.generation === client.space.generation)
          .modify({ status: 'quarantined' });
      }
    } finally {
      client.syncingBootstrap = false;
      client.notify();
    }
  })();
  return client;
}
export function openPreviewWorkspace() {
  return (currentPromise ??= initialize().catch((e) => {
    currentPromise = undefined;
    throw e;
  }));
}
