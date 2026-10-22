import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ exchange: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { exchangeCodeForSession: mocks.exchange } }),
}));
vi.mock('./config', () => ({
  accessConfigured: true,
  accessConfig: { url: 'https://test.supabase.co', key: 'public' },
}));
import { exchangeCode, safeReturnPath } from './client';
beforeEach(() => mocks.exchange.mockReset());
it('only returns local navigation paths', () => {
  expect(safeReturnPath('/lists/123?from=home')).toBe('/lists/123?from=home');
  for (const path of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/auth/callback?code=secret',
    '/login',
    'javascript:alert(1)',
    '/\n/evil.test',
    null,
  ])
    expect(safeReturnPath(path)).toBe('/');
});
it('exchanges a PKCE callback code once across duplicate StrictMode effects', async () => {
  mocks.exchange.mockResolvedValue({ data: { session: {} }, error: null });
  const code = crypto.randomUUID();
  const [first, second] = await Promise.all([exchangeCode(code), exchangeCode(code)]);
  expect(mocks.exchange).toHaveBeenCalledTimes(1);
  expect(first).toBe(second);
});
