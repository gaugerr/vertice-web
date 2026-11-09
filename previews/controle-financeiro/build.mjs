import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
await mkdir(root + 'dist', { recursive: true });
for (const file of [
  'index.html',
  'app.js',
  'styles.css',
  'vertice.svg',
  '_headers',
  'robots.txt',
]) {
  await copyFile(root + file, root + 'dist/' + file);
}
console.log('Preview financeiro estático preparado em dist.');
