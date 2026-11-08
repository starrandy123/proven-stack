#!/usr/bin/env node
// See the game the way a player does: boot it in a real browser on this machine's GPU, play a few inputs, save a picture.
//   node tools/shot.mjs <game folder> <out.png> [--w 1280] [--h 720] [--engine chromium|webkit] [--keys "KeyW:2000,KeyF:100"] [--eval "<js>"] [--wait 1500]
// --keys holds each key for its milliseconds, in order; --eval runs in the page after boot (e.g. move the camera); prints errors.
import path from 'node:path';
import { serve } from './serve.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const [dir, out] = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
const pw = await import('playwright');
const { server, url } = await serve(path.resolve(dir));
const engine = opt('engine', 'chromium');
const browser = await pw[engine].launch(engine === 'chromium' ? { args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : {});
const page = await browser.newPage({ viewport: { width: +opt('w', 1280), height: +opt('h', 720) } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('[game]')) errors.push(m.type() + ': ' + m.text()); });
await page.goto(url + 'index.html');
await page.waitForFunction(() => window.__MOSA_BOOT && window.__MOSA_BOOT.ok === true, null, { timeout: 30000 });
await page.waitForTimeout(+opt('wait', 1500));
if (opt('eval')) console.log('eval →', JSON.stringify(await page.evaluate(opt('eval'))));
for (const step of String(opt('keys', '')).split(',').filter(Boolean)) {
  const [key, ms] = step.split(':'); await page.keyboard.down(key); await page.waitForTimeout(+ms || 100); await page.keyboard.up(key);
}
if (opt('after')) await page.waitForTimeout(+opt('after'));
await page.screenshot({ path: out });
console.log('saved', out, errors.length ? '\nerrors:\n' + errors.slice(0, 8).join('\n') : '(no errors)');
await browser.close(); server.close();
