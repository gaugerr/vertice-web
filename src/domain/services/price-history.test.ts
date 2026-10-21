import { describe, expect, it } from 'vitest';
import { latestPriceReferences, priceCents, priceDifference, productIdentity, type PriceReference } from './price-history';
const product = { name: 'Café', brand: 'Marca X', packageContent: { amount: '500', unit: 'g' as const }, unit: 'un' as const };
const record: PriceReference = { productKey: productIdentity(product)!, itemId: 'a', unitPrice: '18.9', purchaseDate: '2026-10-12', completedAt: '2026-10-12T12:00:00.000Z', updatedAt: '2026-10-12T11:00:00.000Z', marketName: 'Mercado X' };
describe('last price identity and arithmetic', () => {
  it('normalizes whitespace, case and Unicode without fuzzy matching', () => {
    expect(productIdentity({ ...product, name: '  CAFE\u0301  ', brand: ' marca   x ' })).toBe(productIdentity(product));
    for (const name of ['Cafe', 'Café extraforte']) expect(productIdentity({ ...product, name })).not.toBe(productIdentity(product));
    expect(productIdentity({ ...product, brand: 'Marca Y' })).not.toBe(productIdentity(product));
  });
  it('recognizes equivalent packages but keeps dimensions, sizes and billing units separate', () => {
    expect(productIdentity({ ...product, packageContent: { amount: '0,5', unit: 'kg' } })).toBe(productIdentity(product));
    const volume = { ...product, packageContent: { amount: '1', unit: 'L' as const } };
    expect(productIdentity(volume)).toBe(productIdentity({ ...product, packageContent: { amount: '1000', unit: 'ml' } }));
    for (const content of [{ amount: '500', unit: 'ml' as const }, { amount: '500', unit: 'un' as const }, { amount: '250', unit: 'g' as const }]) expect(productIdentity({ ...product, packageContent: content })).not.toBe(productIdentity(product));
    expect(productIdentity({ ...product, unit: 'kg' })).not.toBe(productIdentity(product));
  });
  it('requires complete valid details, including whole package counts', () => {
    for (const patch of [{ brand: null }, { brand: ' ' }, { name: '' }, { packageContent: null }, { packageContent: { amount: '0', unit: 'g' as const } }, { packageContent: { amount: '1.5', unit: 'un' as const } }]) expect(productIdentity({ ...product, ...patch })).toBeNull();
  });
  it('orders by purchase date, completion, item update and id regardless of input order', () => {
    const records = [record, { ...record, itemId: 'b' }, { ...record, itemId: 'c', updatedAt: '2026-10-12T11:01:00.000Z' }, { ...record, itemId: 'd', completedAt: '2026-10-13T12:00:00.000Z' }, { ...record, itemId: 'e', purchaseDate: '2026-10-14' }];
    for (let n = 1; n <= records.length; n++) {
      const candidates = records.slice(0, n);
      expect(latestPriceReferences(candidates).get(record.productKey)).toEqual(candidates[n - 1]);
      expect(latestPriceReferences(candidates.reverse()).get(record.productKey)).toEqual(records[n - 1]);
    }
  });
  it('compares unit prices with exact cents, independently of quantities', () => {
    expect(priceDifference('20,90', '18.9')).toBe(200n);
    expect(priceDifference('16,90', '18.9')).toBe(-200n);
    expect(priceDifference('18.90', '18.9')).toBe(0n);
    expect(priceDifference('18.904', '18.901')).toBe(0n);
    expect(priceCents('1.005')).toBe(101n);
    expect(priceDifference('9007199254740992.99', '9007199254740992.98')).toBe(1n);
    for (const input of ['', '0', '-1', 'abc', '1,', '1.2.3']) expect(priceDifference(input, '18.9')).toBeNull();
  });
});
