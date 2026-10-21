import type { ProductIdentity } from './price-history';
import { normalizeProductText, productIdentity } from './price-history';
import { formatItemName } from './product-details';

export type SuggestedProduct = ProductIdentity;
export interface ItemSuggestion extends SuggestedProduct {
  itemId: string;
  purchaseDate: string;
  completedAt: string;
  updatedAt: string;
}
export function suggestionKey(product: SuggestedProduct): string | null {
  return productIdentity(product, { allowIncomplete: true });
}
export function suggestionLabel(product: SuggestedProduct): string {
  return formatItemName(product) + (product.unit === 'un' ? '' : ` · por ${product.unit}`);
}
export function recentSuggestions(records: ItemSuggestion[]): ItemSuggestion[] {
  const order = (record: ItemSuggestion) => [record.purchaseDate, record.completedAt, record.updatedAt, record.itemId].join('|');
  const distinct = new Map<string, ItemSuggestion>();
  for (const record of records) {
    const key = suggestionKey(record);
    if (!key) continue;
    const previous = distinct.get(key);
    if (!previous || order(record) > order(previous)) distinct.set(key, record);
  }
  return [...distinct.values()].sort((a, b) => order(a) > order(b) ? -1 : order(a) < order(b) ? 1 : 0);
}
export function normalizeSuggestionSearch(text: string): string {
  return normalizeProductText(text).normalize('NFD').replace(/\p{M}/gu, '');
}
export function matchSuggestions(candidates: ItemSuggestion[], existing: SuggestedProduct[], query: string): ItemSuggestion[] {
  const search = normalizeSuggestionSearch(query);
  if (search.length < 2) return [];
  const present = new Set(existing.map(suggestionKey).filter((key) => key !== null));
  return candidates.filter((candidate) => normalizeSuggestionSearch(candidate.name).startsWith(search) && !present.has(suggestionKey(candidate)!)).slice(0, 3);
}
