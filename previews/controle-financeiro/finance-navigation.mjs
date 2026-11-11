export const planningViews = ['budget', 'fixed', 'goals'];
export const financeTitles = {
  overview: 'Início',
  transactions: 'Lançamentos',
  budget: 'Planejamento · Orçamentos',
  fixed: 'Planejamento · Contas fixas',
  goals: 'Planejamento · Metas',
  analysis: 'Análises',
  more: 'Mais',
  wealth: 'Mais · Patrimônio',
};
export function financeGroup(view) {
  return planningViews.includes(view) ? 'planning' : view === 'wealth' ? 'more' : view;
}
export function financeRoute(view) {
  if (planningViews.includes(view)) return 'planning/' + view;
  if (view === 'overview') return 'home';
  return view === 'wealth' ? 'more/wealth' : view;
}
export function financeView(route) {
  if (route === 'home') return 'overview';
  if (route === 'planning') return 'budget';
  if (route.startsWith('planning/') && planningViews.includes(route.slice(9)))
    return route.slice(9);
  if (route === 'more/wealth') return 'wealth';
  return Object.hasOwn(financeTitles, route) ? route : null;
}
