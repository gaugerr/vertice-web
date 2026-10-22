import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const origin = 'http://127.0.0.1:4173';
async function fixture() {
  return JSON.parse(await readFile('.secrets/fixtures.json', 'utf8')) as {
    url: string;
    key: string;
    users: Record<string, { uid: string; email: string; session: { access_token: string } }>;
  };
}
async function enter(page: Page, kind = 'buyer') {
  const data = await fixture();
  const user = data.users[kind];
  await page.goto('/login');
  await page.evaluate(
    ({ url, user }) => {
      localStorage.setItem('sb-127-auth-token', JSON.stringify(user.session));
      localStorage.removeItem(`vertice:access:${url}:lease`);
    },
    { url: data.url, user },
  );
  await page.goto('/');
}
async function admin(action: unknown) {
  const data = await fixture();
  const response = await fetch(`${data.url}/functions/v1/license-admin`, {
    method: 'POST',
    headers: {
      Origin: origin,
      Authorization: `Bearer ${data.users.owner.session.access_token}`,
      apikey: data.key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(action),
  });
  return { response, data: await response.json() };
}
test('a customer without a license is denied and cannot invoke admin or grant itself access', async ({
  page,
}) => {
  await enter(page, 'unknown');
  await expect(page.getByRole('heading', { name: 'Acesso aguardando liberação' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nova lista' })).toHaveCount(0);
  await page.goto('/admin');
  await expect(page.getByRole('alert')).toContainText('Acesso não autorizado');
  const data = await fixture();
  const response = await fetch(`${data.url}/rest/v1/rpc/access_admin`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${data.users.unknown.session.access_token}`,
      apikey: data.key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      actor: data.users.owner.uid,
      input: { action: 'grant', email: data.users.unknown.email },
    }),
  });
  expect(response.ok).toBe(false);
});
test('admin grants a license, buyer claims it, revoke blocks it and reactivation restores access', async ({
  page,
}) => {
  const data = await fixture();
  await enter(page, 'owner');
  await page.goto('/settings');
  await page.getByRole('link', { name: 'Administrar licenças' }).click();
  await page.getByLabel('E-mail Google do comprador').fill(data.users.other.email);
  await page.getByLabel('Referência da compra (opcional)').fill('local-fixture-order');
  await page.getByRole('button', { name: 'Liberar acesso', exact: true }).click();
  const row = page.getByRole('listitem').filter({ hasText: data.users.other.email });
  await expect(row).toContainText('Aguardando primeiro acesso');
  await enter(page, 'other');
  await expect(page.getByRole('button', { name: 'Nova lista' })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Sua conta' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Administrar licenças' })).toHaveCount(0);
  const licenses = await admin({ action: 'list', search: data.users.other.email, page: 0 });
  const license = licenses.data.licenses[0];
  expect(license.user_id).toBe(data.users.other.uid);
  expect((await admin({ action: 'revoke', id: license.id })).response.ok).toBe(true);
  await page.goto('/settings');
  // Opening the app already revalidates: revocation may arrive before Settings mounts.
  await expect(page.getByRole('heading', { name: 'Acesso aguardando liberação' })).toBeVisible();
  expect((await admin({ action: 'reactivate', id: license.id })).response.ok).toBe(true);
  await page.getByRole('button', { name: 'Verificar acesso' }).click();
  await expect(page.getByRole('heading', { name: 'Dados e aplicativo' })).toBeVisible();
});
test('signed offline access survives reload and logout removes the local authorization', async ({
  page,
  context,
}) => {
  await enter(page);
  await expect(page.getByRole('button', { name: 'Nova lista' })).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Pronto para usar offline' }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Nova lista' })).toBeVisible();
  await context.setOffline(false);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Acesso pausado' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Nova lista' })).toHaveCount(0);
});
