import { createContext, createElement, useContext, type ReactNode } from 'react';
import type { ShoppingRepository } from '../domain/models/repository';
import { repository } from './services';

const RepositoryContext = createContext<ShoppingRepository | null>(null);
export const AccountScopeContext = createContext('legacy');
export function RepositoryProvider({
  value,
  scope,
  children,
}: {
  value: ShoppingRepository;
  scope: string;
  children: ReactNode;
}) {
  return createElement(
    AccountScopeContext.Provider,
    { value: scope },
    createElement(RepositoryContext.Provider, { value }, children),
  );
}
export function useRepository() {
  return useContext(RepositoryContext) ?? repository;
}
export function useAccountScope() {
  return useContext(AccountScopeContext);
}
