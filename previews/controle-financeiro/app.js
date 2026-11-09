'use strict';
const $ = (s) => document.querySelector(s),
  money = (n) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(n / 100);
const categories = {
  Moradia: { color: '#b19aef', icon: '⌂', limit: 180000 },
  Alimentação: { color: '#b7edce', icon: '♧', limit: 90000 },
  Transporte: { color: '#e0bd8e', icon: '↗', limit: 35000 },
  Saúde: { color: '#e6a4b2', icon: '♡', limit: 25000 },
  Lazer: { color: '#8caed5', icon: '◈', limit: 30000 },
  Outros: { color: '#a695b5', icon: '⋯', limit: 20000 },
  Renda: { color: '#b7edce', icon: '↙', limit: 0 },
};
function initial() {
  let id = 0;
  const e = (name, amount, category, day, paid = true, type = 'expense') => ({
    id: String(++id),
    name,
    amount,
    category,
    date: `2026-11-${String(day).padStart(2, '0')}`,
    paid,
    type,
  });
  return {
    entries: [
      e('Salário', 520000, 'Renda', 5, true, 'income'),
      e('Projeto freelance', 65000, 'Renda', 15, false, 'income'),
      e('Aluguel', 140000, 'Moradia', 5),
      e('Compra do mercado', 41775, 'Alimentação', 6),
      e('Combustível', 16000, 'Transporte', 7),
      e('Farmácia', 7860, 'Saúde', 8),
      e('Almoço de domingo', 12600, 'Alimentação', 8),
      e('Internet', 9990, 'Moradia', 10, false),
      e('Energia elétrica', 18640, 'Moradia', 12, false),
      e('Academia', 8990, 'Saúde', 15, false),
      e('Streaming', 3990, 'Lazer', 18, false),
      e('Feira da semana', 8500, 'Alimentação', 20, false),
      e('Salário', 520000, 'Renda', 5, true, 'income'),
    ].map((v, i) => (i === 12 ? { ...v, date: '2026-10-05' } : v)),
    budgets: Object.fromEntries(
      Object.entries(categories)
        .filter(([k]) => k !== 'Renda')
        .map(([k, v]) => [k, v.limit]),
    ),
    goals: [
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
    ],
  };
}
const storageKey = 'vertice-finance-preview-v1';
let state;
try {
  state = JSON.parse(localStorage.getItem(storageKey));
  if (!state || !Array.isArray(state.entries) || !state.budgets || !Array.isArray(state.goals))
    throw Error();
} catch {
  state = initial();
}
let view = 'overview',
  month = '2026-11',
  filter = 'all',
  query = '',
  adjust = null;
