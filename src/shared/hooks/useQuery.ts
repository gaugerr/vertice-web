import {useLiveQuery} from 'dexie-react-hooks';

export type QueryResult<T> = {status: 'loading'} | {status: 'error'; error: unknown} | {status: 'ready'; data: T};
export function useQuery<T>(query: () => Promise<T>, dependencies: unknown[]): QueryResult<T> {
  const result = useLiveQuery(async (): Promise<QueryResult<T>> => {
    try {return {status: 'ready', data: await query()}} catch (error) {return {status: 'error', error}}
  }, dependencies);
  return result ?? {status: 'loading'};
}
