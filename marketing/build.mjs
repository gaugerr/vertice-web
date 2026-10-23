import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const file of [
  'index.html',
  'styles.css',
  'script.js',
  'icon.svg',
  'social.svg',
  '_headers',
]) {
  cpSync(file, `dist/${file}`);
}
