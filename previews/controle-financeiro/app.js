import { openPreviewWorkspace, WorkspaceFinanceStore } from './workspaces.js';
import './workspace-ui.mjs';
import {
  cents,
  initialState,
  monthlyRows,
  fixedRows,
  totals,
  saveCatalog,
  toggleCatalog,
  saveEntry,
  saveFixed,
  payFixed,
  correctPayment,
  undoFixed,
  adjustFixed,
  endFixed,
  validMonth,
  adjacentMonth,
  budgetsFor,
  saveBudget,
  copyPreviousBudget,
  overdueRows,
  compareMonths,
  saveGoal,
  saveContribution,
  removeContribution,
  removeGoal,
} from './finance-domain.mjs';
import { createBackup, readBackup, BACKUP_LIMIT } from './finance-backup.mjs';
import { STORAGE_KEY } from './finance-store.mjs';
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
const money = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n / 100);
const decimal = (n) => (n / 100).toFixed(2).replace('.', ',');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const monthName = (m) =>
  new Date((m || month) + '-15T12:00:00')
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase());
const dateName = (d) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
let store,
  workspaceClient,
  state,
  loadError = '';
try {
  workspaceClient = await openPreviewWorkspace();
  store = new WorkspaceFinanceStore(workspaceClient);
  state = await store.load();
} catch (e) {
  loadError = e.message || 'O armazenamento do navegador está indisponível. Nada foi apagado.';
}
let view = 'overview',
  month = today().slice(0, 7),
  editing = null,
  catalogKind = 'categories';
const filters = {
  query: '',
  category: 'all',
  method: 'all',
  status: 'all',
  source: 'all',
  type: 'all',
};
const screens = {
  overview: [
    'Seu dinheiro, em equilíbrio.',
    'Entradas, saídas e contas do mês, sem perder o que vem pela frente.',
  ],
  transactions: [
    'Cada movimento conta.',
    'Lançamentos avulsos e contas fixas, juntos e sem duplicidade.',
  ],
  fixed: [
    'Contas fixas, mês a mês.',
    'Cadastre uma vez. Acompanhe cada competência e seu pagamento.',
  ],
  budget: ['Um plano para o seu mês.', 'Limites por categoria para acompanhar suas escolhas.'],
  goals: ['Espaço para os seus planos.', 'Pequenos passos para os objetivos que fazem sentido.'],
};
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 3800);
}
function category(id) {
  return state.categories.find((c) => c.id === id);
}
function method(id) {
  return state.methods.find((m) => m.id === id)?.name || 'Não informado';
}
function rows() {
  return monthlyRows(state, month);
}
function spend(id) {
  return rows()
    .filter((e) => e.type === 'expense' && e.categoryId === id)
    .reduce((n, e) => n + e.amount, 0);
}
async function transact(action, message) {
  state = await store.commit(action);
  render();
  if (message) toast(message);
}
function panel(title, subtitle, body, action = '') {
  return `<section class="panel"><div class="panel-heading"><div><h2>${title}</h2>${subtitle ? `<p class="panel-subtitle">${subtitle}</p>` : ''}</div>${action}</div>${body}</section>`;
}
const to = (label, destination) =>
  `<button class="text-button" data-view="${destination}">${label} ↗</button>`;
