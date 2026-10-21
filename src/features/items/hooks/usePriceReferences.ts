import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { repository } from '../../../app/services';
import { latestPriceReferences } from '../../../domain/services/price-history';

export function usePriceReferences(listId: string) {
  const result = useLiveQuery(async () => {
    try {
      return { records: await repository.getCompletedPriceReferences(listId), failed: false };
    } catch {
      return { records: [], failed: true };
    }
  }, [listId]);
  const references = useMemo(() => latestPriceReferences(result?.records ?? []), [result]);
  return { references, failed: result?.failed ?? false };
}
