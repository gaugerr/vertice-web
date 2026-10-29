import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve('video-output');
const frames = resolve(out, 'frames');
await mkdir(frames, { recursive: true });
const base = 'http://127.0.0.1:4173';
const renderOnly = process.env.DEMO_RENDER_ONLY === '1';
const server = renderOnly
  ? null
  : spawn(process.execPath, ['tools/serve-test.mjs'], { stdio: 'inherit' });
const shots = [];
const closing = [];
let stage;
let browser;
let elapsed = 0;
let appDuration;
const notes = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exec = (args) =>
  execFileSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'warning', '-y', '-filter_complex_threads', '1', ...args],
    { stdio: 'inherit' },
  );
async function capture(seconds, note = '') {
  const file = resolve(frames, 'app-' + String(shots.length).padStart(4, '0') + '.png');
  await stage.screenshot({ path: file, animations: 'disabled' });
  shots.push({ file, duration: seconds });
  if (note) notes.push({ at: +elapsed.toFixed(2), note });
  elapsed += seconds;
}
async function tap(locator) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  if (!b) throw new Error('Controle fora do enquadramento');
  await stage.evaluate(
    ({ x, y }) => {
      const ring = document.querySelector('#tap');
      ring.style.left = x + 'px';
      ring.style.top = y + 'px';
      ring.style.transform = 'translate(-50%,-50%) scale(0.7)';
      ring.style.opacity = '0.85';
    },
    { x: b.x + b.width / 2, y: b.y + b.height / 2 },
  );
  await capture(0.1);
  await locator.click();
  await sleep(160);
  await stage.evaluate(() => {
    const ring = document.querySelector('#tap');
    ring.style.transform = 'translate(-50%,-50%) scale(1.35)';
    ring.style.opacity = '0.3';
  });
  await capture(0.1);
  await stage.evaluate(() => {
    document.querySelector('#tap').style.opacity = '0';
  });
}
async function type(locator, text, pace = 0.12) {
  await locator.click();
  await locator.fill('');
  for (const character of text) {
    await locator.pressSequentially(character);
    await capture(pace);
  }
}
async function scroll(locator, duration = 0.45) {
  await locator.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  for (let i = 0; i < 6; i++) {
    await sleep(55);
    await capture(duration / 6);
  }
}
async function concatFile(path, entries) {
  const text =
    'ffconcat version 1.0\n' +
    entries
      .map(
        (s) =>
          "file '" +
          s.file.replaceAll("'", "'\\''") +
          "'\nduration " +
          s.duration.toFixed(6) +
          '\n',
      )
      .join('') +
    "file '" +
    entries.at(-1).file +
    "'\n";
  await writeFile(path, text);
}
try {
  if (!renderOnly) {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {
        /* Wait for the local server to become ready. */
      }
      if (i === 99) throw new Error('Servidor local não iniciou');
      await sleep(150);
    }
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 540, height: 960 },
      deviceScaleFactor: 2,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      serviceWorkers: 'allow',
      reducedMotion: 'reduce',
      colorScheme: 'dark',
    });
    // A fresh context contains only the demonstration's local IndexedDB.
    // Only the local build is loaded; no production account or API is used.
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1' && url.protocol.startsWith('http')) {
        return route.abort();
      }
      return route.continue();
    });
    await context.route(base + '/__video-stage', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
    <style>
      *{box-sizing:border-box}html,body{margin:0;width:540px;height:960px;overflow:hidden}
      body{background:radial-gradient(ellipse at 12% 24%,#50307c38,transparent 58%),radial-gradient(ellipse at 90% 78%,#254f3e20,transparent 50%),#0d0d12;font-family:Inter,Arial,sans-serif}
      #screen{position:absolute;top:38px;left:54px;width:432px;height:786px;border-radius:25px;border:1px solid #ffffff22;overflow:hidden;box-shadow:0 22px 75px #0009;background:#101014}
      iframe{width:100%;height:100%;border:0;display:block}
      #tap{position:absolute;width:32px;height:32px;pointer-events:none;border:1.5px solid #b7edce;background:#b7edce20;border-radius:50%;opacity:0;z-index:3}
    </style><div id="screen"><iframe id="app" src="/"></iframe></div><div id="tap"></div></html>`,
      }),
    );
    stage = await context.newPage();
    await stage.goto(base + '/__video-stage');
    const iframe = await stage.locator('iframe').elementHandle();
    const app = await iframe.contentFrame();
    await app.getByRole('button', { name: 'Nova lista', exact: true }).waitFor();
    await app.getByText('Pronto para usar offline', { exact: true }).waitFor({ timeout: 20000 });
    await sleep(400);
    await capture(2.7, 'Tela inicial real do Vértice');
    await tap(app.getByRole('button', { name: 'Nova lista', exact: true }));
    await app.getByLabel('Nome da lista', { exact: true }).waitFor();
    await capture(0.7, 'Criação da lista');
    await type(app.getByLabel('Nome da lista', { exact: true }), 'Compras da semana', 0.12);
    await capture(0.65);
    await tap(app.getByRole('button', { name: 'Criar lista', exact: true }));
    const list = app.getByRole('link', { name: 'Abrir lista Compras da semana', exact: true });
    await list.waitFor();
    await capture(0.65);
    await tap(list);
    const category = app.getByRole('link').filter({
      has: app.getByRole('heading', { name: 'Essenciais', exact: true }),
    });
    await category.waitFor();
    await capture(0.6);
    await scroll(category);
    await capture(0.35);
    await tap(category);
    const add = app.getByRole('textbox', { name: 'Adicionar item', exact: true });
    await add.waitFor();
    await capture(0.5, 'Inclusão dos produtos');
    for (const name of ['Arroz', 'Feijão', 'Café']) {
      await type(add, name, 0.13);
      await capture(0.17);
      await tap(app.getByRole('button', { name: 'Adicionar item', exact: true }));
      await app.getByRole('heading', { name, exact: true }).waitFor();
      await capture(0.55);
    }
    for (const [name, price] of [
      ['Arroz', '24,90'],
      ['Feijão', '8,50'],
      ['Café', '18,90'],
    ]) {
      const checkbox = app.getByRole('checkbox', {
        name: 'Marcar ' + name + ' como comprado',
        exact: true,
      });
      await scroll(checkbox, 0.36);
      await capture(0.25);
      await tap(checkbox);
      const form = app.getByRole('form', { name: 'Valores de ' + name, exact: true });
      const input = form.getByLabel('Preço por un (R$)', { exact: true });
      await input.waitFor();
      await scroll(input, 0.4);
      await capture(0.4, 'Preço de ' + name + ': R$ ' + price);
      await type(input, price, 0.18);
      await capture(0.6);
      const save = form.getByRole('button', { name: 'Salvar valores', exact: true });
      await scroll(save, 0.36);
      await save.waitFor();
      for (let i = 0; i < 40 && !(await save.isEnabled()); i++) await sleep(50);
      await tap(save);
      await form.waitFor({ state: 'detached' });
      await capture(0.55);
    }
    const total = app.getByLabel('Total da categoria', { exact: true });
    if (!(await total.innerText()).includes('52,30')) throw new Error('Total incorreto');
    await tap(app.getByRole('link', { name: 'Compras da semana', exact: true }));
    const summary = app.getByLabel('Total da lista', { exact: true });
    await summary.waitFor();
    await scroll(summary, 0.5);
    if (!(await summary.innerText()).includes('52,30')) throw new Error('Resumo incorreto');
    await capture(1.4, 'Resumo: três produtos, total de R$ 52,30');
    // Keep the demonstration readable while targeting approximately 35 seconds overall.
    if (elapsed < 29.8) await capture(29.8 - elapsed);
    appDuration = elapsed;
    console.log(
      'APP_CAPTURE_COMPLETE duration=' + appDuration.toFixed(2) + ' shots=' + shots.length,
    );

    const endHTML = `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
    <style>
    *{box-sizing:border-box}html,body{margin:0;width:540px;height:960px;overflow:hidden}
    body{background:#0d0d12;color:white;font-family:Inter,Arial,sans-serif}
    #glow{position:absolute;inset:0;background:radial-gradient(ellipse at 48% 44%,#7137b83b,transparent 57%),radial-gradient(ellipse at 80% 75%,#49775b14,transparent 50%)}
    #brand{position:absolute;left:0;right:0;top:345px;display:flex;align-items:center;justify-content:center;gap:22px;transform-origin:center}
    #brand img{width:100px;height:100px}
    #name{font-size:77px;font-weight:800;line-height:1;letter-spacing:-.065em}
    #dot{color:#89e5a7}
    #phrase{position:absolute;top:494px;left:45px;right:45px;text-align:center;color:#d8cde5;font-size:23px;line-height:1.55;letter-spacing:-.025em}
    </style><div id="glow"></div><div id="brand"><img src="/icons/icon.svg" alt=""><span id="name">vértice<span id="dot">.</span></span></div><div id="phrase">Onde suas compras encontram<br>o equilíbrio.</div></html>`;
    await stage.setContent(endHTML);
    await stage.locator('#brand img').evaluate((img) => img.decode());
    const endDuration = 6.2;
    for (let i = 0; i < 75; i++) {
      const t = i / 12;
      const ease = (v) => {
        const c = Math.min(1, Math.max(0, v));
        return c * c * (3 - 2 * c);
      };
      const reveal = ease(t / 1.2);
      const phrase = ease((t - 0.65) / 1.1);
      await stage.evaluate(
        ({ reveal, phrase, t }) => {
          const brand = document.querySelector('#brand');
          brand.style.opacity = String(reveal);
          brand.style.transform =
            'translateY(' +
            12 * (1 - reveal) +
            'px) scale(' +
            (0.96 + 0.04 * reveal + Math.min(t, 4) * 0.002) +
            ')';
          const text = document.querySelector('#phrase');
          text.style.opacity = String(phrase);
          text.style.transform = 'translateY(' + 8 * (1 - phrase) + 'px)';
        },
        { reveal, phrase, t },
      );
      const file = resolve(frames, 'end-' + String(i).padStart(4, '0') + '.png');
      await stage.screenshot({ path: file });
      closing.push({ file, duration: endDuration / 75 });
    }
    await browser.close();
    browser = null;
    await concatFile(resolve(out, 'app.ffconcat'), shots);
    await concatFile(resolve(out, 'end.ffconcat'), closing);
    await writeFile(resolve(out, 'capture.json'), JSON.stringify({ appDuration, notes }));
    if (process.env.DEMO_CAPTURE_ONLY === '1') {
      server?.kill();
      console.log('CAPTURE_SAVED');
      process.exit(0);
    }
  } else {
    const metadata = JSON.parse(await readFile(resolve(out, 'capture.json'), 'utf8'));
    appDuration = metadata.appDuration;
    notes.push(...metadata.notes);
  }
  const endDuration = 6.2;
  exec([
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    resolve(out, 'app.ffconcat'),
    '-vf',
    'fps=30,format=yuv420p',
    '-an',
    '-c:v',
    'libx264',
    '-threads',
    '2',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    '-movflags',
    '+faststart',
    resolve(out, 'vertice-gravacao-bruta.mp4'),
  ]);
  exec([
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    resolve(out, 'end.ffconcat'),
    '-vf',
    'fps=30,format=yuv420p',
    '-an',
    '-c:v',
    'libx264',
    '-threads',
    '2',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    resolve(out, 'closing.mp4'),
  ]);
  const offset = appDuration - 1;
  const finalDuration = appDuration + endDuration - 1;
  const fade = finalDuration - 0.7;
  const camera =
    "zoompan=z='1.018+0.016*sin(on/30*0.28-1)':x='iw/2-(iw/zoom/2)':y='ih*0.43-(ih/zoom*0.43)':d=1:s=1080x1920:fps=30";
  exec([
    '-i',
    resolve(out, 'vertice-gravacao-bruta.mp4'),
    '-i',
    resolve(out, 'closing.mp4'),
    '-filter_complex',
    '[0:v]' +
      camera +
      ',setsar=1,settb=AVTB,setpts=PTS-STARTPTS,fps=30[a];[1:v]setsar=1,settb=AVTB,setpts=PTS-STARTPTS,fps=30[b];[a][b]xfade=transition=fade:duration=1:offset=' +
      offset.toFixed(4) +
      ',fade=t=in:st=0:d=0.5,fade=t=out:st=' +
      fade.toFixed(4) +
      ':d=0.7,format=yuv420p[v]',
    '-map',
    '[v]',
    '-an',
    '-t',
    finalDuration.toFixed(4),
    '-c:v',
    'libx264',
    '-threads',
    '2',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    '-movflags',
    '+faststart',
    '-metadata',
    'title=Vértice — sua lista de compras',
    resolve(out, 'vertice-lista-de-compras-1080x1920.mp4'),
  ]);
  const probe = JSON.parse(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_format',
        '-show_streams',
        '-of',
        'json',
        resolve(out, 'vertice-lista-de-compras-1080x1920.mp4'),
      ],
      { encoding: 'utf8' },
    ),
  );
  if (probe.streams[0].width !== 1080 || probe.streams[0].height !== 1920)
    throw new Error('Dimensão incorreta');
  if (probe.streams.some((s) => s.codec_type === 'audio'))
    throw new Error('O master deveria ser silencioso');
  exec([
    '-i',
    resolve(out, 'vertice-lista-de-compras-1080x1920.mp4'),
    '-vf',
    'fps=1/4,scale=360:640,tile=3x3',
    '-frames:v',
    '1',
    '-q:v',
    '5',
    resolve(out, 'contato-video.jpg'),
  ]);
  await writeFile(
    resolve(out, 'verificacao.json'),
    JSON.stringify(
      {
        sourceCommit: 'e625cb74d7dbbaa5a65a7b51951624414cd13a7d',
        recording:
          'Real application, isolated local legacy build with fictional shopping data; no production login or API',
        items: [
          { name: 'Arroz', price: '24.90' },
          { name: 'Feijão', price: '8.50' },
          { name: 'Café', price: '18.90' },
        ],
        quantity: '1',
        verifiedTotal: '52.30',
        notes,
        appDuration,
        finalDuration,
        video: probe.streams
          .filter((s) => s.codec_type === 'video')
          .map((s) => ({
            codec: s.codec_name,
            width: s.width,
            height: s.height,
            fps: s.avg_frame_rate,
          })),
        bytes: probe.format.size,
      },
      null,
      2,
    ),
  );
  await writeFile(
    resolve(out, 'narracao.txt'),
    `Suas compras começam com uma lista.

No Vértice, você cria, organiza e adiciona o que precisa levar.

No mercado, é só marcar os produtos e registrar os preços.

O total acompanha cada escolha, para você conferir quanto já gastou.

Mais clareza, do primeiro item ao fim da compra.

Vértice. Onde suas compras encontram o equilíbrio.
`,
  );
  await writeFile(
    resolve(out, 'legendas-sugeridas.srt'),
    `1
00:00:00,400 --> 00:00:04,000
Suas compras começam com uma lista.

2
00:00:04,000 --> 00:00:10,000
No Vértice, você cria, organiza
e adiciona o que precisa levar.

3
00:00:10,000 --> 00:00:17,000
No mercado, é só marcar os produtos
e registrar os preços.

4
00:00:17,000 --> 00:00:24,000
O total acompanha cada escolha,
para conferir quanto já gastou.

5
00:00:24,000 --> 00:00:29,000
Mais clareza, do primeiro item
ao fim da compra.

6
00:00:29,000 --> 00:00:34,500
Vértice. Onde suas compras
encontram o equilíbrio.
`,
  );
  await writeFile(
    resolve(out, 'LEIA-ME.txt'),
    `VÉRTICE — DEMONSTRAÇÃO

vertice-lista-de-compras-1080x1920.mp4: vídeo final vertical, H.264, 30 fps, sem áudio nem legendas fixas.
vertice-gravacao-bruta.mp4: gravação editável, antes dos zooms e do fechamento.
closing.mp4: fechamento da marca separado.
narracao.txt: sugestão de voz.
legendas-sugeridas.srt: ponto de partida; ajuste os tempos à sua gravação de voz.
contato-video.jpg: folha de contato do vídeo.

A gravação usa a versão atual do app em uma cópia local isolada, com dados fictícios. Não usa conta real nem altera produção. É a interface funcional do aplicativo, não uma reconstrução de telas.
`,
  );
  const contact = (await readFile(resolve(out, 'contato-video.jpg'))).toString('base64');
  for (let i = 0; i < contact.length; i += 8000)
    console.log(
      'CONTACT_CHUNK_' + String(i / 8000).padStart(4, '0') + ' ' + contact.slice(i, i + 8000),
    );
  console.log(
    'VIDEO_RENDER_COMPLETE ' +
      finalDuration.toFixed(2) +
      's 1080x1920 30fps silent total=52.30 bytes=' +
      probe.format.size,
  );
} catch (error) {
  if (stage) await stage.screenshot({ path: resolve(out, 'error.png') }).catch(() => {});
  await writeFile(resolve(out, 'erro.txt'), String(error.stack || error));
  throw error;
} finally {
  await browser?.close().catch(() => {});
  server?.kill();
}
