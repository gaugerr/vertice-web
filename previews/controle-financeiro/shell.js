import './app.js';
(() => {
  const menu = document.getElementById('app-menu');
  const toggle = document.getElementById('menu-toggle');
  const frame = document.getElementById('shopping-frame');
  const names = { shopping: 'Compras', finance: 'Financeiro', settings: 'Configurações' };
  const screens = {
    overview: 'Resumo',
    transactions: 'Lançamentos',
    fixed: 'Contas Fixas',
    budget: 'Orçamento',
    goals: 'Metas',
  };
  const key = 'vertice_navigation_preview_v1';
  let area = 'shopping',
    shoppingScreen = 'Minhas listas',
    financialView = 'overview';
  const openMenu = () => {
    menu.showModal();
    toggle.setAttribute('aria-expanded', 'true');
  };
  const closeMenu = () => {
    menu.close();
    toggle.setAttribute('aria-expanded', 'false');
  };
  function breadcrumb() {
    document
      .getElementById('area-shortcut')
      .replaceChildren(
        document.createTextNode(names[area] + ' '),
        Object.assign(document.createElement('span'), { textContent: '⌄' }),
      );
    document.getElementById('current-screen').textContent =
      area === 'finance'
        ? screens[financialView]
        : area === 'shopping'
          ? shoppingScreen
          : 'Dados do preview';
    document.title = `${names[area]} · Vértice Preview`;
  }
  function applyArea(next, save = true) {
    if (!Object.hasOwn(names, next)) next = 'shopping';
    area = next;
    document.body.className = 'area-' + next;
    document.getElementById('shopping-area').hidden = next !== 'shopping';
    document.getElementById('finance-area').hidden = next !== 'finance';
    document.getElementById('settings-area').hidden = next !== 'settings';
    document.getElementById('finance-tabs').hidden = next !== 'finance';
    document.getElementById('reset').hidden = next !== 'finance';
    menu.querySelectorAll('[data-area]').forEach((b) => {
      b.classList.toggle('active', b.dataset.area === next);
      if (b.dataset.area === next) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    breadcrumb();
    if (save) {
      try {
        localStorage.setItem(key, JSON.stringify({ area, financialView }));
      } catch {
        /* The navigation still works without storage. */
      }
    }
  }
  function navigate(next, destination) {
    applyArea(next);
    const hash =
      next === 'finance'
        ? 'financeiro/' + financialView
        : next === 'settings'
          ? 'configuracoes'
          : 'compras';
    if (location.hash !== '#' + hash) history.pushState({ area: next }, '', '#' + hash);
    if (destination)
      frame.contentWindow.postMessage(
        { type: 'vertice:shopping-navigate', path: destination },
        location.origin,
      );
    closeMenu();
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (next === 'shopping') frame.focus();
    else document.getElementById('main').focus({ preventScroll: true });
  }
  function readLocation() {
    const [part, tab] = location.hash.slice(1).split('/');
    if (part === 'financeiro' && Object.hasOwn(screens, tab)) {
      financialView = tab;
      window.dispatchEvent(
        new CustomEvent('vertice:finance-navigate', { detail: { view: financialView } }),
      );
    }
    applyArea(
      part === 'financeiro' ? 'finance' : part === 'configuracoes' ? 'settings' : 'shopping',
    );
  }
  toggle.addEventListener('click', openMenu);
  document.getElementById('area-shortcut').addEventListener('click', openMenu);
  document.getElementById('menu-close').addEventListener('click', closeMenu);
  menu.addEventListener('close', () => toggle.setAttribute('aria-expanded', 'false'));
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-area]');
    if (b) navigate(b.dataset.area);
    else if (e.target === menu) closeMenu();
  });
  window.addEventListener('vertice:finance-view', (e) => {
    financialView = e.detail.view;
    breadcrumb();
    if (area === 'finance') {
      try {
        localStorage.setItem(key, JSON.stringify({ area, financialView }));
      } catch {
        /* Optional state. */
      }
      history.replaceState({ area }, '', '#financeiro/' + financialView);
    }
  });
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== frame.contentWindow) return;
    if (e.data?.type === 'vertice:shopping-route' && typeof e.data.label === 'string') {
      shoppingScreen = e.data.label;
      breadcrumb();
    }
  });
  document
    .getElementById('shopping-settings')
    .addEventListener('click', () => navigate('shopping', '/settings'));
  document
    .getElementById('finance-reset')
    .addEventListener('click', () => document.getElementById('reset').click());
  window.addEventListener('popstate', readLocation);
  window.addEventListener('hashchange', readLocation);
  document.getElementById('main').tabIndex = -1;
  if (location.hash) readLocation();
  else {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && Object.hasOwn(names, saved.area)) {
        area = saved.area;
        if (Object.hasOwn(screens, saved.financialView)) {
          financialView = saved.financialView;
          window.dispatchEvent(
            new CustomEvent('vertice:finance-navigate', { detail: { view: financialView } }),
          );
        }
      }
    } catch {
      /* First visit. */
    }
    applyArea(area, false);
  }
})();
