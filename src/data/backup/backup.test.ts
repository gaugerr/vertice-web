import {describe, expect, it} from 'vitest';
import {encodeBackup, MAX_BACKUP_BYTES, parseBackup, validateSnapshot} from './backup';
import {spentCents} from '../../domain/services/money';

const legacy = {
  format: 'vertice-backup', version: 1,
  lists: [{id: 1, storeName: 'Mercado', date: new Date(2026, 9, 19, 12).valueOf(), description: ''}],
  categories: [{id: 8, shoppingListId: 1, title: 'Essenciais'}],
  items: [{id: 10, name: 'Arroz', price: 20, quantity: 0.5, unit: 'kg', isPurchased: 1, categoryId: 8, shoppingListId: 1}],
};
describe('backups', () => {
  it('maps legacy IDs consistently and preserves financial values and local dates', () => {
    const data = parseBackup(JSON.stringify(legacy));
    expect(data.lists[0].id).not.toBe('1');
    expect(data.categories[0].shoppingListId).toBe(data.lists[0].id);
    expect(data.items[0].categoryId).toBe(data.categories[0].id);
    expect(data.items[0]).toMatchObject({unitPrice: '20', quantity: '0.5', isPurchased: true});
    expect(data.lists[0].date).toBe('2026-10-19');
    expect(spentCents(data.items)).toBe(1000);
    expect(parseBackup(encodeBackup(data))).toEqual(data);
  });
  it('preserves legacy fractional unit prices without premature rounding', () => {
    const data = structuredClone(legacy); data.items[0].price = 0.005; data.items[0].quantity = 1;
    expect(spentCents(parseBackup(JSON.stringify(data)).items)).toBe(1);
  });
  it('rejects duplicates, orphan rows and category/list mismatches', () => {
    const duplicates = structuredClone(legacy); duplicates.items.push({...duplicates.items[0]});
    expect(() => parseBackup(JSON.stringify(duplicates))).toThrow();
    const orphan = structuredClone(legacy); orphan.items[0].categoryId = 777;
    expect(() => parseBackup(JSON.stringify(orphan))).toThrow();
    const mismatched = parseBackup(JSON.stringify(legacy)); mismatched.items[0].shoppingListId = crypto.randomUUID();
    expect(() => validateSnapshot(mismatched)).toThrow();
  });
  it('rejects unknown versions, invalid fields, huge files and non-JSON', () => {
    expect(() => parseBackup('{')).toThrow();
    expect(() => parseBackup(JSON.stringify({...legacy, version: 99}))).toThrow();
    expect(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow();
    expect(() => parseBackup(JSON.stringify({...legacy, items: [{...legacy.items[0], quantity: 0}]}))).toThrow();
    expect(() => parseBackup(JSON.stringify({...legacy, categories: [{...legacy.categories[0], extra: true}]}))).toThrow();
  });
});
