export function financeVisitKey(scope: string) {
  return `vertice:finance-visited:v1:${scope}`;
}

export function hasVisitedFinance(scope: string): boolean {
  try {
    return localStorage.getItem(financeVisitKey(scope)) === '1';
  } catch {
    return false;
  }
}

export function markFinanceVisited(scope: string): void {
  try {
    localStorage.setItem(financeVisitKey(scope), '1');
  } catch {
    // This is a presentation preference; storage failure must never block access.
  }
}
