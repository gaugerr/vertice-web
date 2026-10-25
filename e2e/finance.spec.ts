import { test, expect } from './fixtures';

test('mantém links padrão no Android e orienta criar uma cópia pelo aplicativo', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 14) Chrome/141.0.0.0 Mobile Safari/537.36',
    });
  });
  await page.goto('/financeiro');
  const primary = page.getByRole('link', { name: 'Criar cópia do modelo limpo' });
  const normal =
    'https://docs.google.com/spreadsheets/d/1lqra8SGALrb8N6l4W8vn_r8MUDxTdQU1xV1mn3fdnmg/copy';
  await expect(primary).toHaveAttribute('href', normal);
  await expect(primary).toHaveAttribute('target', '_blank');
  await expect(page.locator('.finance-mobile-help ol li')).toHaveCount(4);
  await expect(
    page.locator('.finance-mobile-help').getByText('Fazer uma cópia', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Copiar link — Modelo limpo', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Microsoft Excel' }).click();
  await expect(page.getByRole('link', { name: 'Baixar modelo limpo' })).toHaveAttribute(
    'href',
    'https://drive.google.com/uc?export=download&id=1wGGyAMfwU6yVzaZHfx7KGcNi8Yo0AsPY',
  );
});

test('oferece cópia do link e alternativa manual quando o navegador nega a área de transferência', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('denied');
        },
      },
    });
  });
  await page.goto('/financeiro');
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.getByText('No celular, abriu no app Planilhas?')).toBeVisible();
  await page.getByRole('button', { name: 'Copiar link — Modelo limpo', exact: true }).click();
  const field = page.getByLabel('Link de cópia — Modelo limpo', { exact: true });
  await expect(field).toHaveValue(
    'https://docs.google.com/spreadsheets/d/1lqra8SGALrb8N6l4W8vn_r8MUDxTdQU1xV1mn3fdnmg/copy',
  );
  await page.getByRole('button', { name: 'Selecionar link', exact: true }).click();
  await expect(field).toBeFocused();
  expect(
    await field.evaluate((input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!),
  ).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Microsoft Excel' }).click();
  await expect(page.getByRole('button', { name: /^Copiar link/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Google Planilhas' }).click();
  await expect(field).toHaveCount(0);
});

test('copia o destino correto sem afirmar que a planilha foi criada', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as Window & { copiedTemplate?: string }).copiedTemplate = value;
        },
      },
    });
  });
  await page.goto('/financeiro');
  await page.getByRole('button', { name: 'Copiar link — Demonstração', exact: true }).click();
  await expect(
    page.getByText('Link copiado. Cole na barra de endereço', { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as Window & { copiedTemplate?: string }).copiedTemplate),
  ).toBe(
    'https://docs.google.com/spreadsheets/d/1CM5orJ2dGeLOrMGZkPLzIpaiopT48CQIKJAi6GwW4dc/copy',
  );
});

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
