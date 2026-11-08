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
  // THE FEET, for a clip the game carries by its own planted foot (Daniel Holden, foot locking: a planted foot keeps "a static position on
  // the floor which was the toe's location when the contact first became active"; research J §1c): each foot's middle (ankle and ball)
  // across and ahead, and its lowest height, every 1/60 s in the character's own frame. Sword_Dash is authored in place (its root bone
  // never moves), so the body's travel is what its feet say.
  const FEET = new Set(['Sword_Dash']);
  const p = new G.ronin.constructor(G.kit, 'ronin'); p.root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(p.root.matrixWorld).invert();
  for (const [name, clip] of Object.entries(G.kit.clips)) {
    if (!/^(Sword|Melee|Hit|NinjaJump|Slide|Roll|two-handed|spear|kick|dodge|weapon|sword-block|death)/.test(name)) continue;
    p.mixer.stopAllAction(); const a = p.mixer.clipAction(clip); a.reset(); a.play(); a.paused = true;
    const dur = clip.duration, N = Math.max(2, Math.round(dur * 60)), tip = [], base = [], speed = [];
    const t3 = new T.Vector3(), b3 = new T.Vector3(); let prev = null;
    const feet = FEET.has(name) ? [] : null, fa = new T.Vector3(), fb = new T.Vector3();
    const foot = (s) => { p.bones['foot_' + s].getWorldPosition(fa).applyMatrix4(inv); p.bones['ball_' + s].getWorldPosition(fb).applyMatrix4(inv);
      return [+((fa.x + fb.x) / 2).toFixed(4), +((fa.z + fb.z) / 2).toFixed(4), +Math.min(fa.y, fb.y).toFixed(4)]; };
    for (let i = 0; i <= N; i++) {
      a.time = Math.min(dur, i / 60); p.mixer.update(0); p.root.updateMatrixWorld(true);
      p.sword.userData.tip.getWorldPosition(t3).applyMatrix4(inv); p.sword.userData.base.getWorldPosition(b3).applyMatrix4(inv);
      tip.push(t3.toArray().map((v) => +v.toFixed(3))); base.push(b3.toArray().map((v) => +v.toFixed(3)));
      speed.push(prev ? t3.distanceTo(prev) * 60 : 0); prev = t3.clone();
      if (feet) feet.push([...foot('l'), ...foot('r')]);               // [left x, z, y, right x, z, y]
    }
    const top = Math.max(...speed), hits = [];
    for (let i = 2; i < speed.length - 2; i++) {                       // a blow: a local peak of the tip's speed, at least 55% of the clip's fastest
      if (speed[i] >= 0.55 * top && speed[i] >= speed[i - 1] && speed[i] >= speed[i + 1] && speed[i] >= speed[i - 2] && speed[i] >= speed[i + 2]
        && (!hits.length || i / 60 - hits[hits.length - 1] > 0.18)) hits.push(+(i / 60).toFixed(3));
    }
    // the CONTACT: while the blade is fast (35% of its top speed or more), the frame where its tip crosses in front of the body
    // (ahead, z > 0.3 m) closest to the centreline, preferring torso height. A target that stands THERE is cut; the speed peak alone
    // can be the wind-up (the two-handed swing's peak is overhead at 2 m)
    let best = -1, score = 1e9;
    for (const torso of [true, false]) {                             // torso height first (0.6-1.8 m); any height only if it never passes there
      for (let i = 1; i < tip.length - 1; i++) {
        const [x, y, z] = tip[i]; if (speed[i] < 0.35 * top || z < 0.3 || (torso && (y < 0.6 || y > 1.8))) continue;
        const sc = Math.abs(x) + 0.3 * Math.abs(y - 1.15);
        if (sc < score) { score = sc; best = i; }
      }
      if (best > 0) break;
    }
    let contact = null;
    if (best > 0) {
      const p0 = tip[best - 1], p1 = tip[best + 1];
      contact = { t: +(best / 60).toFixed(3), frame: best, tip: tip[best], reach: +tip[best][2].toFixed(3), off: +tip[best][0].toFixed(3),
        swing: [0, 1, 2].map((k) => +((p1[k] - p0[k]) * 30).toFixed(2)) };
    }
    out[name] = { duration: +dur.toFixed(3), hits, contact, topSpeed: +top.toFixed(2), tip, base, ...(feet ? { feet } : {}) };
  }
  return out;
});
await browser.close(); server.close();
fs.writeFileSync(path.join(GAME, 'assets', 'clipdata.json'), JSON.stringify(data));
for (const [k, v] of Object.entries(data)) console.log(k.padEnd(28), 'dur', v.duration, 'contact', v.contact ? `${v.contact.t}s reach ${v.contact.reach} off ${v.contact.off} h ${v.contact.tip[1]} swing [${v.contact.swing}]` : 'none');
