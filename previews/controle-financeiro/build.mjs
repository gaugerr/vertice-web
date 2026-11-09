import { mkdir, copyFile, access, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
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
// The authenticated entrypoint stays disabled without an explicit, non-production project.
const stagingUrl = (process.env.VITE_WORKSPACE_STAGING_URL ?? '').replace(/\/$/, '');
if (stagingUrl.includes('wqutcsjdozcukwxvkbtc'))
  throw Error('Do not connect the preview to production.');
const enabled = Boolean(
  stagingUrl &&
    process.env.VITE_WORKSPACE_STAGING_PUBLISHABLE_KEY &&
    process.env.VITE_WORKSPACE_STAGING_PUBLIC_JWK,
);
if (enabled) {
  const jwk = JSON.parse(process.env.VITE_WORKSPACE_STAGING_PUBLIC_JWK);
  if (jwk.d || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y)
    throw Error('Use only a public ES256 workspace signing key.');
  const value = process.env.VITE_WORKSPACE_STAGING_PUBLISHABLE_KEY;
  let role;
  try {
    role = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString()).role;
  } catch {
    /* New publishable keys are not JWTs. */
  }
  if (!value.startsWith('sb_publishable_') && role !== 'anon')
    throw Error('Use only a publishable key, never a service role key.');
}
await writeFile(
  root + 'dist/staging-config.json',
  JSON.stringify({
    enabled,
    url: stagingUrl,
    publishableKey: enabled ? process.env.VITE_WORKSPACE_STAGING_PUBLISHABLE_KEY : '',
    endpoint: stagingUrl ? stagingUrl + '/functions/v1/workspaces' : '',
    publicKey: enabled ? JSON.parse(process.env.VITE_WORKSPACE_STAGING_PUBLIC_JWK) : null,
    issuer: stagingUrl,
  }),
);
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
        .replace('src="shopping/index.html"', 'src="/shopping/index.html"')
        .replace('Vértice · Compras e Financeiro · Preview', 'Vértice · Homologação do casal'),
    );
  } else await copyFile(root + 'dist/' + file, root + 'dist/staging/' + file);
}
