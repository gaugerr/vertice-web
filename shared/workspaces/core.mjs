import { VerticeDatabase } from '../../src/data/database/database.ts';
import Dexie from 'dexie';
import { DexieShoppingRepository } from '../../src/data/repositories/dexie-shopping-repository.ts';
import {
  financeRows,
  readFinance,
  shoppingRows,
  readShopping,
  changesBetween,
  keyOf,
} from './mapping.mjs';
import { validateState } from '../../previews/controle-financeiro/finance-domain.mjs';
export const OFFLINE_MS = 86400000;
export class WorkspaceError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}
export function workspaceDatabase(project, uid, workspace) {
  for (const value of [project, uid, workspace])
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw Error('Escopo inválido.');
  const db = new VerticeDatabase(`vertice_space_${project}_${uid}_${workspace}`);
  db.version(6).stores({
    workspaceRecords: 'key,entity',
    workspaceOutbox: 'id,status,createdAt',
    workspaceMeta: 'key',
    workspaceConflicts: 'id',
  });
  for (const name of ['workspaceRecords', 'workspaceOutbox', 'workspaceMeta', 'workspaceConflicts'])
    db[name] = db.table(name);
  return db;
}
const dataTables = (db) => [
  db.lists,
  db.categories,
  db.items,
  db.migrations,
  db.workspaceRecords,
  db.workspaceOutbox,
  db.workspaceMeta,
  db.workspaceConflicts,
];
export class WorkspaceClient {
  constructor({ project, actor, space, transport, clock = () => Date.now() }) {
    this.actor = actor;
    this.space = space;
    this.transport = transport;
    this.clock = clock;
    this.db = workspaceDatabase(project, actor.uid, space.id);
    this.repository = new DexieShoppingRepository(this.db);
    this.listeners = new Set();
    this.running = null;
    this.stopped = false;
  }
  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  notify() {
    for (const fn of this.listeners) fn();
  }
  async initialize() {
    await this.db.open();
    await this.refresh();
    return this;
  }
  async refresh() {
    try {
      const access = await this.transport.request('access', { workspace_id: this.space.id });
      if (!access.member)
        throw new WorkspaceError('removed', 'Você não participa mais deste espaço.');
      if (access.generation !== this.space.generation)
        throw new WorkspaceError('removed', 'Sua participação mudou. Reabra o espaço.');
      const previous = (await this.db.workspaceMeta.get('access'))?.value;
      if (previous && previous.generation !== access.generation) {
        await this.db.transaction('rw', dataTables(this.db), async () => {
          await this.db.workspaceMeta.put({
            key: 'recovery-epoch-' + previous.generation,
            value: {
              operations: await this.db.workspaceOutbox.toArray(),
              records: await this.db.workspaceRecords.toArray(),
              at: this.clock(),
            },
          });
          await this.db.workspaceOutbox.clear();
          await this.db.workspaceRecords.clear();
          await this.db.workspaceConflicts.clear();
          await this.db.workspaceMeta.put({ key: 'cursor', value: 0 });
          const rev = (await this.db.workspaceMeta.get('finance-revision'))?.value ?? 0;
          await this.db.workspaceMeta.put({ key: 'finance-revision', value: rev + 1 });
        });
      }
      await this.db.workspaceMeta.put({ key: 'access', value: access });
      await this.db.workspaceMeta.put({
        key: 'revoked',
        value: false,
        generation: this.space.generation,
      });
      await this.pull();
    } catch (e) {
      if (['removed', 'forbidden'].includes(e.code)) {
        await this.db.workspaceMeta.put({
          key: 'revoked',
          value: true,
          generation: this.space.generation,
        });
        await this.db.workspaceOutbox
          .filter((o) => o.generation === this.space.generation)
          .modify({ status: 'quarantined' });
        this.notify();
        throw e;
      }
      if (!(await this.db.workspaceMeta.get('access'))) throw e;
    }
    this.notify();
  }
  async assertWrite() {
    let a = (await this.db.workspaceMeta.get('access'))?.value;
    if (a && this.transport.verifyCached)
      a = await Dexie.waitFor(
        this.transport.verifyCached(a, {
          uid: this.actor.uid,
          workspaceId: this.space.id,
          generation: this.space.generation,
          now: this.clock(),
        }),
      );
    const r = await this.db.workspaceMeta.get('revoked'),
      water = (await this.db.workspaceMeta.get('high-water'))?.value ?? 0,
      now = this.clock();
    if (
      (r?.value && (!r.generation || r.generation === this.space.generation)) ||
      !a?.writable ||
      a.generation !== this.space.generation ||
      now + 60000 < water ||
      Math.max(now, water) >= a.expiresAt
    )
      throw new WorkspaceError('read_only', 'Reconecte e valide o acesso antes de editar.');
    await this.db.workspaceMeta.put({ key: 'high-water', value: Math.max(now, water) });
  }
  async pull() {
    const cursor = (await this.db.workspaceMeta.get('cursor'))?.value ?? 0;
    const data = await this.transport.request('pull', { workspace_id: this.space.id, cursor });
    await this.db.transaction('rw', dataTables(this.db), async () => {
      let financialChanged = false,
        shoppingChanged = false;
      for (const batch of data.batches?.length ? data.batches : [{ records: data.records }]) {
        const own = batch.operation_id && (await this.db.workspaceOutbox.get(batch.operation_id));
        if (own) {
          await this.ack(own, batch);
          shoppingChanged ||= batch.records.some((r) => r.entity.startsWith('shopping_'));
          continue;
        }
        const pending = await this.db.workspaceOutbox.toArray(),
          conflicting = new Set(
            pending.flatMap((o) => o.changes.map((c) => keyOf(c.entity, c.id))),
          );
        for (const record of batch.records) {
          const key = keyOf(record.entity, record.id),
            current = await this.db.workspaceRecords.get(key);
          if (
            record.entity.startsWith('finance_') &&
            Number(record.body.row_version) !== Number(current?.confirmedVersion ?? 0)
          )
            financialChanged = true;
          if (
            conflicting.has(key) &&
            current &&
            Number(record.body.row_version) !== Number(current.confirmedVersion ?? 0)
          ) {
            await this.db.workspaceConflicts.put({
              id: key,
              remote: record,
              local: current,
              kind: 'remote',
              createdAt: this.clock(),
            });
            for (const op of pending)
              if (op.changes.some((c) => keyOf(c.entity, c.id) === key)) {
                op.status = 'conflict';
                await this.db.workspaceOutbox.put(op);
              }
            continue;
          }
          if (
            !conflicting.has(key) &&
            record.entity.startsWith('shopping_') &&
            Number(record.body.row_version) !== Number(current?.confirmedVersion ?? 0)
          )
            shoppingChanged = true;
          if (!conflicting.has(key))
            await this.db.workspaceRecords.put({
              ...record,
              key,
              confirmedVersion: Number(record.body.row_version),
            });
        }
      }
      if (financialChanged) {
        const v = (await this.db.workspaceMeta.get('finance-revision'))?.value ?? 0;
        await this.db.workspaceMeta.put({ key: 'finance-revision', value: v + 1 });
      }
      await this.db.workspaceMeta.put({ key: 'cursor', value: data.revision });
      if (shoppingChanged) await this.materializeShopping();
    });
    this.notify();
    if (data.more) return this.pull();
  }
  async ack(op, response) {
    await this.db.workspaceOutbox.delete(op.id);
    const rest = await this.db.workspaceOutbox.toArray();
    for (const record of response.records) {
      const key = keyOf(record.entity, record.id),
        version = Number(record.body.row_version),
        later = rest.filter((o) => o.changes.some((c) => keyOf(c.entity, c.id) === key));
      if (!later.length)
        await this.db.workspaceRecords.put({ ...record, key, confirmedVersion: version });
      else {
        await this.db.workspaceRecords.update(key, { confirmedVersion: version });
        for (const next of later)
          if (next.depends.includes(op.id)) {
            for (const c of next.changes)
              if (keyOf(c.entity, c.id) === key) c.expected_version = version;
            await this.db.workspaceOutbox.put(next);
          }
      }
      for (const next of rest)
        if (next.depends.includes(op.id)) {
          for (const g of next.guards)
            if (keyOf(g.entity, g.id) === key) g.expected_version = version;
          await this.db.workspaceOutbox.put(next);
        }
    }
  }
  async materializeShopping() {
    const snapshot = readShopping(await this.db.workspaceRecords.toArray());
    await this.db.items.clear();
    await this.db.categories.clear();
    await this.db.lists.clear();
    if (snapshot.lists.length) await this.db.lists.bulkPut(snapshot.lists);
    if (snapshot.categories.length) await this.db.categories.bulkPut(snapshot.categories);
    if (snapshot.items.length) await this.db.items.bulkPut(snapshot.items);
  }
  async enqueue(changes) {
    if (!changes.length) return;
    if (
      changes.length > 5000 ||
      new TextEncoder().encode(JSON.stringify(changes)).length > 5 * 1024 * 1024
    )
      throw new WorkspaceError(
        'too_large',
        'Este conjunto é grande demais para sincronizar de uma vez. Seus dados anteriores foram preservados.',
      );
    const operations = await this.db.workspaceOutbox.toArray();
    if (operations.some((o) => o.status === 'conflict' || o.status === 'quarantined'))
      throw new WorkspaceError('conflict', 'Revise as alterações pendentes antes de continuar.');
    const op = {
      id: crypto.randomUUID(),
      createdAt: this.clock(),
      status: 'pending',
      generation: this.space.generation,
      depends: operations.map((o) => o.id),
      changes,
      guards: [],
    };
    for (const c of changes) {
      const existing = await this.db.workspaceRecords.get(keyOf(c.entity, c.id));
      c.expected_version = existing?.confirmedVersion ?? 0;
      if (['finance_payments', 'finance_goal_contributions'].includes(c.entity)) {
        const entity = c.entity === 'finance_payments' ? 'finance_entries' : 'finance_goals',
          id = c.body.entry_id ?? c.body.goal_id,
          p = await this.db.workspaceRecords.get(keyOf(entity, id));
        if (p && !op.guards.some((g) => g.entity === entity && g.id === id))
          op.guards.push({ entity, id, expected_version: p.confirmedVersion ?? 0 });
      }
      await this.db.workspaceRecords.put({
        ...c,
        key: keyOf(c.entity, c.id),
        body: { ...c.body, deleted_at: c.body.deleted_at ?? null },
        confirmedVersion: existing?.confirmedVersion ?? 0,
      });
    }
    await this.db.workspaceOutbox.put(op);
  }
  async finance() {
    await this.assertRead();
    const s = readFinance(await this.db.workspaceRecords.toArray());
    s.revision = (await this.db.workspaceMeta.get('finance-revision'))?.value ?? 0;
    return s;
  }
  async commitFinance(change, expectedRevision, baseline) {
    let state;
    await this.db.transaction('rw', dataTables(this.db), async () => {
      await this.assertWrite();
      state = await this.finance();
      const before = (await this.db.workspaceRecords.toArray()).filter((r) =>
        r.entity.startsWith('finance_'),
      );
      if (expectedRevision !== undefined && state.revision !== expectedRevision && !baseline)
        throw new WorkspaceError(
          'conflict',
          'O financeiro mudou. Atualize a tela antes de salvar.',
        );
      if (baseline && state.revision !== expectedRevision) {
        const original = readFinance(baseline),
          wanted = structuredClone(original);
        change(wanted);
        validateState(wanted);
        const intended = changesBetween(baseline, financeRows(wanted));
        const originalMap = new Map(financeRows(original).map((r) => [keyOf(r.entity, r.id), r]));
        const currentMap = new Map(financeRows(state).map((r) => [keyOf(r.entity, r.id), r]));
        const merged = new Map(before.map((r) => [keyOf(r.entity, r.id), r]));
        for (const c of intended) {
          const key = keyOf(c.entity, c.id),
            old = originalMap.get(key),
            current = currentMap.get(key);
          const same = old && current && changesBetween([old], [current]).length === 0;
          const seeded =
            !old &&
            current &&
            ['finance_categories', 'finance_payment_methods'].includes(c.entity) &&
            changesBetween([current], [c]).length === 0;
          if ((old && !same) || (!old && current && !seeded))
            throw new WorkspaceError(
              'conflict',
              'Este registro foi alterado. Atualize a tela e revise antes de salvar.',
            );
          if (['finance_payments', 'finance_goal_contributions'].includes(c.entity)) {
            const entity = c.entity === 'finance_payments' ? 'finance_entries' : 'finance_goals',
              id = c.body.entry_id ?? c.body.goal_id;
            const prior = baseline.find((r) => r.entity === entity && r.id === id),
              latest = before.find((r) => r.entity === entity && r.id === id);
            if ((prior?.confirmedVersion ?? 0) !== (latest?.confirmedVersion ?? 0))
              throw new WorkspaceError(
                'conflict',
                'O total desta conta ou meta mudou. Confira os valores atuais antes de registrar.',
              );
          }
          if (!seeded)
            merged.set(key, { ...c, body: { ...c.body, deleted_at: c.body.deleted_at ?? null } });
        }
        const revision = state.revision;
        state = readFinance([...merged.values()]);
        state.revision = revision;
      } else change(state);
      validateState(state);
      await this.enqueue(changesBetween(before, financeRows(state)));
      state.revision++;
      await this.db.workspaceMeta.put({ key: 'finance-revision', value: state.revision });
    });
    this.notify();
    void this.flush();
    return state;
  }
  shopping() {
    const target = this.repository,
      reads = new Set([
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
    return new Proxy(target, {
      get: (repo, key) => {
        const fn = repo[key];
        if (typeof fn !== 'function') return fn;
        if (reads.has(key))
          return async (...args) => {
            await this.assertRead();
            return fn.apply(repo, args);
          };
        return async (...args) => {
          let result;
          await this.db.transaction('rw', dataTables(this.db), async () => {
            await this.assertWrite();
            const before = (await this.db.workspaceRecords.toArray()).filter((r) =>
              r.entity.startsWith('shopping_'),
            );
            result = await fn.apply(repo, args);
            const after = shoppingRows(await repo.exportSnapshot());
            await this.enqueue(changesBetween(before, after));
          });
          this.notify();
          void this.flush();
          return result;
        };
      },
    });
  }
  async assertRead() {
    const r = await this.db.workspaceMeta.get('revoked'),
      a = (await this.db.workspaceMeta.get('access'))?.value;
    if (
      (r?.value && (!r.generation || r.generation === this.space.generation)) ||
      (a && a.generation !== this.space.generation)
    )
      throw new WorkspaceError(
        'removed',
        'Seu acesso a este espaço foi removido. Suas alterações pendentes continuam preservadas.',
      );
  }
  async flush() {
    if (this.running || this.stopped) return this.running;
    this.running = this.sendPending().finally(() => {
      this.running = null;
      this.notify();
    });
    return this.running;
  }
  async sendPending() {
    try {
      await this.refresh();
      for (;;) {
        const op = (await this.db.workspaceOutbox.orderBy('createdAt').toArray()).find(
          (o) => o.status === 'pending',
        );
        if (!op) break;
        let response;
        try {
          response = await this.transport.request('apply', {
            workspace_id: this.space.id,
            operation: op,
          });
        } catch (e) {
          if (e.code === 'conflict') {
            await this.db.workspaceOutbox.update(op.id, { status: 'conflict' });
            await this.db.workspaceConflicts.put({
              id: op.id,
              operation: op,
              kind: 'write',
              detail: e.detail,
            });
          }
          if (['removed', 'forbidden', 'generation'].includes(e.code)) {
            await this.db.workspaceOutbox
              .filter((o) => o.generation === this.space.generation)
              .modify({ status: 'quarantined' });
            await this.db.workspaceMeta.put({
              key: 'revoked',
              value: true,
              generation: this.space.generation,
            });
          }
          break;
        }
        await this.db.transaction('rw', dataTables(this.db), async () => {
          await this.ack(op, response);
          if (response.records.some((r) => r.entity.startsWith('shopping_')))
            await this.materializeShopping();
        });
      }
      if (!(await this.db.workspaceOutbox.count())) await this.pull();
    } catch {
      /* Durable operations remain pending during a network failure. */
    }
  }
  async status() {
    const ops = await this.db.workspaceOutbox.toArray();
    if (ops.some((o) => ['conflict', 'quarantined'].includes(o.status)))
      return 'Precisa de atenção';
    if (ops.length) return 'Pendente de envio';
    return 'Sincronizado';
  }
  async discardConflicts() {
    const conflicts = await this.db.workspaceOutbox.toArray();
    const local = await this.db.workspaceRecords.toArray();
    await this.db.transaction('rw', dataTables(this.db), async () => {
      await this.db.workspaceMeta.put({
        key: 'recovery',
        value: { operations: conflicts, records: local, at: this.clock() },
      });
      await this.db.workspaceOutbox.clear();
      await this.db.workspaceConflicts.clear();
      await this.db.workspaceRecords.clear();
      await this.db.workspaceMeta.put({ key: 'cursor', value: 0 });
    });
    await this.pull();
  }
  async recovery() {
    const previous = (await this.db.workspaceMeta.get('recovery'))?.value;
    const current = {
      operations: await this.db.workspaceOutbox.toArray(),
      records: await this.db.workspaceRecords.toArray(),
    };
    const priorEpochs = (await this.db.workspaceMeta.toArray())
      .filter((r) => r.key.startsWith('recovery-epoch-'))
      .map((r) => r.value);
    return { ...(previous ?? current), priorEpochs };
  }
  start() {
    const tick = () => void this.flush();
    const unsubscribe = this.transport.subscribe?.(this.space.id, tick);
    const timer = setInterval(tick, 15000);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', tick);
      window.addEventListener('focus', tick);
    }
    return () => {
      this.stopped = true;
      clearInterval(timer);
      unsubscribe?.();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', tick);
        window.removeEventListener('focus', tick);
      }
    };
  }
  close() {
    this.stopped = true;
    this.db.close();
  }
}
export class WorkspaceFinanceStore {
  constructor(client) {
    this.client = client;
    this.state = null;
  }
  async load() {
    await this.client.db.transaction(
      'r',
      this.client.db.workspaceRecords,
      this.client.db.workspaceMeta,
      async () => {
        this.state = await this.client.finance();
        this.baseline = (await this.client.db.workspaceRecords.toArray()).filter((r) =>
          r.entity.startsWith('finance_'),
        );
      },
    );
    return this.state;
  }
  async commit(change) {
    await this.client.commitFinance(change, this.state?.revision, this.baseline);
    return this.load();
  }
  async restore(imported) {
    validateState(imported);
    const backup = await this.client.finance();
    await this.client.db.workspaceMeta.put({ key: 'finance-before-restore', value: backup });
    await this.client.commitFinance((s) => {
      const revision = s.revision;
      for (const key of Object.keys(s)) delete s[key];
      Object.assign(s, structuredClone(imported), { revision });
    }, this.state?.revision);
    return this.load();
  }
}
