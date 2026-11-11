// Browser + real SDK + signed synthetic leases. All HTTP is intercepted; no real accounts/data.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import assert from 'node:assert/strict';
import { emptyState } from '../../previews/controle-financeiro/finance-domain.mjs';
import { financeRows } from './mapping.mjs';
const origin = 'https://preview-controle-financeiro.vertice-financeiro-preview.pages.dev';
const url = 'https://cache-test.supabase.co';
const uid = '11111111-1111-4111-8111-111111111111';
const space = {
  id: '22222222-2222-4222-8222-222222222222',
  kind: 'personal',
  name: 'Meu espaço',
  generation: 1,
  status: 'active',
  role: 'owner',
  writable: true,
};
const { privateKey, publicKey } = await generateKeyPair('ES256');
const lease = await new SignJWT({
  workspaceId: space.id,
  generation: 1,
  kind: 'personal',
  writable: true,
})
  .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'vertice-workspace-v1' })
  .setSubject(uid)
  .setIssuer(url)
  .setAudience(origin)
  .setIssuedAt()
  .setExpirationTime('1d')
  .sign(privateKey);
const user = {
  id: uid,
  email: 'cache@example.test',
  email_confirmed_at: new Date().toISOString(),
  identities: [{ provider: 'google', identity_data: { email_verified: true } }],
};
const token = await new SignJWT({ role: 'authenticated' })
  .setProtectedHeader({ alg: 'ES256' })
  .setSubject(uid)
  .setIssuedAt()
  .setExpirationTime('1d')
  .sign(privateKey);
const session = {
  user,
  access_token: token,
  refresh_token: 'synthetic',
  token_type: 'bearer',
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  expires_in: 86400,
};
const config = {
  enabled: true,
  url,
  endpoint: url + '/functions/v1/workspaces',
  issuer: url,
  publishableKey: 'sb_publishable_synthetic',
  publicKey: await exportJWK(publicKey),
};
const state = emptyState();
state.entries.push({
  id: 'entry',
  name: 'Despesa preservada',
  amount: 1250,
  type: 'expense',
  paid: false,
  date: '2026-11-09',
  categoryId: 'D01',
  paymentMethodId: 'P2',
  observation: '',
});
const records = financeRows(state).map((r) => ({ ...r, body: { ...r.body, row_version: 1 } }));
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
let hold = false,
  release;
const held = new Promise((resolve) => {
  release = resolve;
});
let calls = 0;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(
    ({ session }) => {
      if (!localStorage.getItem('vertice_workspace_staging_auth'))
        localStorage.setItem('vertice_workspace_staging_auth', JSON.stringify(session));
    },
    { session },
  );
  await context.routeWebSocket('**/*', (socket) => socket.close());
  await context.route('**/*', async (route) => {
    const request = route.request(),
      target = new URL(request.url());
    if (target.origin === url) {
      if (hold) await held;
      calls++;
      let body = user;
      if (target.pathname.endsWith('/workspaces')) {
        const { action, input } = request.postDataJSON();
        if (action === 'list') body = [space];
        else if (action === 'access') body = { generation: 1, kind: 'personal', lease };
        else if (action === 'pull')
          body = {
            revision: 1,
            records: [],
            more: false,
            batches: input.cursor ? [] : [{ revision: 1, operation_id: 'synthetic', records }],
          };
        else throw Error('Unexpected action ' + action);
      }
      return route.fulfill({ json: body, headers: { 'Access-Control-Allow-Origin': origin } });
    }
    assert.equal(target.origin, origin, 'No external traffic is allowed');
    if (target.pathname === '/staging-config.json') {
      if (hold) await held;
      return route.fulfill({ json: config });
    }
    let path = target.pathname;
    if (path.endsWith('/')) path += 'index.html';
    const root = new URL('../../previews/controle-financeiro/dist/', import.meta.url);
    const body = await readFile(new URL('.' + path, root));
    const type = path.endsWith('.html')
      ? 'text/html'
      : /\.(js|mjs)$/.test(path)
        ? 'text/javascript'
        : path.endsWith('.css')
          ? 'text/css'
          : 'image/svg+xml';
    return route.fulfill({ body, contentType: type });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + '/staging/#financeiro/transactions');
  await page.getByText('Despesa preservada', { exact: true }).waitFor();
  await page.locator('#sync-toggle[title="Sincronizado"]').waitFor();
  hold = true;
  const previous = calls;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Despesa preservada', { exact: true }).waitFor({ timeout: 1000 });
  assert.equal(calls, previous, 'Cache must paint before pending API replies');
  await page.locator('#sync-toggle[title^="Atualizando"]').waitFor();
  await page.locator('#new-entry').click();
  await page.locator('#financial-form [name=name]').fill('Rascunho preservado');
  release();
  await page.locator('#sync-toggle[title="Sincronizado"]').waitFor();
  assert.equal(
    await page.locator('#financial-form [name=name]').inputValue(),
    'Rascunho preservado',
  );
  await page.evaluate(() => window.dispatchEvent(new Event('vertice:workspace-auth-invalid')));
  await page.locator('#workspace-access-block').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#finance-area').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: warm cache renders within 1s with Auth/config/API suspended; signed authorization, complete sync and draft preserved. Synthetic HTTP only.',
  );
} finally {
  release();
  await browser.close();
}
