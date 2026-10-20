import Big from 'big.js';

export type BudgetStatus = 'none' | 'normal' | 'near' | 'reached' | 'exceeded';

export function parseBudgetInput(input: string): number | null {
  const value = input.trim().replace(',', '.');
  if (!value) return null;
  if (value.length > 100 || !/^\d+(?:\.\d{1,2})?$/.test(value))
    throw new Error('Informe um orçamento válido, com até duas casas decimais, sem separador de milhares.');
  const cents = new Big(value).times(100);
  if (cents.lte(0)) throw new Error('O orçamento deve ser maior que zero. Deixe em branco para remover o limite.');
  if (cents.gt(Number.MAX_SAFE_INTEGER)) throw new Error('O orçamento excede o limite permitido.');
  return cents.toNumber();
}

export function budgetInput(cents: number | null): string {
  return cents === null ? '' : new Big(cents).div(100).toFixed(2).replace('.', ',');
}

export function budgetSummary(budgetCents: number | null, spentCents: number) {
  if (!Number.isSafeInteger(spentCents) || spentCents < 0)
    throw new Error('Total gasto inválido.');
  if (budgetCents === null)
    return { status: 'none' as BudgetStatus, remainingCents: null, progressPercent: 0 };
  if (!Number.isSafeInteger(budgetCents) || budgetCents <= 0)
    throw new Error('Orçamento inválido.');
  const spent = new Big(spentCents);
  const status: BudgetStatus = spent.gt(budgetCents)
    ? 'exceeded'
    : spent.eq(budgetCents)
      ? 'reached'
      : spent.gte(new Big(budgetCents).times('0.8'))
        ? 'near'
        : 'normal';
  return {
    status,
    remainingCents: budgetCents - spentCents,
    progressPercent: Math.min(100, spent.div(budgetCents).times(100).toNumber()),
  };
}
