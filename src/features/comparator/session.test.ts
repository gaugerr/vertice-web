import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COMPARISON_SESSION_KEY,
  emptyComparisonSession,
  loadComparisonSession,
  parseComparisonSession,
  saveComparisonSession,
} from './session';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});
describe('comparison session', () => {
  it('preserves independent mode drafts and touches only its own storage key', () => {
    sessionStorage.setItem('unrelated', 'preserve');
    const session = emptyComparisonSession();
    session.mode = 'volume';
    session.drafts.weight[0].price = '10,90';
    session.drafts.volume[0] = { price: '6', content: '500', unit: 'ml' };
    expect(saveComparisonSession(session)).toBe(true);
    expect(loadComparisonSession()).toEqual({ session, failed: false });
    expect(sessionStorage.getItem('unrelated')).toBe('preserve');
    expect(sessionStorage.getItem(COMPARISON_SESSION_KEY)).not.toBeNull();
  });
  it('resets corrupt, oversized, incompatible or unknown session structures safely', () => {
    for (const raw of [
      '{',
      ' '.repeat(10001),
      JSON.stringify({ ...emptyComparisonSession(), version: 2 }),
    ])
      expect(parseComparisonSession(raw)).toEqual(emptyComparisonSession());
    const wrongUnit = emptyComparisonSession();
    wrongUnit.drafts.weight[0].unit = 'L';
    expect(parseComparisonSession(JSON.stringify(wrongUnit))).toEqual(emptyComparisonSession());
    const tooLong = emptyComparisonSession();
    tooLong.drafts.weight[0].price = '1'.repeat(101);
    expect(parseComparisonSession(JSON.stringify(tooLong))).toEqual(emptyComparisonSession());
  });
  it('handles blocked session storage without throwing or affecting purchase data', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    expect(loadComparisonSession()).toEqual({ session: emptyComparisonSession(), failed: true });
    expect(saveComparisonSession(emptyComparisonSession())).toBe(false);
  });
});
