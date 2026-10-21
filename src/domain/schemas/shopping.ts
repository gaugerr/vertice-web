import { z } from 'zod';
import Big from 'big.js';
import { canonicalDecimal, lineCents } from '../services/money';

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Informe um nome.')
  .max(50, 'Use até 50 caracteres.');
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida.')
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, 'Informe uma data válida.');
export const decimalSchema = z
  .string()
  .max(100)
  .transform((value, ctx) => {
    try {
      return canonicalDecimal(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Informe um número válido.' });
      return z.NEVER;
    }
  });
export const budgetCentsSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER)
  .nullable();
export const listInputSchema = z.object({
  storeName: nameSchema,
  date: dateSchema,
  description: z.string().max(10000, 'Use até 10.000 caracteres.'),
  budgetCents: budgetCentsSchema,
});
export const purchaseDetailsSchema = z
  .object({
    unitPrice: decimalSchema,
    quantity: decimalSchema.refine(
      (v) => new Big(v).gt(0),
      'A quantidade deve ser maior que zero.',
    ),
    unit: z.enum(['un', 'kg', 'L']),
  })
  .superRefine((value, ctx) => {
    try {
      lineCents(value);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'O valor excede o limite permitido.',
        path: ['unitPrice'],
      });
    }
  });
export const itemInputSchema = purchaseDetailsSchema.safeExtend({ name: nameSchema });
const timestamps = { createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() };
// Historical backup shapes stay fixed when the live model evolves.
export const listV3Schema = listInputSchema.extend({ id: z.uuid(), ...timestamps }).strict();
export const completionInputSchema = z.object({
  purchaseDate: dateSchema,
  marketName: z.string().trim().min(1).max(50).nullable(),
});
export const listSchema = listV3Schema
  .extend({
    status: z.enum(['active', 'completed']),
    completedAt: z.iso.datetime().nullable(),
    purchaseDate: dateSchema.nullable(),
    marketName: z.string().trim().min(1).max(50).nullable(),
  })
  .superRefine((list, ctx) => {
    if (
      (list.status === 'active' && list.completedAt !== null) ||
      (list.status === 'completed' && (!list.completedAt || !list.purchaseDate))
    ) {
      ctx.addIssue({ code: 'custom', message: 'Estado de finalização inválido.' });
    }
  });
export const categorySchema = z
  .object({
    id: z.uuid(),
    shoppingListId: z.uuid(),
    title: nameSchema,
    position: z.number().int().nonnegative(),
    ...timestamps,
  })
  .strict();
// Keep decimal strings canonical in storage and backups.
export const itemSchema = z
  .object({
    id: z.uuid(),
    shoppingListId: z.uuid(),
    categoryId: z.uuid(),
    ...timestamps,
    name: nameSchema,
    unitPrice: decimalSchema,
    quantity: decimalSchema.refine((v) => new Big(v).gt(0)),
    unit: z.enum(['un', 'kg', 'L']),
    isPurchased: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    try {
      lineCents(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Valor inválido no backup.' });
    }
  });
