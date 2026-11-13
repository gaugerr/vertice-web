import {
  MAX_AMOUNT,
  validDate,
  validMonth,
  dueDate,
  adjacentMonth,
  saveEntry,
} from './finance-domain.mjs';
const fail = (message) => {
  throw Error(message);
};
const amount = (n, signed = false) => {
  if (!Number.isSafeInteger(n) || Math.abs(n) > MAX_AMOUNT || (!signed && n <= 0))
    fail('Informe um valor válido.');
};
const name = (value) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80)
    fail('Informe um nome de até 80 caracteres.');
  return value.trim();
};
const getWallet = (s, id) =>
  (s.wallets ?? []).find((w) => w.id === id) ?? fail('Conta não encontrada.');
const getCard = (s, id) =>
  (s.cards ?? []).find((c) => c.id === id) ?? fail('Cartão não encontrado.');
export function invoiceMonth(card, date) {
  if (!validDate(date)) fail('Data da compra inválida.');
  let closing = date.slice(0, 7);
  if (date >= dueDate(closing, card.closingDay)) closing = adjacentMonth(closing, 1);
  return card.dueDay <= card.closingDay ? adjacentMonth(closing, 1) : closing;
}
export function saveWallet(s, w) {
  name(w.name);
  amount(w.openingBalance, true);
  if (!validDate(w.openingDate)) fail('Data do saldo inicial inválida.');
  const old = (s.wallets ??= []).find((x) => x.id === w.id);
  if (
    old &&
    (old.openingBalance !== w.openingBalance || old.openingDate !== w.openingDate) &&
    ((s.entries ?? []).some((e) => e.walletId === w.id) ||
      (s.moves ?? []).some((m) => m.fromWalletId === w.id || m.toWalletId === w.id) ||
      Object.values(s.occurrences).some((o) =>
        o.payment?.history?.some((h) => h.walletId === w.id),
      ))
  )
    fail('O saldo inicial de uma conta com movimentos não pode ser alterado.');
  const value = { ...w, name: w.name.trim(), active: w.active !== false };
  if (old) Object.assign(old, value);
  else s.wallets.push(value);
}
export function saveCard(s, c) {
  name(c.name);
  if (
    !Number.isInteger(c.closingDay) ||
    !Number.isInteger(c.dueDay) ||
    c.closingDay < 1 ||
    c.closingDay > 31 ||
    c.dueDay < 1 ||
    c.dueDay > 31
  )
    fail('Informe dias entre 1 e 31.');
  const old = (s.cards ??= []).find((x) => x.id === c.id);
  if (
    old &&
    (old.closingDay !== c.closingDay || old.dueDay !== c.dueDay) &&
    s.entries.some((e) => e.cardId === c.id)
  )
    fail(
      'Preserve o ciclo do cartão com compras registradas. Crie outro cartão para um ciclo novo.',
    );
  const value = { ...c, name: c.name.trim(), active: c.active !== false };
  if (old) Object.assign(old, value);
  else s.cards.push(value);
}
export function invoice(s, cardId, month) {
  const entries = s.entries
    .filter((e) => e.cardId === cardId && e.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  const paid = (s.moves ?? [])
    .filter((m) => m.kind === 'invoice' && m.cardId === cardId && m.month === month)
    .reduce((sum, m) => sum + m.amount, 0);
  return { total, paid, remaining: total - paid, entries };
}
export function invoiceAllocations(s) {
  const result = [],
    allocated = new Map();
  for (const move of (s.moves ?? [])
    .filter((m) => m.kind === 'invoice')
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    let remaining = move.amount;
    for (const e of invoice(s, move.cardId, move.month).entries) {
      const n = Math.min(remaining, e.amount - (allocated.get(e.id) ?? 0));
      if (n > 0) {
        result.push({ move, entry: e, amount: n });
        allocated.set(e.id, (allocated.get(e.id) ?? 0) + n);
        remaining -= n;
      }
    }
    if (remaining) fail('O pagamento ultrapassa o total da fatura.');
  }
  return result;
}
export function saveMove(s, m) {
  amount(m.amount);
  if (!validDate(m.date)) fail('Data do movimento inválida.');
  const wallet = getWallet(s, m.fromWalletId);
  if (!wallet.active) fail('Escolha uma conta ativa.');
  if (m.date < wallet.openingDate)
    fail('O movimento deve ser posterior ao saldo inicial da conta.');
  if (m.kind === 'transfer') {
    const target = getWallet(s, m.toWalletId);
    if (target.id === wallet.id || !target.active) fail('Escolha duas contas ativas diferentes.');
    if (m.date < target.openingDate) fail('Confira a data do saldo inicial da conta de destino.');
  } else if (m.kind === 'invoice') {
    getCard(s, m.cardId);
    if (!validMonth(m.month)) fail('Competência da fatura inválida.');
  } else fail('Movimento inválido.');
  const next = (s.moves ?? []).filter((x) => x.id !== m.id).concat({ ...m });
  invoiceAllocations({ ...s, moves: next });
  s.moves = next;
}
export function ensureEditable(s, e) {
  if (e?.cardId && invoice(s, e.cardId, e.date.slice(0, 7)).paid)
    fail('Desfaça os pagamentos dessa fatura antes de alterar suas compras.');
}
export function saveLedgerEntry(s, e, { mode = 'single', count = 1 } = {}) {
  const old = s.entries.find((x) => x.id === e.id);
  ensureEditable(s, old);
  if (e.walletId) {
    const w = getWallet(s, e.walletId);
    if (!w.active && old?.walletId !== w.id) fail('Escolha uma conta ativa.');
  }
  if (e.cardId) {
    const c = getCard(s, e.cardId);
    if (e.type !== 'expense') fail('Cartão de crédito é usado somente para despesas.');
    if (!c.active && old?.cardId !== c.id) fail('Escolha um cartão ativo.');
    if (e.walletId) fail('A conta será debitada no pagamento da fatura, não na compra.');
    e.paid = false;
  }
  if (old || mode === 'single') {
    if (e.cardId) {
      const card = getCard(s, e.cardId);
      let month = invoiceMonth(card, e.purchaseDate ?? e.date);
      for (let i = 1; i < (e.seriesIndex ?? 1); i++) month = adjacentMonth(month, 1);
      e.date = dueDate(month, card.dueDay);
    }
    saveEntry(s, e);
    return;
  }
  if (
    !['installments', 'repeat'].includes(mode) ||
    !Number.isInteger(count) ||
    count < 2 ||
    count > 120
  )
    fail('Informe de 2 a 120 parcelas ou repetições.');
  if (mode === 'installments' && e.amount < count)
    fail('Cada parcela precisa ter ao menos um centavo.');
  const card = e.cardId ? getCard(s, e.cardId) : null;
  const first = card ? invoiceMonth(card, e.purchaseDate ?? e.date) : e.date.slice(0, 7);
  const day = card ? card.dueDay : Number(e.date.slice(8));
  let month = first;
  const planned = [];
  for (let i = 0; i < count; i++) {
    if (!month || !validMonth(month)) fail('Período fora do intervalo permitido.');
    planned.push({
      ...e,
      id: e.id + ':' + i,
      seriesId: e.id,
      seriesKind: mode,
      seriesIndex: i + 1,
      seriesCount: count,
      amount:
        mode === 'repeat'
          ? e.amount
          : Math.floor(e.amount / count) + (i < e.amount % count ? 1 : 0),
      date: dueDate(month, day),
      paid: !card && i === 0 && e.paid,
    });
    month = adjacentMonth(month, 1);
  }
  for (const item of planned) saveEntry(s, item);
}
export function deleteLedgerEntry(s, id) {
  const e = s.entries.find((x) => x.id === id);
  ensureEditable(s, e);
  s.entries = s.entries.filter((x) => x.id !== id);
}
export function stopSeries(s, id) {
  const source = s.entries.find((e) => e.id === id);
  if (!source?.seriesId) fail('Série não encontrada.');
  const removable = s.entries.filter(
    (e) =>
      e.seriesId === source.seriesId &&
      e.seriesIndex >= source.seriesIndex &&
      !e.paid &&
      !e.paidAmount &&
      (!e.cardId || !invoice(s, e.cardId, e.date.slice(0, 7)).paid),
  );
  if (!removable.length) fail('Não há parcelas ou repetições em aberto para excluir.');
  const ids = new Set(removable.map((e) => e.id));
  s.entries = s.entries.filter((e) => !ids.has(e.id));
}
export function saveMonthlyLimit(s, month, limit) {
  if (
    !validMonth(month) ||
    (limit !== null && (!Number.isSafeInteger(limit) || limit < 0 || limit > MAX_AMOUNT))
  )
    fail('Limite mensal inválido.');
  s.monthlyLimits ??= {};
  if (limit === null) delete s.monthlyLimits[month];
  else s.monthlyLimits[month] = limit;
}
export function walletBalance(s, id, at) {
  const wallet = getWallet(s, id);
  let balance = wallet.openingBalance;
  const includes = (date) => date >= wallet.openingDate && date <= at;
  for (const e of s.entries)
    if (e.walletId === id && !e.cardId && e.paid && includes(e.date))
      balance += (e.type === 'income' ? 1 : -1) * e.amount;
  for (const o of Object.values(s.occurrences))
    for (const h of o.payment?.history ?? [])
      if (h.walletId === id && includes(h.date)) balance -= h.amount;
  for (const m of s.moves ?? [])
    if (includes(m.date)) {
      if (m.fromWalletId === id) balance -= m.amount;
      if (m.toWalletId === id) balance += m.amount;
    }
  if (!Number.isSafeInteger(balance)) fail('Saldo fora do limite seguro.');
  return balance;
}
export function validateLedger(s) {
  for (const key of ['wallets', 'cards', 'moves'])
    if (s[key] !== undefined && (!Array.isArray(s[key]) || s[key].length > 50000))
      fail('Dados financeiros adicionais inválidos.');
  for (const key of ['wallets', 'cards', 'moves']) {
    const ids = new Set();
    for (const row of s[key] ?? []) {
      if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id))
        fail('Registro financeiro duplicado ou inválido.');
      ids.add(row.id);
    }
  }
  for (const w of s.wallets ?? []) {
    name(w.name);
    amount(w.openingBalance, true);
    if (!validDate(w.openingDate) || typeof w.active !== 'boolean') fail('Conta inválida.');
  }
  for (const c of s.cards ?? []) {
    name(c.name);
    if (
      !Number.isInteger(c.closingDay) ||
      !Number.isInteger(c.dueDay) ||
      c.closingDay < 1 ||
      c.closingDay > 31 ||
      c.dueDay < 1 ||
      c.dueDay > 31 ||
      typeof c.active !== 'boolean'
    )
      fail('Cartão inválido.');
  }
  for (const [month, limit] of Object.entries(s.monthlyLimits ?? {}))
    if (!validMonth(month) || !Number.isSafeInteger(limit) || limit < 0 || limit > MAX_AMOUNT)
      fail('Limite mensal inválido.');
  for (const e of s.entries) {
    if (e.walletId) getWallet(s, e.walletId);
    if (e.cardId) {
      if (e.id.length > 100) fail('Identificador de compra no cartão muito longo.');
      getCard(s, e.cardId);
      if (e.walletId || e.type !== 'expense' || !validDate(e.purchaseDate))
        fail('Compra no cartão inválida.');
    }
    if (
      e.seriesId &&
      (!['repeat', 'installments'].includes(e.seriesKind) ||
        !Number.isInteger(e.seriesIndex) ||
        !Number.isInteger(e.seriesCount) ||
        e.seriesCount < 2 ||
        e.seriesCount > 120 ||
        e.seriesIndex < 1 ||
        e.seriesIndex > e.seriesCount)
    )
      fail('Série inválida.');
  }
  for (const o of Object.values(s.occurrences))
    for (const h of o.payment?.history ?? []) if (h.walletId) getWallet(s, h.walletId);
  for (const m of s.moves ?? []) {
    if (
      m.id.length > 80 ||
      (m.observation !== undefined &&
        (typeof m.observation !== 'string' || m.observation.length > 1000))
    )
      fail('Movimento inválido.');
    amount(m.amount);
    if (!validDate(m.date)) fail('Data do movimento inválida.');
    getWallet(s, m.fromWalletId);
    if (m.kind === 'transfer') {
      getWallet(s, m.toWalletId);
      if (m.fromWalletId === m.toWalletId) fail('Transferência inválida.');
    } else if (m.kind === 'invoice') {
      getCard(s, m.cardId);
      if (!validMonth(m.month)) fail('Fatura inválida.');
    } else fail('Movimento inválido.');
  }
  invoiceAllocations(s);
}
