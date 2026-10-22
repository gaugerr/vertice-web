import { test, expect } from '@playwright/test';

const supabase = 'https://wqutcsjdozcukwxvkbtc.supabase.co';
const publicKey = 'sb_publishable_na1zSXjXeXTF0RzGkpplhA__XR1-0Sl';

test('public deployment requires Google login and uses its own callback origin', async ({
  page,
  baseURL,
}) => {
  for (const path of ['/', '/settings', '/admin']) {
    await page.goto(path);
    await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Nova lista' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Administrar licenças' })).toHaveCount(0);
    await expect(page.getByLabel('E-mail Google do comprador')).toHaveCount(0);
  }
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacidade no Vértice' })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar ao aplicativo' }).click();
  // Inspect the real client-generated authorize URL without logging into a real account.
  await page.route(`${supabase}/auth/v1/authorize?**`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'OAuth navigation verified' }),
  );
  const authorize = page.waitForRequest((r) =>
    r.url().startsWith(`${supabase}/auth/v1/authorize?`),
  );
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  const url = new URL((await authorize).url());
  expect(url.searchParams.get('provider')).toBe('google');
  expect(url.searchParams.get('redirect_to')).toBe(`${new URL(baseURL!).origin}/auth/callback`);
  expect(url.searchParams.get('code_challenge_method')).toBe('s256');
});

test('hosted Supabase permits this origin, enables Google and rejects anonymous license operations', async ({
  request,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const settings = await request.get(`${supabase}/auth/v1/settings`, {
    headers: { apikey: publicKey },
  });
  expect(settings.ok()).toBe(true);
  expect((await settings.json()).external.google).toBe(true);
  for (const name of ['license-check', 'license-admin']) {
    const url = `${supabase}/functions/v1/${name}`;
    const preflight = await request.fetch(url, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,apikey,content-type',
      },
    });
    expect(preflight.status()).toBe(200);
    expect(preflight.headers()['access-control-allow-origin']).toBe(origin);
    const denied = await request.post(url, {
      headers: { Origin: origin, apikey: publicKey },
      data: {},
    });
    expect(denied.status()).toBe(401);
    expect(denied.headers()['access-control-allow-origin']).toBe(origin);
  }
});
