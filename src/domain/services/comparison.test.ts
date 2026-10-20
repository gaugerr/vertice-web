import { describe, expect, it } from 'vitest';
import { comparePackages, type ComparisonMode, type PackagePair } from './comparison';

const clean = (value: string) => value.replace(/\s/g, ' ');
function ready(mode: ComparisonMode, pair: PackagePair) {
  const result = comparePackages(mode, pair);
  if (result.status !== 'ready') throw new Error(JSON.stringify(result));
  return result;
}
const weight: PackagePair = [{ price: '10,90', content: '500', unit: 'g' }, { price: '19,90', content: '1', unit: 'kg' }];

describe('package comparison', () => {
  it('compares mixed weight units and reports savings against the more expensive unit price', () => {
    const result = ready('weight', weight);
    expect(result.winner).toBe('B');
    expect(result.reference).toBe('kg');
    expect(result.unitPrices.map(clean)).toEqual(['R$ 21,80', 'R$ 19,90']);
    expect(clean(result.saving!)).toBe('R$ 1,90');
    expect(result.savingPercent).toBe('8,7%');
  });
  it('recognizes exact ties across different quantities without premature rounding', () => {
    const result = ready('weight', [{ price: '4', content: '0,25', unit: 'kg' }, { price: '8', content: '500', unit: 'g' }]);
    expect(result).toMatchObject({ winner: 'tie', saving: null, savingPercent: null });
  });
  it('compares milliliters and liters', () => {
    const result = ready('volume', [{ price: '6.99', content: '750', unit: 'ml' }, { price: '12,99', content: '1,5', unit: 'L' }]);
    expect(result.unitPrices.map(clean)).toEqual(['R$ 9,32', 'R$ 8,66']);
    expect(result).toMatchObject({ winner: 'B', reference: 'L', savingPercent: '7,1%' });
  });
  it('compares packs by whole unit counts', () => {
    const result = ready('units', [{ price: '11,90', content: '12', unit: 'un' }, { price: '21,90', content: '24', unit: 'un' }]);
    expect(result).toMatchObject({ winner: 'B', reference: 'un', savingPercent: '8,0%' });
    expect(clean(result.saving!)).toBe('R$ 0,08');
  });
  it('keeps a winner when displayed prices coincide, with an explicit sub-cent saving', () => {
    const result = ready('units', [{ price: '1', content: '3', unit: 'un' }, { price: '0,33', content: '1', unit: 'un' }]);
    expect(result.unitPrices.map(clean)).toEqual(['R$ 0,33', 'R$ 0,33']);
    expect(result).toMatchObject({ winner: 'B', saving: 'menos de R$ 0,01', savingPercent: '1,0%' });
  });
  it('compares ratios exactly even when finite decimal division would create a false tie', () => {
    const result = ready('units', [{ price: '1', content: '100000000000000000001', unit: 'un' }, { price: '1', content: '100000000000000000000', unit: 'un' }]);
    expect(result).toMatchObject({ winner: 'A', saving: 'menos de R$ 0,01', savingPercent: 'menos de 0,1%' });
    expect(result.unitPrices).toEqual(['menos de R$ 0,01', 'menos de R$ 0,01']);
  });
  it('formats a normalized price larger than the safe number range without losing cents', () => {
    const result = ready('weight', [{ price: '90071992547409.91', content: '0.001', unit: 'g' }, { price: '1', content: '1', unit: 'kg' }]);
    expect(clean(result.unitPrices[0])).toBe('R$ 90.071.992.547.409.910.000,00');
    expect(result.winner).toBe('B');
    expect(result.savingPercent).toBe('mais de 99,9%');
  });
  it.each(['0', '-1', '1,001', '1.000,00', 'NaN', 'Infinity', '1e3', '90071992547409.92', '1'.repeat(101)])('rejects price %s', (price) => {
    expect(comparePackages('weight', [{ ...weight[0], price }, weight[1]]).status).toBe('invalid');
  });
  it.each(['0', '-1', '0,0001', 'abc', '1e3'])('rejects content %s', (content) => {
    expect(comparePackages('weight', [{ ...weight[0], content }, weight[1]]).status).toBe('invalid');
  });
  it('never produces a result for missing fields, fractional unit counts or incompatible units', () => {
    expect(comparePackages('weight', [{ ...weight[0], price: '' }, weight[1]]).status).toBe('incomplete');
    expect(comparePackages('units', [{ price: '1', content: '1.5', unit: 'un' }, { price: '2', content: '2', unit: 'un' }]).status).toBe('invalid');
    expect(comparePackages('weight', [{ ...weight[0], unit: 'L' }, weight[1]]).status).toBe('invalid');
  });
});
