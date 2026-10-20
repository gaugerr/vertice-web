import {readdir, readFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const files = await readdir('dist/assets');
const sizes = await Promise.all(files.filter((f) => /\.(js|css)$/.test(f)).map(async (file) => ({
  file, gzip: gzipSync(await readFile(`dist/assets/${file}`)).length,
})));
console.table(sizes.map(({file, gzip}) => ({file, 'gzip KiB': (gzip / 1024).toFixed(1)})));
const js = sizes.filter((s) => s.file.endsWith('.js')).reduce((sum, s) => sum + s.gzip, 0);
console.log(`All application JS, including lazy routes: ${(js / 1024).toFixed(1)} KiB gzip`);
if (js > 250 * 1024) throw new Error('JavaScript exceeds the 250 KiB gzip budget');