function stats() {
  const t = totals(rows());
  return `<div class="stats">${[
    ['Saldo do período', t.balance, 'Recebidos menos pagos nesta competência', '', true],
    ['Entradas recebidas', t.income, 'Somente entradas confirmadas', 'green'],
    ['Saídas pagas', t.expense, 'Avulsos e contas fixas pagas', 'pink'],
    ['Saldo previsto', t.forecast, 'Inclui pendências do mês', 'purple'],
  ]
    .map(
      ([label, value, note, color, accent]) =>
        `<article class="stat ${accent ? 'accent' : ''}"><div class="stat-top">${label}</div><strong class="${color}">${money(value)}</strong><small>${note}</small></article>`,
    )
    .join(
      '',
    )}</div><p class="competence-note">Por competência · uma conta paga em outro mês continua no mês de referência. O saldo do período não é um extrato bancário.</p>`;
}
function empty(message) {
  return `<div class="empty">${message}</div>`;
}
function actionIcon(name) {
  const paths = {
    edit: '<path d="m16 3 5 5-12 12H4v-5Z"/><path d="m14 5 5 5"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  };
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}
function row(e, full = false) {
  const c = category(e.categoryId),
    fixed = e.source === 'fixed';
  const source = fixed ? 'Conta fixa' : 'Avulso';
  const date = e.paymentDate
    ? `${e.paid ? 'Pago' : 'Último pagamento'} em ${dateName(e.paymentDate)}`
    : dateName(e.date);
  return `<article class="transaction"><span class="txn-icon ${e.type === 'income' ? 'income' : ''}" aria-hidden="true">${esc(c.icon)}</span><div class="txn-info"><strong>${esc(e.name)}</strong><small>${esc(c.name)}${!c.active ? ' · arquivada' : ''} · ${source}</small><small>${esc(method(e.paymentMethodId))} · ${date}</small>${e.observation ? `<p class="record-note">${esc(e.observation)}</p>` : ''}</div><div class="txn-amount ${e.type === 'income' ? 'green' : ''}">${e.type === 'income' ? '+' : '−'} ${money(e.amount)}<small>${e.paid ? (e.type === 'income' ? 'Recebido' : 'Pago') : e.paidAmount ? `Parcial · pago ${money(e.paidAmount)} · resta ${money(e.remainingAmount)}` : 'Pendente'}</small></div>${full ? `<div class="txn-actions">${fixed ? `<button data-fixed-action="${e.paid ? 'correct' : 'pay'}" data-id="${esc(e.accountId)}" aria-label="${e.paid ? 'Corrigir pagamento de' : 'Pagar'} ${esc(e.name)}" title="${e.paid ? 'Corrigir pagamento' : 'Pagar'}">${actionIcon(e.paid ? 'edit' : 'check')}</button><button data-fixed-action="details" data-id="${esc(e.accountId)}" aria-label="Detalhes de ${esc(e.name)}" title="Detalhes">${actionIcon('more')}</button>` : `<button data-entry-edit="${esc(e.id)}" aria-label="Editar ${esc(e.name)}" title="Editar">${actionIcon('edit')}</button><button data-entry-copy="${esc(e.id)}" aria-label="Copiar ${esc(e.name)}" title="Copiar">${actionIcon('copy')}</button><button class="danger-action" data-entry-delete="${esc(e.id)}" aria-label="Excluir ${esc(e.name)}" title="Excluir">${actionIcon('trash')}</button>`}</div>` : ''}</article>`;
}
function distribution() {
  const list = state.categories
      .filter((c) => c.type === 'expense')
      .map((c) => ({ ...c, value: spend(c.id) }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value),
    total = list.reduce((n, c) => n + c.value, 0);
  let offset = 0;
  return `<div class="donut-content"><div class="donut"><svg viewBox="0 0 120 120" aria-label="Distribuição das despesas por categoria"><circle cx="60" cy="60" r="50" fill="none" stroke="#302735" stroke-width="13"/>${list
    .map((c) => {
      const len = (c.value / total) * 314.159,
        r = `<circle cx="60" cy="60" r="50" fill="none" stroke="${esc(c.color)}" stroke-width="13" stroke-dasharray="${len} ${314.159 - len}" stroke-dashoffset="${-offset}"/>`;
      offset += len;
      return r;
    })
    .join(
      '',
    )}</svg><div class="donut-center"><small>Despesas do mês</small><strong>${money(total)}</strong></div></div><div class="category-legend">${list.length ? list.map((c) => `<div class="legend-row"><span><i style="background:${esc(c.color)}"></i>${esc(c.name)}</span><span>${Math.round((c.value / total) * 100)}%</span></div>`).join('') : '<p class="muted">Nenhuma despesa neste mês.</p>'}</div></div>`;
}
function chart() {
  const list = rows().filter((r) => r.paid || r.paidAmount),
    series = (type) =>
      Array.from({ length: 5 }, (_, w) =>
        list
          .filter((r) => r.type === type && Math.floor((Number(r.date.slice(-2)) - 1) / 7) === w)
          .reduce((n, r) => n + (r.paidAmount ?? r.amount), 0),
      );
  const a = series('income'),
    b = series('expense'),
    max = Math.max(1, ...a, ...b),
    points = (values) => values.map((v, i) => `${45 + i * 115},${170 - (v / max) * 135}`).join(' ');
  return `<div class="chart-legend"><span>● Entradas</span><span class="purple">● Saídas</span></div><svg class="line-chart" viewBox="0 0 550 210" role="img" aria-label="Entradas e saídas pagas agrupadas por semana da competência">${[35, 80, 125, 170].map((y) => `<line x1="40" y1="${y}" x2="520" y2="${y}" stroke="#302837" stroke-dasharray="4 5"/>`).join('')}<polyline points="${points(a)}" fill="none" stroke="#b7edce" stroke-width="2.5"/><polyline points="${points(b)}" fill="none" stroke="#b19aef" stroke-width="2.5"/>${[1, 2, 3, 4, 5].map((v, i) => `<text x="${45 + i * 115}" y="204" fill="#9e91ae" text-anchor="middle" font-size="11">${v}ª sem.</text>`).join('')}</svg><p class="muted">Pagos e recebidos · semana da data de referência, não da compensação bancária.</p>`;
}
function budgetRows(compact = false) {
  const limits = budgetsFor(state, month);
  let cats = state.categories.filter(
    (c) => c.type === 'expense' && (c.active || spend(c.id) > 0 || limits[c.id] != null),
  );
  if (compact) cats = cats.sort((a, b) => spend(b.id) - spend(a.id)).slice(0, 3);
  return cats
    .map((c) => {
      const used = spend(c.id),
        limit = limits[c.id],
        defined = limit != null,
        p = defined ? (limit ? Math.round((used / limit) * 100) : used ? 100 : 0) : 0;
      return `<div class="budget-row"><div class="budget-line"><span>${esc(c.name)}${!c.active ? ' (arquivada)' : ''}</span><small>${money(used)} / ${defined ? money(limit) : 'Sem limite'}</small></div><div class="track"><div style="width:${Math.min(100, p)}%;background:${defined && used > limit ? 'var(--pink)' : 'var(--purple)'}"></div></div><div class="budget-foot"><span>${defined ? (used > limit ? `Excedeu ${money(used - limit)}` : `Restam ${money(limit - used)}`) : 'Defina um limite para acompanhar'}</span>${compact ? '' : `<button class="text-button" data-budget="${c.id}">${defined ? 'Ajustar limite' : 'Definir limite'}</button>`}</div></div>`;
    })
    .join('');
}
function goals(compact = false) {
  const list = compact ? state.goals.slice(0, 2) : state.goals;
  return (
    (list.length
      ? list
          .map(
            (g) =>
              `<article class="goal"><div class="goal-heading"><h3>${esc(g.name)}</h3>${compact ? '' : `<div class="txn-actions"><button data-goal-edit="${esc(g.id)}" aria-label="Editar meta ${esc(g.name)}" title="Editar meta">${actionIcon('edit')}</button><button class="danger-action" data-goal-delete="${esc(g.id)}" aria-label="Excluir meta ${esc(g.name)}" title="Excluir meta">${actionIcon('trash')}</button></div>`}</div><p>${esc(g.subtitle || '')}</p><div class="goal-total">${money(g.current)} <small>de ${money(g.target)}</small></div><div class="track"><div style="width:${Math.min(100, (g.current / g.target) * 100)}%;background:var(--mint)"></div></div><div class="goal-actions"><span>${Math.round((g.current / g.target) * 100)}% do caminho</span><button class="text-button" data-goal="${esc(g.id)}">＋ Guardar um valor</button></div>${compact ? '' : `<button class="text-button" data-goal-history="${esc(g.id)}">Ver aportes</button>`}</article>`,
          )
          .join('')
      : empty('Crie uma meta para começar a guardar.')) +
    '<p class="muted">Os valores guardados nas metas não descontam automaticamente do saldo do mês.</p>'
  );
}
function oldPending() {
  const list = overdueRows(state, month, today());
  if (!list.length) return '';
  return panel(
    'Pendências anteriores',
    `${list.length} conta(s) · ${money(list.reduce((n, r) => n + r.remainingAmount, 0))} em aberto`,
    `<p class="muted">Valores de meses anteriores. Eles não são somados novamente ao resultado deste mês.</p><details class="old-pending"><summary>Ver pendências</summary>${list.map((r) => `<div class="old-pending-row"><div><strong>${esc(r.name)}</strong><small>${monthName(r.month)} · ${money(r.remainingAmount)} a pagar</small></div><button class="text-button" data-review-month="${r.month}">Abrir mês</button></div>`).join('')}</details>`,
  );
}
function monthComparison() {
  const { previous, current, prior, hasPrior } = compareMonths(state, month);
  if (!previous) return '';
  if (!hasPrior)
    return panel(
      'Comparar com o mês anterior',
      monthName(previous),
      '<p class="muted">Ainda não há lançamentos no mês anterior para comparar.</p>',
    );
  const line = (label, now, before) =>
    `<div class="comparison-row"><span>${label}</span><strong>${money(now)}</strong><small>${now === before ? 'Sem mudança' : `${money(Math.abs(now - before))} ${now > before ? 'a mais' : 'a menos'}`} · antes ${money(before)}</small></div>`;
  return panel(
    'Comparar com o mês anterior',
    monthName(previous),
    `<div class="month-comparison">${line('Entradas recebidas', current.income, prior.income)}${line('Saídas pagas', current.expense, prior.expense)}${line('Resultado do mês', current.balance, prior.balance)}</div><p class="muted">Valores confirmados por competência. O mês em andamento pode estar incompleto.</p>`,
  );
}
function openGoal(id) {
  const g = state.goals.find((g) => g.id === id);
  showForm(
    'goal-edit',
    g ? 'Editar meta' : 'Nova meta',
    `${field('Nome da meta', 'name', g?.name || '', 'text', 'required maxlength="150"')}${field('Objetivo (R$)', 'target', g ? decimal(g.target) : '', 'text', 'required inputmode="decimal"')}${g ? '' : field('Já guardado (R$)', 'openingAmount', '0,00', 'text', 'required inputmode="decimal"')}${field('Descrição (opcional)', 'subtitle', g?.subtitle || '', 'text', 'maxlength="1000"')}`,
    { id: g?.id || crypto.randomUUID() },
  );
}
function openContribution(goalId, id) {
  const g = state.goals.find((g) => g.id === goalId);
  const c = g.contributions?.find((c) => c.id === id);
  $('#goal-history').close();
  showForm(
    'goal',
    c ? 'Corrigir aporte' : 'Guardar para sua meta',
    `<p class="muted">${esc(g.name)} · este registro acompanha a meta, sem movimentar o saldo mensal.</p>${field('Valor do aporte (R$)', 'amount', c ? decimal(c.amount) : '', 'text', 'required inputmode="decimal"')}${field('Data do aporte', 'date', c?.date || today(), 'date', 'required')}`,
    { id: goalId, contributionId: c?.id || crypto.randomUUID() },
  );
}
function openGoalHistory(id) {
  const g = state.goals.find((g) => g.id === id);
  $('#goal-history-content').innerHTML =
    `<div class="dialog-heading"><h2>Aportes · ${esc(g.name)}</h2><button class="icon-button" data-close aria-label="Fechar">×</button></div><p class="muted">Já guardado antes deste histórico: ${money(g.openingAmount ?? g.current)}.</p>${
      g.contributions?.length
        ? g.contributions
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(
              (c) =>
                `<div class="contribution-row"><div><strong>${money(c.amount)}</strong><small>${dateName(c.date)}</small></div><div class="txn-actions"><button data-contribution-edit="${esc(c.id)}" data-goal-id="${esc(id)}" aria-label="Corrigir aporte de ${money(c.amount)}" title="Corrigir aporte">${actionIcon('edit')}</button><button class="danger-action" data-contribution-delete="${esc(c.id)}" data-goal-id="${esc(id)}" aria-label="Desfazer aporte de ${money(c.amount)}" title="Desfazer aporte">${actionIcon('trash')}</button></div></div>`,
            )
            .join('')
        : empty('Nenhum aporte registrado neste histórico.')
    }`;
  $('#goal-history').showModal();
}
function bills() {
  const pending = rows()
    .filter((e) => e.type === 'expense' && !e.paid)
    .sort((a, b) => a.date.localeCompare(b.date));
  return pending.length
    ? pending
        .slice(0, 4)
        .map(
          (e) =>
            `<div class="bill"><div class="bill-date">${e.date.slice(-2)}<small>${e.source === 'fixed' ? 'FIXA' : 'AVULSA'}</small></div><div class="bill-info">${esc(e.name)}<small>${e.date < today() ? 'Atrasada · ' : ''}${esc(method(e.paymentMethodId))}</small></div><div class="bill-value">${money(e.remainingAmount ?? e.amount)}${e.source === 'fixed' ? `<button data-fixed-action="pay" data-id="${e.accountId}">Pagar competência</button>` : `<button data-entry-edit="${esc(e.id)}">Editar pagamento</button>`}</div></div>`,
        )
        .join('')
    : empty('Tudo em dia. Nenhuma conta pendente neste mês.');
}
function option(value, label, selected) {
  return `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`;
}
function transactionFilters() {
  return `<div class="filters financial-filters"><input id="search" type="search" value="${esc(filters.query)}" aria-label="Buscar lançamento" placeholder="Buscar lançamento…"><label>Tipo<select data-filter="type">${[
    ['all', 'Todos'],
    ['expense', 'Despesas'],
    ['income', 'Receitas'],
  ]
    .map(([v, t]) => option(v, t, filters.type))
    .join(
      '',
    )}</select></label><label>Categoria<select data-filter="category">${option('all', 'Todas', filters.category)}${state.categories.map((c) => option(c.id, c.name + (!c.active ? ' (arquivada)' : ''), filters.category)).join('')}</select></label><label>Pagamento<select data-filter="method">${option('all', 'Todas as formas', filters.method)}${option('none', 'Não informado', filters.method)}${state.methods.map((m) => option(m.id, m.name + (!m.active ? ' (arquivada)' : ''), filters.method)).join('')}</select></label><label>Situação<select data-filter="status">${[
    ['all', 'Todas'],
    ['pending', 'Pendente'],
    ['paid', 'Pago / Recebido'],
  ]
    .map(([v, t]) => option(v, t, filters.status))
    .join('')}</select></label><label>Origem<select data-filter="source">${[
    ['all', 'Todas'],
    ['entry', 'Avulsos'],
    ['fixed', 'Contas fixas'],
  ]
    .map(([v, t]) => option(v, t, filters.source))
    .join('')}</select></label></div><div id="transaction-list"></div>`;
}
function renderTransactions() {
  const list = rows().filter(
    (e) =>
      (filters.type === 'all' || e.type === filters.type) &&
      (filters.category === 'all' || e.categoryId === filters.category) &&
      (filters.method === 'all' ||
        (filters.method === 'none' ? !e.paymentMethodId : e.paymentMethodId === filters.method)) &&
      (filters.status === 'all' || (filters.status === 'paid' ? e.paid : !e.paid)) &&
      (filters.source === 'all' || e.source === filters.source) &&
      [e.name, e.observation]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(filters.query.toLocaleLowerCase('pt-BR')),
  );
  $('#transaction-list').innerHTML = list.length
    ? list.map((e) => row(e, true)).join('')
    : empty('Nenhum lançamento encontrado. Experimente outros filtros.');
}
function fixedPage() {
  const list = fixedRows(state, month),
    paid = list.filter((r) => r.paid),
    pending = list.filter((r) => !r.paid),
    sum = (rs) => rs.reduce((n, r) => n + r.amount, 0);
  const paidTotal = list.reduce((n, r) => n + r.paidAmount, 0);
  const remainingTotal = list.reduce((n, r) => n + r.remainingAmount, 0);
  const sections = [
    ['Pendentes', pending.filter((r) => r.date >= today())],
    ['Atrasadas', pending.filter((r) => r.date < today())],
    ['Pagas', paid],
  ];
  return `<div class="fixed-summary"><article><small>Total previsto</small><strong>${money(sum(list))}</strong></article><article><small>Pago</small><strong class="green">${money(paidTotal)}</strong></article><article><small>A pagar</small><strong class="pink">${money(remainingTotal)}</strong></article></div><div class="main-grid"><div>${sections.map(([title, rs]) => panel(title, `${rs.length} competência(s) em ${monthName().toLowerCase()}`, rs.length ? rs.map((e) => row(e, true)).join('') : empty('Nenhuma conta nesta situação.'))).join('')}</div>${panel('Minhas contas cadastradas', 'Gerencie vigências sem apagar o histórico.', state.fixedAccounts.length ? state.fixedAccounts.map((a) => `<article class="registered-account"><strong>${esc(a.name)}</strong><small>Desde ${a.startMonth.split('-').reverse().join('/')} ${a.endMonth ? `· término ${a.endMonth.split('-').reverse().join('/')}` : '· mensal'}</small><button class="text-button" data-fixed-action="details" data-id="${a.id}">Detalhes e histórico →</button></article>`).join('') : empty('Nenhuma conta fixa cadastrada.<br>Comece por aluguel, internet ou uma assinatura.'), '<button class="text-button" data-new-fixed>＋ Nova conta</button>')}</div>`;
}
function errorPage() {
  return panel(
    'Seus dados foram preservados',
    'O financeiro está indisponível até a leitura ou gravação ser restabelecida.',
    `<p class="error">${esc(loadError)}</p><div class="recovery-actions"><button class="secondary" id="download-preserved">Baixar dados preservados</button><button class="primary" id="retry-load">Tentar novamente</button></div><p class="muted">Não limpe os dados do site. As listas de compras continuam separadas.</p>`,
  );
}
function render() {
  window.dispatchEvent(new CustomEvent('vertice:finance-view', { detail: { view } }));
  $('#page-title').textContent = screens[view][0];
  $('#page-subtitle').textContent = screens[view][1];
  $('#month').textContent = monthName();
  $('#finance-area .toolbar').hidden = view === 'goals';
  $('#new-entry').textContent =
    view === 'fixed'
      ? '＋ Nova conta fixa'
      : view === 'goals'
        ? '＋ Nova meta'
        : '＋ Novo lançamento';
  $('#new-entry').disabled = Boolean(loadError);
  document.querySelectorAll('[data-catalog]').forEach((b) => (b.disabled = Boolean(loadError)));
  document.querySelectorAll('#finance-tabs [data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
    if (b.dataset.view === view) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  if (loadError) {
    $('#content').innerHTML = errorPage();
    return;
  }
  if (view === 'overview')
    $('#content').innerHTML =
      stats() +
      oldPending() +
      monthComparison() +
      `<div class="main-grid">${panel('Seu mês em movimento', 'Entradas e saídas confirmadas por competência.', chart())}${panel('Para onde vai seu dinheiro', 'Despesas pagas e previstas, incluindo contas fixas.', distribution())}${panel(
        'Últimos lançamentos',
        'Uma única visão para avulsos e recorrentes.',
        rows().length
          ? rows()
              .slice(0, 5)
              .map((e) => row(e))
              .join('')
          : empty('Nenhum lançamento neste mês.'),
        to('Ver todos', 'transactions'),
      )}${panel('Contas para lembrar', 'Acompanhe o que ainda está pendente.', bills(), to('Contas fixas', 'fixed'))}${panel('Seu orçamento', 'Limites para comprar com mais clareza.', budgetRows(true), to('Planejar', 'budget'))}${panel('Um plano mais perto', 'Seus objetivos.', goals(true), to('Ver metas', 'goals'))}</div>`;
  else if (view === 'transactions') {
    $('#content').innerHTML =
      stats() +
      panel(
        'Lançamentos de ' + monthName().toLowerCase(),
        'Contas fixas são identificadas para não serem registradas novamente como avulsos.',
        transactionFilters(),
      );
    renderTransactions();
  } else if (view === 'fixed') $('#content').innerHTML = fixedPage();
  else if (view === 'budget')
    $('#content').innerHTML =
      stats() +
      `<div class="main-grid">${panel('Orçamento por categoria', 'Limites de ' + monthName().toLowerCase() + '. Alterações valem somente para este mês.', budgetRows(), '<button class="text-button" id="copy-budget">Copiar mês anterior</button>')}${panel('Visão do mês', 'Despesas pagas e previstas, sem duplicar recorrências.', distribution())}</div>`;
  else
    $('#content').innerHTML =
      `<div class="main-grid">${panel('Suas metas', 'Acompanhe quanto já conseguiu guardar.', goals())}</div>`;
}
function catalogOptions(kind, current, type, required = true) {
  const list = state[kind].filter(
    (c) => (c.active || c.id === current) && (!type || c.type === type),
  );
  return (
    option('', required ? 'Selecione…' : 'Não informado', current || '') +
    list.map((c) => option(c.id, c.name + (!c.active ? ' (arquivada)' : ''), current)).join('')
  );
}
function field(label, name, value = '', type = 'text', extra = '') {
  return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
function categoryField(current, type) {
  return `<label>Categoria<select name="categoryId" required data-current="${esc(current || '')}" data-category-type="${type}">${catalogOptions('categories', current, type)}</select></label><button type="button" class="text-button manage-link" data-catalog="categories">Gerenciar categorias</button>`;
}
function methodField(current, type = 'expense', allowUnknown = false) {
  return `<label>${type === 'income' ? 'Forma de recebimento' : 'Forma de pagamento'}<select name="paymentMethodId" ${allowUnknown ? '' : 'required'} data-current="${esc(current || '')}">${catalogOptions('methods', current, undefined, !allowUnknown)}</select></label><button type="button" class="text-button manage-link" data-catalog="methods">Gerenciar formas de pagamento</button>`;
}
const noteField = (value) =>
  `<label>Observação <span class="muted">(opcional)</span><textarea name="observation" rows="2" maxlength="1000">${esc(value || '')}</textarea></label>`;
function showForm(kind, title, body, context = {}) {
  editing = { kind, ...context };
  $('#financial-form').innerHTML =
    `<div class="dialog-heading"><h2>${title}</h2><button type="button" class="icon-button" data-close aria-label="Fechar">×</button></div>${body}<p id="financial-error" class="error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" data-close>Cancelar</button><button type="submit" class="primary">${kind === 'pay' ? 'Confirmar pagamento' : kind === 'restore' ? 'Restaurar backup' : 'Salvar'}</button></div>`;
  $('#financial-dialog').showModal();
}
function openEntry(id, copy = false) {
  const source = state.entries.find((e) => e.id === id);
  const e =
      copy && source
        ? {
            ...source,
            id: crypto.randomUUID(),
            paid: false,
            categoryId: state.categories.find((c) => c.id === source.categoryId)?.active
              ? source.categoryId
              : null,
            paymentMethodId: state.methods.find((m) => m.id === source.paymentMethodId)?.active
              ? source.paymentMethodId
              : null,
          }
        : source,
    type = e?.type || 'expense';
  showForm(
    'entry',
    copy ? 'Copiar lançamento' : e ? 'Editar lançamento' : 'Novo lançamento',
    `${copy ? '<p class="muted">Revise a cópia antes de salvar. Ela começa pendente. Cadastros arquivados precisam ser substituídos.</p>' : ''}<label>Tipo<select name="type" id="entry-type">${option('expense', 'Despesa', type)}${option('income', 'Receita', type)}</select></label>${field('Descrição', 'name', e?.name || '', 'text', 'required maxlength="80"')}<div class="form-grid">${field('Valor (R$)', 'amount', e ? decimal(e.amount) : '', 'text', 'required inputmode="decimal"')}${field('Data de referência', 'date', e?.date || month + '-09', 'date', 'required')}</div><div id="entry-category">${categoryField(e?.categoryId, type)}</div><div id="entry-method">${methodField(e?.paymentMethodId, type, Boolean(source && !copy && source.paymentMethodId === null))}</div><label class="check-label"><input name="paid" type="checkbox" ${!e || e.paid ? 'checked' : ''}> Já foi pago ou recebido</label>${noteField(e?.observation)}`,
    { id: e?.id || crypto.randomUUID() },
  );
}
function fixedVersion(a, m) {
  return a.versions.filter((v) => v.from <= m).at(-1) || a.versions[0];
}
function openFixed(id) {
  const a = state.fixedAccounts.find((a) => a.id === id),
    v = a ? fixedVersion(a, month) : null;
  const from = a ? (month < a.startMonth ? a.startMonth : month) : month;
  showForm(
    'fixed',
    a ? 'Editar conta / reajustar' : 'Nova conta fixa',
    `${field('Nome da conta', 'name', a?.name || '', 'text', 'required maxlength="80"')}<div class="form-grid">${field('Valor mensal (R$)', 'amount', v ? decimal(v.amount) : '', 'text', 'required inputmode="decimal"')}${field('Dia do vencimento', 'dueDay', v?.dueDay || 5, 'number', 'required min="1" max="31"')}</div>${categoryField(v?.categoryId, 'expense')}${methodField(v?.paymentMethodId)}<div class="form-grid">${field('Mês de início', 'startMonth', a?.startMonth || month, 'month', a ? 'readonly required' : 'required')}${field('Término (opcional)', 'endMonth', a?.endMonth || '', 'month')}</div>${a ? field('Aplicar alterações a partir de', 'from', from, 'month', 'required') : '<p class="muted">O primeiro valor começa no mês de início. Vencimentos inexistentes usam o último dia do mês.</p>'}${a ? '<p class="muted">A vigência escolhida altera competências em aberto. Pagamentos já registrados mantêm os valores e os dados históricos.</p>' : ''}${noteField(a?.observation)}`,
    { id: a?.id || crypto.randomUUID() },
  );
}
function openPayment(id, correction = false) {
  const r = fixedRows(state, month).find((r) => r.accountId === id);
  if (!r) throw Error('Competência não encontrada.');
  const correcting = correction || r.paid;
  const payment = state.occurrences[id + ':' + month]?.payment;
  showForm(
    correcting ? 'correct' : 'pay',
    correcting
      ? 'Corrigir total pago'
      : r.paidAmount
        ? 'Pagar valor restante'
        : 'Pagar competência',
    `<p class="muted">${esc(r.name)} · competência ${monthName()} · vencimento ${dateName(r.date)}. O pagamento continuará neste mês de referência.</p><div class="form-grid">${field(correcting ? 'Total pago acumulado (R$)' : 'Valor deste pagamento (R$)', 'amount', decimal(correcting ? r.paidAmount : r.remainingAmount), 'text', 'required inputmode="decimal"')}${field('Data real do pagamento', 'date', correcting ? r.paymentDate : today(), 'date', 'required')}</div><p class="muted">Total da conta: ${money(payment?.snapshot.amount ?? r.amount)} · já pago: ${money(r.paidAmount)} · restante: ${money(r.remainingAmount)}.${correcting ? ' A correção substitui o total acumulado, não soma outro pagamento.' : ' Este valor será somado aos pagamentos anteriores.'}</p><label class="check-label"><input name="settle" type="checkbox" ${correcting && r.paid && r.paidAmount < payment.snapshot.amount ? 'checked' : ''}> Quitar o restante com desconto</label><p class="muted">Se pagar menos, o restante continua pendente. Marque a opção somente se a diferença foi dispensada.</p>${noteField(r.observation)}`,
    { id, month },
  );
}
function openDetails(id) {
  const a = state.fixedAccounts.find((a) => a.id === id);
  const payments = Object.entries(state.occurrences)
    .filter(([key, r]) => key.startsWith(id + ':') && r.payment)
    .sort(([a], [b]) => b.localeCompare(a));
  $('#fixed-detail-content').innerHTML =
    `<div class="dialog-heading"><h2>${esc(a.name)}</h2><button class="icon-button" data-close aria-label="Fechar">×</button></div><p class="muted">Mensal desde ${a.startMonth}${a.endMonth ? ' · encerrada após ' + a.endMonth : ''}</p><div class="detail-actions"><button class="secondary" data-fixed-action="edit" data-id="${id}">Editar / reajustar</button><button class="secondary" data-fixed-action="adjust" data-id="${id}">Ajustar só ${monthName()}</button><button class="secondary" data-fixed-action="end" data-id="${id}">Encerrar recorrência</button>${fixedRows(state, month).find((r) => r.accountId === id)?.paidAmount ? `<button class="secondary" data-fixed-action="correct" data-id="${id}">Corrigir total pago</button><button class="secondary" data-fixed-action="undo" data-id="${id}">Desfazer todos os pagamentos de ${monthName()}</button>` : ''}</div><h3>Valores por vigência</h3><div class="version-history">${a.versions.map((v) => `<p><strong>${v.from}</strong> · ${money(v.amount)} · dia ${v.dueDay}<small>${esc(category(v.categoryId).name)} · ${esc(method(v.paymentMethodId))}</small></p>`).join('')}</div><h3>Pagamentos registrados</h3>${payments.length ? payments.map(([key, r]) => `<p class="payment-history"><strong>Competência ${key.slice(key.lastIndexOf(':') + 1)}</strong><br>${money(r.payment.amount)} · total pago · último registro em ${dateName(r.payment.date)}${r.payment.history ? r.payment.history.map((h) => `<small>${dateName(h.date)} · ${money(h.amount)}${h.observation ? ' · ' + esc(h.observation) : ''}</small>`).join('') : ''}<small>${esc(category(r.payment.snapshot.categoryId).name)} · ${esc(method(r.payment.snapshot.paymentMethodId))}</small></p>`).join('') : empty('Nenhum pagamento registrado.')}`;
  $('#fixed-detail').showModal();
}
function openCatalog(kind) {
  catalogKind = kind;
  $('#catalog-title').textContent =
    kind === 'categories' ? 'Categorias financeiras' : 'Formas de pagamento';
  $('#catalog-id').value = '';
  $('#catalog-name').value = '';
  $('#catalog-type').disabled = false;
  $('#catalog-type-label').hidden = kind !== 'categories';
  $('#catalog-error').textContent = '';
  renderCatalog();
  $('#catalog-dialog').showModal();
}
function renderCatalog() {
  const list = state[catalogKind];
  $('#catalog-list').innerHTML = list
    .map(
      (c) =>
        `<div class="catalog-row"><div><strong>${esc(c.name)}</strong><small>${catalogKind === 'categories' ? (c.type === 'income' ? 'Receita' : 'Despesa') + ' · ' : ''}${c.active ? 'Ativa' : 'Arquivada'}</small></div><button class="text-button" data-catalog-edit="${c.id}">Renomear</button><button class="text-button" data-catalog-toggle="${c.id}">${c.active ? 'Arquivar' : 'Reativar'}</button></div>`,
    )
    .join('');
}
function refreshFormCatalogs() {
  const cat = $('#financial-form select[name=categoryId]');
  if (cat) {
    const current = cat.value || cat.dataset.current;
    cat.innerHTML = catalogOptions('categories', current, cat.dataset.categoryType);
  }
  const m = $('#financial-form select[name=paymentMethodId]');
  if (m) {
    const current = m.value || m.dataset.current;
    m.innerHTML = catalogOptions('methods', current, undefined, m.required);
  }
}
async function downloadPreserved() {
  try {
    if (!workspaceClient) throw Error('Entre no espaço para recuperar seus registros.');
    downloadJson(
      'vertice-recuperacao-do-espaco.json',
      JSON.stringify(await workspaceClient.recovery(), null, 2),
    );
  } catch (error) {
    toast(error.message);
  }
}
function downloadJson(name, raw) {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#export-finance').onclick = () => {
  try {
    downloadJson('vertice-financeiro-' + today() + '.json', createBackup(state));
    $('#finance-backup-status').textContent =
      'Backup exportado. Guarde o arquivo em um lugar seguro.';
  } catch (error) {
    $('#finance-backup-status').textContent = error.message;
  }
};
$('#import-finance').onclick = () => {
  $('#finance-backup-file').value = '';
  $('#finance-backup-file').click();
};
$('#finance-backup-file').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > BACKUP_LIMIT) throw Error('Use um backup de até 5 MB.');
    const imported = readBackup(await file.text());
    showForm(
      'restore',
      'Restaurar backup financeiro',
      `<p>O arquivo contém <strong>${imported.entries.length} lançamentos</strong>, <strong>${imported.fixedAccounts.length} contas fixas</strong> e <strong>${imported.goals.length} metas</strong>.</p><p>Ao confirmar, o financeiro deste navegador será substituído. Uma cópia dos dados atuais será guardada antes da troca. As listas de compras permanecem separadas.</p>`,
      { imported },
    );
    $('#finance-backup-status').textContent = 'Confira o conteúdo e confirme a restauração.';
  } catch (error) {
    $('#finance-backup-status').textContent = error.message;
  }
};
$('#export-before-restore').onclick = async () => {
  try {
    const previous = (await workspaceClient?.db.workspaceMeta.get('finance-before-restore'))?.value;
    const raw = previous ? JSON.stringify(previous) : null;
    if (!raw) throw Error('Não há cópia anterior disponível.');
    downloadJson('vertice-financeiro-antes-da-restauracao.json', createBackup(JSON.parse(raw)));
  } catch (error) {
    $('#finance-backup-status').textContent = error.message;
  }
};
try {
  $('#export-before-restore').hidden =
    !(await workspaceClient?.db.workspaceMeta.get('finance-before-restore'));
} catch {
  /* Existing recovery screen handles unavailable storage. */
}
$('#export-finance').disabled = Boolean(loadError);
$('#import-finance').disabled = Boolean(loadError);
$('#new-entry').onclick = () =>
  view === 'fixed' ? openFixed() : view === 'goals' ? openGoal() : openEntry();
$('#financial-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target),
    get = (k) => String(f.get(k) || ''),
    context = editing;
  try {
    if (context.kind === 'restore') {
      state = await store.restore(context.imported);
      render();
      $('#financial-dialog').close();
      $('#finance-backup-status').textContent =
        'Backup restaurado. A cópia anterior está disponível para download.';
      $('#export-before-restore').hidden = false;
      toast('Financeiro restaurado neste navegador.');
      return;
    }
    await transact((s) => {
      if (context.kind === 'entry')
        saveEntry(s, {
          id: context.id,
          name: get('name'),
          amount: cents(get('amount')),
          date: get('date'),
          categoryId: get('categoryId'),
          paymentMethodId: get('paymentMethodId') || null,
          type: get('type'),
          paid: f.has('paid'),
          observation: get('observation'),
        });
      else if (context.kind === 'fixed')
        saveFixed(s, {
          id: context.id,
          name: get('name'),
          amount: cents(get('amount')),
          startMonth: get('startMonth'),
          endMonth: get('endMonth') || null,
          from: get('from') || get('startMonth'),
          dueDay: Number(get('dueDay')),
          categoryId: get('categoryId'),
          paymentMethodId: get('paymentMethodId') || null,
          observation: get('observation'),
        });
      else if (context.kind === 'pay' || context.kind === 'correct')
        (context.kind === 'pay' ? payFixed : correctPayment)(s, context.id, context.month, {
          date: get('date'),
          amount: cents(get('amount')),
          observation: get('observation'),
          settle: f.has('settle'),
        });
      else if (context.kind === 'adjust')
        adjustFixed(s, context.id, context.month, cents(get('amount')), get('observation'));
      else if (context.kind === 'end') endFixed(s, context.id, get('endMonth'));
      else if (context.kind === 'budget')
        saveBudget(
          s,
          context.month,
          context.id,
          get('amount').trim() ? cents(get('amount'), { allowZero: true }) : null,
        );
      else if (context.kind === 'goal-edit')
        saveGoal(s, {
          id: context.id,
          name: get('name'),
          target: cents(get('target')),
          subtitle: get('subtitle'),
          openingAmount: get('openingAmount')
            ? cents(get('openingAmount'), { allowZero: true })
            : 0,
        });
      else if (context.kind === 'goal')
        saveContribution(s, context.id, {
          id: context.contributionId,
          amount: cents(get('amount')),
          date: get('date'),
        });
    }, 'Salvo neste navegador.');
    $('#financial-dialog').close();
  } catch (error) {
    $('#financial-error').textContent = error.message;
  }
});
$('#catalog-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await transact(
      (s) =>
        saveCatalog(s, catalogKind, {
          id: $('#catalog-id').value || crypto.randomUUID(),
          name: $('#catalog-name').value,
          type: $('#catalog-type').value,
        }),
      'Cadastro salvo.',
    );
    $('#catalog-id').value = '';
    $('#catalog-name').value = '';
    $('#catalog-type').disabled = false;
    $('#catalog-error').textContent = '';
    renderCatalog();
    refreshFormCatalogs();
  } catch (error) {
    $('#catalog-error').textContent = error.message;
  }
});
$('#prev-month').onclick = () => changeMonth(-1);
$('#next-month').onclick = () => changeMonth(1);
function changeMonth(n) {
  const d = new Date(month + '-15T12:00:00');
  d.setMonth(d.getMonth() + n);
  const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (validMonth(next)) {
    month = next;
    render();
  }
}
$('#reset').onclick = async () => {
  if (loadError) {
    toast('Resolva a leitura dos dados antes de restaurar exemplos.');
    return;
  }
  if (
    confirm(
      'Restaurar o financeiro de exemplo? Isso remove os lançamentos, cadastros e contas fixas deste preview. As compras não serão alteradas.',
    )
  )
    try {
      await transact((s) => {
        const initial = initialState();
        for (const k of Object.keys(s)) if (k !== 'revision') delete s[k];
        Object.assign(s, initial);
      }, 'Exemplos financeiros restaurados.');
    } catch (error) {
      toast(error.message);
    }
};
document.addEventListener('input', (e) => {
  if (e.target.id === 'search') {
    filters.query = e.target.value;
    renderTransactions();
  }
});
document.addEventListener('change', (e) => {
  if (e.target.dataset.filter) {
    filters[e.target.dataset.filter] = e.target.value;
    renderTransactions();
  }
  if (e.target.id === 'entry-type') {
    const old = $('#entry-method select').value;
    $('#entry-category').innerHTML = categoryField(null, e.target.value);
    $('#entry-method').innerHTML = methodField(
      old,
      e.target.value,
      state.entries.find((r) => r.id === editing?.id)?.paymentMethodId === null,
    );
  }
});
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.hasAttribute('data-close')) {
      b.closest('dialog').close();
      return;
    }
    if (b.dataset.view) {
      view = b.dataset.view;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (b.id === 'download-preserved') await downloadPreserved();
    if (b.id === 'retry-load') window.location.reload();
    if (loadError) return;
    if (b.dataset.catalog) openCatalog(b.dataset.catalog);
    if (b.dataset.catalogEdit) {
      const c = state[catalogKind].find((c) => c.id === b.dataset.catalogEdit);
      $('#catalog-id').value = c.id;
      $('#catalog-name').value = c.name;
      if (catalogKind === 'categories') {
        $('#catalog-type').value = c.type;
        $('#catalog-type').disabled = true;
      }
      $('#catalog-name').focus();
    }
    if (b.id === 'catalog-new') {
      $('#catalog-id').value = '';
      $('#catalog-name').value = '';
      $('#catalog-type').disabled = false;
    }
    if (b.dataset.catalogToggle) {
      await transact(
        (s) => toggleCatalog(s, catalogKind, b.dataset.catalogToggle),
        'Cadastro atualizado; o histórico foi preservado.',
      );
      renderCatalog();
      refreshFormCatalogs();
    }
    if (b.dataset.entryEdit) openEntry(b.dataset.entryEdit);
    if (b.dataset.entryCopy) openEntry(b.dataset.entryCopy, true);
    if (
      b.dataset.entryDelete &&
      confirm(
        'Excluir o lançamento “' +
          state.entries.find((r) => r.id === b.dataset.entryDelete)?.name +
          '”? Essa ação não pode ser desfeita.',
      )
    )
      await transact((s) => {
        s.entries = s.entries.filter((r) => r.id !== b.dataset.entryDelete);
      }, 'Lançamento excluído.');
    if (b.hasAttribute('data-new-fixed')) openFixed();
    if (b.dataset.fixedAction) {
      const id = b.dataset.id,
        action = b.dataset.fixedAction;
      if (action === 'details') openDetails(id);
      else {
        $('#fixed-detail').close();
        if (action === 'edit') openFixed(id);
        else if (action === 'pay' || action === 'correct') openPayment(id, action === 'correct');
        else if (action === 'undo') {
          if (
            confirm(
              'Desfazer todos os pagamentos desta competência? O valor previsto em vigor será utilizado novamente.',
            )
          )
            await transact((s) => undoFixed(s, id, month), 'Pagamento desfeito.');
        } else if (action === 'adjust') {
          const r = fixedRows(state, month).find((r) => r.accountId === id);
          if (!r || r.paid || r.paidAmount)
            throw Error('Escolha uma competência em aberto para ajustar somente este mês.');
          showForm(
            'adjust',
            'Ajustar somente ' + monthName(),
            field(
              'Valor desta competência (R$)',
              'amount',
              decimal(r.amount),
              'text',
              'required inputmode="decimal"',
            ) + noteField(r.observation),
            { id, month },
          );
        } else if (action === 'end') {
          const a = state.fixedAccounts.find((a) => a.id === id);
          showForm(
            'end',
            'Encerrar recorrência',
            `<p class="muted">A conta continua no mês final informado. Depois dele, não aparecem novas pendências; pagamentos históricos são preservados.</p>${field('Último mês da conta', 'endMonth', a.endMonth || month, 'month', 'required')}`,
            { id },
          );
        }
      }
    }
    if (b.dataset.budget)
      showForm(
        'budget',
        'Limite de ' + esc(category(b.dataset.budget).name),
        `<p class="muted">O limite vale somente para ${monthName()}. Deixe vazio para remover o limite.</p>${field('Limite (R$)', 'amount', budgetsFor(state, month)[b.dataset.budget] != null ? decimal(budgetsFor(state, month)[b.dataset.budget]) : '', 'text', 'inputmode="decimal"')}`,
        { id: b.dataset.budget, month },
      );
    if (b.dataset.goalEdit) openGoal(b.dataset.goalEdit);
    if (b.dataset.goalDelete && confirm('Excluir esta meta e seu histórico de aportes?'))
      await transact((s) => removeGoal(s, b.dataset.goalDelete), 'Meta excluída.');
    if (b.dataset.goal) openContribution(b.dataset.goal);
    if (b.dataset.goalHistory) openGoalHistory(b.dataset.goalHistory);
    if (b.dataset.contributionEdit) openContribution(b.dataset.goalId, b.dataset.contributionEdit);
    if (
      b.dataset.contributionDelete &&
      confirm('Desfazer este aporte? O valor será retirado apenas da meta.')
    ) {
      await transact(
        (s) => removeContribution(s, b.dataset.goalId, b.dataset.contributionDelete),
        'Aporte desfeito.',
      );
      openGoalHistory(b.dataset.goalId);
    }
    if (b.dataset.reviewMonth) {
      month = b.dataset.reviewMonth;
      view = 'transactions';
      filters.query = '';
      filters.category = 'all';
      filters.method = 'all';
      filters.status = 'pending';
      filters.source = 'all';
      filters.type = 'expense';
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (
      b.id === 'copy-budget' &&
      confirm(
        'Copiar os limites de ' +
          monthName(adjacentMonth(month, -1)) +
          ' para ' +
          monthName() +
          '? Os limites deste mês serão substituídos.',
      )
    )
      await transact(
        (s) => copyPreviousBudget(s, month),
        'Limites copiados somente para este mês.',
      );
  } catch (error) {
    if ($('#catalog-dialog').open) $('#catalog-error').textContent = error.message;
    else toast(error.message);
  }
});
window.addEventListener('vertice:finance-navigate', (e) => {
  if (!Object.hasOwn(screens, e.detail?.view)) return;
  view = e.detail.view;
  render();
});
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) {
    toast('O financeiro mudou em outra aba. Atualize a página antes de editar.');
  }
});
render();

workspaceClient?.onChange(async () => {
  try {
    const next = await workspaceClient.finance();
    if (next.revision === state?.revision) return;
    if ($('#financial-dialog').open || $('#catalog-dialog').open || $('#goal-history').open) {
      toast('O financeiro mudou. Revise antes de salvar.');
      return;
    }
    state = await store.load();
    render();
  } catch (error) {
    toast(error.message);
  }
});
