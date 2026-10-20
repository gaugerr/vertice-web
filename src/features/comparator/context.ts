import { createContext, useContext } from 'react';

export const OpenComparisonContext = createContext<(() => void) | null>(null);
export function useOpenComparison() {
  const open = useContext(OpenComparisonContext);
  if (!open) throw new Error('O comparador não foi inicializado.');
  return open;
}
