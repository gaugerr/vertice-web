export type Unit = 'un' | 'kg' | 'L';
export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}
export interface ShoppingList extends Timestamps {
  id: string;
  storeName: string;
  date: string;
  description: string;
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
}
export interface ItemInput {
  name: string;
  unitPrice: string;
  quantity: string;
  unit: Unit;
}
export const DEFAULT_CATEGORIES = [
  'Essenciais',
  'Hortifruti',
  'Higiene e Limpeza',
  'Padaria e Laticínios',
  'Carnes e Bebidas',
  'Outros',
] as const;
