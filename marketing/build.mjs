import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const file of ['index.html', 'styles.css', 'conversion.css', 'script.js', 'site-config.js', 'icon.svg', 'social.svg', 'social.png', '_headers', 'media']) {
  cpSync(file, `dist/${file}`, { recursive: true });
}
