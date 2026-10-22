import { test, expect, type Page } from '@playwright/test';
import {
  appOrigin,
  checkTestLicense,
  closeTestSession,
  readLocalFixture,
  signInTestUser,
} from '../e2e/support/access';
async function enter(page: Page, kind: Parameters<typeof signInTestUser>[0] = 'buyer') {
  const auth = await signInTestUser(kind);
  const data = auth.fixture;
  const user = { session: auth.session };
  await page.goto('/login');
  await page.evaluate(
    ({ url, user }) => {
      localStorage.setItem('sb-127-auth-token', JSON.stringify(user.session));
      localStorage.removeItem(`vertice:access:${url}:lease`);
    },
    { url: data.url, user },
  );
  await page.goto('/');
  return auth;
}
async function admin(action: unknown) {
  const auth = await signInTestUser('owner');
  try {
    const response = await fetch(`${auth.fixture.url}/functions/v1/license-admin`, {
      method: 'POST',
      headers: {
        Origin: appOrigin,
        Authorization: `Bearer ${auth.session.access_token}`,
        apikey: auth.fixture.key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(action),
    });
    return { response, data: await response.json() };
  } finally {
    await closeTestSession(auth);
  }
}
test('a customer without a license is denied and cannot invoke admin or grant itself access', async ({
  page,
}) => {
  await enter(page, 'unknown');
  await expect(page.getByRole('heading', { name: 'Acesso aguardando liberação' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nova lista' })).toHaveCount(0);
  await page.goto('/admin');
  await expect(page.getByRole('alert')).toContainText('Acesso não autorizado');
  const data = await readLocalFixture();
  const unknown = await signInTestUser('unknown');
  const response = await fetch(`${data.url}/rest/v1/rpc/access_admin`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${unknown.session.access_token}`,
      apikey: data.key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      actor: data.users.owner.uid,
      input: { action: 'grant', email: data.users.unknown.email },
    }),
  });
  expect(response.ok).toBe(false);
  await closeTestSession(unknown);
});
test('admin grants a license, buyer claims it, revoke blocks it and reactivation restores access', async ({
  page,
}) => {
  const data = await readLocalFixture();
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

test('logout rejects the old session without invalidating an independent or new login', async ({
  page,
}) => {
  const original = await enter(page);
  const independent = await signInTestUser();
  let loggedOut = false;
  try {
    await expect(page.getByRole('button', { name: 'Nova lista', exact: true })).toBeVisible();
    expect((await checkTestLicense(original)).status).toBe(200);
    expect((await checkTestLicense(independent)).status).toBe(200);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Acesso pausado' })).toBeVisible();
    loggedOut = true;
    const claims = JSON.parse(
      Buffer.from(original.session.access_token.split('.')[1], 'base64url').toString(),
    ) as { exp: number };
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000);
    const oldStatus = (await checkTestLicense(original)).status;
    const independentStatus = (await checkTestLicense(independent)).status;
    console.log(JSON.stringify({ oldSessionAfterLogout: oldStatus, independentSession: independentStatus }));
    expect(oldStatus).toBe(401);
    expect(independentStatus).toBe(200);
    const renewed = await enter(page);
    try {
      await expect(page.getByRole('button', { name: 'Nova lista', exact: true })).toBeVisible();
      const newStatus = (await checkTestLicense(renewed)).status;
      expect(newStatus).toBe(200);
      console.log(
        JSON.stringify({
          oldSessionAfterLogout: oldStatus,
          independentSession: independentStatus,
          newLogin: newStatus,
          oldTokenExpired: false,
        }),
      );
    } finally {
      await closeTestSession(renewed);
    }
  } finally {
    if (!loggedOut) await closeTestSession(original);
    await closeTestSession(independent);
  }
});
