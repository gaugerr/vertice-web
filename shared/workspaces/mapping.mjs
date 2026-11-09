import { emptyState, validateState } from '../../previews/controle-financeiro/finance-domain.mjs';
export const ENTITIES = [
  'shopping_lists',
  'shopping_categories',
  'shopping_items',
  'finance_categories',
  'finance_payment_methods',
  'finance_fixed_accounts',
  'finance_fixed_versions',
  'finance_entries',
  'finance_payments',
  'finance_budget_defaults',
  'finance_budget_months',
  'finance_budget_limits',
  'finance_goals',
  'finance_goal_contributions',
];
const monthId = (m) => '00000000-0000-4000-8000-' + m.replace('-', '').padStart(12, '0');
export const keyOf = (entity, id) => entity + '/' + id;
export function financeRows(s) {
  validateState(s);
  const result = [];
  const add = (entity, id, body) => result.push({ entity, id, body: { id, ...body } });
  for (const c of s.categories)
    add('finance_categories', c.id, {
      name: c.name,
      kind: c.type,
      color: c.color ?? null,
      icon: c.icon ?? null,
      is_archived: !c.active,
    });
  for (const p of s.methods)
    add('finance_payment_methods', p.id, { name: p.name, is_archived: !p.active });
  for (const a of s.fixedAccounts) {
    add('finance_fixed_accounts', a.id, {
      name: a.name,
      start_month: a.startMonth + '-01',
      end_month: a.endMonth ? a.endMonth + '-01' : null,
      observation: a.observation,
    });
    for (const v of a.versions)
      add('finance_fixed_versions', a.id + ':v:' + v.from, {
        fixed_account_id: a.id,
        effective_month: v.from + '-01',
        amount_cents: v.amount,
        due_day: v.dueDay,
        category_id: v.categoryId,
        payment_method_id: v.paymentMethodId,
      });
  }
  for (const e of s.entries) {
    add('finance_entries', e.id, {
      source: 'manual',
      kind: e.type,
      name: e.name,
      competence_month: e.date.slice(0, 7) + '-01',
      reference_date: e.date,
      planned_amount_cents: e.amount,
      settlement_discount_cents: 0,
      category_id: e.categoryId,
      payment_method_id: e.paymentMethodId,
      observation: e.observation,
      fixed_account_id: null,
      fixed_version_id: null,
      shopping_list_id: null,
    });
    if (e.paid)
      add('finance_payments', e.id + ':confirm', {
        entry_id: e.id,
        payment_date: e.date,
        movement_type: 'payment',
        amount_cents: e.amount,
        observation: e.observation,
        sequence_no: 0,
      });
  }
  for (const [id, o] of Object.entries(s.occurrences)) {
    const split = id.lastIndexOf(':'),
      aid = id.slice(0, split),
      m = id.slice(split + 1),
      a = s.fixedAccounts.find((a) => a.id === aid),
      v = a.versions.filter((v) => v.from <= m).at(-1);
    if (!v) throw Error('Vigência ausente.');
    const p = o.payment,
      snap = p?.snapshot;
    const amount = snap?.amount ?? o.amountOverride ?? v.amount;
    const due =
      snap?.date ??
      `${m}-${String(Math.min(v.dueDay, new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate())).padStart(2, '0')}`;
    add('finance_entries', id, {
      source: 'fixed',
      kind: 'expense',
      name: snap?.name ?? a.name,
      competence_month: m + '-01',
      reference_date: due,
      planned_amount_cents: amount,
      local_override_cents: o.amountOverride ?? null,
      settlement_discount_cents:
        p && (p.settled === undefined || p.settled) ? Math.max(0, amount - p.amount) : 0,
      category_id: snap?.categoryId ?? v.categoryId,
      payment_method_id: snap?.paymentMethodId ?? v.paymentMethodId,
      observation: snap?.observation ?? o.observation ?? a.observation,
      fixed_account_id: aid,
      fixed_version_id: aid + ':v:' + v.from,
      shopping_list_id: null,
    });
    if (p) {
      const history = p.history ?? [
        { date: p.date, amount: p.amount, observation: p.snapshot.observation },
      ];
      history.forEach((h, i) =>
        add('finance_payments', id + ':payment:' + i, {
          entry_id: id,
          payment_date: h.date,
          movement_type: h.amount > 0 ? 'payment' : 'adjustment',
          amount_cents: h.amount,
          observation: h.observation,
          sequence_no: i,
        }),
      );
    }
  }
  for (const [c, v] of Object.entries(s.budgets))
    if (v !== null) add('finance_budget_defaults', c, { category_id: c, limit_cents: v });
  for (const [m, limits] of Object.entries(s.monthlyBudgets ?? {})) {
    add('finance_budget_months', monthId(m), { month: m + '-01' });
    for (const [c, v] of Object.entries(limits))
      add('finance_budget_limits', m + ':' + c, {
        budget_month_id: monthId(m),
        category_id: c,
        limit_cents: v,
      });
  }
  for (const g of s.goals) {
    add('finance_goals', g.id, {
      name: g.name,
      description: g.subtitle ?? '',
      target_cents: g.target,
      opening_amount_cents: g.openingAmount ?? g.current,
    });
    for (const c of g.contributions ?? [])
      add('finance_goal_contributions', c.id, {
        goal_id: g.id,
        contribution_date: c.date,
        amount_cents: c.amount,
      });
  }
  return result;
}
export function readFinance(records) {
  const s = emptyState(),
    get = (e) => records.filter((r) => r.entity === e && !r.body.deleted_at).map((r) => r.body);
  const cats = get('finance_categories'),
    methods = get('finance_payment_methods');
  if (cats.length)
    s.categories = cats.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.kind,
      active: !(c.is_archived ?? Boolean(c.archived_at)),
      color: c.color ?? '#b19aef',
      icon: c.icon ?? '◈',
    }));
  if (methods.length)
    s.methods = methods.map((p) => ({
      id: p.id,
      name: p.name,
      active: !(p.is_archived ?? Boolean(p.archived_at)),
    }));
  const versions = get('finance_fixed_versions');
  s.fixedAccounts = get('finance_fixed_accounts').map((a) => ({
    id: a.id,
    name: a.name,
    startMonth: a.start_month.slice(0, 7),
    endMonth: a.end_month?.slice(0, 7) ?? null,
    observation: a.observation,
    versions: versions
      .filter((v) => v.fixed_account_id === a.id)
      .sort((a, b) => a.effective_month.localeCompare(b.effective_month))
      .map((v) => ({
        from: v.effective_month.slice(0, 7),
        amount: Number(v.amount_cents),
        categoryId: v.category_id,
        paymentMethodId: v.payment_method_id,
        dueDay: v.due_day,
      })),
  }));
  const payments = get('finance_payments');
  for (const e of get('finance_entries')) {
    const ps = payments
        .filter((p) => p.entry_id === e.id)
        .sort((a, b) => a.sequence_no - b.sequence_no),
      paid = ps.reduce((n, p) => n + Number(p.amount_cents), 0),
      amount = Number(e.planned_amount_cents),
      settled = paid >= amount - Number(e.settlement_discount_cents ?? 0);
    if (e.source !== 'fixed') {
      s.entries.push({
        id: e.id,
        name: e.name,
        type: e.kind,
        date: e.reference_date,
        amount,
        categoryId: e.category_id,
        paymentMethodId: e.payment_method_id ?? null,
        paid: settled,
        observation: e.observation,
      });
      continue;
    }
    const m = e.competence_month.slice(0, 7),
      o = { observation: e.observation };
    if (e.local_override_cents != null) o.amountOverride = Number(e.local_override_cents);
    if (ps.length) {
      const snapshot = {
        id: e.id,
        source: 'fixed',
        accountId: e.fixed_account_id,
        month: m,
        name: e.name,
        date: e.reference_date,
        amount,
        categoryId: e.category_id,
        paymentMethodId: e.payment_method_id,
        type: 'expense',
        paid: false,
        observation: e.observation,
      };
      o.payment = {
        date: ps.at(-1).payment_date,
        amount: paid,
        settled,
        snapshot,
        history: ps.map((p) => ({
          date: p.payment_date,
          amount: Number(p.amount_cents),
          observation: p.observation,
        })),
      };
    }
    s.occurrences[e.id] = o;
  }
  s.budgets = Object.fromEntries(
    get('finance_budget_defaults').map((b) => [b.category_id, Number(b.limit_cents)]),
  );
  s.monthlyBudgets = {};
  const limits = get('finance_budget_limits');
  for (const b of get('finance_budget_months'))
    s.monthlyBudgets[b.month.slice(0, 7)] = Object.fromEntries(
      limits
        .filter((l) => l.budget_month_id === b.id)
        .map((l) => [l.category_id, Number(l.limit_cents)]),
    );
  const contributions = get('finance_goal_contributions');
  s.goals = get('finance_goals').map((g) => {
    const cs = contributions
        .filter((c) => c.goal_id === g.id)
        .map((c) => ({ id: c.id, date: c.contribution_date, amount: Number(c.amount_cents) })),
      opening = Number(g.opening_amount_cents);
    return {
      id: g.id,
      name: g.name,
      subtitle: g.description,
      target: Number(g.target_cents),
      openingAmount: opening,
      current: opening + cs.reduce((n, c) => n + c.amount, 0),
      contributions: cs,
    };
  });
  validateState(s);
  return s;
}
export function shoppingRows(snapshot) {
  return [
    ...snapshot.lists.map((l) => ({
      entity: 'shopping_lists',
      id: l.id,
      body: {
        id: l.id,
        store_name: l.storeName,
        reference_date: l.date,
        description: l.description,
        budget_cents: l.budgetCents,
        status: l.status,
        completed_at: l.completedAt,
        purchase_date: l.purchaseDate,
        market_name: l.marketName,
        client_created_at: l.createdAt,
        client_updated_at: l.updatedAt,
      },
    })),
    ...snapshot.categories.map((c) => ({
      entity: 'shopping_categories',
      id: c.id,
      body: {
        id: c.id,
        shopping_list_id: c.shoppingListId,
        title: c.title,
        position: c.position,
        client_created_at: c.createdAt,
        client_updated_at: c.updatedAt,
      },
    })),
    ...snapshot.items.map((i) => ({
      entity: 'shopping_items',
      id: i.id,
      body: {
        id: i.id,
        shopping_list_id: i.shoppingListId,
        category_id: i.categoryId,
        name: i.name,
        unit_price: i.unitPrice,
        quantity: i.quantity,
        unit: i.unit,
        is_purchased: i.isPurchased,
        brand: i.brand,
        package_amount: i.packageContent?.amount ?? null,
        package_unit: i.packageContent?.unit ?? null,
        client_created_at: i.createdAt,
        client_updated_at: i.updatedAt,
      },
    })),
  ];
}
export function readShopping(records) {
  const get = (e) => records.filter((r) => r.entity === e && !r.body.deleted_at).map((r) => r.body),
    ts = (r) => ({
      createdAt: new Date(r.client_created_at ?? r.created_at ?? Date.now()).toISOString(),
      updatedAt: new Date(r.client_updated_at ?? r.updated_at ?? Date.now()).toISOString(),
    });
  return {
    lists: get('shopping_lists').map((r) => ({
      id: r.id,
      storeName: r.store_name,
      date: r.reference_date,
      description: r.description,
      budgetCents: r.budget_cents == null ? null : Number(r.budget_cents),
      status: r.status,
      completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
      purchaseDate: r.purchase_date,
      marketName: r.market_name,
      ...ts(r),
    })),
    categories: get('shopping_categories').map((r) => ({
      id: r.id,
      shoppingListId: r.shopping_list_id,
      title: r.title,
      position: r.position,
      ...ts(r),
    })),
    items: get('shopping_items').map((r) => ({
      id: r.id,
      shoppingListId: r.shopping_list_id,
      categoryId: r.category_id,
      name: r.name,
      unitPrice: String(r.unit_price),
      quantity: String(r.quantity),
      unit: r.unit,
      isPurchased: r.is_purchased,
      brand: r.brand,
      packageContent:
        r.package_amount === null
          ? null
          : { amount: String(r.package_amount), unit: r.package_unit },
      ...ts(r),
    })),
  };
}
export function comparable(body) {
  return Object.fromEntries(
    Object.entries(body)
      .filter(
        ([k]) =>
          ![
            'workspace_id',
            'created_at',
            'updated_at',
            'created_by',
            'updated_by',
            'row_version',
            'line_total_cents',
          ].includes(k),
      )
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}
function normalizeValue(key, value) {
  if (value == null) return null;
  if (['unit_price', 'quantity', 'package_amount'].includes(key)) return String(value);
  if (key.endsWith('_at')) return new Date(value).toISOString();
  return value;
}
export function changesBetween(before, after) {
  const old = new Map(before.map((r) => [keyOf(r.entity, r.id), r])),
    next = new Map(after.map((r) => [keyOf(r.entity, r.id), r]));
  const changes = [];
  for (const [key, row] of next) {
    const prior = old.get(key),
      keys = Object.keys(row.body);
    if (
      !prior ||
      prior.body.deleted_at ||
      keys.some(
        (k) =>
          JSON.stringify(normalizeValue(k, prior.body[k])) !==
          JSON.stringify(normalizeValue(k, row.body[k])),
      )
    )
      changes.push({ ...row, expected_version: prior?.body.row_version ?? 0 });
  }
  for (const [key, row] of old)
    if (!row.body.deleted_at && !next.has(key))
      changes.push({
        entity: row.entity,
        id: row.id,
        body: { ...row.body, deleted_at: new Date().toISOString() },
        expected_version: row.body.row_version ?? 0,
      });
  return changes;
}
