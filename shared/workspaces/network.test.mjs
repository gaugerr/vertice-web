import { afterEach, expect, test, vi } from 'vitest';
import { boundedFetch } from './network.mjs';
import { HttpWorkspaceTransport } from './http.mjs';
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
test('requisição pendurada é abortada após dez segundos', async () => {
  vi.useFakeTimers();
  let signal;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          signal = options.signal;
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    ),
  );
  const pending = expect(boundedFetch('https://example.test')).rejects.toThrow('aborted');
  await vi.advanceTimersByTimeAsync(10000);
  await pending;
  expect(signal.aborted).toBe(true);
});
test('sessão encerrada não inicia consulta nem renova o acesso do cache', async () => {
  const getSession = vi.fn();
  const transport = new HttpWorkspaceTransport({
    client: { auth: { getSession } },
    sessionAllowed: () => false,
  });
  await expect(transport.request('access')).rejects.toMatchObject({ code: 'unauthorized' });
  expect(getSession).not.toHaveBeenCalled();
});
