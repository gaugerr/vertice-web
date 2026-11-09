import { mkdir, copyFile, access } from 'node:fs/promises';
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
