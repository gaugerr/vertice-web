import { useMemo } from 'react';
import { repository } from '../../../app/services';
import { useQuery } from '../../../shared/hooks/useQuery';
import { matchSuggestions } from '../../../domain/services/item-suggestions';

export function useItemSuggestions(listId: string, query: string, enabled: boolean) {
  const history = useQuery(
    () => (enabled ? repository.getCompletedItemSuggestions(listId) : Promise.resolve([])),
    [listId, enabled],
  );
  const current = useQuery(
    () => (enabled ? repository.getItemsForList(listId) : Promise.resolve([])),
    [listId, enabled],
  );
  return useMemo(() => {
    if (!enabled || history.status !== 'ready' || current.status !== 'ready') return [];
    return matchSuggestions(history.data, current.data, query);
  }, [history, current, query, enabled]);
}
