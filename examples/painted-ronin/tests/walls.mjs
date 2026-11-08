#!/usr/bin/env node
// Painted Ronin's walls, each a measurement of the running game in a real browser (never a picture judged by eye):
//   W2 ragdolls  — three bandits cut down from three sides: every knee and elbow stays in its anatomical range (−15°..155°: a real elbow or knee hyperextends a little; the defect is the fold the wrong way, which reads past −100°, measured
//                  from the bones, not from the joint settings), the bodies come to rest on the ground, nothing is NaN
//   W3 pursuit   — a camp's bandit reaches the ronin through Recast & Detour within 6 s
//   W4 combat    — the ronin's strikes take a bandit down within six blows
//   W5 phone     — at a phone's size the page's own memory count stays under 192 MB (NotesMosaic's ceiling)
//   node examples/painted-ronin/tests/walls.mjs [--engine chromium|webkit] [--plant knee]   (a plant must turn its wall red: exit 1)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../../../tools/serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const engine = opt('engine', 'chromium'), plant = opt('plant', null);
const pw = await import('playwright');
const { server, url } = await serve(path.resolve(HERE, '..'));
const browser = await pw[engine].launch(engine === 'chromium' ? { args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : {});
const results = [];
const wall = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✔' : '✖'} ${name}: ${detail}`); };

async function open(query, viewport = { width: 960, height: 540 }) {
  const page = await browser.newPage({ viewport });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e.message || e)));
  await page.goto(url + 'index.html?' + query);
  await page.waitForFunction(() => window.__MOSA_BOOT && window.__MOSA_BOOT.ok === true, null, { timeout: 45000 });
  await page.waitForTimeout(800);
  return { page, errors };
}

// W2: ragdolls
{
  const { page, errors } = await open('test' + (plant ? '&plant=' + plant : ''));
  const r = await page.evaluate(async () => {
    const G = window.__GAME, T = G.THREE, wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const dirs = [new T.Vector3(1, 0, 0), new T.Vector3(0, 0, -1), new T.Vector3(-0.7, 0, 0.7).normalize()];
    const range = {}; let nan = false;
    G.bandits.list.forEach((b, i) => G.bandits.kill(b, dirs[i % 3], 2));
    for (let k = 0; k < 80; k++) {
      await wait(50);
      for (const b of G.bandits.list) {
        const m = G.anatomicalBends(b, G.rest);
        for (const [j, v] of Object.entries(m)) { if (!Number.isFinite(v)) nan = true; range[j] = range[j] || [1e9, -1e9]; range[j][0] = Math.min(range[j][0], v); range[j][1] = Math.max(range[j][1], v); }
      }
    }
    const rest = G.bandits.list.map((b) => { const p = new T.Vector3(); b.bones.pelvis.getWorldPosition(p); return +(p.y - G.land.groundY(p.x, p.z)).toFixed(2); });
    return { range, nan, rest };
  });
  const bad = Object.entries(r.range).filter(([, [lo, hi]]) => lo < -15 || hi > 155);
  wall('W2 ragdolls', !r.nan && !bad.length && r.rest.every((h) => h > -0.3 && h < 1.0) && !errors.length,
    Object.entries(r.range).map(([j, [lo, hi]]) => `${j} ${lo.toFixed(0)}..${hi.toFixed(0)}°`).join(' · ') + ` · pelvis above ground ${r.rest.join(', ')} m` + (r.nan ? ' · NaN' : '') + (errors.length ? ' · ' + errors[0] : ''));
  await page.close();
}

if (!plant) {
  // W3 + W4: pursuit and combat at camp 1
  const { page, errors } = await open('test');
  const r = await page.evaluate(async () => {
    const G = window.__GAME, c = G.land.spots.camps[1], wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const x = c.x + 11, z = c.y; G.player.setPosition(x, G.land.groundY(x, z) + 0.3, z);
    const b = G.bandits.list.find((o) => o.nav === G.navs[1]);
    let reached = null; const t0 = performance.now();
    for (let k = 0; k < 60; k++) { await wait(100); if (b.root.position.distanceTo(G.ronin.root.position) < 2.5) { reached = (performance.now() - t0) / 1000; break; } }
    let blows = 0;
    for (let k = 0; k < 40 && !b.dead && blows < 6; k++) {
      const to = b.root.position.clone().sub(G.ronin.root.position); G.facing = Math.atan2(to.x, to.z);
      if (!G.pc.strike && to.length() < 2.6) { G.strike(blows % 3); blows++; }
      await wait(250);
    }
    return { reached, dead: !!b.dead, blows };
  });
  wall('W3 pursuit', r.reached !== null && !errors.length, r.reached !== null ? `the bandit reached the ronin in ${r.reached.toFixed(1)} s` : 'never reached him in 6 s');
  wall('W4 combat', r.dead, `down in ${r.blows} blow(s)`);
  await page.close();

  // W5: memory at a phone's size
  const ph = await open('', { width: 390, height: 844 });
  await ph.page.waitForTimeout(1500);
  const mem = await ph.page.evaluate(() => window.__STACK_MEMORY);
  wall('W5 phone', mem && mem.totalMB < 192, mem ? `${mem.totalMB.toFixed(0)} MB (${Object.entries(mem).filter(([k]) => k !== 'totalMB').map(([k, v]) => k + ' ' + Math.round(v)).join(', ')})` : 'no report');
  await ph.page.close();
}

await browser.close(); server.close();
const red = results.filter((x) => !x.ok).length;
console.log(red ? `\n✖ ${red} wall(s) red (${engine}${plant ? ', plant ' + plant : ''})` : `\n✔ every wall holds (${engine})`);
process.exit(red ? 1 : 0);
