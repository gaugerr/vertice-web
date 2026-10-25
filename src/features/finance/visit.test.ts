import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasVisitedFinance, markFinanceVisited } from './visit';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('visita ao Financeiro', () => {
  it('preserva a preferência na conta correta sem afetar compras ou outra conta', () => {
    localStorage.setItem('outra-preferencia', 'preservar');
    markFinanceVisited('projeto:conta-a');
    expect(hasVisitedFinance('projeto:conta-a')).toBe(true);
    expect(hasVisitedFinance('projeto:conta-b')).toBe(false);
    expect(localStorage.getItem('outra-preferencia')).toBe('preservar');
  });

  it('continua utilizável se o navegador negar armazenamento', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(hasVisitedFinance('conta')).toBe(false);
    expect(() => markFinanceVisited('conta')).not.toThrow();
  });
});
