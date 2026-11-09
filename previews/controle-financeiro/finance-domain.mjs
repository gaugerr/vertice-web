// Pure financial rules. No browser, storage or official app dependencies.
export const MAX_AMOUNT = 9_999_999_999;
export const expenseNames = [
  'Moradia',
  'Contas de Consumo',
  'Mercado',
  'Alimentação Fora',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer',
  'Compras Pessoais',
  'Casa e Manutenção',
  'Assinaturas',
  'Pets',
  'Carro',
  'Dívidas e Financiamentos',
  'Reserva e Investimentos',
  'Outros',
];
export const incomeNames = ['Salário', 'Renda Extra', 'Rendimentos', 'Outras Receitas'];
export const methodNames = [
  'Dinheiro',
  'Pix',
  'Cartão de Débito',
  'Cartão de Crédito',
  'Boleto',
  'Débito Automático',
  'Transferência',
  'Vale Alimentação',
];
const colors = ['#b19aef', '#8caed5', '#b7edce', '#e0bd8e', '#e6a4b2', '#c1ade4'];
export const normalize = (s) => s.trim().normalize('NFC').toLocaleLowerCase('pt-BR');
export function cents(input, { allowZero = false } = {}) {
  if (!/^\d{1,8}([,.]\d{1,2})?$/.test(String(input).trim()))
    throw Error('Use um valor como 120,50, sem separador de milhares.');
  const [a, b = ''] = String(input).trim().replace(',', '.').split('.');
  const value = Number(a) * 100 + Number(b.padEnd(2, '0'));
  if (allowZero) nonnegative(value);
  else positive(value);
  return value;
}
function positive(n) {
  if (!Number.isSafeInteger(n) || n <= 0 || n > MAX_AMOUNT)
    throw Error('Informe um valor positivo dentro do limite permitido.');
}
function nonnegative(n) {
  if (!Number.isSafeInteger(n) || n < 0 || n > MAX_AMOUNT)
    throw Error('Valor financeiro inválido.');
}
export function validMonth(m) {
  return (
    typeof m === 'string' &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(m) &&
    m.slice(0, 4) >= '1900' &&
    m.slice(0, 4) <= '9999'
  );
}
export function monthEnd(m) {
  if (!validMonth(m)) throw Error('Mês inválido.');
  return new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();
}
export function dueDate(m, day) {
  if (!Number.isInteger(day) || day < 1 || day > 31)
    throw Error('O vencimento deve ser entre 1 e 31.');
  return `${m}-${String(Math.min(day, monthEnd(m))).padStart(2, '0')}`;
}
export function validDate(s) {
  return (
    typeof s === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    validMonth(s.slice(0, 7)) &&
    Number(s.slice(8)) >= 1 &&
    Number(s.slice(8)) <= monthEnd(s.slice(0, 7))
  );
}
function text(s, max = 80) {
  if (typeof s !== 'string' || !s.trim() || s.trim().length > max)
    throw Error(`Informe um nome de até ${max} caracteres.`);
  return s.trim();
}
function observation(s) {
  if (typeof s !== 'string' || s.length > 1000)
    throw Error('Use até 1.000 caracteres na observação.');
  return s;
}
export function catalog() {
  return {
    categories: [
      ...incomeNames.map((name, i) => ({
        id: `R${String(i + 1).padStart(2, '0')}`,
        name,
        type: 'income',
        active: true,
        color: '#b7edce',
        icon: '↙',
      })),
      ...expenseNames.map((name, i) => ({
        id: `D${String(i + 1).padStart(2, '0')}`,
        name,
        type: 'expense',
        active: true,
        color: colors[i % colors.length],
        icon: ['⌂', '◈', '♧', '♡', '↗', '◎'][i % 6],
      })),
    ],
    methods: methodNames.map((name, i) => ({ id: `P${i + 1}`, name, active: true })),
  };
}
export function emptyState() {
  return {
    version: 2,
    ...catalog(),
    entries: [],
    budgets: {},
    goals: [],
    fixedAccounts: [],
    occurrences: {},
  };
}
export function initialState() {
  const s = emptyState();
  const seeds = [
    ['Salário', 520000, 'R01', 'P2', '05', true],
    ['Projeto freelance', 65000, 'R02', 'P7', '15', false],
    ['Aluguel', 140000, 'D01', 'P2', '05', true],
    ['Compra do mercado', 41775, 'D03', 'P3', '06', true],
    ['Combustível', 16000, 'D05', 'P4', '07', true],
    ['Farmácia', 7860, 'D06', 'P3', '08', true],
    ['Almoço de domingo', 12600, 'D04', 'P2', '08', true],
    ['Internet', 9990, 'D02', 'P6', '10', false],
    ['Energia elétrica', 18640, 'D02', 'P5', '12', false],
    ['Academia', 8990, 'D06', 'P4', '15', false],
    ['Streaming', 3990, 'D11', 'P4', '18', false],
    ['Feira da semana', 8500, 'D03', 'P2', '20', false],
  ];
  s.entries = seeds.map(([name, amount, categoryId, paymentMethodId, day, paid], i) => ({
    id: String(i + 1),
    name,
    amount,
    categoryId,
    paymentMethodId,
    date: `2026-11-${day}`,
    paid,
    type: categoryId.startsWith('R') ? 'income' : 'expense',
    observation: '',
  }));
  s.entries.push({ ...s.entries[0], id: '13', date: '2026-10-05' });
  s.budgets = {
    D01: 180000,
    D02: 30000,
    D03: 75000,
    D04: 20000,
    D05: 35000,
    D06: 25000,
    D08: 30000,
    D16: 20000,
  };
  s.goals = [
    {
      id: 'reserve',
      name: 'Minha reserva de emergência',
      subtitle: 'Mais tranquilidade para os imprevistos.',
      current: 180000,
      target: 500000,
    },
    {
      id: 'trip',
      name: 'Uma viagem para chamar de minha',
      subtitle: 'Pequenos aportes, um plano mais perto.',
      current: 60000,
      target: 240000,
    },
  ];
  return s;
}
export function migrateV1(old) {
  if (
    !old ||
    !Array.isArray(old.entries) ||
    !old.budgets ||
    typeof old.budgets !== 'object' ||
    !Array.isArray(old.goals)
  )
    throw Error('Os registros financeiros antigos não puderam ser lidos.');
  const s = emptyState();
  let legacy = 0;
  const find = (name, type) => {
    let c = s.categories.find((c) => c.name === name && c.type === type);
    if (!c) {
      c = {
        id: `legacy-${++legacy}`,
        name: ['Renda', 'Alimentação'].includes(name) ? name + ' (legado)' : text(name),
        type,
        active: true,
        color: colors[legacy % colors.length],
        icon: '◈',
      };
      s.categories.push(c);
    }
    return c.id;
  };
  const mapping = new Map();
  function category(name, type) {
    const key = name + ':' + type;
    if (!mapping.has(key)) mapping.set(key, find(name, type));
    return mapping.get(key);
  }
  s.entries = old.entries.map((e) => ({
    ...e,
    categoryId: category(e.category, e.type),
    paymentMethodId: null,
    observation: typeof e.observation === 'string' ? e.observation : '',
    category: undefined,
  }));
  for (const [name, value] of Object.entries(old.budgets))
    s.budgets[category(name, 'expense')] = value;
  s.goals = structuredClone(old.goals);
  validateState(s);
  return s;
}
function reference(s, catId, methodId, type, oldCat, oldMethod) {
  const c = s.categories.find((c) => c.id === catId);
  if (!c || c.type !== type || (!c.active && c.id !== oldCat))
    throw Error('Escolha uma categoria ativa do tipo correto.');
  const m = s.methods.find((m) => m.id === methodId);
  if ((methodId !== null || oldMethod !== null) && (!m || (!m.active && m.id !== oldMethod)))
    throw Error('Escolha uma forma de pagamento ou recebimento ativa.');
}
export function saveCatalog(s, kind, { id, name, type }) {
  const list = kind === 'categories' ? s.categories : s.methods;
  name = text(name, 50);
  const old = list.find((c) => c.id === id);
  if (kind === 'categories' && !['income', 'expense'].includes(old?.type || type))
    throw Error('Escolha Receita ou Despesa.');
  if (
    list.some(
      (c) =>
        c.id !== id &&
        normalize(c.name) === normalize(name) &&
        (kind !== 'categories' || c.type === (old?.type || type)),
    )
  )
    throw Error('Já existe um cadastro com esse nome, inclusive entre os arquivados.');
  if (old) old.name = name;
  else
    list.push(
      kind === 'categories'
        ? {
            id,
            name,
            type,
            active: true,
            color: colors[list.length % colors.length],
            icon: type === 'income' ? '↙' : '◈',
          }
        : { id, name, active: true },
    );
}
export function toggleCatalog(s, kind, id) {
  const c = s[kind].find((c) => c.id === id);
  if (!c) throw Error('Cadastro não encontrado.');
  c.active = !c.active;
}
export function saveEntry(s, e) {
  const old = s.entries.find((v) => v.id === e.id);
  text(e.name);
  positive(e.amount);
  if (!validDate(e.date)) throw Error('Informe uma data válida.');
  observation(e.observation);
  reference(s, e.categoryId, e.paymentMethodId, e.type, old?.categoryId, old?.paymentMethodId);
  if (typeof e.paid !== 'boolean') throw Error('Situação inválida.');
  const value = { ...e, name: e.name.trim() };
  if (old) Object.assign(old, value);
  else s.entries.push(value);
}
export function saveFixed(
  s,
  {
    id,
    name,
    startMonth,
    endMonth,
    observation: note = '',
    from,
    amount,
    categoryId,
    paymentMethodId,
    dueDay,
  },
) {
  const old = s.fixedAccounts.find((a) => a.id === id);
  name = text(name);
  observation(note);
  if (
    !validMonth(startMonth) ||
    !validMonth(from) ||
    (endMonth !== null && !validMonth(endMonth)) ||
    from < startMonth ||
    (endMonth !== null && (endMonth < startMonth || from > endMonth))
  )
    throw Error('Confira os meses de início, vigência e término.');
  positive(amount);
  dueDate(from, dueDay);
  const prior = old?.versions.filter((v) => v.from <= from).at(-1) || old?.versions[0];
  reference(s, categoryId, paymentMethodId, 'expense', prior?.categoryId, prior?.paymentMethodId);
  if (old && startMonth !== old.startMonth)
    throw Error('O início da conta não pode ser alterado após o cadastro.');
  const version = { from, amount, categoryId, paymentMethodId, dueDay };
  if (old) {
    old.name = name;
    old.endMonth = endMonth;
    old.observation = note;
    old.versions = old.versions
      .filter((v) => v.from !== from)
      .concat(version)
      .sort((a, b) => a.from.localeCompare(b.from));
  } else {
    if (from !== startMonth) throw Error('O primeiro valor deve começar no mês inicial.');
    s.fixedAccounts.push({
      id,
      name,
      startMonth,
      endMonth,
      observation: note,
      versions: [version],
    });
  }
}
export function fixedRows(s, month) {
  if (!validMonth(month)) throw Error('Mês inválido.');
  const rows = [];
  for (const a of s.fixedAccounts) {
    const key = a.id + ':' + month,
      record = s.occurrences[key];
    if (record?.payment) {
      const p = record.payment;
      const settled = p.settled === undefined || p.settled;
      const expected = settled ? p.amount : Math.max(p.snapshot.amount, p.amount);
      rows.push({
        ...record.payment.snapshot,
        amount: expected,
        paidAmount: p.amount,
        remainingAmount: expected - p.amount,
        paid: settled,
        paymentDate: record.payment.date,
        source: 'fixed',
        accountId: a.id,
        id: key,
        month,
      });
      continue;
    }
    if (month < a.startMonth || (a.endMonth && month > a.endMonth)) continue;
    const v = a.versions.filter((v) => v.from <= month).at(-1);
    if (!v) continue;
    rows.push({
      id: key,
      source: 'fixed',
      accountId: a.id,
      month,
      name: a.name,
      date: dueDate(month, v.dueDay),
      amount: record?.amountOverride ?? v.amount,
      baseAmount: v.amount,
      categoryId: v.categoryId,
      paymentMethodId: v.paymentMethodId,
      type: 'expense',
      paid: false,
      paidAmount: 0,
      remainingAmount: record?.amountOverride ?? v.amount,
      observation: record?.observation ?? a.observation,
    });
  }
  return rows;
}
export function monthlyRows(s, month) {
  return [
    ...s.entries.filter((e) => e.date.startsWith(month)).map((e) => ({ ...e, source: 'entry' })),
    ...fixedRows(s, month),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
export function payFixed(s, id, month, { date, amount, observation: note = '', settle = false }) {
  const row = fixedRows(s, month).find((r) => r.accountId === id);
  if (!row || row.paid) throw Error('Esta competência não está disponível para pagamento.');
  if (!validDate(date)) throw Error('Informe a data real do pagamento.');
  positive(amount);
  observation(note);
  const key = id + ':' + month;
  const record = s.occurrences[key] || {};
  const old = record.payment;
  const total = (old?.amount || 0) + amount;
  positive(total);
  record.payment = {
    date,
    amount: total,
    settled: settle || total >= row.amount,
    snapshot: old ? { ...old.snapshot, observation: note } : { ...row, observation: note },
    history: [...(old?.history || []), { date, amount, observation: note }],
  };
  s.occurrences[key] = record;
}
export function undoFixed(s, id, month) {
  const key = id + ':' + month;
  if (!s.occurrences[key]?.payment) throw Error('Pagamento não encontrado.');
  delete s.occurrences[key].payment;
}
export function adjustFixed(s, id, month, amount, note = '') {
  const row = fixedRows(s, month).find((r) => r.accountId === id);
  if (!row || row.paid || row.paidAmount)
    throw Error('Desfaça os pagamentos antes de ajustar esta competência.');
  positive(amount);
  observation(note);
  s.occurrences[id + ':' + month] = {
    ...s.occurrences[id + ':' + month],
    amountOverride: amount,
    observation: note,
  };
}
export function endFixed(s, id, month) {
  const a = s.fixedAccounts.find((a) => a.id === id);
  if (!a || !validMonth(month) || month < a.startMonth)
    throw Error('Informe um mês de término válido.');
  a.endMonth = month;
}
export function totals(rows) {
  const add = (type, paidOnly) =>
    rows
      .filter((r) => r.type === type)
      .reduce((n, r) => n + (paidOnly ? (r.paidAmount ?? (r.paid ? r.amount : 0)) : r.amount), 0);
  const income = add('income', true),
    expense = add('expense', true),
    expectedIncome = add('income', false),
    expectedExpense = add('expense', false);
  const values = {
    income,
    expense,
    balance: income - expense,
    expectedIncome,
    expectedExpense,
    forecast: expectedIncome - expectedExpense,
  };
  if (!Object.values(values).every(Number.isSafeInteger))
    throw Error('O total ultrapassou o limite seguro.');
  return values;
}
export function validateState(s) {
  if (
    !s ||
    s.version !== 2 ||
    !Array.isArray(s.categories) ||
    !Array.isArray(s.methods) ||
    !Array.isArray(s.entries) ||
    !Array.isArray(s.fixedAccounts) ||
    !Array.isArray(s.goals) ||
    !s.budgets ||
    typeof s.budgets !== 'object' ||
    Array.isArray(s.budgets) ||
    !s.occurrences ||
    typeof s.occurrences !== 'object' ||
    Array.isArray(s.occurrences)
  )
    throw Error('Formato financeiro inválido. Os dados foram preservados.');
  function ids(list) {
    const used = new Set();
    for (const x of list) {
      if (!x || typeof x.id !== 'string' || !x.id || used.has(x.id))
        throw Error('Registros duplicados ou inválidos.');
      used.add(x.id);
    }
    return used;
  }
  const cats = ids(s.categories),
    methods = ids(s.methods),
    accounts = ids(s.fixedAccounts);
  ids(s.entries);
  ids(s.goals);
  for (const c of s.categories) {
    text(c.name, 50);
    if (!['income', 'expense'].includes(c.type) || typeof c.active !== 'boolean')
      throw Error('Categoria inválida.');
  }
  for (const m of s.methods) {
    text(m.name, 50);
    if (typeof m.active !== 'boolean') throw Error('Forma de pagamento inválida.');
  }
  const refs = (r) => {
    const c = s.categories.find((c) => c.id === r.categoryId);
    if (!c || c.type !== r.type || (r.paymentMethodId !== null && !methods.has(r.paymentMethodId)))
      throw Error('Referência financeira inválida.');
  };
  for (const e of s.entries) {
    text(e.name);
    positive(e.amount);
    refs(e);
    if (!validDate(e.date) || typeof e.paid !== 'boolean') throw Error('Lançamento inválido.');
    observation(e.observation);
  }
  for (const [id, limit] of Object.entries(s.budgets)) {
    if (!cats.has(id) || s.categories.find((c) => c.id === id).type !== 'expense')
      throw Error('Orçamento sem categoria.');
    if (limit !== null) nonnegative(limit);
  }
  for (const a of s.fixedAccounts) {
    text(a.name);
    observation(a.observation);
    if (
      !validMonth(a.startMonth) ||
      (a.endMonth !== null && (!validMonth(a.endMonth) || a.endMonth < a.startMonth)) ||
      !Array.isArray(a.versions) ||
      !a.versions.length ||
      a.versions[0].from !== a.startMonth
    )
      throw Error('Conta fixa inválida.');
    let prior = '';
    for (const v of a.versions) {
      if (!validMonth(v.from) || v.from <= prior) throw Error('Vigências inválidas.');
      prior = v.from;
      positive(v.amount);
      dueDate(v.from, v.dueDay);
      refs({ ...v, type: 'expense' });
      if (v.paymentMethodId === null) throw Error('Conta fixa sem forma de pagamento.');
    }
  }
  for (const [key, r] of Object.entries(s.occurrences)) {
    const split = key.lastIndexOf(':');
    const id = key.slice(0, split),
      month = key.slice(split + 1);
    if (!accounts.has(id) || !validMonth(month) || !r || typeof r !== 'object')
      throw Error('Competência inválida.');
    if (r.amountOverride !== undefined) positive(r.amountOverride);
    if (r.observation !== undefined) observation(r.observation);
    if (r.payment) {
      if (r.payment.settled !== undefined && typeof r.payment.settled !== 'boolean')
        throw Error('Situação de pagamento inválida.');
      positive(r.payment.amount);
      if (!validDate(r.payment.date)) throw Error('Pagamento inválido.');
      const snap = r.payment.snapshot;
      if (
        !snap ||
        snap.accountId !== id ||
        snap.month !== month ||
        snap.id !== key ||
        snap.type !== 'expense' ||
        !validDate(snap.date) ||
        !snap.date.startsWith(month)
      )
        throw Error('Histórico de pagamento inválido.');
      refs(snap);
      positive(snap.amount);
      text(snap.name);
      observation(snap.observation);
      if (r.payment.settled === false && r.payment.amount >= snap.amount)
        throw Error('Pagamento parcial inválido.');
      if (r.payment.history !== undefined) {
        if (!Array.isArray(r.payment.history) || !r.payment.history.length)
          throw Error('Histórico inválido.');
        let sum = 0;
        for (const h of r.payment.history) {
          if (
            !validDate(h.date) ||
            !Number.isSafeInteger(h.amount) ||
            Math.abs(h.amount) > MAX_AMOUNT
          )
            throw Error('Movimentação inválida.');
          observation(h.observation);
          sum += h.amount;
        }
        if (sum !== r.payment.amount) throw Error('Histórico diverge do total pago.');
      }
    }
  }
  for (const g of s.goals) {
    text(g.name, 150);
    nonnegative(g.current);
    positive(g.target);
  }
  return s;
}
export function correctPayment(
  s,
  id,
  month,
  { date, amount, observation: note = '', settle = false },
) {
  const payment = s.occurrences[id + ':' + month]?.payment;
  if (!payment) throw Error('Pagamento não encontrado.');
  if (!validDate(date)) throw Error('Informe a data real do pagamento.');
  positive(amount);
  observation(note);
  const history = payment.history || [
    { date: payment.date, amount: payment.amount, observation: payment.snapshot.observation },
  ];
  history.push({ date, amount: amount - payment.amount, observation: note });
  payment.history = history;
  payment.settled = settle || amount >= payment.snapshot.amount;
  payment.date = date;
  payment.amount = amount;
  payment.snapshot.observation = note;
}