const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    toast('O navegador não salvou. Os exemplos ficam nesta sessão.');
  }
}
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 3500);
}
function amount(s) {
  const x = String(s).trim();
  if (!/^\d{1,8}([,.]\d{1,2})?$/.test(x))
    throw Error('Use um valor como 120,50, sem separador de milhares.');
  const [a, b = ''] = x.replace(',', '.').split('.');
  const v = Number(a) * 100 + Number(b.padEnd(2, '0'));
  if (v <= 0 || !Number.isSafeInteger(v)) throw Error('Informe um valor maior que zero.');
  return v;
}
const entries = () => state.entries.filter((e) => e.date.startsWith(month));
const sum = (a) => a.reduce((t, e) => t + e.amount, 0);
const monthName = () =>
  new Date(month + '-15T12:00:00')
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase());
const dateLabel = (s) =>
  new Date(s + 'T12:00:00')
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', '');
const spent = (cat) => sum(entries().filter((e) => e.type === 'expense' && e.category === cat));
function stat(title, value, note, icon, color = '', accent = false) {
  return `<article class="stat ${accent ? 'accent' : ''}"><div class="stat-top">${title}<span class="stat-icon">${icon}</span></div><strong class="${color}">${money(value)}</strong><small>${note}</small></article>`;
}
function panel(title, subtitle, body, action = '') {
  return `<section class="panel"><div class="panel-heading"><div><h2>${title}</h2>${subtitle ? `<p class="panel-subtitle">${subtitle}</p>` : ''}</div>${action}</div>${body}</section>`;
}
const link = (label, to) => `<button class="text-button" data-view="${to}">${label} ↗</button>`;
function transaction(e, full = false) {
  const c = categories[e.category] || categories.Outros;
  return `<div class="transaction"><span class="txn-icon ${e.type === 'income' ? 'income' : ''}">${e.type === 'income' ? '↙' : c.icon}</span><div class="txn-info"><strong>${escapeHtml(e.name)}</strong><small>${escapeHtml(e.category)} · ${dateLabel(e.date)}</small></div><div class="txn-amount ${e.type === 'income' ? 'green' : ''}">${e.type === 'income' ? '+' : '−'} ${money(e.amount)}<small>${e.paid ? (e.type === 'income' ? 'Recebido' : 'Pago') : 'Previsto'}</small></div>${full ? `<div class="txn-actions"><button data-edit="${escapeHtml(e.id)}" aria-label="Editar ${escapeHtml(e.name)}" title="Editar">✎</button><button data-delete="${escapeHtml(e.id)}" aria-label="Excluir ${escapeHtml(e.name)}" title="Excluir">×</button></div>` : ''}</div>`;
}
function chart() {
  const es = entries().filter((e) => e.paid),
    series = (type) =>
      [0, 1, 2, 3, 4].map((w) =>
        sum(
          es.filter((e) => e.type === type && Math.floor((Number(e.date.slice(-2)) - 1) / 7) === w),
        ),
      );
  const inc = series('income'),
    out = series('expense'),
    max = Math.max(1, ...inc, ...out);
  const points = (a) => a.map((n, i) => `${55 + i * 115},${170 - (n / max) * 135}`).join(' ');
  return `<div class="chart-legend"><span><i style="background:var(--mint)"></i>Entradas</span><span><i style="background:var(--purple)"></i>Saídas</span></div><svg class="line-chart" viewBox="0 0 550 210" role="img" aria-label="Entradas e saídas pagas por semana do mês"><defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b7edce" stop-opacity=".13"/><stop offset="1" stop-color="#b7edce" stop-opacity="0"/></linearGradient></defs>${[35, 80, 125, 170].map((y) => `<line x1="45" y1="${y}" x2="530" y2="${y}" stroke="#302837" stroke-dasharray="4 5"/>`).join('')}<polygon points="55,170 ${points(inc)} 515,170" fill="url(#fade)"/><polyline points="${points(inc)}" fill="none" stroke="#b7edce" stroke-width="2.5" stroke-linejoin="round"/><polyline points="${points(out)}" fill="none" stroke="#b19aef" stroke-width="2.5" stroke-linejoin="round"/>${[1, 2, 3, 4, 5].map((n, i) => `<text x="${55 + i * 115}" y="204" fill="#887c97" text-anchor="middle" font-size="11">${n}ª sem.</text>`).join('')}</svg><div class="chart-bottom"><span>Movimentações <b>pagas e recebidas</b></span><span>Valores agrupados por semana</span></div>`;
}
function distribution() {
  const list = Object.entries(categories)
      .filter(([k]) => k !== 'Renda')
      .map(([k, c]) => ({ name: k, color: c.color, value: spent(k) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value),
    total = list.reduce((t, x) => t + x.value, 0);
  let offset = 0;
  const rings = list
    .map((x) => {
      const length = (x.value / (total || 1)) * 314.159;
      const r = `<circle cx="60" cy="60" r="50" fill="none" stroke="${x.color}" stroke-width="13" stroke-dasharray="${length} ${314.159 - length}" stroke-dashoffset="${-offset}"/>`;
      offset += length;
      return r;
    })
    .join('');
  return `<div class="donut-content"><div class="donut"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" fill="none" stroke="#302735" stroke-width="13"/>${rings}</svg><div class="donut-center"><small>Despesas do mês</small><strong>${money(total)}</strong></div></div><div class="category-legend">${list.length ? list.map((x) => `<div class="legend-row"><span><i style="background:${x.color}"></i>${x.name}</span><span>${Math.round((x.value / total) * 100)}%</span></div>`).join('') : '<p class="muted">Nenhuma despesa neste mês.</p>'}</div></div><div class="insight">${list.length ? `<b>${list[0].name}</b> representa a maior parte das suas despesas previstas neste mês.` : 'Adicione um lançamento para começar a visualizar seus gastos.'}</div>`;
}
function bills() {
  const list = entries()
    .filter((e) => e.type === 'expense' && !e.paid)
    .sort((a, b) => a.date.localeCompare(b.date));
  return list.length
    ? list
        .slice(0, 4)
        .map(
          (e) =>
            `<div class="bill"><div class="bill-date">${e.date.slice(-2)}<small>${new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()}</small></div><div class="bill-info">${escapeHtml(e.name)}<small>${escapeHtml(e.category)}</small></div><div class="bill-value">${money(e.amount)}<button data-pay="${e.id}">Marcar como pago ✓</button></div></div>`,
        )
        .join('')
    : '<div class="empty">Tudo em dia por aqui.<br>Nenhuma conta prevista neste mês.</div>';
}
function budgets(compact = false) {
  return Object.entries(state.budgets)
    .slice(0, compact ? 3 : 6)
    .map(([name, limit]) => {
      const v = spent(name),
        p = limit ? Math.round((v / limit) * 100) : 0;
      return `<div class="budget-row"><div class="budget-line"><span>${categories[name].icon} &nbsp;${name}</span><small>${money(v)} <span>/ ${money(limit)}</span></small></div><div class="track"><div style="width:${Math.min(p, 100)}%;background:${p > 100 ? 'var(--pink)' : p >= 80 ? '#e0bd8e' : 'var(--purple)'}"></div></div><div class="budget-foot"><span>${p}% utilizado${p > 100 ? ' · limite ultrapassado' : ''}</span>${!compact ? `<button class="text-button" data-budget="${name}">Ajustar limite</button>` : ''}</div></div>`;
    })
    .join('');
}
function goals() {
  return (
    state.goals
      .map(
        (g) =>
          `<article class="goal"><h3>◎ &nbsp;${escapeHtml(g.name)}</h3><p>${escapeHtml(g.subtitle)}</p><div class="goal-total">${money(g.current)} <small>de ${money(g.target)}</small></div><div class="track"><div style="width:${Math.min(100, (g.current / g.target) * 100)}%;background:var(--mint)"></div></div><div class="goal-actions"><span>${Math.round((g.current / g.target) * 100)}% do caminho</span><button class="text-button" data-goal="${g.id}">＋ Guardar um valor</button></div></article>`,
      )
      .join('') +
    '<p class="muted">Os valores das metas são registros separados. Não descontam automaticamente do saldo do mês.</p>'
  );
}
function render() {
  const titles = {
    overview: [
      'Seu dinheiro, em equilíbrio.',
      'Um olhar simples para o que entra, o que sai e o que vem pela frente.',
    ],
    transactions: [
      'Cada movimento conta.',
      'Registre receitas e despesas. Entenda para onde seu dinheiro vai.',
    ],
    budget: ['Um plano para o seu mês.', 'Defina limites por categoria e acompanhe suas escolhas.'],
    goals: [
      'Espaço para os seus planos.',
      'Transforme pequenos passos em conquistas que fazem sentido.',
    ],
  };
  $('#page-title').textContent = titles[view][0];
  $('#page-subtitle').textContent = titles[view][1];
  $('#month').textContent = monthName();
  document
    .querySelectorAll('[data-view]')
    .forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  const es = entries(),
    received = sum(es.filter((e) => e.type === 'income' && e.paid)),
    paid = sum(es.filter((e) => e.type === 'expense' && e.paid)),
    forecast =
      sum(es.filter((e) => e.type === 'income')) - sum(es.filter((e) => e.type === 'expense'));
  const stats = `<div class="stats">${stat('Saldo do mês', received - paid, 'Entradas recebidas menos saídas pagas', '◉', '', true)}${stat('Entradas recebidas', received, 'Só o que já entrou na sua conta', '↙', 'green')}${stat('Saídas pagas', paid, 'Despesas já pagas neste mês', '↗')}${stat('Saldo previsto', forecast, 'Inclui receitas e despesas previstas', '⌁', 'purple')}</div>`;
  if (view === 'overview') {
    $('#content').innerHTML =
      stats +
      `<div class="main-grid">${panel('Seu mês em movimento', 'Um retrato semanal das suas finanças.', chart(), '<span class="tag">FLUXO DO MÊS</span>')}${panel('Para onde vai seu dinheiro', 'Despesas pagas e previstas.', distribution())}${panel(
        'Últimos lançamentos',
        'Seu mês, uma escolha de cada vez.',
        es.length
          ? es
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .filter((e) => e.paid)
              .slice(0, 4)
              .map((e) => transaction(e))
              .join('') || '<div class="empty">Nenhum lançamento pago.</div>'
          : '<div class="empty">Nenhum lançamento neste mês.</div>',
        link('Ver todos', 'transactions'),
      )}${panel('Contas para lembrar', 'Organize os próximos pagamentos.', bills(), '<span class="tag">' + es.filter((e) => e.type === 'expense' && !e.paid).length + ' previstas</span>')}${panel('Seu orçamento', 'Limites para comprar com mais clareza.', budgets(true), link('Planejar', 'budget'))}${panel('Um plano mais perto', 'O que você está construindo para depois.', goals().replace(/<p class="muted">.*?<\/p>$/, ''), link('Ver metas', 'goals'))}</div>`;
  } else if (view === 'transactions') {
    $('#content').innerHTML =
      stats +
      `<div style="margin-top:22px">${panel('Lançamentos de ' + monthName().toLowerCase(), 'Edite, exclua ou registre um novo movimento.', '<div class="filters"><input id="search" type="search" placeholder="Buscar lançamento…" aria-label="Buscar lançamento"><button data-filter="all">Todos</button><button data-filter="expense">Despesas</button><button data-filter="income">Receitas</button><button data-filter="pending">Previstos</button></div><div id="transaction-list"></div>')}</div>`;
    $('#search').value = query;
    renderTransactions();
  } else if (view === 'budget') {
    $('#content').innerHTML =
      stats +
      `<div class="main-grid">${panel('Orçamento por categoria', 'Despesas pagas e previstas comparadas aos seus limites.', budgets())}${panel('O que cabe no seu mês', 'Uma referência para planejar com calma.', distribution() + '<div class="insight">Os limites desta primeira versão são os mesmos para todos os meses. Ajustá-los não altera seus lançamentos.</div>')}</div>`;
  } else {
    $('#content').innerHTML =
      `<div class="main-grid">${panel('Suas metas', 'Acompanhe quanto já conseguiu guardar.', goals())}${panel('Constância vale mais que pressa.', 'O próximo passo pode ser pequeno.', '<div class="goal"><h3>Comece pelo que importa para você.</h3><p>Uma reserva para os imprevistos, uma viagem ou um objetivo especial. Escolha um plano e acompanhe sua evolução, no seu ritmo.</p></div><div class="insight">Nesta prévia, você pode experimentar aportes nas duas metas de exemplo.</div>')}</div>`;
  }
}
function renderTransactions() {
  const list = entries()
    .filter(
      (e) =>
        (filter === 'all' || (filter === 'pending' ? !e.paid : e.type === filter)) &&
        e.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  $('#transaction-list').innerHTML = list.length
    ? list.map((e) => transaction(e, true)).join('')
    : '<div class="empty">Nenhum lançamento encontrado.<br>Experimente outro filtro ou adicione um movimento.</div>';
  document
    .querySelectorAll('[data-filter]')
    .forEach((b) => b.classList.toggle('selected', b.dataset.filter === filter));
}
function categoryOptions(value) {
  const type = document.querySelector('input[name=type]:checked').value;
  $('#category').innerHTML = Object.keys(categories)
    .filter((c) => (type === 'income' ? c === 'Renda' : c !== 'Renda'))
    .map((c) => `<option>${c}</option>`)
    .join('');
  if (value && [...$('#category').options].some((o) => o.value === value))
    $('#category').value = value;
}
function openEntry(id) {
  const e = state.entries.find((e) => e.id === id);
  $('#entry-form').reset();
  $('#entry-id').value = e?.id || '';
  $('#form-title').textContent = e ? 'Editar lançamento' : 'Novo lançamento';
  $('#description').value = e?.name || '';
  $('#amount').value = e ? (e.amount / 100).toFixed(2).replace('.', ',') : '';
  $('#date').value = e?.date || month + '-09';
  document.querySelector(`input[name=type][value=${e?.type || 'expense'}]`).checked = true;
  categoryOptions(e?.category);
  $('#paid').checked = e ? e.paid : true;
  $('#form-error').textContent = '';
  $('#entry-dialog').showModal();
}
$('#new-entry').onclick = () => openEntry();
document
  .querySelectorAll('input[name=type]')
  .forEach((r) => (r.onchange = () => categoryOptions()));
document
  .querySelectorAll('[data-close]')
  .forEach((b) => (b.onclick = () => b.closest('dialog').close()));
$('#entry-form').onsubmit = (e) => {
  e.preventDefault();
  try {
    const cents = amount($('#amount').value),
      name = $('#description').value.trim(),
      date = $('#date').value;
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw Error('Preencha a descrição e uma data válida.');
    const id = $('#entry-id').value || crypto.randomUUID();
    const entry = {
      id,
      name,
      amount: cents,
      category: $('#category').value,
      date,
      paid: $('#paid').checked,
      type: document.querySelector('input[name=type]:checked').value,
    };
    const idx = state.entries.findIndex((e) => e.id === id);
    if (idx < 0) state.entries.push(entry);
    else state.entries[idx] = entry;
    month = date.slice(0, 7);
    persist();
    $('#entry-dialog').close();
    render();
    toast('Lançamento salvo na demonstração.');
  } catch (error) {
    $('#form-error').textContent = error.message;
  }
};
$('#prev-month').onclick = () => changeMonth(-1);
$('#next-month').onclick = () => changeMonth(1);
function changeMonth(n) {
  const d = new Date(month + '-15T12:00:00');
  d.setMonth(d.getMonth() + n);
  month = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  render();
}
$('#reset').onclick = () => {
  if (
    confirm('Restaurar os dados de exemplo? As alterações feitas neste preview serão descartadas.')
  ) {
    state = initial();
    month = '2026-11';
    persist();
    render();
    toast('Exemplos restaurados.');
  }
};
document.addEventListener('click', (event) => {
  const b = event.target.closest('button');
  if (!b) return;
  if (b.dataset.view) {
    view = b.dataset.view;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (b.dataset.filter) {
    filter = b.dataset.filter;
    renderTransactions();
  }
  if (b.dataset.edit) openEntry(b.dataset.edit);
  if (b.dataset.delete && confirm('Excluir este lançamento de exemplo?')) {
    state.entries = state.entries.filter((e) => e.id !== b.dataset.delete);
    persist();
    render();
    toast('Lançamento excluído.');
  }
  if (b.dataset.pay) {
    const e = state.entries.find((e) => e.id === b.dataset.pay);
    e.paid = true;
    persist();
    render();
    toast('Conta marcada como paga.');
  }
  if (b.dataset.budget || b.dataset.goal) {
    adjust = {
      type: b.dataset.budget ? 'budget' : 'goal',
      id: b.dataset.budget || b.dataset.goal,
    };
    $('#adjust-title').textContent =
      adjust.type === 'budget' ? 'Limite de ' + adjust.id : 'Guardar para sua meta';
    $('#adjust-help').textContent =
      adjust.type === 'budget'
        ? 'Ajuste o limite mensal desta categoria.'
        : 'Este aporte atualiza somente a meta de exemplo.';
    $('#adjust-amount').value =
      adjust.type === 'budget' ? (state.budgets[adjust.id] / 100).toFixed(2).replace('.', ',') : '';
    $('#adjust-error').textContent = '';
    $('#adjust-dialog').showModal();
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'search') {
    query = e.target.value;
    renderTransactions();
  }
});
$('#adjust-form').onsubmit = (e) => {
  e.preventDefault();
  try {
    const v = amount($('#adjust-amount').value);
    if (adjust.type === 'budget') state.budgets[adjust.id] = v;
    else {
      const g = state.goals.find((g) => g.id === adjust.id);
      if (g.current + v > 99999999999)
        throw Error('Esse valor ultrapassa o limite da demonstração.');
      g.current += v;
    }
    persist();
    $('#adjust-dialog').close();
    render();
    toast(adjust.type === 'budget' ? 'Orçamento atualizado.' : 'Mais um passo para sua meta!');
  } catch (err) {
    $('#adjust-error').textContent = err.message;
  }
};
render();
