import { chromium, webkit } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve('marketing/dist');
const types = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};
const server = createServer(async (req, res) => {
  const path = resolve(
    root,
    '.' +
      decodeURIComponent(
        new URL(req.url, 'http://localhost').pathname === '/'
          ? '/index.html'
          : new URL(req.url, 'http://localhost').pathname,
      ),
  );
  if (!path.startsWith(root + '/')) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(8081, '127.0.0.1', r));
await mkdir('marketing-results', { recursive: true });
try {
  for (const [name, engine] of [
    ['chromium', chromium],
    ['webkit', webkit],
  ]) {
    const browser = await engine.launch();
    try {
      for (const width of [280, 390, 768, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto('http://127.0.0.1:8081');
        const search = page.locator('#smart-search'),
          price = page.locator('#smart-price'),
          list = page.locator('#smart-suggestions button'),
          result = page.locator('#smart-price-result');
        await search.fill('m');
        assert.equal(await list.count(), 0);
        await search.dispatchEvent('compositionstart');
        await search.fill('ma');
        assert.equal(await list.count(), 3);
        await search.fill('mass');
        assert.equal(await list.count(), 2);
        await search.dispatchEvent('compositionend');
        await list.first().click();
        assert.equal(await price.inputValue(), '');
        for (const [value, expected] of [
          ['5,99', '0,50 a mais'],
          ['4,99', '0,50 a menos'],
          ['5,49', 'Mesmo preço'],
        ]) {
          await price.fill(value);
          assert.ok((await result.innerText()).includes(expected));
        }
        await price.fill('-1');
        assert.equal(await price.getAttribute('aria-invalid'), 'true');
        await price.fill('');
        assert.ok((await result.innerText()).includes('Digite um preço'));
        await search.fill('MAÇ');
        assert.equal(await list.count(), 1);
        await list.first().click();
        assert.ok((await page.locator('#smart-last-price').innerText()).includes('8,90'));
        assert.equal(await price.inputValue(), '');
        await search.fill('xyz');
        assert.equal(await list.count(), 0);
        await search.fill('ma');
        await search.press('Escape');
        assert.equal(await list.count(), 0);
        const labels = await page.locator('#app-gallery-track .screen-card-step').allTextContents();
        assert.ok(labels[0].includes('SUGESTÕES'));
        assert.ok(labels[1].includes('HISTÓRICO'));
        // Preserve the original interactive purchase totals and filters.
        await page.locator('#show-app-items').click();
        const before = await page.locator('#demo-total').innerText();
        await page.locator('[data-product="3"]').check();
        assert.notEqual(await page.locator('#demo-total').innerText(), before);
        await page.locator('#reset-app').click();
        assert.equal(await page.locator('#demo-total').innerText(), before);
        console.log('LAYOUT', name, width, await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, outside: [...document.querySelectorAll('body *')].filter(e => { const r=e.getBoundingClientRect(); return r.width && (r.right>innerWidth+1 || r.left < -1) && getComputedStyle(e).position !== 'fixed'; }).slice(0,18).map(e=>({tag:e.tagName,cls:e.className,id:e.id,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right})) })));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.deepEqual(errors, []);
        assert.equal(
          await page.locator('#smart-search').getAttribute('aria-describedby'),
          'smart-search-hint',
        );
        if (name === 'chromium' && [390, 1440].includes(width)) {
          await search.fill('ma');
          await page
            .locator('#app-inteligente')
            .screenshot({ path: `marketing-results/smart-${width}.png` });
          const screenshot = await page
            .locator('#app-inteligente')
            .screenshot({ type: 'jpeg', quality: 65 });
          const data = screenshot.toString('base64');
          for (let i = 0; i < data.length; i += 8000)
            console.log(
              `SMART_${width}_${String(i / 8000).padStart(4, '0')} ${data.slice(i, i + 8000)}`,
            );
          await page.screenshot({ path: `marketing-results/hero-${width}.png` });
        }
        console.log(
          `PASS ${name} ${width}: smart suggestions, prices, gallery, original demo, layout`,
        );
        await page.close();
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
}
