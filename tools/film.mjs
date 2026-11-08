#!/usr/bin/env node
// Film a game on a HELD CLOCK: the page's time (performance.now, Date.now, requestAnimationFrame) is ours, advanced exactly one frame
// before each capture, so every frame of the video is a distinct frame of the game, however slow the effects are to render.
//   node tools/film.mjs <game folder> <out.mp4> --shot <shot.js> [--seconds 6] [--fps 30] [--w 1600] [--h 900] [--query "a=b"] [--rehearse]
// --rehearse: the same held clock with NO pictures, then the shot's own log (window.__filmLog: lines the shot pushes) — rehearse a fight
// beat by beat before filming it; it is fast, and it finds the game's own defects (8 Nov: a guard that never blocked, a dropped press).
// <shot.js> is evaluated in the page once the game has booted. It defines window.__film = (t, dt) => { … } (t = seconds of film),
// called before every frame: move the camera, call the game's functions, press keys through window.__keys('KeyW', true).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';

const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const [dir, out] = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
const seconds = +opt('seconds', 6), fps = +opt('fps', 30), W = +opt('w', 1600), H = +opt('h', 900), rehearse = argv.includes('--rehearse');
const shot = fs.readFileSync(opt('shot'), 'utf8');
const pw = await import('playwright');
const { server, url } = await serve(path.resolve(dir));
const browser = await pw.chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = []; page.on('pageerror', (e) => errors.push(String(e.message || e)));
await page.addInitScript(() => {
  let now = 0; let queue = [];
  performance.now = () => now;
  const d0 = 1.7e12; Date.now = () => d0 + now;
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = () => {};
  window.__step = (ms) => { now += ms; const run = queue; queue = []; for (const cb of run) cb(now); return run.length; };
  window.__keys = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
});
await page.goto(url + 'index.html' + (opt('query') ? '?' + opt('query') : ''));
// boot on the held clock: step until the game says it painted its first frame
for (let i = 0; i < 2000; i++) {
  const ok = await page.evaluate(() => { window.__step(1000 / 60); return !!(window.__MOSA_BOOT && window.__MOSA_BOOT.ok); });
  if (ok) break; if (i % 50 === 49) await page.waitForTimeout(50);
}
// the page's own loading screen fades on the browser's real clock (a CSS transition, not the held one): wait until it is gone, so no
// frame of the film shows it (8 Nov: the first frames of every clip still carried the fading title)
await page.waitForFunction(() => { const l = document.getElementById('loading'); if (!l) return true; const cs = getComputedStyle(l); return cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0; }, null, { timeout: 15000 }).catch(() => {});
await page.evaluate(shot);
for (let i = 0; i < 30; i++) await page.evaluate(() => window.__step(1000 / 60));            // settle a half second
const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'film-'));
const N = Math.round(seconds * fps), dtMs = 1000 / fps;
for (let i = 0; i < N; i++) {
  await page.evaluate(([t, dt]) => { window.__filmT = t; if (window.__film) window.__film(t, dt); window.__step(dt * 1000); }, [i / fps, dtMs / 1000]);
  if (!rehearse) await page.screenshot({ path: path.join(frames, String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
}
if (rehearse) {
  const log = await page.evaluate(() => window.__filmLog || []);
  await browser.close(); server.close(); fs.rmSync(frames, { recursive: true, force: true });
  console.log(log.join('\n')); console.log(`✔ rehearsed ${N} frames at ${fps} fps${errors.length ? ' · page errors: ' + errors.slice(0, 3).join(' | ') : ' · no page errors'}`);
  process.exit(0);
}
await browser.close(); server.close();
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(fps), '-i', path.join(frames, '%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-movflags', '+faststart', out]);
fs.rmSync(frames, { recursive: true, force: true });
console.log(`✔ ${out}: ${N} frames at ${fps} fps, ${W}x${H}${errors.length ? ' · page errors: ' + errors.slice(0, 3).join(' | ') : ''}`);
