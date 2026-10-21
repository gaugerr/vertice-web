import type { PackageContent, PackageUnit, ShoppingItem } from '../models/shopping';
import { brandSchema, packageContentSchema } from '../schemas/shopping';
import { decimalInput } from './money';

export const PACKAGE_UNITS: PackageUnit[] = ['g', 'kg', 'ml', 'L', 'un'];
export type ProductDetails = Pick<ShoppingItem, 'brand' | 'packageContent'>;
export interface ProductDetailsDraft {
  brand: string;
  amount: string;
  unit: PackageUnit;
}

export function formatPackageContent(content: PackageContent): string {
  return `${decimalInput(content.amount)} ${content.unit}`;
}
export function formatItemName(
  item: Pick<ShoppingItem, 'name' | 'brand' | 'packageContent'>,
): string {
  return [
    item.name,
    item.brand,
    item.packageContent ? formatPackageContent(item.packageContent) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
export function productDetailsDraft(item: ProductDetails): ProductDetailsDraft {
  return {
    brand: item.brand ?? '',
    amount: item.packageContent ? decimalInput(item.packageContent.amount) : '',
    unit: item.packageContent?.unit ?? 'g',
  };
}
export function parseProductDetailsDraft(
  draft: ProductDetailsDraft,
):
  | { ok: true; details: ProductDetails }
  | { ok: false; errors: { brand?: string; amount?: string } } {
  const brand = brandSchema.safeParse(draft.brand);
  const content = packageContentSchema
    .nullable()
    .safeParse(draft.amount.trim() ? { amount: draft.amount, unit: draft.unit } : null);
  if (!brand.success || !content.success)
    return {
      ok: false,
      errors: {
        ...(!brand.success ? { brand: brand.error.issues[0].message } : {}),
        ...(!content.success ? { amount: content.error.issues[0].message } : {}),
      },
    };
  return { ok: true, details: { brand: brand.data, packageContent: content.data } };
}
export function productDetailsDirty(
  original: ProductDetailsDraft,
  draft: ProductDetailsDraft,
): boolean {
  return (
    draft.brand !== original.brand ||
    draft.amount !== original.amount ||
    (draft.amount.trim() !== '' && draft.unit !== original.unit)
  );
}
export function productDetailsPatch(
  original: ProductDetailsDraft,
  draft: ProductDetailsDraft,
): Partial<ProductDetails> {
  const parsed = parseProductDetailsDraft(draft);
  if (!parsed.ok) throw new Error(parsed.errors.brand ?? parsed.errors.amount);
  return {
    ...(draft.brand !== original.brand ? { brand: parsed.details.brand } : {}),
    ...(draft.amount !== original.amount ||
    (draft.amount.trim() !== '' && draft.unit !== original.unit)
      ? { packageContent: parsed.details.packageContent }
      : {}),
  };
}
