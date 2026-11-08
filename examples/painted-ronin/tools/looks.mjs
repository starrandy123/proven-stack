#!/usr/bin/env node
// The painted look, seen the way a player sees it: boots the game once in a real browser and saves one picture per view — the valley
// away from the sun, the sky toward the sun (backlit clouds), a camp (smoke, rocks, banners, the ground), the cranes up close — at the
// film's size, and the same on a phone held upright. Pictures are for a person to judge; the walls (tests/walls.mjs) hold the rules.
//   node examples/painted-ronin/tools/looks.mjs <out folder> [--views valley,sun,camp,birds] [--phone] [--query plant=…]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../../../tools/serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const out = path.resolve(argv.find((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--')) || '.');
const views = opt('views', 'valley,sun,camp,birds').split(',');
const phone = argv.includes('--phone');
fs.mkdirSync(out, { recursive: true });
const pw = await import('playwright');
const { server, url } = await serve(path.resolve(HERE, '..'));
const browser = await pw.chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1600, height: 900 } });
const errors = []; page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
await page.goto(url + 'index.html?' + (opt('query', '') || ''));
await page.waitForFunction(() => window.__MOSA_BOOT && window.__MOSA_BOOT.ok === true, null, { timeout: 60000 });
await page.waitForTimeout(1500);
const SET = {
  valley: () => { const G = window.__GAME; G.cam.hold = false; G.cam.yaw = 2.9; G.cam.pitch = 0.02; G.cam.dist = 4.8; },
  // facing the sun: the camera sits on the far side of the ronin from it (sun azimuth 215°)
  sun: () => { const G = window.__GAME; G.cam.hold = false; G.cam.yaw = Math.atan2(-G.sunDir.x, -G.sunDir.z); G.cam.pitch = -0.12; G.cam.dist = 4.8; },
  camp: () => {
    const G = window.__GAME, c = G.env.camps[0].center; G.cam.hold = false;
    G.player.setPosition(c.x + 9, G.land.groundY(c.x + 9, c.z) + 0.3, c.z + 3); G.cam.yaw = Math.atan2(9, 3); G.cam.pitch = 0.18; G.cam.dist = 6.5;
  },
  birds: () => {
    const G = window.__GAME, m = new G.THREE.Matrix4(), p = new G.THREE.Vector3(), c = new G.THREE.Vector3();
    const n = Math.min(14, G.birds.mesh.count); for (let i = 0; i < n; i++) { G.birds.mesh.getMatrixAt(i, m); c.add(p.setFromMatrixPosition(m)); } c.divideScalar(n);
    G.cam.hold = true; G.cam.target.copy(c); G.cam.dist = 22; G.cam.pitch = -0.75;            // from below, as a player on the ground sees them
  },
};
for (const v of views) {
  await page.evaluate(`(${SET[v].toString()})()`);
  await page.waitForTimeout(v === 'camp' ? 2500 : 1200);
  if (v === 'birds') await page.evaluate(`(${SET.birds.toString()})()`), await page.waitForTimeout(150);
  const file = path.join(out, (phone ? 'phone_' : '') + v + '.png');
  await page.screenshot({ path: file });
  console.log('saved', file);
}
console.log(errors.length ? 'ERRORS:\n' + errors.slice(0, 6).join('\n') : 'no errors');
await browser.close(); server.close();
