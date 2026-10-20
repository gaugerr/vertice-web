import { describe, expect, it } from 'vitest';
import type { ShoppingItem } from '../models/shopping';
import { canonicalDecimal, formatMoney, lineCents, spentCents } from './money';
import { itemInputSchema, listInputSchema } from '../schemas/shopping';

describe('decimal arithmetic', () => {
  it.each([
    ['20', '0.5', 1000],
    ['4', '2', 800],
    ['3.5', '3', 1050],
    ['1.99', '0.333', 66],
    ['0.005', '1', 1],
    ['0.1', '0.2', 2],
  ])('multiplies %s by %s to %i cents', (unitPrice, quantity, expected) => {
    expect(lineCents({ unitPrice, quantity })).toBe(expected);
  });
  it('sums rounded line amounts and excludes pending items', () => {
    const items = [
      { unitPrice: '0.005', quantity: '1', isPurchased: true },
      { unitPrice: '0.005', quantity: '1', isPurchased: true },
      { unitPrice: '100', quantity: '1', isPurchased: false },
    ] as ShoppingItem[];
    expect(spentCents(items)).toBe(2);
  });
  it('normalizes Brazilian decimals without accepting ambiguous grouping', () => {
    expect(canonicalDecimal(' 00,500 ')).toBe('0.5');
    expect(() => canonicalDecimal('1.234,56')).toThrow();
    expect(() => canonicalDecimal('Infinity')).toThrow();
    expect(() => canonicalDecimal('-1')).toThrow();
    expect(formatMoney(1250).replace(/\s/g, ' ')).toBe('R$ 12,50');
  });
  it('rejects unsafe item and aggregate totals', () => {
    expect(() => lineCents({ unitPrice: '9999999999999999', quantity: '1' })).toThrow();
    expect(() =>
      spentCents(
        Array.from({ length: 2 }, () => ({
          unitPrice: '90071992547409.91',
          quantity: '1',
          isPurchased: true,
        })) as ShoppingItem[],
      ),
    ).toThrow();
  });
  it('validates names, civil dates and positive quantities', () => {
    expect(
      listInputSchema.parse({ storeName: ' Mercado ', date: '2028-02-29', description: '' })
        .storeName,
    ).toBe('Mercado');
    expect(
      listInputSchema.safeParse({ storeName: ' ', date: '2026-02-29', description: '' }).success,
    ).toBe(false);
    expect(
      itemInputSchema.safeParse({ name: 'Arroz', unitPrice: '-1', quantity: '1', unit: 'kg' })
        .success,
    ).toBe(false);
    expect(
      itemInputSchema.safeParse({ name: 'Arroz', unitPrice: '0', quantity: '0', unit: 'kg' })
        .success,
    ).toBe(false);
  });
});
