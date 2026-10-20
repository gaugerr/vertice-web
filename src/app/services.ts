import type { ShoppingRepository } from '../domain/models/repository';
import { VerticeDatabase } from '../data/database/database';
import { DexieShoppingRepository } from '../data/repositories/dexie-shopping-repository';

const database = new VerticeDatabase();
export const repository: ShoppingRepository = new DexieShoppingRepository(database);
