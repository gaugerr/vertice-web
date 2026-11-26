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
export function saveMove(s, m) {
  amount(m.amount);
  if (!validDate(m.date)) fail('Data do movimento inválida.');
  const wallet = getWallet(s, m.fromWalletId);
  if (!wallet.active) fail('Escolha uma conta ativa.');
  if (m.date < wallet.openingDate)
    fail('O movimento deve ser posterior ao saldo inicial da conta.');
  if (m.kind !== 'transfer') fail('Movimento inválido.');
  const target = getWallet(s, m.toWalletId);
  if (target.id === wallet.id || !target.active) fail('Escolha duas contas ativas diferentes.');
  if (m.date < target.openingDate) fail('Confira a data do saldo inicial da conta de destino.');
  s.moves = (s.moves ?? []).filter((x) => x.id !== m.id).concat({ ...m });
}
export function saveLedgerEntry(s, e, { mode = 'single', count = 1 } = {}) {
  const old = s.entries.find((x) => x.id === e.id);
  if (e.walletId) {
    const w = getWallet(s, e.walletId);
    if (!w.active && old?.walletId !== w.id) fail('Escolha uma conta ativa.');
  }
  if (old || mode === 'single') {
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
  const day = Number(e.date.slice(8));
  let month = e.date.slice(0, 7);
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
      paid: i === 0 && e.paid,
    });
    month = adjacentMonth(month, 1);
  }
  for (const item of planned) saveEntry(s, item);
}
export function deleteLedgerEntry(s, id) {
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
      !e.paidAmount,
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
    if (e.walletId === id && e.paid && includes(e.date))
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
  for (const key of ['wallets', 'moves'])
    if (s[key] !== undefined && (!Array.isArray(s[key]) || s[key].length > 50000))
      fail('Dados financeiros adicionais inválidos.');
  for (const key of ['wallets', 'moves']) {
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
  for (const [month, limit] of Object.entries(s.monthlyLimits ?? {}))
    if (!validMonth(month) || !Number.isSafeInteger(limit) || limit < 0 || limit > MAX_AMOUNT)
      fail('Limite mensal inválido.');
  for (const e of s.entries) {
    if (e.walletId) getWallet(s, e.walletId);
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
    if (m.kind !== 'transfer') fail('Movimento inválido.');
    getWallet(s, m.toWalletId);
    if (m.fromWalletId === m.toWalletId) fail('Transferência inválida.');
  }
}
// Credit cards no longer exist. Older data may still carry them: card purchases keep their
// amounts and dates as ordinary expenses, and each invoice payment (the only card record that
// moved money) is folded into the opening balance of the wallet it was paid from, so today's
// balance is unchanged (a payment dated in the future would take effect immediately). Anything
// that cannot be converted without losing a value is refused, never dropped.
export function dropLegacyCards(s, notes = []) {
  if (!s || typeof s !== 'object') return s;
  let purchases = 0;
  for (const e of Array.isArray(s.entries) ? s.entries : []) {
    if (e?.cardId === undefined && e?.purchaseDate === undefined) continue;
    if (e.cardId !== undefined && !e.paid && Number(e.paidAmount) > 0)
      fail(
        'Este backup tem compras de cartão com fatura paga em parte. Quite ou ajuste esses lançamentos antes de importar.',
      );
    delete e.cardId;
    delete e.purchaseDate;
    delete e.paidAmount;
    delete e.remainingAmount;
    purchases++;
  }
  let payments = 0;
  if (Array.isArray(s.moves)) {
    const wallets = new Map((s.wallets ?? []).map((w) => [w.id, w]));
    for (const m of s.moves) {
      if (m?.kind !== 'invoice') continue;
      const wallet = wallets.get(m.fromWalletId);
      if (!wallet) fail('Este backup tem um pagamento de fatura sem conta. Importação recusada.');
      if (m.date >= wallet.openingDate) wallet.openingBalance -= m.amount;
      payments++;
    }
    s.moves = s.moves.filter((m) => m?.kind !== 'invoice');
  }
  const cards = Array.isArray(s.cards) ? s.cards.length : 0;
  delete s.cards;
  if (purchases) notes.push(`${purchases} compra(s) de cartão viraram despesas comuns.`);
  if (payments)
    notes.push(`${payments} pagamento(s) de fatura foram incorporados ao saldo inicial da conta.`);
  if (cards) notes.push(`${cards} cartão(ões) cadastrado(s) foram ignorados.`);
  return s;
}
