import {
  MAX_AMOUNT,
  validDate,
  validMonth,
  dueDate,
  adjacentMonth,
  saveEntry,
  isCreditEntry,
  isCreditMethodId,
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
// Atomicidade local: a mudança roda numa cópia e só substitui o estado se tudo validar.
// As séries tocadas são validadas pelo tipo: installments exige sequência completa; repeat
// exige identidade e posições válidas, aceitando lacunas. Dados antigos fora da operação não
// são revalidados aqui.
function atomic(s, change, { seriesId, kind } = {}) {
  const next = structuredClone(s);
  const result = change(next);
  validateLedger(next);
  if (seriesId && kind === 'installments') validateSeriesSequence(next, seriesId);
  if (seriesId && kind === 'repeat') validateRepeatSeries(next, seriesId);
  for (const key of Object.keys(s)) delete s[key];
  Object.assign(s, next);
  return result;
}
const brl = (cents) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const seriesMembers = (s, seriesId, kind) =>
  s.entries
    .filter((e) => e.seriesId === seriesId && (!kind || e.seriesKind === kind))
    .sort((a, b) => a.seriesIndex - b.seriesIndex);
// Criação de lançamento. Crédito: todas as ocorrências reconhecidas e sem conta.
export function saveLedgerEntry(s, e, { mode = 'single', count = 1, removeWallet = false } = {}) {
  const old = s.entries.find((x) => x.id === e.id);
  if (e.walletId) {
    const w = getWallet(s, e.walletId);
    if (!w.active && old?.walletId !== w.id) fail('Escolha uma conta ativa.');
  }
  if (old || mode === 'single') return saveEntry(s, e, { removeWallet });
  if (
    !['installments', 'repeat'].includes(mode) ||
    !Number.isInteger(count) ||
    count < 2 ||
    count > 120
  )
    fail('Informe de 2 a 120 parcelas ou repetições.');
  if (mode === 'installments' && e.amount < count)
    fail('Cada parcela precisa ter ao menos um centavo.');
  const credit = isCreditEntry(e);
  if (credit && e.walletId) fail('Crédito não movimenta carteira. Remova a conta do lançamento.');
  const day = Number(e.date.slice(8));
  let month = e.date.slice(0, 7);
  const planned = [];
  for (let i = 0; i < count; i++) {
    if (!month || !validMonth(month)) fail('Período fora do intervalo permitido.');
    const withoutWallet = { ...e };
    delete withoutWallet.walletId;
    planned.push({
      ...(credit ? withoutWallet : e),
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
      paid: credit ? true : i === 0 && e.paid,
    });
    month = adjacentMonth(month, 1);
  }
  atomic(
    s,
    (n) => {
      if (planned.some((item) => n.entries.some((x) => x.id === item.id)))
        fail('Já existe um lançamento com este identificador.');
      for (const item of planned) saveEntry(n, item);
    },
    { seriesId: e.id, kind: mode },
  );
  return null;
}
// Remove parcelas e renumera as restantes (1..M), mantendo IDs. Se restar uma só, ela vira
// lançamento avulso: mesmo id e dados financeiros, sem metadados de série. Nada é recriado.
function removeInstallments(n, ids) {
  if (!ids.length) return;
  const seriesId = n.entries.find((e) => ids.includes(e.id))?.seriesId;
  const rest = n.entries.filter((e) => !ids.includes(e.id));
  const members = rest
    .filter((e) => e.seriesId === seriesId && e.seriesKind === 'installments')
    .sort((a, b) => a.seriesIndex - b.seriesIndex);
  if (members.length === 1) {
    for (const key of ['seriesId', 'seriesKind', 'seriesIndex', 'seriesCount'])
      delete members[0][key];
  } else
    members.forEach((m, i) => {
      m.seriesIndex = i + 1;
      m.seriesCount = members.length;
    });
  n.entries = rest;
}
// Exclusão de um lançamento. Parcela: remove e renumera. Repetição e avulso: remove sem renumerar.
export function deleteLedgerEntry(s, id) {
  const target = s.entries.find((x) => x.id === id);
  atomic(
    s,
    (n) => {
      if (target?.seriesKind === 'installments') removeInstallments(n, [id]);
      else n.entries = n.entries.filter((x) => x.id !== id);
    },
    { seriesId: target?.seriesId, kind: target?.seriesKind },
  );
}
// "Esta e as seguintes" (somente parcelas): remove a escolhida e as posteriores.
export function deleteInstallmentsFrom(s, id) {
  const source = s.entries.find((e) => e.id === id);
  if (source?.seriesKind !== 'installments') fail('Esta ação vale só para parcelas.');
  atomic(
    s,
    (n) => {
      const current = n.entries.find((e) => e.id === id);
      const ids = seriesMembers(n, current.seriesId, 'installments')
        .filter((e) => e.seriesIndex >= current.seriesIndex)
        .map((e) => e.id);
      removeInstallments(n, ids);
    },
    { seriesId: source.seriesId, kind: 'installments' },
  );
}
// "Série inteira" (somente parcelas): remove todas as parcelas.
export function deleteInstallmentSeries(s, id) {
  const source = s.entries.find((e) => e.id === id);
  if (source?.seriesKind !== 'installments') fail('Esta ação vale só para parcelas.');
  atomic(
    s,
    (n) => {
      n.entries = n.entries.filter((e) => e.seriesId !== source.seriesId);
    },
    { seriesId: source.seriesId, kind: 'installments' },
  );
}
// Ocorrências de repeat com crédito: remove só as com data estritamente posterior a hoje,
// a partir da posição escolhida. Preserva as lançadas (inclusive as de hoje). Sem renumeração.
export function repeatCreditStopPlan(s, id, today) {
  if (!validDate(today)) fail('Informe a data de hoje para encerrar.');
  const source = s.entries.find((e) => e.id === id);
  if (!source?.seriesId) fail('Série não encontrada.');
  const members = seriesMembers(s, source.seriesId, 'repeat').filter(
    (e) => e.seriesIndex >= source.seriesIndex,
  );
  return {
    removeIds: members.filter((e) => e.date > today).map((e) => e.id),
    preservedIds: members.filter((e) => e.date <= today).map((e) => e.id),
  };
}
// Encerramento de repetições. Parcelas não têm encerramento: usam as exclusões aprovadas.
// Repeat com crédito: regra de data. Repeat sem crédito: comportamento atual, sem renumerar.
export function stopSeries(s, id, { today } = {}) {
  const source = s.entries.find((e) => e.id === id);
  if (!source?.seriesId) fail('Série não encontrada.');
  if (source.seriesKind === 'installments')
    fail('Parcelas se excluem por "esta parcela", "esta e as seguintes" ou "série inteira".');
  const seriesId = source.seriesId;
  if (isCreditEntry(source)) {
    const plan = repeatCreditStopPlan(s, id, today);
    if (!plan.removeIds.length) fail('Não há ocorrências futuras para encerrar.');
    atomic(
      s,
      (n) => {
        n.entries = n.entries.filter((e) => !plan.removeIds.includes(e.id));
      },
      { seriesId, kind: 'repeat' },
    );
    return { removed: plan.removeIds.length, preserved: plan.preservedIds.length };
  }
  atomic(
    s,
    (n) => {
      const removable = n.entries.filter(
        (e) =>
          e.seriesId === seriesId &&
          e.seriesIndex >= source.seriesIndex &&
          !e.paid &&
          !e.paidAmount,
      );
      if (!removable.length) fail('Não há parcelas ou repetições em aberto para excluir.');
      const ids = new Set(removable.map((e) => e.id));
      n.entries = n.entries.filter((e) => !ids.has(e.id));
    },
    { seriesId, kind: 'repeat' },
  );
  return undefined;
}
// Plano da alteração de total. Crédito: redistribui entre todas. Demais: preserva pagas e
// redistribui o saldo entre as não pagas. Não grava: serve de prévia.
export function installmentTotalPlan(s, id, total) {
  amount(total);
  const source = s.entries.find((e) => e.id === id);
  if (source?.seriesKind !== 'installments') fail('Alteração de total vale só para parcelas.');
  const members = seriesMembers(s, source.seriesId, 'installments');
  const credit = isCreditEntry(source);
  const fixed = credit ? [] : members.filter((m) => m.paid);
  const open = credit ? members : members.filter((m) => !m.paid);
  const paidSum = fixed.reduce((n, m) => n + m.amount, 0);
  if (!credit && total <= paidSum)
    fail(`O novo total (${brl(total)}) não cobre o valor já pago (${brl(paidSum)}).`);
  if (!open.length)
    fail(`Não há parcelas não pagas para receber o saldo de ${brl(total - paidSum)}.`);
  const rest = total - (credit ? 0 : paidSum);
  if (rest < open.length) fail('Cada parcela não paga precisa de pelo menos R$ 0,01.');
  const base = Math.floor(rest / open.length),
    extra = rest % open.length;
  const next = new Map(open.map((m, i) => [m.id, base + (i < extra ? 1 : 0)]));
  return members.map((m) => ({
    id: m.id,
    seriesIndex: m.seriesIndex,
    paid: m.paid,
    from: m.amount,
    to: next.get(m.id) ?? m.amount,
  }));
}
export function updateInstallmentTotal(s, id, total) {
  const seriesId = s.entries.find((e) => e.id === id)?.seriesId;
  atomic(
    s,
    (n) => {
      const plan = installmentTotalPlan(n, id, total);
      for (const row of plan) n.entries.find((e) => e.id === row.id).amount = row.to;
    },
    { seriesId, kind: 'installments' },
  );
}
// Parcelas: posições contíguas 1..M, seriesCount = M, ids seriesId:sufixo sem duplicata.
// Com seriesId, valida só essa série; sem ele, todas as parcelas.
export function validateSeriesSequence(s, seriesId) {
  const groups = new Map();
  for (const e of s.entries) {
    if (e.seriesKind !== 'installments' || (seriesId && e.seriesId !== seriesId)) continue;
    if (!groups.has(e.seriesId)) groups.set(e.seriesId, []);
    groups.get(e.seriesId).push(e);
  }
  for (const [sid, members] of groups) {
    const sorted = [...members].sort((a, b) => a.seriesIndex - b.seriesIndex);
    sorted.forEach((m, i) => {
      if (m.seriesIndex !== i + 1 || m.seriesCount !== sorted.length)
        fail('Sequência de parcelas inconsistente.');
      if (!m.id.startsWith(sid + ':')) fail('Identificador de parcela inconsistente.');
    });
    if (new Set(members.map((m) => m.id)).size !== members.length)
      fail('Parcela duplicada na série.');
  }
}
// Repetições: mesma identidade e mesma contagem em todas as ocorrências; posições únicas e
// dentro de 1..seriesCount. Lacunas são aceitas, como no comportamento atual.
export function validateRepeatSeries(s, seriesId) {
  const groups = new Map();
  for (const e of s.entries) {
    if (e.seriesKind !== 'repeat' || (seriesId && e.seriesId !== seriesId)) continue;
    if (!groups.has(e.seriesId)) groups.set(e.seriesId, []);
    groups.get(e.seriesId).push(e);
  }
  for (const [sid, members] of groups) {
    const count = members[0].seriesCount;
    if (members.some((m) => m.seriesCount !== count)) fail('Série de repetição inconsistente.');
    const indexes = members.map((m) => m.seriesIndex);
    if (new Set(indexes).size !== indexes.length || indexes.some((i) => i < 1 || i > count))
      fail('Posições de repetição inconsistentes.');
    if (members.some((m) => !m.id.startsWith(sid + ':')))
      fail('Identificador de repetição inconsistente.');
  }
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
  // Conta fixa de crédito é reconhecida automaticamente: não pode ter pagamento registrado.
  for (const [key, record] of Object.entries(s.occurrences ?? {})) {
    if (!record?.payment) continue;
    const at = key.lastIndexOf(':');
    const account = (s.fixedAccounts ?? []).find((a) => a.id === key.slice(0, at));
    const version = account?.versions?.filter((v) => v.from <= key.slice(at + 1)).at(-1);
    if (version && isCreditMethodId(version.paymentMethodId))
      fail('Conta fixa de crédito não tem pagamento registrado.');
  }
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
    if (isCreditEntry(e) && (e.paid !== true || e.walletId))
      fail('Lançamento de crédito inválido: reconhecido e sem conta vinculada.');
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
