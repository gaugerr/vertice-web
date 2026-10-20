// Production-build fixture server. The update endpoint exists only in tests.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
let version = 0;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain',
};
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/__test__/update' && request.method === 'POST') {
      version++;
      response.writeHead(200);
      response.end('updated');
      return;
    }
    let path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (path !== root && !path.startsWith(root + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    if (path === root || !extname(path)) path = resolve(root, 'index.html');
    if (!(await stat(path)).isFile()) throw new Error('not found');
    let body = await readFile(path);
    if (url.pathname === '/sw.js')
      body = Buffer.concat([body, Buffer.from(`\n/* test version ${version} */`)]);
    response.writeHead(200, {
      'Content-Type': types[extname(path)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found');
  }
}).listen(4173, '127.0.0.1', () => console.log('Production PWA on http://127.0.0.1:4173'));
