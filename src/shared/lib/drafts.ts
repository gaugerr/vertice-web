import {useEffect, useRef} from 'react';

const drafts = new Set<symbol>();
export function hasUnsavedChanges(): boolean {return drafts.size > 0}
export function useUnsavedChanges(dirty: boolean): void {
  const id = useRef(Symbol('draft'));
  useEffect(() => {
    const token = id.current;
    if (dirty) drafts.add(token);
    return () => {drafts.delete(token)};
  }, [dirty]);
}
