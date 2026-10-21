import type { ItemSuggestion, SuggestedProduct } from '../services/item-suggestions';
import type { PriceReference } from '../services/price-history';
import type {
  Category,
  ItemInput,
  PurchaseDetails,
  ListInput,
  ShoppingItem,
  ShoppingList,
  ShoppingSnapshot,
  CompletionInput,
  ListReview,
} from './shopping';

export interface ShoppingRepository {
  getCompletedItemSuggestions(excludeListId: string): Promise<ItemSuggestion[]>;
  addSuggestedItem(listId: string, categoryId: string, product: SuggestedProduct): Promise<string>;
  getCompletedPriceReferences(excludeListId: string): Promise<PriceReference[]>;
  getLists(): Promise<ShoppingList[]>;
  getListSummaries(): Promise<{ list: ShoppingList; totalCents: number }[]>;
  getList(id: string): Promise<ShoppingList | undefined>;
  getListReview(id: string): Promise<ListReview>;
  completeList(id: string, input: CompletionInput, expectedRevision: string): Promise<void>;
  reopenList(id: string): Promise<void>;
  duplicateList(sourceId: string, input: ListInput): Promise<string>;
  getCategories(listId: string): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  getItemsForList(listId: string): Promise<ShoppingItem[]>;
  getItemsForCategory(categoryId: string): Promise<ShoppingItem[]>;
  createListWithCategories(input: ListInput): Promise<string>;
  updateList(id: string, input: ListInput): Promise<void>;
  setListBudget(id: string, budgetCents: number | null): Promise<void>;
  deleteListCascade(id: string): Promise<void>;
  addItem(listId: string, categoryId: string, name: string): Promise<string>;
  updateItem(id: string, input: ItemInput): Promise<void>;
  updatePurchaseDetails(id: string, input: PurchaseDetails): Promise<void>;
  setPurchased(id: string, purchased: boolean): Promise<void>;
  deleteItem(id: string): Promise<void>;
  exportSnapshot(): Promise<ShoppingSnapshot>;
  replaceSnapshot(snapshot: ShoppingSnapshot): Promise<void>;
}
