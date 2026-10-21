export type Unit = 'un' | 'kg' | 'L';
export type PackageUnit = 'g' | 'kg' | 'ml' | 'L' | 'un';
export interface PackageContent {
  amount: string;
  unit: PackageUnit;
}
export const EMPTY_PRODUCT_DETAILS = { brand: null, packageContent: null };
export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}
export interface ShoppingList extends Timestamps {
  id: string;
  storeName: string;
  date: string;
  description: string;
  budgetCents: number | null;
  status: 'active' | 'completed';
  completedAt: string | null;
  purchaseDate: string | null;
  marketName: string | null;
}
export interface Category extends Timestamps {
  id: string;
  shoppingListId: string;
  title: string;
  position: number;
}
export interface ShoppingItem extends Timestamps {
  id: string;
  shoppingListId: string;
  categoryId: string;
  name: string;
  unitPrice: string;
  quantity: string;
  unit: Unit;
  isPurchased: boolean;
  brand: string | null;
  packageContent: PackageContent | null;
}
export interface ShoppingSnapshot {
  lists: ShoppingList[];
  categories: Category[];
  items: ShoppingItem[];
}
export interface ListInput {
  storeName: string;
  date: string;
  description: string;
  budgetCents: number | null;
}
export interface CompletionInput {
  purchaseDate: string;
  marketName: string | null;
}
export interface ListReview {
  list: ShoppingList;
  categories: Category[];
  items: ShoppingItem[];
  totalCents: number;
  purchasedCount: number;
  pendingCount: number;
  revision: string;
}
export const ACTIVE_PURCHASE = {
  status: 'active' as const,
  completedAt: null,
  purchaseDate: null,
  marketName: null,
};
export interface ItemInput {
  name: string;
  unitPrice: string;
  quantity: string;
  unit: Unit;
  brand?: string | null;
  packageContent?: PackageContent | null;
}
export type PurchaseDetails = Pick<
  ItemInput,
  'unitPrice' | 'quantity' | 'unit' | 'brand' | 'packageContent'
>;
export const DEFAULT_CATEGORIES = [
  'Essenciais',
  'Hortifruti',
  'Higiene e Limpeza',
  'Padaria e Laticínios',
  'Carnes e Bebidas',
  'Outros',
] as const;
