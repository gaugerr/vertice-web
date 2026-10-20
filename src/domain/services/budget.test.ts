import { describe, expect, it } from 'vitest';
import type { ShoppingItem } from '../models/shopping';
import { budgetInput, budgetSummary, parseBudgetInput } from './budget';
import { spentCents } from './money';

describe('list budgets', () => {
  it('accepts optional Brazilian amounts without silently rounding or accepting unsafe cents', () => {
    expect(parseBudgetInput(' ')).toBeNull();
    expect(parseBudgetInput(' 300,50 ')).toBe(30050);
    expect(parseBudgetInput('300.5')).toBe(30050);
    expect(parseBudgetInput('0,01')).toBe(1);
    expect(parseBudgetInput('90071992547409.91')).toBe(Number.MAX_SAFE_INTEGER);
    for (const input of ['0', '-1', '1,001', '1.000,00', 'Infinity', 'abc', '90071992547409.92'])
      expect(() => parseBudgetInput(input)).toThrow();
    expect(budgetInput(null)).toBe('');
    expect(budgetInput(30050)).toBe('300,50');
  });
  it.each([
    [0, 'normal', 10000], [7999, 'normal', 2001], [8000, 'near', 2000],
    [9999, 'near', 1], [10000, 'reached', 0], [10001, 'exceeded', -1],
  ])('uses the exact status for %i cents spent', (spent, status, remainingCents) => {
    const summary = budgetSummary(10000, spent);
    expect(summary).toMatchObject({ status, remainingCents });
    expect(summary.progressPercent).toBe(Math.min(100, spent / 100));
  });
  it('has no warnings without a limit and uses only committed purchased amounts', () => {
    expect(budgetSummary(null, 900)).toMatchObject({ status: 'none', remainingCents: null });
    const items = [
      { unitPrice: '10', quantity: '0.5', isPurchased: true },
      { unitPrice: '999', quantity: '1', isPurchased: false },
    ] as ShoppingItem[];
    expect(budgetSummary(1000, spentCents(items))).toMatchObject({ remainingCents: 500, status: 'normal' });
  });
  it('compares large threshold values without overflowing integer multiplication', () => {
    const budget = Number.MAX_SAFE_INTEGER;
    expect(budgetSummary(budget, 7205759403792792).status).toBe('normal');
    expect(budgetSummary(budget, 7205759403792793).status).toBe('near');
    expect(() => budgetSummary(0, 0)).toThrow();
  });
});
