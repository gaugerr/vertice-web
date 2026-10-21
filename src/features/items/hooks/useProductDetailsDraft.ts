import { useState } from 'react';
import type { ShoppingItem } from '../../../domain/models/shopping';
import { parseProductDetailsDraft, productDetailsDirty, productDetailsDraft, productDetailsPatch } from '../../../domain/services/product-details';

export function useProductDetailsDraft(item: Pick<ShoppingItem, 'brand' | 'packageContent'>) {
  const [initial] = useState(() => productDetailsDraft(item));
  const [draft, setDraft] = useState(initial);
  const [showErrors, setShowErrors] = useState(false);
  const parsed = parseProductDetailsDraft(draft);
  const errors: { brand?: string; amount?: string } = showErrors && !parsed.ok ? parsed.errors : {};
  return {
    draft, setDraft, parsed, dirty: productDetailsDirty(initial, draft),
    errors,
    getPatch() { setShowErrors(true); return productDetailsPatch(initial, draft); },
  };
}
export type ProductDetailsFormDraft = ReturnType<typeof useProductDetailsDraft>;
