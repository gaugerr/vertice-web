import { test, expect } from './fixtures';

test('encontra as planilhas, consulta o guia e mantém o acesso compacto após voltar', async ({
  page,
}) => {
  await page.goto('/');
  const entry = page.getByRole('region', { name: 'Vértice Financeiro' });
  await expect(entry.getByText('Suas planilhas e instruções em um só lugar.')).toBeVisible();
  await entry.getByRole('link', { name: 'Acessar planilhas' }).click();
  await expect(page).toHaveURL(/\/financeiro$/);
  await expect(
    page.getByRole('heading', { name: 'Vértice Financeiro', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Criar cópia do modelo limpo' })).toHaveAttribute(
    'href',
    'https://docs.google.com/spreadsheets/d/1lqra8SGALrb8N6l4W8vn_r8MUDxTdQU1xV1mn3fdnmg/copy',
  );
  await expect(page.getByRole('link', { name: 'Criar cópia da demonstração' })).toHaveAttribute(
    'href',
    'https://docs.google.com/spreadsheets/d/1CM5orJ2dGeLOrMGZkPLzIpaiopT48CQIKJAi6GwW4dc/copy',
  );
  await page.getByRole('button', { name: 'Microsoft Excel' }).click();
  await expect(page.getByRole('link', { name: 'Baixar modelo limpo' })).toHaveAttribute(
    'href',
    'https://drive.google.com/uc?export=download&id=1wGGyAMfwU6yVzaZHfx7KGcNi8Yo0AsPY',
  );
  await expect(page.getByRole('link', { name: 'Baixar demonstração' })).toHaveAttribute(
    'href',
    'https://drive.google.com/uc?export=download&id=1JNbdnGF9lD6rJ-Jjx222Gi1B2fKjeNyY',
  );
  for (const link of await page.locator('.finance-versions a').all()) {
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await page.getByRole('button', { name: 'Como utilizar?' }).click();
  await expect(page.getByRole('heading', { name: 'Como utilizar suas planilhas' })).toBeFocused();
  await page.locator('summary').filter({ hasText: 'Cadastre contas fixas' }).click();
  await expect(
    page.getByText('Não registre a mesma conta também em Lançamentos:', { exact: false }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Minhas listas', exact: true }).last().click();
  await expect(entry).toHaveClass(/is-compact/);
  await page.reload();
  await expect(entry).toHaveClass(/is-compact/);
  await expect(entry.getByRole('link', { name: 'Acessar planilhas' })).toBeVisible();
});

test('rota direta, guia offline e layouts estreitos continuam utilizáveis', async ({
  page,
  context,
  browserName,
}) => {
  await page.goto('/financeiro');
  await expect(
    page.getByRole('heading', { name: 'Vértice Financeiro', exact: true }),
  ).toBeVisible();
  for (const width of [280, 320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(
      page
        .getByRole('navigation', { name: 'Navegação principal' })
        .getByRole('link', { name: 'Financeiro', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  if (browserName !== 'chromium') return;
  await expect(
    page.getByRole('status').filter({ hasText: 'Pronto para usar offline' }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Vértice Financeiro', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Você está offline. Conecte-se', { exact: false })).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Escolha mês e ano' }).click();
  await expect(
    page.getByText('Selecione o mês e o ano que deseja acompanhar', { exact: false }),
  ).toBeVisible();
  await context.setOffline(false);
});
