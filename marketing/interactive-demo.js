// Prévia independente: somente memória, sem acesso a compras, arquivos ou serviços.
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const reais = (cents) => currency.format(cents / 100);
  const decimal = (cents) => `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
  const percent = (value) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  // Ler centavos como inteiro; não multiplicar números decimais de dinheiro.
  function parseMoney(raw) {
    const value = raw.trim();
    if (!value) return 0;
    let normalized = value;
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value)) normalized = value.replaceAll('.', '');
    if (!/^\d{1,6}([,.]\d{0,2})?$/.test(normalized)) return null;
    const [whole, fraction = ''] = normalized.replace(',', '.').split('.');
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  }
  const productDefaults = [
    { name: 'Arroz', detail: '1 pacote · 5 kg', category: 'essenciais', cents: 1249, bought: true },
    { name: 'Leite', detail: '1 unidade · 1 L', category: 'essenciais', cents: 579, bought: true },
    { name: 'Banana', detail: '1 kg', category: 'hortifruti', cents: 690, bought: true },
    {
      name: 'Feijão',
      detail: '1 pacote · 1 kg',
      category: 'essenciais',
      cents: 749,
      bought: false,
    },
    {
      name: 'Café',
      detail: '1 pacote · 500 g',
      category: 'essenciais',
      cents: 1890,
      bought: false,
    },
  ];
  let products = productDefaults.map((item) => ({ ...item }));
  let appBudget = 7000;
  let appFilter = null;
  const appTotal = () => products.reduce((sum, item) => sum + (item.bought ? item.cents : 0), 0);
  const categories = [
    {
      key: 'moradia',
      label: 'Moradia',
      color: '#b39aff',
      initial: 132000,
      limit: 135000,
      payment: 'Pix',
    },
    {
      key: 'mercado',
      label: 'Mercado',
      color: '#b7edce',
      initial: 70715,
      limit: 75000,
      payment: 'Cartão de débito',
    },
    {
      key: 'contas',
      label: 'Contas',
      color: '#f1b7c8',
      initial: 23490,
      limit: 25000,
      payment: 'Boleto',
    },
    {
      key: 'outros',
      label: 'Outros',
      color: '#f4ca80',
      initial: 116410,
      limit: 150000,
      payment: 'Cartão de crédito',
    },
  ];
  let income = 450000;
  let expenses, limits, payments, paid;
  let goals = { target: 1200000, saved: 320000, monthly: 40000 };
  let selectedCategory = 'mercado';
  const resetFinanceState = () => {
    expenses = Object.fromEntries(categories.map((c) => [c.key, c.initial]));
    limits = Object.fromEntries(categories.map((c) => [c.key, c.limit]));
    payments = Object.fromEntries(categories.map((c) => [c.key, c.payment]));
    paid = Object.fromEntries(categories.map((c) => [c.key, true]));
  };
  resetFinanceState();

  function showValidation(scope) {
    const invalid = scope.querySelector('[aria-invalid="true"]');
    scope.querySelector('.demo-error').textContent = invalid
      ? 'Use um valor de 0 a 999.999,99, com até duas casas decimais. O último valor válido foi mantido.'
      : '';
  }
  function bindMoney(input, scope, setValue, render) {
    input.addEventListener('input', () => {
      const cents = parseMoney(input.value);
      input.setAttribute('aria-invalid', String(cents === null));
      if (cents !== null) {
        setValue(cents);
        render();
      }
      showValidation(scope);
    });
    input.addEventListener('blur', () => {
      const cents = parseMoney(input.value);
      if (cents !== null) input.value = decimal(cents);
    });
  }
  function renderApp() {
    const total = appTotal();
    $('#demo-total').textContent = reais(total);
    $('#app-count').textContent =
      `${products.filter((p) => p.bought).length} de ${products.length} itens comprados`;
    const progress = $('#app-budget-progress');
    progress.max = appBudget || 1;
    progress.value = Math.min(total, appBudget || 1);
    progress.setAttribute('aria-valuetext', `${reais(total)} de ${reais(appBudget)}`);
    const exceeded = total > appBudget;
    const near = appBudget > 0 && total >= appBudget * 0.8;
    const budgetColor = exceeded ? '#f0a3aa' : near ? '#f4ca80' : '#b7edce';
    progress.style.accentColor = budgetColor;
    progress.style.setProperty('--progress-color', budgetColor);
    $('#demo-remaining').textContent = exceeded
      ? `Passou ${reais(total - appBudget)} do orçamento.`
      : total === appBudget
        ? 'Você chegou ao orçamento.'
        : `${near ? 'Perto do limite. ' : ''}Ainda cabem ${reais(appBudget - total)}.`;
    for (const category of ['essenciais', 'hortifruti']) {
      const items = products.filter((p) => p.category === category);
      $(`[data-category-count="${category}"]`).textContent =
        `${items.filter((p) => p.bought).length}/${items.length} comprados`;
    }
    products.forEach((product, index) => {
      const row = $(`[data-product-row="${index}"]`);
      row.hidden = appFilter !== null && product.category !== appFilter;
      row.classList.toggle('is-bought', product.bought);
      row.querySelector('input[type="checkbox"]').checked = product.bought;
    });
  }
  $('#app-items').innerHTML = products
    .map(
      (p, i) =>
        `<div class="app-product" data-product-row="${i}"><label class="app-product-check"><input type="checkbox" data-product="${i}" ${p.bought ? 'checked' : ''} /><span>${p.name}<small>${p.detail}</small></span></label><label class="app-price"><span class="sr-only">Preço de ${p.name} em reais</span><input type="text" inputmode="decimal" maxlength="12" value="${decimal(p.cents)}" data-price="${i}" /></label></div>`,
    )
    .join('');
  $$('[data-product]').forEach((input) =>
    input.addEventListener('change', () => {
      products[Number(input.dataset.product)].bought = input.checked;
      renderApp();
    }),
  );
  $$('[data-price]').forEach((input) =>
    bindMoney(
      input,
      $('#demo-compra'),
      (value) => {
        products[Number(input.dataset.price)].cents = value;
      },
      renderApp,
    ),
  );
  bindMoney(
    $('#app-budget-input'),
    $('#demo-compra'),
    (value) => {
      appBudget = value;
    },
    renderApp,
  );
  function openAppItems(category) {
    appFilter = category;
    $('#app-categories').hidden = true;
    $('#app-items-view').hidden = false;
    $('#app-back').hidden = false;
    $('#app-items-title').textContent =
      category === 'essenciais'
        ? 'Essenciais'
        : category === 'hortifruti'
          ? 'Hortifruti'
          : 'Todos os itens';
    renderApp();
    $('#app-back').focus({ preventScroll: true });
  }
  $$('[data-category]').forEach((button) =>
    button.addEventListener('click', () => openAppItems(button.dataset.category)),
  );
  $('#show-app-items').addEventListener('click', () => openAppItems(null));
  $('#app-back').addEventListener('click', () => {
    $('#app-categories').hidden = false;
    $('#app-items-view').hidden = true;
    $('#app-back').hidden = true;
    $('#show-app-items').focus({ preventScroll: true });
  });
  $('#reset-app').addEventListener('click', () => {
    products = productDefaults.map((item) => ({ ...item }));
    appBudget = 7000;
    $('#app-budget-input').value = '70,00';
    $$('[data-price]').forEach((input) => {
      input.value = decimal(products[Number(input.dataset.price)].cents);
    });
    $('#demo-compra')
      .querySelectorAll('[aria-invalid]')
      .forEach((input) => input.removeAttribute('aria-invalid'));
    showValidation($('#demo-compra'));
    renderApp();
  });

  function syncInputs(selector, getValue) {
    $$(selector).forEach((input) => {
      if (input !== document.activeElement && input.getAttribute('aria-invalid') !== 'true')
        input.value = decimal(getValue(input));
    });
  }
  function bar(label, value, max, color, extra = '') {
    return `<button type="button" class="finance-bar" data-chart-label="${label}" data-chart-value="${value}" ${extra}><span>${label}</span><span class="finance-bar-track"><i style="width:${max ? Math.min(100, (value / max) * 100) : 0}%;background:${color}"></i></span><strong>${reais(value)}</strong></button>`;
  }
  function renderFinance() {
    const total = categories.reduce((sum, c) => sum + expenses[c.key], 0);
    const balance = income - total;
    $('#finance-income').textContent = reais(income);
    $('#finance-expenses').textContent = reais(total);
    $('#finance-balance').textContent = reais(balance);
    $('#finance-balance').classList.toggle('is-negative', balance < 0);
    $('#finance-savings').textContent = income ? percent((balance / income) * 100) : '—';
    $('#finance-pending').textContent = reais(
      categories.reduce((sum, c) => sum + (paid[c.key] ? 0 : expenses[c.key]), 0),
    );
    syncInputs('[data-expense]', (input) => expenses[input.dataset.expense]);
    const selected = categories.find((c) => c.key === selectedCategory);
    $('#donut-label').textContent = selected.label;
    $('#donut-amount').textContent = reais(expenses[selected.key]);
    $('#donut-percent').textContent = total
      ? `${percent((expenses[selected.key] / total) * 100)} do total`
      : 'Sem gastos neste exemplo';
    let angle = 0;
    const slices = categories.map((c) => {
      const start = angle;
      angle += total ? (expenses[c.key] / total) * 360 : 0;
      return `${c.color} ${start}deg ${angle}deg`;
    });
    $('#finance-donut').style.background = total
      ? `conic-gradient(${slices.join(',')})`
      : '#35313f';
    $('#finance-donut').setAttribute(
      'aria-label',
      `Gastos por categoria. ${categories.map((c) => `${c.label}: ${reais(expenses[c.key])}`).join('; ')}`,
    );
    $('#finance-legend').innerHTML = categories
      .map(
        (c) =>
          `<button type="button" data-select-category="${c.key}" aria-pressed="${c.key === selectedCategory}"><i style="background:${c.color}"></i><span>${c.label}</span><strong>${reais(expenses[c.key])}</strong></button>`,
      )
      .join('');
    $('#finance-flow').innerHTML =
      bar('Receitas', income, Math.max(income, total), '#b39aff') +
      bar('Despesas', total, Math.max(income, total), '#b7edce');
    $('#finance-flow-detail').textContent =
      balance >= 0
        ? `Sobram ${reais(balance)} neste mês de exemplo.`
        : `As despesas superam a receita em ${reais(-balance)}.`;
    const budgetMax = Math.max(...Object.values(limits), ...Object.values(expenses));
    $('#finance-budget-chart').innerHTML = categories
      .map(
        (c) =>
          `<div class="finance-pair"><button type="button" class="finance-pair-label" data-budget-category="${c.key}">${c.label}<span>${reais(expenses[c.key])} / ${reais(limits[c.key])}</span></button><div class="finance-pair-tracks" aria-hidden="true"><i style="width:${budgetMax ? (limits[c.key] / budgetMax) * 100 : 0}%;background:#b39aff"></i><i style="width:${budgetMax ? (expenses[c.key] / budgetMax) * 100 : 0}%;background:${expenses[c.key] > limits[c.key] ? '#f1b7c8' : '#b7edce'}"></i></div></div>`,
      )
      .join('');
    const grouped = new Map();
    categories.forEach((c) =>
      grouped.set(payments[c.key], (grouped.get(payments[c.key]) || 0) + expenses[c.key]),
    );
    $('#finance-payments').innerHTML = [...grouped]
      .map(([method, value], i) =>
        bar(method, value, Math.max(...grouped.values()), categories[i].color),
      )
      .join('');
    $('#finance-payment-detail').textContent =
      'Toque em uma forma de pagamento para ver sua participação.';
    categories.forEach((c) => {
      const used = expenses[c.key],
        limit = limits[c.key];
      $(`[data-limit-progress="${c.key}"]`).value = limit
        ? Math.min(100, (used / limit) * 100)
        : used
          ? 100
          : 0;
      $(`[data-limit-status="${c.key}"]`).textContent =
        `${reais(used)} gastos · ${used > limit ? `${reais(used - limit)} acima do limite` : `${reais(limit - used)} disponíveis`}`;
    });
  }
  function renderGoals() {
    const remaining = Math.max(0, goals.target - goals.saved);
    $('#goal-remaining').textContent = remaining
      ? `Faltam ${reais(remaining)}`
      : 'Meta alcançada neste exemplo';
    $('#goal-progress').value = goals.target
      ? Math.min(100, (goals.saved / goals.target) * 100)
      : 100;
    $('#goal-time').textContent = !remaining
      ? 'Você já tem o valor definido para sua meta.'
      : goals.monthly
        ? `Cerca de ${Math.ceil(remaining / goals.monthly)} meses guardando ${reais(goals.monthly)} por mês.`
        : 'Informe um valor mensal maior que zero para estimar o prazo.';
  }
  const financeScope = $('#finance-preview');
  bindMoney(
    $('#finance-income-input'),
    financeScope,
    (value) => {
      income = value;
    },
    renderFinance,
  );
  $$('[data-expense]').forEach((input) =>
    bindMoney(
      input,
      financeScope,
      (value) => {
        expenses[input.dataset.expense] = value;
      },
      renderFinance,
    ),
  );
  $$('[data-limit]').forEach((input) =>
    bindMoney(
      input,
      financeScope,
      (value) => {
        limits[input.dataset.limit] = value;
      },
      renderFinance,
    ),
  );
  $$('[data-goal]').forEach((input) =>
    bindMoney(
      input,
      financeScope,
      (value) => {
        goals[input.dataset.goal] = value;
      },
      renderGoals,
    ),
  );
  $$('[data-payment]').forEach((input) => {
    input.value = payments[input.dataset.payment];
    input.addEventListener('change', () => {
      payments[input.dataset.payment] = input.value;
      renderFinance();
    });
  });
  $$('[data-paid]').forEach((input) =>
    input.addEventListener('change', () => {
      paid[input.dataset.paid] = input.value === 'paid';
      renderFinance();
    }),
  );
  $('#finance-legend').addEventListener('click', (event) => {
    const button = event.target.closest('[data-select-category]');
    if (!button) return;
    selectedCategory = button.dataset.selectCategory;
    renderFinance();
    $(`[data-select-category="${selectedCategory}"]`).focus({ preventScroll: true });
  });
  for (const [selector, output] of [
    ['#finance-flow', '#finance-flow-detail'],
    ['#finance-payments', '#finance-payment-detail'],
  ]) {
    $(selector).addEventListener('click', (event) => {
      const button = event.target.closest('[data-chart-value]');
      if (!button) return;
      const value = Number(button.dataset.chartValue);
      const total = categories.reduce((sum, c) => sum + expenses[c.key], 0);
      $(output).textContent =
        `${button.dataset.chartLabel}: ${reais(value)}${selector === '#finance-payments' ? ` · ${total ? percent((value / total) * 100) : '0%'} das despesas` : ''}.`;
    });
  }
  $('#finance-budget-chart').addEventListener('click', (event) => {
    const button = event.target.closest('[data-budget-category]');
    if (!button) return;
    const key = button.dataset.budgetCategory;
    $('#finance-budget-detail').textContent =
      `${categories.find((c) => c.key === key).label}: limite de ${reais(limits[key])}, gasto de ${reais(expenses[key])}.`;
  });
  function selectTab(key, focus = false) {
    $$('[data-finance-tab]').forEach((tab) => {
      const selected = tab.dataset.financeTab === key;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      $(`#panel-${tab.dataset.financeTab}`).hidden = !selected;
      if (selected && focus) tab.focus({ preventScroll: true });
    });
  }
  const tabs = $$('[data-finance-tab]');
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.financeTab));
    tab.addEventListener('keydown', (event) => {
      let target;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target === undefined) return;
      event.preventDefault();
      selectTab(tabs[target].dataset.financeTab, true);
    });
  });
  $('#reset-finance').addEventListener('click', () => {
    income = 450000;
    selectedCategory = 'mercado';
    resetFinanceState();
    goals = { target: 1200000, saved: 320000, monthly: 40000 };
    financeScope
      .querySelectorAll('[aria-invalid]')
      .forEach((input) => input.removeAttribute('aria-invalid'));
    $('#finance-income-input').value = decimal(income);
    $$('[data-limit]').forEach((input) => {
      input.value = decimal(limits[input.dataset.limit]);
    });
    $$('[data-goal]').forEach((input) => {
      input.value = decimal(goals[input.dataset.goal]);
    });
    $$('[data-payment]').forEach((input) => {
      input.value = payments[input.dataset.payment];
    });
    $$('[data-paid]').forEach((input) => {
      input.value = 'paid';
    });
    showValidation(financeScope);
    renderFinance();
    renderGoals();
  });
  renderApp();
  renderFinance();
  renderGoals();
})();
