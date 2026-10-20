import { z } from 'zod';
import { emptyPackages, type ComparisonMode, type PackagePair } from '../../domain/services/comparison';

export const COMPARISON_SESSION_KEY = 'vertice:package-comparator:v1';
export interface ComparisonSession { version: 1; mode: ComparisonMode; drafts: Record<ComparisonMode, PackagePair> }
const text = z.string().max(100);
const option = z.object({ price: text, content: text, unit: z.enum(['g', 'kg', 'ml', 'L', 'un']) }).strict();
const pair = z.tuple([option, option]);
const schema = z.object({
  version: z.literal(1), mode: z.enum(['weight', 'volume', 'units']),
  drafts: z.object({
    weight: pair.refine((p) => p.every((o) => o.unit === 'g' || o.unit === 'kg')),
    volume: pair.refine((p) => p.every((o) => o.unit === 'ml' || o.unit === 'L')),
    units: pair.refine((p) => p.every((o) => o.unit === 'un')),
  }).strict(),
}).strict();

export function emptyComparisonSession(): ComparisonSession {
  return { version: 1, mode: 'weight', drafts: { weight: emptyPackages('weight'), volume: emptyPackages('volume'), units: emptyPackages('units') } };
}
export function parseComparisonSession(source: string | null): ComparisonSession {
  if (!source || source.length > 10000) return emptyComparisonSession();
  try {
    const result = schema.safeParse(JSON.parse(source));
    return result.success ? result.data : emptyComparisonSession();
  } catch { return emptyComparisonSession(); }
}
export function loadComparisonSession(): { session: ComparisonSession; failed: boolean } {
  try { return { session: parseComparisonSession(window.sessionStorage.getItem(COMPARISON_SESSION_KEY)), failed: false }; }
  catch { return { session: emptyComparisonSession(), failed: true }; }
}
export function saveComparisonSession(session: ComparisonSession): boolean {
  try { window.sessionStorage.setItem(COMPARISON_SESSION_KEY, JSON.stringify(session)); return true; }
  catch { return false; }
}
