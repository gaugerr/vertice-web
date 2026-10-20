import { z } from 'zod';
import Big from 'big.js';
import type { ShoppingSnapshot } from '../../domain/models/shopping';
import { categorySchema, itemSchema, listSchema, nameSchema } from '../../domain/schemas/shopping';
import { legacyDate } from '../../shared/lib/date';
import { spentCents } from '../../domain/services/money';

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 50000;
const snapshotSchema = z
  .object({
    lists: z.array(listSchema).max(MAX_ROWS),
    categories: z.array(categorySchema).max(MAX_ROWS),
    items: z.array(itemSchema).max(MAX_ROWS),
  })
  .strict();
export interface BackupV3 extends ShoppingSnapshot {
  format: 'vertice-backup';
  version: 3;
  exportedAt: string;
}
export function validateSnapshot(input: unknown): ShoppingSnapshot {
  const data = snapshotSchema.parse(input);
  const unique = (rows: { id: string }[]) => {
    const ids = new Set(rows.map((row) => row.id));
    if (ids.size !== rows.length) throw new Error('O backup contém identificadores duplicados.');
    return ids;
  };
  const lists = unique(data.lists);
  unique(data.categories);
  unique(data.items);
  const categories = new Map(data.categories.map((c) => [c.id, c.shoppingListId]));
  for (const category of data.categories) {
    if (!lists.has(category.shoppingListId))
      throw new Error('O backup contém categoria sem lista.');
  }
  for (const item of data.items) {
    if (
      !lists.has(item.shoppingListId) ||
      categories.get(item.categoryId) !== item.shoppingListId
    ) {
      throw new Error('O backup contém item com relacionamento inválido.');
    }
  }
  // Reject imported totals that the monetary representation cannot safely sum.
  spentCents(data.items);
  return data;
}
const legacyId = z.number().int().positive().safe();
const legacySchema = z
  .object({
    format: z.literal('vertice-backup'),
    version: z.literal(1),
    exportedAt: z.string().optional(),
    lists: z
      .array(
        z
          .object({
            id: legacyId,
            storeName: nameSchema,
            date: z.number().int(),
            description: z.string().max(10000),
          })
          .strict(),
      )
      .max(MAX_ROWS),
    categories: z
      .array(z.object({ id: legacyId, title: nameSchema, shoppingListId: legacyId }).strict())
      .max(MAX_ROWS),
    items: z
      .array(
        z
          .object({
            id: legacyId,
            name: nameSchema,
            price: z.number().finite().nonnegative(),
            quantity: z.number().finite().positive(),
            unit: z.enum(['un', 'kg', 'L']),
            isPurchased: z.union([z.literal(0), z.literal(1)]),
            categoryId: legacyId,
            shoppingListId: legacyId,
          })
          .strict(),
      )
      .max(MAX_ROWS),
  })
  .strict();
function convertLegacy(input: unknown): ShoppingSnapshot {
  const data = legacySchema.parse(input);
  function remap(rows: { id: number }[]) {
    const map = new Map<number, string>();
    for (const row of rows) {
      if (map.has(row.id)) throw new Error('O backup contém identificadores duplicados.');
      map.set(row.id, crypto.randomUUID());
    }
    return map;
  }
  const lists = remap(data.lists),
    categories = remap(data.categories),
    items = remap(data.items);
  const reference = (map: Map<number, string>, id: number): string => {
    const value = map.get(id);
    if (!value) throw new Error('O backup contém referência inexistente.');
    return value;
  };
  const importedAt = Date.now();
  const now = new Date(importedAt).toISOString();
  const timestamps = { createdAt: now, updatedAt: now };
  return validateSnapshot({
    lists: data.lists.map((list) => ({
      ...list,
      id: reference(lists, list.id),
      date: legacyDate(list.date),
      budgetCents: null,
      ...timestamps,
    })),
    categories: data.categories.map((category, position) => ({
      ...category,
      id: reference(categories, category.id),
      shoppingListId: reference(lists, category.shoppingListId),
      position,
      ...timestamps,
    })),
    items: data.items.map(({ price, quantity, isPurchased, ...item }, index) => ({
      ...item,
      id: reference(items, item.id),
      shoppingListId: reference(lists, item.shoppingListId),
      categoryId: reference(categories, item.categoryId),
      unitPrice: new Big(String(price)).toFixed(),
      quantity: new Big(String(quantity)).toFixed(),
      isPurchased: isPurchased === 1,
      ...timestamps,
      // Legacy records have no creation time; keep their original sequence.
      createdAt: new Date(importedAt - data.items.length + index + 1).toISOString(),
    })),
  });
}
export function parseBackup(source: string): ShoppingSnapshot {
  if (new TextEncoder().encode(source).byteLength > MAX_BACKUP_BYTES)
    throw new Error('O arquivo excede 10 MiB.');
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    throw new Error('O arquivo não contém um JSON válido.');
  }
  const header = z
    .object({ format: z.literal('vertice-backup'), version: z.number().int() })
    .parse(raw);
  if (header.version === 1) return convertLegacy(raw);
  if (header.version === 2) {
    const old = z.object({
      format: z.literal('vertice-backup'),
      version: z.literal(2),
      exportedAt: z.iso.datetime(),
      ...snapshotSchema.shape,
      lists: z.array(listSchema.omit({ budgetCents: true })).max(MAX_ROWS),
    }).strict().parse(raw);
    return validateSnapshot({
      lists: old.lists.map((list) => ({ ...list, budgetCents: null })),
      categories: old.categories,
      items: old.items,
    });
  }
  if (header.version !== 3) throw new Error('Esta versão do backup não é compatível.');
  const backup = z
    .object({
      format: z.literal('vertice-backup'),
      version: z.literal(3),
      exportedAt: z.iso.datetime(),
      ...snapshotSchema.shape,
    })
    .strict()
    .parse(raw);
  return validateSnapshot({
    lists: backup.lists,
    categories: backup.categories,
    items: backup.items,
  });
}
export function encodeBackup(data: ShoppingSnapshot): string {
  const backup: BackupV3 = {
    format: 'vertice-backup',
    version: 3,
    exportedAt: new Date().toISOString(),
    ...validateSnapshot(data),
  };
  const result = JSON.stringify(backup, null, 2);
  if (new TextEncoder().encode(result).byteLength > MAX_BACKUP_BYTES)
    throw new Error('Os dados excedem o limite de 10 MiB do backup.');
  return result;
}
export function downloadBackup(source: string): void {
  const url = URL.createObjectURL(new Blob([source], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `vertice-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
