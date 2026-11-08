#!/usr/bin/env node
// Measure every clip in the real game: when each blow LANDS (the peaks of the sword tip's speed) and the path the blade draws (the
// sword's base and tip each 1/60 s, in the character's own frame). The game reads assets/clipdata.json: an enemy's impact times, the
// player's cancel windows and the slash arcs all come from the animation as it really moves, never from a guess.
//   node examples/painted-ronin/tools/measure_clips.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../../../tools/serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), GAME = path.resolve(HERE, '..');
const pw = await import('playwright');
const { server, url } = await serve(GAME);
const browser = await pw.chromium.launch({ args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.goto(url + 'index.html?test&cine');
await page.waitForFunction(() => window.__MOSA_BOOT && window.__MOSA_BOOT.ok === true, null, { timeout: 45000 });
const data = await page.evaluate(() => {
  const G = window.__GAME, T = G.THREE, out = {};
  const p = new G.ronin.constructor(G.kit, 'ronin'); p.root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(p.root.matrixWorld).invert();
  for (const [name, clip] of Object.entries(G.kit.clips)) {
    if (!/^(Sword|Melee|Hit|NinjaJump|Slide|Roll|two-handed|spear|kick|dodge|weapon|sword-block|death)/.test(name)) continue;
    p.mixer.stopAllAction(); const a = p.mixer.clipAction(clip); a.reset(); a.play(); a.paused = true;
    const dur = clip.duration, N = Math.max(2, Math.round(dur * 60)), tip = [], base = [], speed = [];
    const t3 = new T.Vector3(), b3 = new T.Vector3(); let prev = null;
    for (let i = 0; i <= N; i++) {
      a.time = Math.min(dur, i / 60); p.mixer.update(0); p.root.updateMatrixWorld(true);
      p.sword.userData.tip.getWorldPosition(t3).applyMatrix4(inv); p.sword.userData.base.getWorldPosition(b3).applyMatrix4(inv);
      tip.push(t3.toArray().map((v) => +v.toFixed(3))); base.push(b3.toArray().map((v) => +v.toFixed(3)));
      speed.push(prev ? t3.distanceTo(prev) * 60 : 0); prev = t3.clone();
    }
    const top = Math.max(...speed), hits = [];
    for (let i = 2; i < speed.length - 2; i++) {                       // a blow: a local peak of the tip's speed, at least 55% of the clip's fastest
      if (speed[i] >= 0.55 * top && speed[i] >= speed[i - 1] && speed[i] >= speed[i + 1] && speed[i] >= speed[i - 2] && speed[i] >= speed[i + 2]
        && (!hits.length || i / 60 - hits[hits.length - 1] > 0.18)) hits.push(+(i / 60).toFixed(3));
    }
    out[name] = { duration: +dur.toFixed(3), hits, topSpeed: +top.toFixed(2), tip, base };
  }
  return out;
});
await browser.close(); server.close();
fs.writeFileSync(path.join(GAME, 'assets', 'clipdata.json'), JSON.stringify(data));
for (const [k, v] of Object.entries(data)) console.log(k.padEnd(22), 'dur', v.duration, 'hits', JSON.stringify(v.hits), 'tip speed max', v.topSpeed, 'm/s');
