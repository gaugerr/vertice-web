import Dexie from 'dexie';
import { WorkspaceError, OFFLINE_MS } from './core.mjs';
import { ENTITIES, keyOf, readFinance } from './mapping.mjs';
import { isCreditMethodId } from '../../previews/controle-financeiro/finance-domain.mjs';
const OWNER = '11111111-1111-4111-8111-111111111111',
  GUEST = '22222222-2222-4222-8222-222222222222';
export const DEMO_ACTORS = [
  { uid: OWNER, email: 'titular@exemplo.test', name: 'Titular', licensed: true },
  { uid: GUEST, email: 'parceiro@exemplo.test', name: 'Parceiro', licensed: false },
  {
    uid: '33333333-3333-4333-8333-333333333333',
    email: 'outra@exemplo.test',
    name: 'Outra conta',
    licensed: false,
  },
];
export const sha256 = async (text) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))),
    (n) => n.toString(16).padStart(2, '0'),
  ).join('');
export const invitationToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
const demoLocalMonth = (timeZone, ms) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(ms));
  return (
    parts.find((p) => p.type === 'year').value + '-' + parts.find((p) => p.type === 'month').value
  );
};
const demoFixedCreditBody = (records, accountId, month) => {
  const account = records.find(
    (r) => r.entity === 'finance_fixed_accounts' && r.id === accountId && !r.body.deleted_at,
  );
  if (!account) return null;
  const end = account.body.end_month?.slice(0, 7) ?? null;
  if (month < account.body.start_month.slice(0, 7) || (end && month > end)) return null;
  const version = records
    .filter(
      (r) =>
        r.entity === 'finance_fixed_versions' &&
        r.body.fixed_account_id === accountId &&
        !r.body.deleted_at &&
        r.body.effective_month.slice(0, 7) <= month,
    )
    .sort((a, b) => b.body.effective_month.localeCompare(a.body.effective_month))[0]?.body;
  if (!version || !isCreditMethodId(version.payment_method_id)) return null;
  const [y, mo] = month.split('-').map(Number);
  const day = Math.min(version.due_day, new Date(Date.UTC(y, mo, 0)).getUTCDate());
  return {
    id: accountId + ':' + month,
    source: 'fixed',
    kind: 'expense',
    name: account.body.name,
    competence_month: month + '-01',
    reference_date: `${month}-${String(day).padStart(2, '0')}`,
    planned_amount_cents: version.amount_cents,
    local_override_cents: null,
    settlement_discount_cents: 0,
    category_id: version.category_id,
    payment_method_id: version.payment_method_id,
    observation: account.body.observation,
    fixed_account_id: accountId,
    fixed_version_id: accountId + ':v:' + version.effective_month.slice(0, 7),
    shopping_list_id: null,
  };
};
export class DemoTransport {
  constructor(
    actor,
    {
      name = 'vertice_couple_demo_server_v1',
      clock = () => Date.now(),
      online = () => typeof navigator === 'undefined' || navigator.onLine !== false,
    } = {},
  ) {
    this.actor = actor;
    this.clock = clock;
    this.online = online;
    this.db = new Dexie(name);
    this.db.version(1).stores({ state: 'id' });
    this.channel =
      typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(name)
        : null;
  }
  async request(action, input = {}) {
    if (!this.online()) throw new WorkspaceError('network', 'Sem conexão.');
    const token = action === 'invite' ? invitationToken() : input.token,
      hash = token ? await sha256(token) : null,
      digest = action === 'apply' ? await sha256(JSON.stringify(input.operation)) : null,
      digestMaterialize =
        action === 'materialize_fixed_credit' ? await sha256(JSON.stringify(input)) : null;
    let result;
    await this.db.transaction('rw', this.db.table('state'), async () => {
      const store = this.db.table('state'),
        s = (await store.get('server')) ?? {
          id: 'server',
          spaces: [],
          members: [],
          invites: [],
          records: {},
          operations: {},
          journals: {},
          licenses: { [OWNER]: true },
          personal: {},
        };
      const actor = this.actor,
        licensed = (uid) => s.licenses[uid] === true,
        member = (id) =>
          s.members.find((m) => m.workspace_id === id && m.user_id === actor.uid && m.active),
        space = (id) => s.spaces.find((w) => w.id === id);
      const access = (id, write = false) => {
        const w = space(id),
          m = member(id);
        if (!w || !m) throw new WorkspaceError('removed', 'Você não participa deste espaço.');
        if (write && (w.status !== 'active' || !licensed(w.owner_user_id)))
          throw new WorkspaceError('forbidden', 'Espaço disponível somente para consulta.');
        return { w, m };
      };
      const owner = (id) => {
        const r = access(id);
        if (r.w.owner_user_id !== actor.uid)
          throw new WorkspaceError('forbidden', 'Apenas o titular administra o espaço.');
        return r;
      };
      const create = (kind, name) => {
        const id =
            kind === 'shared' && input.workspace_id ? input.workspace_id : crypto.randomUUID(),
          w = { id, kind, name, owner_user_id: actor.uid, status: 'active', revision: 0 };
        s.spaces.push(w);
        s.members.push({
          workspace_id: id,
          user_id: actor.uid,
          email: actor.email,
          name: actor.name,
          role: 'owner',
          active: true,
          generation: 1,
          kind,
        });
        s.records[id] = [];
        s.journals[id] = [];
        return w;
      };
      if (action === 'list') {
        if (
          licensed(actor.uid) &&
          !s.spaces.some((w) => w.kind === 'personal' && w.owner_user_id === actor.uid)
        )
          create('personal', 'Meu espaço');
        result = s.spaces
          .filter((w) => member(w.id))
          .map((w) => ({
            ...w,
            role: member(w.id).role,
            generation: member(w.id).generation,
            writable: w.status === 'active' && licensed(w.owner_user_id),
          }));
      } else if (
        action === 'create' &&
        input.workspace_id &&
        s.spaces.some(
          (w) =>
            w.id === input.workspace_id && w.owner_user_id === actor.uid && w.status === 'active',
        )
      ) {
        result = s.spaces.find((w) => w.id === input.workspace_id);
      } else if (action === 'create') {
        if (!licensed(actor.uid))
          throw new WorkspaceError('forbidden', 'É preciso uma licença própria ativa.');
        if (
          s.members.some(
            (m) =>
              m.user_id === actor.uid &&
              m.active &&
              m.kind === 'shared' &&
              space(m.workspace_id)?.status === 'active',
          )
        )
          throw new WorkspaceError('conflict', 'Você já participa de um espaço compartilhado.');
        const name = String(input.name ?? '').trim();
        if (!name || name.length > 60) throw Error('Use um nome de até 60 caracteres.');
        result = create('shared', name);
      } else if (action === 'invite') {
        const { w } = owner(input.workspace_id);
        access(w.id, true);
        if (w.kind !== 'shared') throw Error('Escolha o espaço do casal.');
        const email = String(input.email ?? '')
          .trim()
          .toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === actor.email)
          throw Error('Informe o e-mail Google da outra pessoa.');
        if (s.members.filter((m) => m.workspace_id === w.id && m.active).length >= 2)
          throw new WorkspaceError('full', 'O espaço já tem duas pessoas.');
        for (const i of s.invites) if (i.workspace_id === w.id && !i.used) i.revoked = true;
        const invite = {
          id: crypto.randomUUID(),
          workspace_id: w.id,
          email,
          hash,
          expiresAt: this.clock() + 7 * OFFLINE_MS,
          revoked: false,
          used: false,
        };
        s.invites.push(invite);
        result = { token, email, expiresAt: invite.expiresAt };
      } else if (action === 'inspect_invite' || action === 'accept') {
        const i = s.invites.find((i) => i.hash === hash),
          w = i && space(i.workspace_id);
        if (!i || i.revoked || i.used || i.expiresAt <= this.clock() || w?.status !== 'active')
          throw new WorkspaceError(
            'invalid_invite',
            'Este convite expirou ou não está mais disponível.',
          );
        if (i.email !== actor.email.toLowerCase())
          throw new WorkspaceError('wrong_account', 'Entre com a conta Google convidada.');
        if (!licensed(w.owner_user_id))
          throw new WorkspaceError('forbidden', 'A licença do titular não está ativa.');
        if (action === 'inspect_invite')
          result = {
            workspace_id: w.id,
            name: w.name,
            owner: s.members.find((m) => m.workspace_id === w.id && m.role === 'owner')?.name,
            email: i.email,
          };
        else {
          if (s.members.some((m) => m.user_id === actor.uid && m.active && m.kind === 'shared'))
            throw new WorkspaceError(
              'conflict',
              'Você já participa de outro espaço compartilhado.',
            );
          if (s.members.filter((m) => m.workspace_id === w.id && m.active).length >= 2)
            throw new WorkspaceError('full', 'O espaço já tem duas pessoas.');
          let m = s.members.find((m) => m.workspace_id === w.id && m.user_id === actor.uid);
          if (m) {
            m.active = true;
            m.generation++;
          } else {
            s.members.push({
              workspace_id: w.id,
              user_id: actor.uid,
              email: actor.email,
              name: actor.name,
              role: 'member',
              active: true,
              generation: 1,
              kind: 'shared',
            });
          }
          i.used = true;
          result = { workspace_id: w.id };
        }
      } else if (action === 'members') {
        const { w } = access(input.workspace_id);
        result = {
          members: s.members.filter((m) => m.workspace_id === w.id && m.active),
          pending: s.invites
            .filter(
              (i) => i.workspace_id === w.id && !i.revoked && !i.used && i.expiresAt > this.clock(),
            )
            .map(({ email, expiresAt }) => ({ email, expiresAt })),
        };
      } else if (
        action === 'remove' ||
        action === 'leave' ||
        action === 'close' ||
        action === 'revoke_invite'
      ) {
        const { w } = action === 'leave' ? access(input.workspace_id) : owner(input.workspace_id);
        if (action === 'leave' && w.owner_user_id === actor.uid)
          throw Error('O titular deve encerrar o compartilhamento.');
        if (action === 'remove' && input.user_id === w.owner_user_id)
          throw Error('Não é possível remover o titular.');
        if (action === 'revoke_invite') {
          for (const i of s.invites) if (i.workspace_id === w.id) i.revoked = true;
        } else {
          for (const m of s.members)
            if (
              m.workspace_id === w.id &&
              m.active &&
              ((action === 'remove' && m.user_id === input.user_id) ||
                (action === 'leave' && m.user_id === actor.uid) ||
                (action === 'close' && m.role !== 'owner'))
            ) {
              m.active = false;
              m.generation++;
            }
          if (action === 'close') w.status = 'closed';
          for (const i of s.invites) if (i.workspace_id === w.id) i.revoked = true;
        }
        result = { ok: true };
      } else if (action === 'access') {
        const { w, m } = access(input.workspace_id);
        result = {
          member: true,
          generation: m.generation,
          writable: w.status === 'active' && licensed(w.owner_user_id),
          expiresAt: this.clock() + (w.kind === 'shared' ? OFFLINE_MS : 7 * OFFLINE_MS),
          kind: w.kind,
          workspace_id: w.id,
          uid: actor.uid,
        };
      } else if (action === 'pull') {
        const { w } = access(input.workspace_id);
        result = {
          revision: w.revision,
          batches: s.journals[w.id].filter((b) => b.revision > (input.cursor ?? 0)),
          records:
            input.cursor === 0
              ? s.records[w.id]
              : s.journals[w.id].filter((b) => b.revision > input.cursor).flatMap((b) => b.records),
        };
      } else if (action === 'apply') {
        const { w, m } = access(input.workspace_id, true),
          op = input.operation;
        if (op.generation !== m.generation)
          throw new WorkspaceError('generation', 'A participação mudou.');
        const opkey = w.id + ':' + op.id;
        const done = s.operations[opkey];
        if (done) {
          if (done.digest !== digest)
            throw new WorkspaceError('conflict', 'Operação reutilizada com conteúdo diferente.');
          result = done.result;
        } else {
          if (!Array.isArray(op.changes) || op.changes.length > 5000)
            throw Error('Operação inválida.');
          const records = s.records[w.id];
          for (const c of [...op.changes, ...(op.guards ?? [])]) {
            if (!ENTITIES.includes(c.entity)) throw Error('Tipo de registro inválido.');
            const current = records.find((r) => r.entity === c.entity && r.id === c.id);
            if (Number(current?.body.row_version ?? 0) !== Number(c.expected_version))
              throw new WorkspaceError('conflict', 'Outra pessoa alterou este registro.', {
                entity: c.entity,
                id: c.id,
                current,
              });
          }
          const changed = new Map();
          for (const c of op.changes) {
            let r = records.find((r) => r.entity === c.entity && r.id === c.id);
            const body = {
              ...c.body,
              id: c.id,
              workspace_id: w.id,
              created_at: r?.body.created_at ?? new Date(this.clock()).toISOString(),
              updated_at: new Date(this.clock()).toISOString(),
              created_by: r?.body.created_by ?? actor.uid,
              updated_by: actor.uid,
              row_version: Number(r?.body.row_version ?? 0) + 1,
              deleted_at: c.body.deleted_at ?? null,
            };
            if (!r) {
              r = { entity: c.entity, id: c.id, body };
              records.push(r);
            } else r.body = body;
            changed.set(keyOf(r.entity, r.id), structuredClone(r));
          }
          readFinance(records);
          const active = (e) => records.filter((r) => r.entity === e && !r.body.deleted_at);
          for (const i of active('shopping_items'))
            if (
              !active('shopping_categories').some(
                (c) =>
                  c.id === i.body.category_id &&
                  c.body.shopping_list_id === i.body.shopping_list_id,
              ) ||
              !active('shopping_lists').some((l) => l.id === i.body.shopping_list_id)
            )
              throw Error('Referência de compra inválida.');
          for (const guard of op.guards ?? []) {
            const r = records.find((r) => r.entity === guard.entity && r.id === guard.id);
            if (r && !changed.has(keyOf(r.entity, r.id))) {
              r.body.row_version++;
              r.body.updated_by = actor.uid;
              changed.set(keyOf(r.entity, r.id), structuredClone(r));
            }
          }
          w.revision++;
          result = { revision: w.revision, records: [...changed.values()] };
          s.journals[w.id].push({ ...result, operation_id: op.id });
          s.operations[opkey] = { digest, result };
        }
      } else if (action === 'materialize_fixed_credit') {
        // Espelha a RPC do servidor: mesma competência pelo fuso, mesma derivação, mesma idempotência.
        const { w, m } = access(input.workspace_id);
        if (input.generation !== m.generation)
          throw new WorkspaceError('generation', 'A participação mudou.');
        const opkey = w.id + ':materialize:' + input.operation_id;
        if (s.operations[opkey]) {
          if (s.operations[opkey].digest !== digestMaterialize)
            throw new WorkspaceError(
              'operation_reused',
              'Operação reutilizada com conteúdo diferente.',
            );
          result = s.operations[opkey].result;
        } else {
          const records = s.records[w.id];
          const month = demoLocalMonth(input.time_zone, this.clock());
          const body =
            input.competence_month === month
              ? demoFixedCreditBody(records, input.account_id, month)
              : null;
          result = { status: input.competence_month === month ? 'not_eligible' : 'not_current' };
          if (body) {
            const existing = records.find(
              (r) => r.entity === 'finance_entries' && r.id === body.id,
            );
            if (existing) result = { status: existing.body.deleted_at ? 'tombstoned' : 'exists' };
            else {
              const iso = new Date(this.clock()).toISOString();
              const row = {
                entity: 'finance_entries',
                id: body.id,
                body: {
                  ...body,
                  workspace_id: w.id,
                  created_at: iso,
                  updated_at: iso,
                  created_by: actor.uid,
                  updated_by: actor.uid,
                  row_version: 1,
                  deleted_at: null,
                  extra: {},
                },
              };
              records.push(row);
              w.revision++;
              result = {
                status: 'inserted',
                revision: w.revision,
                records: [structuredClone(row)],
              };
              s.journals[w.id].push({
                revision: w.revision,
                records: result.records,
                operation_id: input.operation_id,
              });
            }
          }
          s.operations[opkey] = { digest: digestMaterialize, result };
        }
      } else if (action === 'copy') {
        const { w } = owner(input.workspace_id);
        access(w.id, true);
        const source = space(input.source_id);
        if (!source || source.kind !== 'personal' || source.owner_user_id !== actor.uid)
          throw Error('Origem inválida.');
        const opkey = w.id + ':copy:' + input.operation_id;
        if (s.operations[opkey]) result = s.operations[opkey].result;
        else {
          if (s.records[w.id].some((r) => !r.body.deleted_at))
            throw new WorkspaceError(
              'not_empty',
              'O espaço já tem dados. A cópia não substitui registros.',
            );
          const selected = s.records[source.id].filter(
            (r) =>
              !r.body.deleted_at &&
              (input.area === 'both' ||
                (input.area === 'shopping'
                  ? r.entity.startsWith('shopping_')
                  : r.entity.startsWith('finance_'))),
          );
          if (
            s.records[w.id].some(
              (r) =>
                !r.body.deleted_at &&
                selected.some((x) => x.entity === r.entity && x.id === r.id) &&
                !['finance_categories', 'finance_payment_methods'].includes(r.entity),
            )
          )
            throw new WorkspaceError('not_empty', 'O espaço já tem dados.');
          const rest = s.records[w.id].filter(
            (r) => !selected.some((x) => x.entity === r.entity && x.id === r.id),
          );
          const clones = selected.map((r) => ({
            ...r,
            body: {
              ...r.body,
              workspace_id: w.id,
              row_version: 1,
              created_by: actor.uid,
              updated_by: actor.uid,
            },
          }));
          s.records[w.id] = [...rest, ...clones];
          w.revision++;
          result = { revision: w.revision, records: clones };
          s.journals[w.id].push({ ...result, operation_id: input.operation_id });
          s.operations[opkey] = { result };
        }
      } else if (action === 'demo_license') {
        if (actor.uid !== OWNER)
          throw new WorkspaceError('forbidden', 'Apenas a conta de teste titular.');
        s.licenses[OWNER] = input.active === true;
        result = { ok: true };
      } else throw Error('Ação desconhecida.');
      await store.put(s);
    });
    if (['apply', 'accept', 'remove', 'leave', 'close', 'copy', 'demo_license'].includes(action))
      this.channel?.postMessage({ workspace_id: input.workspace_id });
    return result;
  }
  subscribe(id, fn) {
    if (!this.channel) return () => {};
    const handler = (e) => {
      if (e.data.workspace_id === id) fn();
    };
    this.channel.addEventListener('message', handler);
    return () => this.channel.removeEventListener('message', handler);
  }
  close() {
    this.channel?.close();
    this.db.close();
  }
}
