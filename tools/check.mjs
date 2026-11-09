#!/usr/bin/env node
// The walls a game must pass before it goes to NotesMosaic (the platform runs its own checks again: this catches what they would refuse,
// on your machine, in seconds).
//
//   node tools/check.mjs <game folder> [--engines chromium,webkit] [--static] [--plant remote|rights|vendor|boot|absolute]
//
// STATIC  S1 an index.html at the root · S2 no remote code (every script, module and stylesheet ships in the folder) · S3 relative paths
//         only · S4 rights.json names every vendored library and every asset folder · S5 the vendored files are byte for byte the
//         pinned releases (a change is allowed only where the lock records it) · S6 web file types only, no .br/.gz, under 50 MB
// DEVICE  D1 it boots: window.__MOSA_BOOT.ok within 30 s, in Chromium AND WebKit (iPhone's engine) · D2 no uncaught error ·
//         D3 it draws: 20+ frames in 2 s · D4 memory: the page's own report (window.__STACK_MEMORY, MB) under 128 (warn) / 192 (fail)
// --plant copies the game to a temp folder and breaks one rule there, to prove the wall turns red (the check must then exit 1).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { serve } from './serve.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
let game = path.resolve(argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1]?.startsWith('--') !== true) || '.');
const plant = opt('plant', null);
const engines = String(opt('engines', 'chromium,webkit')).split(',');
const fails = [], warns = [], oks = [];
const ok = (m) => oks.push(m), fail = (m) => fails.push(m), warn = (m) => warns.push(m);

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out); else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

if (plant) {                                                  // break one rule in a copy, never in the game itself
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-plant-'));
  fs.cpSync(game, tmp, { recursive: true }); game = tmp;
  const idx = path.join(game, 'index.html');
  if (plant === 'remote') fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replace('</head>', '<script type="module">import * as T from "https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js";</script></head>'));
  if (plant === 'absolute') fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replace('</head>', '<link rel="stylesheet" href="/style.css"></head>'));
  if (plant === 'rights') { const r = JSON.parse(fs.readFileSync(path.join(game, 'rights.json'), 'utf8')); r.others = r.others.slice(1); fs.writeFileSync(path.join(game, 'rights.json'), JSON.stringify(r)); }
  if (plant === 'vendor') { const f = path.join(game, 'vendor/three/three.module.js'); fs.appendFileSync(f, '\n// changed\n'); }
  if (plant === 'boot') fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replace('<head>', '<head><script>throw new Error("planted: the page dies before it boots")</script>'));
  console.log(`(plant "${plant}" in ${game})`);
}

// ── STATIC ──
const files = walk(game);
if (files.includes('index.html')) ok('S1 index.html at the root'); else fail('S1 no index.html at the root');

