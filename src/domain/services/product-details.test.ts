import { describe, expect, it } from 'vitest';
import {
  formatItemName,
  parseProductDetailsDraft,
  productDetailsDraft,
  productDetailsDirty,
  productDetailsPatch,
} from './product-details';
import { packageContentSchema } from '../schemas/shopping';
import { lineCents } from './money';

describe('product details', () => {
  it('formats all optional combinations without changing the base name', () => {
    const item = { name: 'Café', brand: null, packageContent: null };
    expect(formatItemName(item)).toBe('Café');
    expect(formatItemName({ ...item, brand: 'Marca X' })).toBe('Café · Marca X');
    expect(formatItemName({ ...item, packageContent: { amount: '500', unit: 'g' } })).toBe(
      'Café · 500 g',
    );
    expect(
      formatItemName({ ...item, brand: 'Marca X', packageContent: { amount: '0.5', unit: 'kg' } }),
    ).toBe('Café · Marca X · 0,5 kg');
    expect(item.name).toBe('Café');
  });
  it('normalizes valid content, keeps the chosen unit and supports whole package counts', () => {
    expect(
      parseProductDetailsDraft({ brand: ' Marca X ', amount: ' 00500,000 ', unit: 'g' }),
    ).toEqual({
      ok: true,
      details: { brand: 'Marca X', packageContent: { amount: '500', unit: 'g' } },
    });
    expect(packageContentSchema.parse({ amount: '12', unit: 'un' })).toEqual({
      amount: '12',
      unit: 'un',
    });
    expect(
      formatItemName({
        name: 'Leite',
        brand: null,
        packageContent: { amount: '1000', unit: 'ml' },
      }),
    ).toBe('Leite · 1000 ml');
  });
  it('rejects zero, negative, nonnumeric, grouped, overprecise and fractional-count inputs without throwing during preview', () => {
    for (const unit of ['g', 'un'] as const)
      for (const amount of ['0', '-1', 'abc', 'Infinity', '1.000,00', '1.0000', '9'.repeat(101)])
        expect(parseProductDetailsDraft({ brand: '', amount, unit }).ok).toBe(false);
    expect(parseProductDetailsDraft({ brand: '', amount: '1.5', unit: 'un' }).ok).toBe(false);
    expect(packageContentSchema.safeParse({ amount: '1', unit: 'oz' }).success).toBe(false);
    expect(parseProductDetailsDraft({ brand: 'x'.repeat(51), amount: '', unit: 'g' }).ok).toBe(
      false,
    );
  });
  it('treats empty details as absent and limits brand independently from the displayed name', () => {
    expect(parseProductDetailsDraft({ brand: ' ', amount: ' ', unit: 'L' })).toEqual({
      ok: true,
      details: { brand: null, packageContent: null },
    });
    const name = formatItemName({
      name: 'a'.repeat(50),
      brand: 'b'.repeat(50),
      packageContent: { amount: '1', unit: 'L' },
    });
    expect(name.length).toBeGreaterThan(100);
  });
  it('only patches edited metadata and explicitly clears removed fields', () => {
    const original = productDetailsDraft({
      brand: 'Marca X',
      packageContent: { amount: '0.5', unit: 'kg' },
    });
    expect(productDetailsPatch(original, { ...original })).toEqual({});
    expect(productDetailsPatch(original, { ...original, brand: '' })).toEqual({ brand: null });
    expect(productDetailsPatch(original, { ...original, amount: '' })).toEqual({
      packageContent: null,
    });
    const empty = productDetailsDraft({ brand: null, packageContent: null });
    expect(productDetailsDirty(empty, { ...empty, unit: 'L' })).toBe(false);
    expect(productDetailsPatch(empty, { ...empty, unit: 'L' })).toEqual({});
  });
  it('never multiplies a purchase by package content or changes billing by kg/L', () => {
    const item = {
      name: 'Café',
      brand: 'X',
      packageContent: { amount: '500', unit: 'g' as const },
      unitPrice: '18.90',
      quantity: '3',
    };
    expect(lineCents(item)).toBe(5670);
    expect(lineCents({ ...item, unitPrice: '8', quantity: '1.2' })).toBe(960);
  });
});
