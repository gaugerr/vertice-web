import Big from 'big.js';
import type { ShoppingItem } from '../models/shopping';
import { brandSchema, nameSchema, packageContentSchema } from '../schemas/shopping';
import { canonicalDecimal } from './money';

export interface PriceReference {
  productKey: string;
  itemId: string;
  unitPrice: string;
  purchaseDate: string;
  completedAt: string;
  updatedAt: string;
  marketName: string | null;
}
export type ProductIdentity = Pick<ShoppingItem, 'name' | 'brand' | 'packageContent' | 'unit'>;
const normalize = (value: string) => value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR');

export function productIdentity(input: ProductIdentity): string | null {
  const name = nameSchema.safeParse(input.name);
  const brand = brandSchema.safeParse(input.brand);
  const content = packageContentSchema.safeParse(input.packageContent);
  if (!name.success || !brand.success || !brand.data || !content.success) return null;
  const { amount, unit } = content.data;
  const dimension = unit === 'g' || unit === 'kg' ? 'mass' : unit === 'ml' || unit === 'L' ? 'volume' : 'count';
  const normalizedAmount = new Big(amount).times(unit === 'kg' || unit === 'L' ? 1000 : 1).toFixed();
  return JSON.stringify([normalize(name.data), normalize(brand.data), dimension, normalizedAmount, input.unit]);
}

export function latestPriceReferences(records: PriceReference[]): Map<string, PriceReference> {
  const result = new Map<string, PriceReference>();
  const order = (record: PriceReference) => [record.purchaseDate, record.completedAt, record.updatedAt, record.itemId].join('|');
  for (const record of records) {
    const previous = result.get(record.productKey);
    if (!previous || order(record) > order(previous)) result.set(record.productKey, record);
  }
  return result;
}

export function priceCents(price: string): bigint {
  return BigInt(new Big(price).times(100).round(0, Big.roundHalfUp).toFixed(0));
}
export function priceDifference(current: string, previous: string): bigint | null {
  try {
    const value = canonicalDecimal(current);
    if (!new Big(value).gt(0)) return null;
    return priceCents(value) - priceCents(previous);
  } catch {
    return null;
  }
}
