export const planningViews = ['budget', 'fixed', 'goals'];
export const financeTitles = {
  overview: 'Resumo',
  transactions: 'Lançamentos',
  budget: 'Planejamento · Orçamentos',
  fixed: 'Planejamento · Contas fixas',
  goals: 'Planejamento · Metas',
  analysis: 'Análises',
  more: 'Mais',
  wealth: 'Mais · Patrimônio',
  wallets: 'Mais · Contas',
};
export function financeGroup(view) {
  return planningViews.includes(view)
    ? 'planning'
    : ['wealth', 'wallets'].includes(view)
      ? 'more'
      : view;
}
export function financeRoute(view) {
  if (planningViews.includes(view)) return 'planning/' + view;
  if (view === 'overview') return 'home';
  return ['wealth', 'wallets'].includes(view) ? 'more/' + view : view;
}
export function financeView(route) {
  if (route === 'home') return 'overview';
  if (route === 'planning') return 'budget';
  if (route.startsWith('planning/') && planningViews.includes(route.slice(9)))
    return route.slice(9);
  if (['more/wealth', 'more/wallets'].includes(route)) return route.slice(5);
  return Object.hasOwn(financeTitles, route) ? route : null;
}
