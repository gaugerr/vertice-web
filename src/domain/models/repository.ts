import type {
  Category,
  ItemInput,
  PurchaseDetails,
  ListInput,
  ShoppingItem,
  ShoppingList,
  ShoppingSnapshot,
} from './shopping';

export interface ShoppingRepository {
  getLists(): Promise<ShoppingList[]>;
  getList(id: string): Promise<ShoppingList | undefined>;
  getCategories(listId: string): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  getItemsForList(listId: string): Promise<ShoppingItem[]>;
  getItemsForCategory(categoryId: string): Promise<ShoppingItem[]>;
  createListWithCategories(input: ListInput): Promise<string>;
  updateList(id: string, input: ListInput): Promise<void>;
  deleteListCascade(id: string): Promise<void>;
  addItem(listId: string, categoryId: string, name: string): Promise<string>;
  updateItem(id: string, input: ItemInput): Promise<void>;
  updatePurchaseDetails(id: string, input: PurchaseDetails): Promise<void>;
  setPurchased(id: string, purchased: boolean): Promise<void>;
  deleteItem(id: string): Promise<void>;
  exportSnapshot(): Promise<ShoppingSnapshot>;
  replaceSnapshot(snapshot: ShoppingSnapshot): Promise<void>;
}
