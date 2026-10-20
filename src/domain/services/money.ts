import Big from 'big.js';
import type { ShoppingItem } from '../models/shopping';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export function canonicalDecimal(input: string): string {
  const value = input.trim().replace(',', '.');
  if (value.length > 100 || !/^\d+(?:\.\d+)?$/.test(value)) {
    throw new Error('Informe um número válido, usando vírgula ou ponto para os decimais.');
  }
  return new Big(value).toFixed();
}
export function lineCents(item: Pick<ShoppingItem, 'unitPrice' | 'quantity'>): number {
  const cents = new Big(item.unitPrice).times(item.quantity).times(100).round(0, Big.roundHalfUp);
  if (cents.lt(0) || cents.gt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('O valor do item excede o limite permitido.');
  }
  return cents.toNumber();
}
export function spentCents(items: ShoppingItem[]): number {
  let total = 0;
  for (const item of items) {
    if (item.isPurchased) {
      total += lineCents(item);
      if (!Number.isSafeInteger(total)) throw new Error('O total excede o limite permitido.');
    }
  }
  return total;
}
export function formatMoney(cents: number): string {
  return currency.format(cents / 100);
}
export function decimalInput(value: string): string {
  return value.replace('.', ',');
}
