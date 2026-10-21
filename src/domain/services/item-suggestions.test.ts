import { describe, expect, it } from 'vitest';
import {
  matchSuggestions,
  recentSuggestions,
  suggestionKey,
  suggestionLabel,
  type ItemSuggestion,
} from './item-suggestions';
import { productIdentity } from './price-history';
const product: ItemSuggestion = {
  name: 'Café',
  brand: 'Melitta',
  packageContent: { amount: '500', unit: 'g' },
  unit: 'un',
  itemId: 'a',
  purchaseDate: '2026-10-12',
  completedAt: '2026-10-12T12:00:00.000Z',
  updatedAt: '2026-10-12T11:00:00.000Z',
};
describe('compact historical suggestions', () => {
  it('deduplicates full and incomplete identities without merging distinct products or weakening price history', () => {
    const equivalent = {
      ...product,
      itemId: 'b',
      name: ' CAFE\u0301 ',
      brand: ' melitta ',
      packageContent: { amount: '0.5', unit: 'kg' as const },
    };
    expect(suggestionKey(equivalent)).toBe(suggestionKey(product));
    const generic = { ...product, itemId: 'c', brand: null, packageContent: null };
    expect(suggestionKey(generic)).not.toBeNull();
    expect(productIdentity(generic)).toBeNull();
    expect(recentSuggestions([product, equivalent, generic])).toEqual([generic, equivalent]);
    expect(suggestionKey({ ...product, brand: 'Pilão' })).not.toBe(suggestionKey(product));
    expect(suggestionKey({ ...generic, name: 'Arroz' })).not.toBe(suggestionKey(generic));
    expect(suggestionKey({ ...product, unit: 'kg' })).not.toBe(suggestionKey(product));
    expect(suggestionKey({ ...product, packageContent: { amount: '0', unit: 'g' } })).toBeNull();
  });
  it('orders deterministically by purchase, completion, item update and id', () => {
    const records = [
      product,
      { ...product, itemId: 'b' },
      { ...product, itemId: 'c', updatedAt: '2026-10-12T11:01:00.000Z' },
      { ...product, itemId: 'd', completedAt: '2026-10-13T12:00:00.000Z' },
      { ...product, itemId: 'e', purchaseDate: '2026-10-14' },
    ];
    for (let n = 1; n <= records.length; n++)
      expect(recentSuggestions(records.slice(0, n).reverse())).toEqual([records[n - 1]]);
  });
  it('matches name prefixes accent-insensitively, limits results and excludes exact products already present', () => {
    const candidates = recentSuggestions(
      ['A', 'B', 'C', 'D'].map((brand, index) => ({ ...product, brand, itemId: String(index) })),
    );
    expect(matchSuggestions(candidates, [], 'c')).toEqual([]);
    expect(matchSuggestions(candidates, [], ' CAFE ')).toEqual(candidates.slice(0, 3));
    expect(matchSuggestions(candidates, [], 'Melitta')).toEqual([]);
    expect(matchSuggestions(candidates, [], 'af')).toEqual([]);
    expect(matchSuggestions(candidates, [candidates[0]], 'ca')).toEqual(candidates.slice(1));
    expect(
      matchSuggestions(candidates, [{ ...product, brand: null, packageContent: null }], 'ca'),
    ).toHaveLength(3);
  });
  it('keeps the concise label useful for incomplete products and non-unit billing', () => {
    expect(suggestionLabel(product)).toBe('Café · Melitta · 500 g');
    expect(suggestionLabel({ ...product, brand: null, packageContent: null })).toBe('Café');
    expect(suggestionLabel({ ...product, unit: 'kg' })).toBe('Café · Melitta · 500 g · por kg');
  });
});
