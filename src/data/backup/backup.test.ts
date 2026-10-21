import { describe, expect, it } from 'vitest';
import { encodeBackup, MAX_BACKUP_BYTES, parseBackup, validateSnapshot } from './backup';
import { spentCents } from '../../domain/services/money';

const legacy = {
  format: 'vertice-backup',
  version: 1,
  lists: [
    { id: 1, storeName: 'Mercado', date: new Date(2026, 9, 19, 12).valueOf(), description: '' },
  ],
  categories: [{ id: 8, shoppingListId: 1, title: 'Essenciais' }],
  items: [
    {
      id: 10,
      name: 'Arroz',
      price: 20,
      quantity: 0.5,
      unit: 'kg',
      isPurchased: 1,
      categoryId: 8,
      shoppingListId: 1,
    },
  ],
};
describe('backups', () => {
  it('reads old web backups with no budget and exports the new version without changing IDs', () => {
    const data = parseBackup(JSON.stringify(legacy));
    const old = {
      format: 'vertice-backup',
      version: 2,
      exportedAt: new Date().toISOString(),
      ...data,
      lists: data.lists.map((list) => ({
        id: list.id,
        storeName: list.storeName,
        date: list.date,
        description: list.description,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
      })),
    };
    const imported = parseBackup(JSON.stringify(old));
    expect(imported).toEqual(data);
    expect(imported.lists[0].budgetCents).toBeNull();
    imported.lists[0].budgetCents = 30000;
    const encoded = encodeBackup(imported);
    expect(JSON.parse(encoded).version).toBe(4);
    expect(parseBackup(encoded)).toEqual(imported);
    for (const budget of [0, -100, 1.5, '30000', Number.MAX_SAFE_INTEGER + 1]) {
      const invalid = JSON.parse(encoded);
      invalid.lists[0].budgetCents = budget;
      expect(() => parseBackup(JSON.stringify(invalid))).toThrow();
    }
  });
  it('maps legacy IDs consistently and preserves financial values and local dates', () => {
    const data = parseBackup(JSON.stringify(legacy));
    expect(data.lists[0].id).not.toBe('1');
    expect(data.categories[0].shoppingListId).toBe(data.lists[0].id);
    expect(data.items[0].categoryId).toBe(data.categories[0].id);
    expect(data.items[0]).toMatchObject({ unitPrice: '20', quantity: '0.5', isPurchased: true });
    expect(data.lists[0].date).toBe('2026-10-19');
    expect(data.lists[0].budgetCents).toBeNull();
    expect(spentCents(data.items)).toBe(1000);
    expect(parseBackup(encodeBackup(data))).toEqual(data);
  });
  it('preserves legacy fractional unit prices without premature rounding', () => {
    const data = structuredClone(legacy);
    data.items[0].price = 0.005;
    data.items[0].quantity = 1;
    expect(spentCents(parseBackup(JSON.stringify(data)).items)).toBe(1);
  });
  it('imports the frozen v3 shape and round trips completed purchases in v4', () => {
    const data = parseBackup(JSON.stringify(legacy));
    const old = {
      format: 'vertice-backup',
      version: 3,
      exportedAt: new Date().toISOString(),
      ...data,
      lists: data.lists.map((list) => ({
        id: list.id,
        storeName: list.storeName,
        date: list.date,
        description: list.description,
        budgetCents: list.budgetCents,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
      })),
    };
    const imported = parseBackup(JSON.stringify(old));
    expect(imported).toEqual(data);
    Object.assign(imported.lists[0], {
      status: 'completed',
      completedAt: '2026-10-21T12:00:00.000Z',
      purchaseDate: '2026-10-20',
      marketName: 'Mercado A',
    });
    expect(parseBackup(encodeBackup(imported))).toEqual(imported);
    for (const patch of [
      { completedAt: null },
      { purchaseDate: null },
      { status: 'unknown' },
      { marketName: 'x'.repeat(51) },
    ]) {
      const invalid = structuredClone(imported);
      Object.assign(invalid.lists[0], patch);
      expect(() => encodeBackup(invalid)).toThrow();
    }
    const empty = structuredClone(imported);
    empty.items = [];
    expect(() => encodeBackup(empty)).toThrow();
    const zero = structuredClone(imported);
    zero.items[0].unitPrice = '0';
    expect(() => encodeBackup(zero)).toThrow();
  });
  it('rejects duplicates, orphan rows and category/list mismatches', () => {
    const duplicates = structuredClone(legacy);
    duplicates.items.push({ ...duplicates.items[0] });
    expect(() => parseBackup(JSON.stringify(duplicates))).toThrow();
    const orphan = structuredClone(legacy);
    orphan.items[0].categoryId = 777;
    expect(() => parseBackup(JSON.stringify(orphan))).toThrow();
    const mismatched = parseBackup(JSON.stringify(legacy));
    mismatched.items[0].shoppingListId = crypto.randomUUID();
    expect(() => validateSnapshot(mismatched)).toThrow();
  });
  it('rejects unknown versions, invalid fields, huge files and non-JSON', () => {
    expect(() => parseBackup('{')).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...legacy, version: 99 }))).toThrow();
    expect(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow();
    expect(() =>
      parseBackup(JSON.stringify({ ...legacy, items: [{ ...legacy.items[0], quantity: 0 }] })),
    ).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({ ...legacy, categories: [{ ...legacy.categories[0], extra: true }] }),
      ),
    ).toThrow();
  });
});
