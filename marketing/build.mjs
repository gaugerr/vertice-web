import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const file of [
  'index.html',
  'styles.css',
  'conversion.css',
  'interactive-demo.css',
  'interactive-demo.js',
  'app-gallery.css',
  'app-gallery.js',
  'script.js',
  'site-config.js',
  'icon.svg',
  'social.svg',
  'social.png',
  '_headers',
  'media',
]) {
  cpSync(file, `dist/${file}`, { recursive: true });
}

// Every HTML release points to the exact CSS it was built with, even when a
// returning browser still has the previous stylesheet cached at its old URL.
let html = readFileSync('dist/index.html', 'utf8');
for (const [, file] of html.matchAll(/href="\/([^"/]+\.css)"/g)) {
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 12);
  const versioned = file.replace(/\.css$/, `.${hash}.css`);
  cpSync(file, `dist/${versioned}`);
  html = html.replaceAll(`href="/${file}"`, `href="/${versioned}"`);
}
writeFileSync('dist/index.html', html);
