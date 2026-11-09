import { mkdir, copyFile, access, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { validateConnection } from '../../shared/workspaces/connection.mjs';
const root = fileURLToPath(new URL('.', import.meta.url));
const repo = fileURLToPath(new URL('../../', import.meta.url));
await mkdir(root + 'dist', { recursive: true });
for (const file of [
  'index.html',
  'app.js',
  'shell.js',
  'styles.css',
  'shell.css',
  'finance.css',
  'finance-domain.mjs',
  'finance-store.mjs',
  'finance-backup.mjs',
  'workspace-ui.mjs',
  'workspace.css',
  'vertice.svg',
  '_headers',
  'robots.txt',
])
  await copyFile(root + file, root + 'dist/' + file);
try {
  await access(repo + 'node_modules/vite/bin/vite.js');
} catch {
  execFileSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: repo,
    stdio: 'inherit',
  });
}
execFileSync(
  process.execPath,
  [repo + 'node_modules/vite/bin/vite.js', 'build', '--config', root + 'shopping.vite.config.mjs'],
  { cwd: repo, stdio: 'inherit' },
);
await copyFile(root + 'dist/shopping/shopping.html', root + 'dist/shopping/index.html');
console.log('Preview com compras e financeiro preparado em dist.');
execFileSync(
  process.execPath,
  [repo + 'node_modules/vite/bin/vite.js', 'build', '--config', root + 'workspace.vite.config.mjs'],
  { cwd: repo, stdio: 'inherit' },
);
// Only the authorized branch on Cloudflare activates the connection to the existing DB.
let config = {
  enabled: false,
  url: '',
  endpoint: '',
  issuer: '',
  publishableKey: '',
  publicKey: null,
};
if (
  process.env.CF_PAGES_BRANCH === 'preview/controle-financeiro' &&
  process.env.VITE_WORKSPACE_DISABLE_REAL !== '1'
) {
  config = JSON.parse(await readFile(root + 'connected-preview.json', 'utf8'));
  validateConnection(config, config.allowedOrigin);
  if (!config.publishableKey.startsWith('sb_publishable_')) throw Error('Use a publishable key.');
} else {
  const url = (process.env.VITE_WORKSPACE_STAGING_URL ?? '').replace(/\/$/, '');
  if (url.includes('wqutcsjdozcukwxvkbtc'))
    throw Error('Use the explicit connected preview configuration.');
  if (
    url &&
    process.env.VITE_WORKSPACE_STAGING_PUBLISHABLE_KEY &&
    process.env.VITE_WORKSPACE_STAGING_PUBLIC_JWK
  ) {
    config = {
      enabled: true,
      url,
      endpoint: url + '/functions/v1/workspaces',
      issuer: url,
      publishableKey: process.env.VITE_WORKSPACE_STAGING_PUBLISHABLE_KEY,
      publicKey: JSON.parse(process.env.VITE_WORKSPACE_STAGING_PUBLIC_JWK),
    };
    validateConnection(config, 'https://isolated-preview.example');
    let role;
    try {
      role = JSON.parse(
        Buffer.from(config.publishableKey.split('.')[1], 'base64url').toString(),
      ).role;
    } catch {
      /* New public keys are not JWTs. */
    }
    if (!config.publishableKey.startsWith('sb_publishable_') && role !== 'anon')
      throw Error('Never publish a service key.');
  }
}
await writeFile(root + 'dist/staging-config.json', JSON.stringify(config));
await mkdir(root + 'dist/staging', { recursive: true });
for (const file of [
  'index.html',
  'app.js',
  'shell.js',
  'styles.css',
  'shell.css',
  'finance.css',
  'finance-domain.mjs',
  'finance-store.mjs',
  'finance-backup.mjs',
  'workspace-ui.mjs',
  'workspace.css',
  'workspaces.js',
  'vertice.svg',
]) {
  if (file === 'index.html') {
    const html = await readFile(root + 'dist/' + file, 'utf8');
    await writeFile(
      root + 'dist/staging/' + file,
      html
        .replace('data-src="shopping/index.html"', 'data-src="/shopping/index.html"')
        .replace('Vértice · Compras e Financeiro · Preview', 'Vértice · Homologação do casal'),
    );
  } else await copyFile(root + 'dist/' + file, root + 'dist/staging/' + file);
}