const code = files.filter((f) => /\.(html|m?js|css)$/i.test(f) && !f.startsWith('vendor/'));
const REMOTE = /(?:\bimport\s*(?:[^'"()]*?\bfrom\s*)?|\bimport\s*\(\s*|<script[^>]*\bsrc\s*=\s*|<link[^>]*\bhref\s*=\s*|\burl\(\s*|\bfetch\s*\(\s*|new\s+(?:Worker|URL)\s*\(\s*)['"]?(https?:)?\/\/(?!notesmosaic\.com\/engine\/)[^'")\s]+/gi;
const ABS = /(?:\bimport\s*(?:[^'"()]*?\bfrom\s*)?|\bimport\s*\(\s*|\bsrc\s*=\s*|\bhref\s*=\s*|\bfetch\s*\(\s*)['"]\/(?!\/)[^'"]*['"]/gi;
const remote = [], absolute = [];
for (const f of code) {
  const src = fs.readFileSync(path.join(game, f), 'utf8');
  for (const m of src.matchAll(REMOTE)) remote.push(`${f}: ${m[0].slice(0, 90)}`);
  for (const m of src.matchAll(ABS)) absolute.push(`${f}: ${m[0].slice(0, 90)}`);
  const im = /<script type="importmap">([\s\S]*?)<\/script>/.exec(src);
  if (im) for (const v of Object.values(JSON.parse(im[1]).imports || {})) { if (/^(https?:)?\/\//.test(v)) remote.push(`${f}: importmap → ${v}`); if (/^\/[^/]/.test(v)) absolute.push(`${f}: importmap → ${v}`); }
}
if (remote.length) fail('S2 remote code (vendor it with tools/stack.mjs):\n     ' + remote.slice(0, 6).join('\n     ')); else ok('S2 no remote code');
if (absolute.length) fail('S3 a path starting with "/" points outside the game:\n     ' + absolute.slice(0, 6).join('\n     ')); else ok('S3 relative paths only');

const rightsFile = path.join(game, 'rights.json');
if (!fs.existsSync(rightsFile)) fail('S4 no rights.json');
else {
  const r = JSON.parse(fs.readFileSync(rightsFile, 'utf8')); const others = r.others || []; const missing = [];
  if (r.schema !== 'mosa.rights.v1') missing.push('schema is not mosa.rights.v1');
  if (!String(r.mine || '').trim()) missing.push('"mine" is empty: say what you made');
  if (!String(r.searched || '').trim()) missing.push('"searched" is empty: say what you searched (the files and the web) and what you found');
  for (const id of fs.existsSync(path.join(game, 'vendor')) ? fs.readdirSync(path.join(game, 'vendor')) : []) {
    if (fs.existsSync(path.join(game, 'vendor', id, 'STACK.lock.json')) && !others.some((o) => String(o.from || '').startsWith(`vendor/${id}/`))) missing.push(`vendor/${id}/ is not in "others"`);
  }
  const assetDirs = new Set(files.filter((f) => f.startsWith('assets/')).map((f) => f.split('/').slice(0, 2).join('/')).filter((d) => !/\.[a-z0-9]+$/i.test(d)));
  for (const d of assetDirs) if (!others.some((o) => String(o.from || '').includes(d + '/')) && !String(r.mine || '').includes(d + '/')) missing.push(`${d}/ is credited nowhere (others[].from or mine)`);
  if (missing.length) fail('S4 rights.json:\n     ' + missing.join('\n     ')); else ok(`S4 rights.json names ${others.length} pieces (every vendored library and asset folder)`);
}

let changed = [];
for (const id of fs.existsSync(path.join(game, 'vendor')) ? fs.readdirSync(path.join(game, 'vendor')) : []) {
  const lockFile = path.join(game, 'vendor', id, 'STACK.lock.json'); if (!fs.existsSync(lockFile)) continue;
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  for (const [rel, f] of Object.entries(lock.files)) {
    const p = path.join(game, 'vendor', id, rel);
    if (!fs.existsSync(p)) { changed.push(`vendor/${id}/${rel} is missing`); continue; }
    if (crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') !== f.sha256) changed.push(`vendor/${id}/${rel} is not the vendored copy (re-run tools/stack.mjs add ${id})`);
  }
}
if (changed.length) fail('S5 vendored files changed:\n     ' + changed.slice(0, 6).join('\n     ')); else ok('S5 vendored files are the pinned releases');

const WEB = /\.(html|m?js|css|json|wasm|png|jpe?g|webp|gif|svg|glb|gltf|bin|ktx2|mp3|ogg|wav|m4a|mp4|webm|woff2?|ttf|otf|txt|md|csv|hdr)$/i;
const odd = files.filter((f) => !WEB.test(f)); const packed = files.filter((f) => /\.(br|gz)$/i.test(f));
const bytes = files.reduce((s, f) => s + fs.statSync(path.join(game, f)).size, 0);
if (odd.length || packed.length || bytes > 50e6) fail(`S6 files: ${[...odd, ...packed].slice(0, 5).join(', ')}${bytes > 50e6 ? ` · ${(bytes / 1e6).toFixed(1)} MB > 50` : ''}`);
else ok(`S6 ${files.length} web files, ${(bytes / 1e6).toFixed(1)} MB`);

// ── DEVICE ──
if (!opt('static', false) && !fails.some((f) => f.startsWith('S1'))) {
  let pw; try { pw = await import('playwright'); } catch { warn('D  playwright is not installed: npm i -D playwright && npx playwright install chromium webkit'); }
  if (pw) {
    const { server, url } = await serve(game);
    for (const name of engines) {
      // --enable-precise-memory-info: without it Chromium rounds performance.memory into ~4.5 MB buckets, and D4 read the same tree 189 or
      // 194 MB run to run (9 Nov: heap 77.6 / 82.4 bucketed against 44.3-44.8 exact) — a ceiling read on a rounded number is a coin toss
      const browser = await pw[name].launch(name === 'chromium' ? { args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] } : {});
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: name === 'chromium' });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 200)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
      const t0 = Date.now();
      await page.goto(url + 'index.html').catch((e) => errors.push('goto: ' + e.message));
      const booted = await page.waitForFunction(() => window.__MOSA_BOOT && window.__MOSA_BOOT.ok === true, null, { timeout: 30000 }).then(() => true).catch(() => false);
      const bootMs = Date.now() - t0;
      if (booted) ok(`D1 ${name}: booted in ${(bootMs / 1000).toFixed(1)} s`); else fail(`D1 ${name}: never said window.__MOSA_BOOT.ok = true in 30 s`);
      const frames = await page.evaluate(() => new Promise((r) => { let n = 0; const t = performance.now(); const f = () => { n++; performance.now() - t < 2000 ? requestAnimationFrame(f) : r(n); }; requestAnimationFrame(f); })).catch(() => 0);
      if (frames >= 20) ok(`D3 ${name}: ${frames} frames in 2 s`); else fail(`D3 ${name}: ${frames} frames in 2 s`);
      const mem = await page.evaluate(() => window.__STACK_MEMORY || null).catch(() => null);
      if (mem && typeof mem.totalMB === 'number') {
        const line = `D4 ${name}: ${mem.totalMB.toFixed(0)} MB (${Object.entries(mem).filter(([k]) => k !== 'totalMB').map(([k, v]) => `${k} ${Math.round(v)}`).join(', ')})`;
        if (mem.totalMB > 192) fail(line + ' > 192'); else if (mem.totalMB > 128) warn(line + ' > 128'); else ok(line);
      } else warn(`D4 ${name}: the page reports no window.__STACK_MEMORY {totalMB, …}`);
      if (errors.length) fail(`D2 ${name}: ${errors.length} error(s):\n     ` + errors.slice(0, 5).join('\n     ')); else ok(`D2 ${name}: no uncaught errors`);
      await browser.close();
    }
    server.close();
  }
}

for (const m of oks) console.log('✔ ' + m);
for (const m of warns) console.log('⚠ ' + m);
for (const m of fails) console.log('✖ ' + m);
console.log(fails.length ? `\n✖ ${fails.length} wall(s) red` : '\n✔ every wall holds');
process.exit(fails.length ? 1 : 0);
