#!/usr/bin/env node
// Painted Ronin's walls, each a measurement of the running game in a real browser (never a picture judged by eye):
//   W2 ragdolls  — three bandits cut down from three sides: every knee and elbow stays in its anatomical range (−15°..155°: a real elbow or knee hyperextends a little; the defect is the fold the wrong way, which reads past −100°, measured
//                  from the bones, not from the joint settings), the bodies come to rest on the ground, nothing is NaN
//   W3 pursuit   — a camp's bandit reaches the ronin through Recast & Detour within 6 s
//   W4 combat    — the ronin's strikes take a bandit down within six blows
//   W5 phone     — at a phone's size the page's own memory count stays under 192 MB (NotesMosaic's ceiling)
//   W6 dash      — 閃: two bandits standing in the blade's line both fall
//   W7 storm     — 嵐: the bandits around the ronin fall, those beyond its reach stand
//   W9 contact   — at each strike's impact the REAL sword tip (read off the skeleton, not the clip data) is inside the bandit's body:
//                  within 0.6 m of his axis, between knee and head height, three strikes of the combo
//   W8 turns     — four bandits fight him 8 s: the attack budget is never overspent (≤ 10: two cuts, or a combo and a cut), never
//                  more than two strike at once, and no two impacts land under 300 ms apart (Kingdoms of Amalur; Ghost of Tsushima).
//                  The bound read is 0.29 s: impacts are stamped on rendered frames, and 10 ms is under one frame at 60 fps.
//   W10 the lock — a bandit 7 m off to the ronin's side (110° from where he faces, outside the old 70° cone): one press of strike goes
//                  to HIM and the blow lands (Arkham's Freeflow: a strike finds the enemy; God of War's targeting)        plant nolock
//   W11 the dash — that strike crosses the 7 m as a DASH ATTACK, never a jump (research J §1; the owner, 8 Nov: "No front flip!" · "Just
//                  dash attack" · "just dash to the opponent with the leg bend"): Quaternius's Sword_Dash, the body ≤ 0.15 m over the
//                  ground (kendo: "forward instead of upward"), the FRONT knee bent at mid-dash (≤ KNEE_MAX°, the inner angle off the
//                  bones; a straight leg reads ~180°), no planted foot sliding more than 0.35 m before the cut (Holden's foot locking:
//                  the stiller foot on the ground, frame by frame, off the bones), and the blow lands; from 3.5 m the combo's own cut
//                  lunges off the ground (≥ 0.05 m, ≤ 0.35 m slid)                      plants frog, strideleap, slide, flatdash
//   W14 the guard — a bandit facing the ronin with his guard up (blockChance 1) blocks the combo's sideways first cut: a guard faces the
//                  man who strikes, not the way his cut pushes (found 8 Nov rehearsing the showcase's clash: none was ever blocked) plant guardpush
//   W15 the chain — a press made after the clash, while the blocked cut recovers, chains into the second cut (Sword_Regular_A's clip
//                  ends before a blocked cut's window, and the press was dropped: no combo went on past a block)  plant dropchain
//   W12 the press — the brush presses where the blade wounds: a cut that wounds is ≥ 1.6× as wide as a cut in the air, a cut that
//                  kills ≥ 2.6× (and ≥ 1.3× a wound) and lingers ≥ 1.2 s; 閃's ink line swells ≥ 1.8× over a body it kills (sumi-e: light
//                  pressure thin, heavy pressure bold; the owner, 8 Nov: "thicker as they injure their enemies … and show death") plant nopress
//   W16 the blot — a cut that wounds or kills shows an ink blot BEHIND the fighters (his own pixels unchanged by it) for 0.07 s of game
//                  time, held through the hit-stop, its ink flung 0.6-1.8× his height from the wound (round 2's strokes: a reach, not a
//                  disc's area; ≥ 0.5 % of the frame), the stroke bare paper meanwhile; none on a miss or a
//                  block (the ink cut's contact; Sakuga Booru's shock frames)                  plants noblot, blotfront, paperoff
//   W17 the flecks — a wound flings 9 drops along the stroke's own travel (4 crimson, 5 ink) and 3 ink back, a kill 14 (10 crimson); each
//                  lands as a stain lying on the terrain's own triangles (≤ 1 cm) and has dried away by 2.35 s (a kill 2.95 s), read in
//                  pixels from above; a miss flings none                      plants nostains, floatstains, nodry, missflecks
//   W18 the chiburi — standing still after a wound, Sword_Regular_A_Rec flicks 4 crimson drops off the REAL blade tip 1.0-1.6 s after the
//                  cut; they land in a line (≤ 0.15 m off it, ≥ 0.25 m along), each stain length ÷ width within 12 % of 1/sin α of its
//                  drop's flight; no flick after a cut in the air                                plants nochiburi, chiburimiss
//   W19 the crimson — the stroke's own pixels: a cut in the air ≤ 2 % crimson; a wound ≥ 5 %, its inner half ≥ 2× its outer; a kill
//                  ≥ 30 % and ≥ 1.5× a wound (flooded)                                                    plant misscrimson
//   W20 no square corners — every mark of the ink comes whole, as MyPaint's brush lays it (the owner, 9 Nov: "One corner looks too square
//                  and shart … And rectangle I mean"): each of a wound's and a kill's 16 strokes, drawn alone, starts in a round press (just past
//                  its start ≤ 0.75 of its widest, with its bleed and its ink alone; a straight cut reads ~1), and no droplet, flying drop or
//                  stain draws a pixel on its tile's outer 3 % (puff_a's and dab_oil's cut sides); both looks          plants flatstart, rimoff
//   W21 brush strokes — the splash is strokes, not a smudge (the owner, 8 Nov: "It just looks like black smudge"): its outline ≥ 4× a
//                  disc's (perimeter² ÷ 4π·area), ≥ 2 palette tones each ≥ 3 % of it, ≥ 1.5× longer along the cut's travel than across  plant smudge
//   W22 pixel art — after the oil pass, in the final picture read off the screen, ≥ 85 % of the splash's cells that meet another tone are
//                  one value (the owner: "making sure it looks pixelly but painted as well")                              plant nopixel
//   W13 clear view — the follow camera never sits inside a camp's smoke column: with the ronin 1 m from a fire and the camera aimed
//                  through it, the lens stays ≥ 2.5 m from the smoke's axis (Cinemachine's collider; the 8 Nov reveal went white)  plant camclip
//   node examples/painted-ronin/tests/walls.mjs [--engine chromium|webkit] [--plant knee] [--only W2,W3,W6,W8,W9,W10,W14,W12,ink,W20,W22,W13,W5]
//   (a plant must turn its wall red: exit 1)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../../../tools/serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const engine = opt('engine', 'chromium'), plant = opt('plant', null);
// --only W14,ink: run just those blocks (a plant's own walls); every wall runs by default
const only = opt('only', null), want = (k) => !only || only.split(',').includes(k);
const pw = await import('playwright');
const { server, url } = await serve(path.resolve(HERE, '..'));
const browser = await pw[engine].launch(engine === 'chromium' ? { args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : {});
const results = [];
let blockBlots = null;
const wall = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✔' : '✖'} ${name}: ${detail}`); };

async function open(query, viewport = { width: 960, height: 540 }) {
  const page = await browser.newPage({ viewport });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e.message || e)));
  await page.goto(url + 'index.html?' + query + (plant && !query.includes('plant=') ? (query ? '&' : '') + 'plant=' + plant : ''));
  await page.waitForFunction(() => window.__MOSA_BOOT && window.__MOSA_BOOT.ok === true, null, { timeout: 45000 });
  await page.waitForTimeout(800);
  return { page, errors };
}

// W2: ragdolls
if (want('W2')) {
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

{
  if (want('W3')) {
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

  }
  // W6 + W7: the specials, each on a fresh page with camp 0's bandits placed by hand (teleported on their own navmesh, told to hold)
  const special = async (kind) => {
    const { page, errors } = await open('');
    const r = await page.evaluate(async (kind) => {
      const G = window.__GAME, wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const c = G.land.spots.camps[0], camp = G.bandits.list.filter((b) => b.nav === G.navs[0]);
      const place = (b, x, z) => { const { point } = b.nav.query.findClosestPoint({ x, y: G.land.groundY(x, z), z }); b.agent.teleport(point); b.state = 'hold'; b.agent.resetMoveTarget(); };
      const x0 = c.x + 10, z0 = c.y; G.player.setPosition(x0, G.land.groundY(x0, z0) + 0.3, z0); await wait(300);
      for (const b of camp) b.state = 'hold';                                // nobody else walks into the test
      const p = G.ronin.root.position;
      if (kind === 'dash') { G.facing = Math.atan2(-1, 0); place(camp[0], p.x - 3, p.z); place(camp[1], p.x - 6, p.z + 0.4); place(camp[2], p.x + 8, p.z + 8); place(camp[3], p.x + 9, p.z - 8); }
      else { place(camp[0], p.x + 2, p.z); place(camp[1], p.x - 1.5, p.z + 1.5); place(camp[2], p.x + 9, p.z + 9); place(camp[3], p.x - 9, p.z - 9); }
      await wait(300); G.pc.ki = 100; kind === 'dash' ? G.dashSpecial() : G.stormSpecial(); await wait(kind === 'dash' ? 1600 : 3500);
      return { down: [camp[0].dead, camp[1].dead], spared: [camp[2].dead, camp[3].dead] };
    }, kind);
    await page.close();
    return { ...r, errors };
  };
  if (want('W6')) { const r = await special('dash'); wall('W6 dash', r.down.every(Boolean) && !r.spared.some(Boolean) && !r.errors.length, `in the line: ${r.down.filter(Boolean).length}/2 down · out of it: ${r.spared.filter((d) => !d).length}/2 standing`); }
  if (want('W6')) { const r = await special('storm'); wall('W7 storm', r.down.every(Boolean) && !r.spared.some(Boolean) && !r.errors.length, `around him: ${r.down.filter(Boolean).length}/2 down · beyond 3.6 m: ${r.spared.filter((d) => !d).length}/2 standing`); }

  // W8: turn-taking, measured on camp 0's four live bandits while the ronin stands among them (invulnerable, not striking)
  if (want('W8')) {
    const { page, errors } = await open('');
    const r = await page.evaluate(async () => {
      const G = window.__GAME, wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const c = G.land.spots.camps[0]; G.player.setPosition(c.x + 2, G.land.groundY(c.x + 2, c.y) + 0.3, c.y);
      const impacts = [], seen = { maxSpent: 0, maxAttackers: 0 };
      const was = G.bandits.onBlow; G.bandits.onBlow = (b, d, k) => { impacts.push(G.bandits.time); };
      for (let i = 0; i < 80; i++) {
        G.pc.invuln = 1; G.pc.hp = 100; await wait(100);
        seen.maxSpent = Math.max(seen.maxSpent, G.bandits.spent);
        seen.maxAttackers = Math.max(seen.maxAttackers, G.bandits.list.filter((b) => b.state === 'attack').length);
      }
      G.bandits.onBlow = was;
      let minGap = 9; for (let i = 1; i < impacts.length; i++) minGap = Math.min(minGap, impacts[i] - impacts[i - 1]);
      return { ...seen, impacts: impacts.length, minGap: +minGap.toFixed(3) };
    });
    wall('W8 turns', r.maxSpent <= 10 && r.maxAttackers <= 2 && r.minGap >= 0.29 && r.impacts >= 3 && !errors.length,
      `budget peak ${r.maxSpent}/10 · at most ${r.maxAttackers} striking at once · ${r.impacts} impacts, closest ${r.minGap} s apart`);
    await page.close();
  }

  // W9: the blade connects (each strike of the combo on a bandit standing 3.5 m in front of the ronin)
  if (want('W9')) {
    const { page, errors } = await open('');
    const r = await page.evaluate(async () => {
      const G = window.__GAME, T = G.THREE, wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      G.bandits.blockChance = 0; G.bandits.feintChance = 0;
      const c = G.land.spots.camps[0], camp = G.bandits.list.filter((b) => b.nav === G.navs[0]);
      const x0 = c.x + 10, z0 = c.y; G.player.setPosition(x0, G.land.groundY(x0, z0) + 0.3, z0); await wait(300);
      for (const b of camp) b.state = 'hold';
      const away = (b) => { const { point } = b.nav.query.findClosestPoint({ x: c.x - 9, y: G.land.groundY(c.x - 9, c.y + 9), z: c.y + 9 }); b.agent.teleport(point); b.state = 'hold'; };
      camp.forEach(away);                                                // bystanders out of the aim's 6 m: each strike has one target
      const out = [];
      for (let k = 0; k < 3; k++) {
        const b = camp[k]; b.hp = 99; const p = G.ronin.root.position;
        const { point } = b.nav.query.findClosestPoint({ x: p.x - 3.5, y: p.y, z: p.z }); b.agent.teleport(point); b.state = 'hold';
        await wait(250); G.facing = Math.atan2(-1, 0); G.pc.strike = null;
        G.strike(k);
        // the real blade's closest pass to his axis over the contact window (impact −50 ms … +70 ms), every rendered frame: a fast
        // swing moves the tip a metre in one frame, so the cut is judged on its sweep, as the eye sees it
        const res = await new Promise((ok) => { let best = { d: 9, h: 0 }; const tick = () => { const st = G.pc.strike;
          if (!st) return ok(best.d < 9 ? { ...best, clip: 'ended' } : null);
          if (st.t >= st.impact - 0.05) {
            const tip = new T.Vector3(); G.ronin.sword.userData.tip.getWorldPosition(tip); const base = new T.Vector3(); G.ronin.sword.userData.base.getWorldPosition(base);
            const bp = b.root.position;
            for (let i = 0; i <= 10; i++) { const q = base.clone().lerp(tip, i / 10); const dd = Math.hypot(q.x - bp.x, q.z - bp.z); const hh = q.y - bp.y; if (hh > 0.25 && hh < 1.95 && dd < best.d) best = { d: +dd.toFixed(2), h: +hh.toFixed(2) }; }
          }
          if (st.t >= st.impact + 0.07) return ok({ ...best, clip: st.def.clip });
          requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
        out.push(res); await wait(900); away(b);
      }
      return out;
    });
    const ok = r.every((x) => x && x.d <= 0.6);
    wall('W9 contact', ok && !errors.length, r.map((x) => x ? `${x.clip.replace('Sword_Regular_', '')}: blade ${x.d} m from his axis at ${x.h} m high` : 'no strike').join(' · '));
    await page.close();
  }

  // W10 + W11: the lock and the dash. One bandit 7 m away at 110° from the ronin's facing (the others far off), one strike; then a bandit
  // 3.5 m ahead and the combo's first cut (a lunge). Every rendered frame reads the BONES, not the game's own record: the root's height
  // over the ground, each foot's middle and height, and at mid-dash the front leg's knee; the strike's record says only its kind and clip.
  if (want('W10')) {
    const KNEE_MAX = 120;
    const { page, errors } = await open('');
    const r = await page.evaluate(async () => {
      const G = window.__GAME, T = G.THREE, wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      G.bandits.blockChance = 0; G.bandits.feintChance = 0;
      const c = G.land.spots.camps[0], camp = G.bandits.list.filter((b) => b.nav === G.navs[0]);
      const x0 = c.x + 10, z0 = c.y; G.player.setPosition(x0, G.land.groundY(x0, z0) + 0.3, z0); await wait(300);
      const put = (b, x, z) => { const { point } = b.nav.query.findClosestPoint({ x, y: G.land.groundY(x, z), z }); b.agent.teleport(point); b.state = 'hold'; b.agent.resetMoveTarget(); };
      camp.forEach((b) => put(b, c.x - 9, c.y + 9));                       // the others out of the lock's 12 m
      const R = G.ronin, W = (n) => R.bones[n].getWorldPosition(new T.Vector3());
      const ang = (a, b, c) => { const u = a.clone().sub(b).normalize(), v = c.clone().sub(b).normalize(); return Math.acos(Math.max(-1, Math.min(1, u.dot(v)))) * 57.3; };
      const feet = () => ['l', 'r'].map((s) => { const a = W('foot_' + s), b = W('ball_' + s), x = (a.x + b.x) / 2, z = (a.z + b.z) / 2; return { x, z, h: Math.min(a.y, b.y) - G.land.groundY(x, z) }; });
      const follow = (b) => new Promise((ok) => {
        const hp0 = b.hp, start = R.root.position.clone(), to = b.root.position.clone().sub(start).setY(0).normalize();
        let rec = null, prev = null, h0 = null, slide = 0, lift = 0, knee = null, stride = null, frames = 0;
        const tick = () => { const st = G.pc.strike;
          if (st) {
            const f = feet(); if (h0 === null) h0 = Math.min(f[0].h, f[1].h);
            if (st.t <= st.impact + 0.25) {
              if (prev) {                                                          // the stiller foot on the ground: how far it moved since the last frame
                const moved = [0, 1].filter((k) => f[k].h < h0 + 0.05 && prev[k].h < h0 + 0.05).map((k) => Math.hypot(f[k].x - prev[k].x, f[k].z - prev[k].z));
                if (moved.length) slide += Math.min(...moved);
              }
              prev = f; frames++;
            }
            if (st.t <= st.impact) lift = Math.max(lift, R.root.position.y - G.land.groundY(R.root.position.x, R.root.position.z));
            const A = st.air, u = !A ? st.t / st.impact : A.kind === 'dash' ? (st.t - A.tA) / A.T : (st.t - A.tau) / A.T;
            if (knee === null && u >= 0.5) {                                        // mid-dash: the front leg is the foot further along the way to him
              const fl = W('foot_l'), fr = W('foot_r'), front = fl.clone().sub(fr).dot(to) > 0 ? 'l' : 'r';
              knee = Math.round(ang(W('thigh_' + front), W('calf_' + front), W('foot_' + front))); stride = +Math.abs(fl.clone().sub(fr).dot(to)).toFixed(2);
            }
            rec = { target: st.target === b, clip: st.def.clip, air: st.air ? st.air.kind : 'ground', D: st.air && st.air.D ? +st.air.D.toFixed(2) : null, T: st.air && st.air.T ? +st.air.T.toFixed(3) : null };
          }
          const done = (!st && rec) || (rec && st && st.t > st.impact + 0.3);
          if (done) return ok({ ...rec, lift: +lift.toFixed(3), slide: +slide.toFixed(2), knee, stride, frames, landed: b.hp < hp0 || b.dead });
          requestAnimationFrame(tick); };
        requestAnimationFrame(tick); });
      const out = {};
      { const b = camp[0], p = G.ronin.root.position, a = 110 * Math.PI / 180; G.facing = 0; put(b, p.x + Math.sin(a) * 7, p.z + Math.cos(a) * 7); b.hp = 99; await wait(400);
        G.facing = 0; G.pc.strike = null; G.strike(0); out.far = await follow(b); await wait(1400); put(b, c.x - 9, c.y + 9); }
      { const b = camp[1], p = G.ronin.root.position; G.facing = Math.atan2(-1, 0); put(b, p.x - 3.5, p.z); b.hp = 99; await wait(400);
        G.facing = Math.atan2(-1, 0); G.pc.strike = null; G.strike(0); out.near = await follow(b); }
      return out;
    });
    const f = r.far || {}, n = r.near || {};
    wall('W10 the lock', !!(f.target && f.landed) && !errors.length, `a bandit 7 m away at 110°: the strike ${f.target ? 'went to him' : 'did NOT go to him'}, the blow ${f.landed ? 'landed' : 'missed'}`);
    const dashOk = f.clip === 'Sword_Dash' && f.lift <= 0.15 && f.knee !== null && f.knee <= KNEE_MAX && f.slide <= 0.35 && f.landed;
    wall('W11 the dash', !!(dashOk && n.lift >= 0.05 && n.slide <= 0.35) && !errors.length, `from 7 m: ${f.air} (${f.clip}${f.D !== null ? `, ${f.D} m in ${f.T} s` : ''}), up ${f.lift} m (≤ 0.15: forward, not up), the front knee at mid-dash ${f.knee}° (≤ ${KNEE_MAX}: bent), a planted foot slid ${f.slide} m over ${f.frames} frames (≤ 0.35), the blow ${f.landed ? 'landed' : 'MISSED'} · from 3.5 m: ${n.air} (${n.clip}), up ${n.lift} m (≥ 0.05), a planted foot slid ${n.slide} m (≤ 0.35)`);
    await page.close();
  }

  // W14 + W15: the guard and the chain. One bandit 1.6 m in front, engaged and facing the ronin, his guard certain and no blow of his own;
  // the combo's first cut with the next press buffered during it. Read: what his guard did, and whether the second cut followed.
  if (want('W14')) {
    const { page, errors } = await open('');
    const r = await page.evaluate(async () => {
      const G = window.__GAME, T = G.THREE, wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      G.bandits.feintChance = 0; G.pc.invuln = 99;
      const c = G.land.spots.camps[0], camp = G.bandits.list.filter((b) => b.nav === G.navs[0]);
      const x0 = c.x + 10, z0 = c.y; G.player.setPosition(x0, G.land.groundY(x0, z0) + 0.3, z0); await wait(300);
      const put = (b, x, z) => { const { point } = b.nav.query.findClosestPoint({ x, y: G.land.groundY(x, z), z }); b.agent.teleport(point); b.agent.resetMoveTarget(); };
      camp.forEach((b) => { put(b, c.x - 9, c.y + 9); b.state = 'hold'; });
      const b = camp[0], p = G.ronin.root.position; G.facing = Math.atan2(-1, 0); put(b, p.x - 1.6, p.z); b.hp = 99; b.cool = 99;
      G.bandits.setState(b, 'engage'); await wait(700); b.cool = 99;
      const facing = Math.round(Math.acos(Math.max(-1, Math.min(1, new T.Vector3(Math.sin(b.facing), 0, Math.cos(b.facing)).dot(p.clone().sub(b.root.position).setY(0).normalize())))) * 57.3);
      const results = [], H = G.bandits.hit.bind(G.bandits); G.bandits.hit = (bb, ...a) => { const out = H(bb, ...a); if (bb === b) results.push(out); return out; };
      let blots = 0; const t0b = performance.now(), seeBlot = () => { if (G.vfx.blot.visible) blots++; if (performance.now() - t0b < 900) requestAnimationFrame(seeBlot); }; requestAnimationFrame(seeBlot);
      G.bandits.blockChance = 1; G.facing = Math.atan2(-1, 0); G.pc.strike = null; G.strike(0);
      // the clash clears a press made before it (a blocked cut interrupts the combo, by design); the press that must not be lost is the
      // one made AFTER the clash, while the blocked cut recovers
      for (let k = 0; k < 40 && !results.length; k++) await wait(10);
      await wait(60); const pressedAt = G.pc.strike ? +(G.pc.strike.t - G.pc.strike.impact).toFixed(3) : null; G.pc.queued = true;
      let second = false; for (let k = 0; k < 40; k++) { await wait(25); if (G.pc.strike && G.pc.strike.i === 1) { second = true; break; } }
      G.bandits.blockChance = 0; G.bandits.hit = H;
      return { first: results[0] || 'none', second, facing, state: b.state, pressedAt, blots };
    });
    wall('W14 the guard', r.first === 'blocked' && !errors.length, `a bandit facing the ronin (${r.facing}° off) with his guard up, the combo's sideways first cut: ${r.first} (blocked)`);
    blockBlots = r.first === 'blocked' ? r.blots : null;                       // W16 reads it: a blocked cut draws no blot
    wall('W15 the chain', r.second && !errors.length, `a press made after the clash (${r.pressedAt} s past the blocked cut's impact): the second cut ${r.second ? 'followed' : 'did NOT follow'}`);
    await page.close();
  }

  // W12: the press. Three cuts of the same clip from 2.2 m — in the air, into a bandit who lives, into one who dies — and 閃 through a
  // bandit it kills; the crescent's widest band read off its own geometry, the ink line's drawn width off its mesh.
  if (want('W12')) {
    const { page, errors } = await open('');
    const r = await page.evaluate(async () => {
      const G = window.__GAME, wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      G.bandits.blockChance = 0; G.bandits.feintChance = 0; G.pc.invuln = 99;
      const c = G.land.spots.camps[0], camp = G.bandits.list.filter((b) => b.nav === G.navs[0]);
      const x0 = c.x + 10, z0 = c.y; G.player.setPosition(x0, G.land.groundY(x0, z0) + 0.3, z0); await wait(300);
      const put = (b, x, z) => { const { point } = b.nav.query.findClosestPoint({ x, y: G.land.groundY(x, z), z }); b.agent.teleport(point); b.state = 'hold'; b.agent.resetMoveTarget(); };
      const away = (b) => put(b, c.x - 9, c.y + 9); camp.forEach(away);
      const widest = (arc) => { const a = arc.m.geometry.attributes.position; let mx = 0; for (let i = 0; i + 1 < a.count; i += 2) mx = Math.max(mx, Math.hypot(a.getX(i + 1) - a.getX(i), a.getY(i + 1) - a.getY(i), a.getZ(i + 1) - a.getZ(i))); return +mx.toFixed(3); };
      const cut = async (b, hp) => {
        const p = G.ronin.root.position; G.facing = Math.atan2(-1, 0);
        if (b) { put(b, p.x - 2.2, p.z); b.hp = hp; }
        await wait(350); G.facing = Math.atan2(-1, 0); G.pc.strike = null; G.strike(0); const arc = G.pc.strike.arc; await wait(900);
        const out = { w: widest(arc), linger: arc.fadeT, dead: b ? b.dead : null }; if (b && !b.dead) away(b); return out;
      };
      const miss = await cut(null), wound = await cut(camp[0], 99), death = await cut(camp[1], 1);
      // 閃 through a bandit it kills
      const p = G.ronin.root.position, f = G.facing; put(camp[2], p.x + Math.sin(f) * 3, p.z + Math.cos(f) * 3); camp[2].hp = 1; await wait(350);
      G.pc.strike = null; G.pc.ki = 100; G.dashSpecial(); const sp = G.pc.special; await wait(1100);
      const dash = sp && sp.stroke ? { base: sp.stroke.m.geometry.parameters.height, drawn: +(sp.stroke.m.geometry.parameters.height * sp.stroke.m.scale.y).toFixed(3), dead: camp[2].dead } : null;
      return { miss, wound, death, dash };
    });
    const { miss: m, wound: w, death: d, dash } = r, k = (a) => (a / Math.max(m.w, 1e-6)).toFixed(2);
    const ok = !w.dead && !!d.dead && w.w >= 1.6 * m.w && d.w >= 2.6 * m.w && d.w >= 1.3 * w.w && d.linger >= 1.2 && dash && dash.dead && dash.drawn >= 1.8 * dash.base;
    wall('W12 the press', ok && !errors.length, `${errors.length ? 'page errors: ' + errors.slice(0, 2).join(' | ') + ' · ' : ''}the wounded ${w.dead ? 'DIED' : 'lived'}, the killed ${d.dead ? 'died' : 'LIVED'}, 閃's ${dash && dash.dead ? 'died' : 'LIVED'} · a cut in the air ${m.w} m wide · into a wound ${w.w} m (${k(w.w)}×, ≥ 1.6) · into a death ${d.w} m (${k(d.w)}×, ≥ 2.6), lingering ${d.linger} s (≥ 1.2) · 閃's ink over a death ${dash ? dash.drawn + ' m from ' + dash.base + ' (≥ 1.8×)' : 'not drawn'}`);
    await page.close();
  }

  // W16 the blot · W17 the flecks · W18 the chiburi · W19 the crimson: THE INK CUT'S BEATS, PAINTED (the receipts'
  // 2026-11-09_pixelfx/painted_ronin/RESEARCH.md). One page and a dry blade: a cut in the air, a cut that wounds (then he stands still), a cut
  // that kills. Every reading is the running game's own: its pixels rendered from its camera without the oil pass, its meshes' geometry, the
  // skeleton's real blade tip, its clock. Its logs are never read for a verdict.
  if (want('ink')) {
    const { page, errors } = await open('');
    const r = await page.evaluate(async () => {
      const G = window.__GAME, T = G.THREE, R = G.renderer, V = G.vfx, wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      G.bandits.blockChance = 0; G.bandits.feintChance = 0; G.pc.invuln = 99;
      const c = G.land.spots.camps[0], camp = G.bandits.list.filter((b) => b.nav === G.navs[0]);
      const x0 = c.x + 10, z0 = c.y; G.player.setPosition(x0, G.land.groundY(x0, z0) + 0.3, z0); await wait(300);
      const put = (b, x, z) => { const { point } = b.nav.query.findClosestPoint({ x, y: G.land.groundY(x, z), z }); b.agent.teleport(point); b.state = 'hold'; b.agent.resetMoveTarget(); };
      const away = (b) => put(b, c.x - 9, c.y + 9); camp.forEach(away);
      // the probe: the scene from a camera (the game's own unless given), no oil pass, into a small half-float target; `only` draws just those
      const PW = 320, PH = 180;
      const shot = (only, cam = G.camera) => {
        const rt = new T.WebGLRenderTarget(PW, PH, { type: T.HalfFloatType }), hidden = [];
        if (only) G.scene.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.visible && !only.includes(o)) { o.visible = false; hidden.push(o); } });
        const cc = R.getClearColor(new T.Color()), ca = R.getClearAlpha();
        R.setRenderTarget(rt); R.setClearColor(0x000000, 0); R.clear(); R.render(G.scene, cam); R.setClearColor(cc, ca); R.setRenderTarget(null);
        const b = new Uint16Array(PW * PH * 4); R.readRenderTargetPixels(rt, 0, 0, PW, PH, b); rt.dispose(); for (const o of hidden) o.visible = true;
        const f = new Float32Array(b.length); for (let i = 0; i < b.length; i++) f[i] = T.DataUtils.fromHalfFloat(b[i]); return f;
      };
      const lum = (f, i) => 0.2126 * f[i * 4] + 0.7152 * f[i * 4 + 1] + 0.0722 * f[i * 4 + 2];
      const meshesOf = (root) => { const a = []; root.traverse((o) => { if (o.isMesh) a.push(o); }); return a; };
      // a stroke's pixels, un-premultiplied: crimson where the red carries it (the swatch is r 0.34, g and b 0.01 in linear light)
      const crimson = (f) => { let n = 0, red = 0, L = 0; for (let i = 0; i < PW * PH; i++) { const a = f[i * 4 + 3]; if (a < 0.25) continue; n++; const r = f[i * 4] / a, g = f[i * 4 + 1] / a, b = f[i * 4 + 2] / a; L += lum(f, i) / a; if (r > 0.05 && r > 3 * Math.max(g, b)) red++; } return { n, share: n ? +(red / n).toFixed(3) : 0, lum: n ? +(L / n).toFixed(3) : 0 }; };
      // one half of the stroke's band, the other half folded onto its middle: the inner half runs toward the hilt (its uv.y 0), the outer past the tip
      const half = (arc, which) => { const g = arc.m.geometry, P = g.attributes.position, U = g.attributes.uv, kP = P.array.slice(), kU = U.array.slice();
        for (let j = 0; j + 1 < P.count; j += 2) { const fold = which === 'inner' ? j + 1 : j; for (let k = 0; k < 3; k++) P.array[fold * 3 + k] = (kP[j * 3 + k] + kP[(j + 1) * 3 + k]) / 2; U.array[fold * 2 + 1] = 0.5; }
        P.needsUpdate = U.needsUpdate = true; const f = shot([arc.m]); P.array.set(kP); U.array.set(kU); P.needsUpdate = U.needsUpdate = true; return crimson(f); };
      // the terrain's own surface under (x, z): the triangle terrainMesh draws there (its diagonal runs from (i+1, j) to (i, j+1))
      const { N, SPACING } = G.GRID, HALF = (N - 1) * SPACING / 2, Hh = G.land.heights;
      const surface = (x, z) => { const fx = (x + HALF) / SPACING, fz = (z + HALF) / SPACING, i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
        const a = Hh[j * N + i], b = Hh[j * N + i + 1], c2 = Hh[(j + 1) * N + i], d = Hh[(j + 1) * N + i + 1];
        return tx + tz <= 1 ? a + (b - a) * tx + (c2 - a) * tz : d + (c2 - d) * (1 - tx) + (b - d) * (1 - tz); };
      // the stains of the stain mesh's own buffer: per slot, its vertices and its landing clock (aInfo.x)
      const SG = V.stainMesh.geometry, SV = SG.attributes.position.count / 96;
      const slots = (from) => { const P = SG.attributes.position, I = SG.attributes.aInfo, out = [];
        for (let s = 0; s < 96; s++) { const v = []; for (let k = 0; k < SV; k++) { const o = s * SV + k; if (I.getZ(o) < 0) continue; v.push(new T.Vector3(P.getX(o), P.getY(o), P.getZ(o))); }
          if (v.length && I.getX(s * SV) >= from) out.push({ slot: s, landed: I.getX(s * SV), v, c: v.reduce((m, q) => m.add(q), new T.Vector3()).divideScalar(v.length) }); }
        return out; };
      // how much of those slots still shows, seen from straight above (the stain mesh alone, only those slots drawn)
      const top = new T.PerspectiveCamera(60, PW / PH, 0.5, 60);
      const coverage = (sl, over) => { if (!sl.length) return 0; top.position.copy(over).add(new T.Vector3(0, 14, 0)); top.up.set(0, 0, -1); top.lookAt(over); top.updateMatrixWorld(true);
        let n = 0; for (const s of sl) { SG.setDrawRange(s.slot * SV, SV); const f = shot([V.stainMesh], top); for (let i = 0; i < PW * PH; i++) if (f[i * 4 + 3] >= 0.25) n++; }   // ≥ 0.25: pixel cells write alpha 0.5
        SG.setDrawRange(0, Infinity); return n; };
      const tipNow = () => G.ronin.sword.userData.tip.getWorldPosition(new T.Vector3());

      // one cut, watched frame by frame for `ms` (each tick runs after the game's own frame)
      const cutAndWatch = async (b, hp, ms, dry) => {
        const p0 = G.ronin.root.position; G.facing = Math.atan2(-1, 0);
        if (b) { put(b, p0.x - 2.2, p0.z); b.hp = hp; }
        await wait(350); G.facing = Math.atan2(-1, 0); G.pc.strike = null;
        const o = { blot: null, arc: null, drops: new Map(), chiburi: null, c0: null, cover: [], travel: null, frames: 0 };
        let prevTip = tipNow(); const clk0 = V.clock.t;
        G.strike(0); const arc = G.pc.strike.arc;
        await new Promise((ok) => { const t0 = performance.now(); const tick = () => {
          const now = performance.now(), clk = V.clock.t, tp = tipNow(); o.frames++;
          // the contact: the first frame of the blot or of the cut's own drops (the same frame in a sound game; either alone if one is broken)
          if (o.c0 === null && b && (V.blot.visible || V.drops.some((d) => !d.cast && !o.drops.has(d)))) {
            // the STROKE's own travel at the cut: its outer edge (it runs past the tip) either side of where the blade met him, in the world
            o.c0 = clk; arc.m.updateMatrixWorld(true); { const P = arc.m.geometry.attributes.position, j = arc.cutAt, e = (k) => new T.Vector3().fromBufferAttribute(P, 2 * k + 1).applyMatrix4(arc.m.matrixWorld);
              o.travel = e(Math.min(j + 1, P.count / 2 - 1)).sub(e(Math.max(j - 1, 0))).normalize(); }
          }
          if (V.blot.visible && !o.blot && !b) o.blot = { miss: true, at: clk, real: now };   // a blot on a cut in the air: the defect itself
          else if (V.blot.visible && !o.blot) {                                       // W16: the blot's first frame
            const full = shot(null); V.blot.visible = false; const bare = shot(null); V.blot.visible = true;
            const mask = shot(meshesOf(b.root)), during = crimson(shot([arc.m]));
            let inside = 0, inN = 0, changed = 0; const dist = [];
            // the splash's REACH (round 2: strokes flung from the wound, not a filled disc): how far its changed pixels lie from the wound, in his heights
            const w0 = V.blotState.at.clone().project(G.camera), wx = (w0.x + 1) / 2 * PW, wy = (w0.y + 1) / 2 * PH;
            for (let i = 0; i < PW * PH; i++) { const dl = Math.abs(lum(full, i) - lum(bare, i)); if (mask[i * 4 + 3] > 0.5) { inN++; inside += dl; } else if (dl > 0.04) { changed++; dist.push(Math.hypot((i % PW) + 0.5 - wx, Math.floor(i / PW) + 0.5 - wy)); } }
            const feet = b.root.position.clone(), sF = feet.clone().project(G.camera), sH = feet.clone().setY(feet.y + b.standH).project(G.camera), hPx = Math.abs(sH.y - sF.y) * PH / 2;
            dist.sort((x, y) => x - y); const reach = dist.length ? dist[Math.floor(dist.length * 0.98)] / Math.max(1, hPx) : 0;
            o.blot = { at: clk, real: now, insideDiff: +(inN ? inside / inN : 0).toFixed(4), inN, area: +(changed / (PW * PH)).toFixed(3), ratio: +reach.toFixed(2), arcLum: during.lum, arcN: during.n };
          }
          if (o.blot && o.blot.hid === undefined && !V.blot.visible) { o.blot.hid = +(clk - o.blot.at).toFixed(3); o.blot.hidReal = +((now - o.blot.real) / 1000).toFixed(3); }
          if (!o.c0 && V.drops.length && !b) o.c0 = clk;                              // (a miss has no blot to start its clock)
          if (!o.arc && arc.m.material.uniforms.progress.value >= 1 && arc.m.material.uniforms.paper.value === 0) {   // W19: the stroke fully laid
            o.arc = { all: crimson(shot([arc.m])), inner: half(arc, 'inner'), outer: half(arc, 'outer') };
          }
          for (const d of V.drops) {                                                   // W17 · W18: every drop, from its birth to its landing
            if (!o.drops.has(d)) o.drops.set(d, { born: clk, from: d.from.clone(), v0: d.v.clone(), tone: d.tone, cast: d.cast, tipD: d.cast ? +d.from.distanceTo(tp).toFixed(3) : null, last: [d.p.clone(), d.p.clone()], gone: null });
            else { const s = o.drops.get(d); s.last = [s.last[1], d.p.clone()]; }
          }
          for (const [d, s] of o.drops) if (s.gone === null && !V.drops.includes(d)) s.gone = clk;
          if (!o.chiburi && G.ronin.current && G.ronin.current.getClip().name === G.CHIBURI.clip) o.chiburi = { at: clk };
          if (o.c0 !== null) for (const [k, at] of dry.entries()) if (o.cover[k] === undefined && clk - o.c0 >= at) {   // W17: still there, then dried
            const sl = slots(o.c0).filter((q) => [...o.drops.values()].some((s) => !s.cast && s.gone !== null && Math.abs(s.gone - q.landed) < 1e-6 && q.c.distanceTo(s.last[1]) < 0.6));
            o.cover[k] = { at, slots: sl.length, px: coverage(sl, G.ronin.root.position) };
          }
          prevTip = tp;
          if (now - t0 < ms) requestAnimationFrame(tick); else ok(); }; requestAnimationFrame(tick); });
        // after the watch: what landed where, read off the stain mesh's own buffer
        const drops = [...o.drops.values()], born = drops.filter((s) => !s.cast), cast = drops.filter((s) => s.cast);
        const all = slots(clk0), match = (s) => all.find((q) => Math.abs(q.landed - s.gone) < 1e-6 && q.c.distanceTo(s.last[1]) < 0.6);
        const fwd = o.travel ? born.filter((s) => s.v0.clone().normalize().dot(o.travel) > 0) : [];
        const lift = Math.max(0, ...all.flatMap((q) => q.v.map((v) => Math.abs(v.y - surface(v.x, v.z)))));
        // a stain's own shape against its drop's last flight: its length along the travel over its width across, against 1/sin α
        const shape = (s) => { const q = match(s); if (!q) return null; const vel = s.last[1].clone().sub(s.last[0]); const n = G.land.normal(q.c.x, q.c.z, new T.Vector3());
          const along = vel.clone().addScaledVector(n, -vel.dot(n)); if (along.lengthSq() < 1e-10) return null; along.normalize(); const across = new T.Vector3().crossVectors(n, along);
          const ext = (dir) => { const xs = q.v.map((v) => v.dot(dir)); return Math.max(...xs) - Math.min(...xs); };
          const sinA = Math.min(1, Math.max(0.25, Math.abs(vel.dot(n)) / Math.max(vel.length(), 1e-9)));
          return { LW: +(ext(along) / Math.max(1e-6, ext(across))).toFixed(3), want: +(1 / sinA).toFixed(3) }; };
        const castSt = cast.map((s) => ({ s, q: match(s) })).filter((x) => x.q);
        let line = null;
        if (castSt.length >= 2) {                                                        // W18: the cast stains in a line (a least-squares line in plan)
          const P = castSt.map((x) => x.q.c), m = P.reduce((a, q) => a.add(q), new T.Vector3()).divideScalar(P.length);
          let sxx = 0, sxz = 0, szz = 0; for (const q of P) { const dx = q.x - m.x, dz = q.z - m.z; sxx += dx * dx; sxz += dx * dz; szz += dz * dz; }
          const th = 0.5 * Math.atan2(2 * sxz, sxx - szz), u = new T.Vector2(Math.cos(th), Math.sin(th));
          const along = P.map((q) => (q.x - m.x) * u.x + (q.z - m.z) * u.y), off = P.map((q) => Math.abs(-(q.x - m.x) * u.y + (q.z - m.z) * u.x));
          line = { n: P.length, off: +Math.max(...off).toFixed(3), spread: +(Math.max(...along) - Math.min(...along)).toFixed(3) };
        }
        return { blot: o.blot, arc: o.arc, chiburi: o.chiburi && o.c0 !== null ? +(o.chiburi.at - o.c0).toFixed(3) : (o.chiburi ? 'played' : null), cover: o.cover, frames: o.frames,
          born: born.length, fwd: fwd.length, fwdCrimson: fwd.filter((s) => s.tone === 1).length, back: born.length - fwd.length, backInk: born.filter((s) => !fwd.includes(s) && s.tone === 0).length,
          maxAngle: o.travel && fwd.length ? +Math.max(...fwd.map((s) => s.v0.angleTo(o.travel))).toFixed(3) : null,
          landed: born.filter((s) => s.gone !== null).length, stained: born.filter((s) => match(s)).length, lift: +lift.toFixed(4),
          cast: cast.length, castTip: cast.length ? Math.max(...cast.map((s) => s.tipD)) : null, castAt: cast.length && o.c0 !== null ? +(Math.min(...cast.map((s) => s.born)) - o.c0).toFixed(3) : null,
          castStained: castSt.length, line, castShape: castSt.map((x) => shape(x.s)).filter(Boolean), dead: b ? !!b.dead : null };
      };
      const miss = await cutAndWatch(null, 0, 2800, []);
      const wound = await cutAndWatch(camp[0], 99, 4200, [1.2, 2.35]); away(camp[0]); await wait(400);
      const death = await cutAndWatch(camp[1], 1, 3300, [2.0, 2.95]);
      return { miss, wound, death };
    });
    const { miss: m, wound: w, death: d } = r, E = errors.length ? ' · page errors: ' + errors.slice(0, 2).join(' | ') : '';
    const blotOk = (x) => x.blot && x.blot.hid >= 0.06 && x.blot.hid <= 0.2 && x.blot.hidReal >= 0.1 && x.blot.insideDiff <= 0.01 && x.blot.area >= 0.005 && x.blot.ratio >= 0.6 && x.blot.ratio <= 1.8 && x.blot.arcLum >= 0.55;
    const bd = (x) => x.blot ? `shown ${x.blot.hid} s of game time, ${x.blot.hidReal} s on the clock (held through the hit-stop), ${(x.blot.area * 100).toFixed(0)} % of the frame, its reach ${x.blot.ratio}× his height from the wound (98th percentile), his own pixels changed ${x.blot.insideDiff} (behind him), the stroke ${x.blot.arcLum} light (bare paper)` : 'NO BLOT';
    wall('W16 the blot', !m.blot && blockBlots === 0 && blotOk(w) && blotOk(d) && !errors.length,
      `a wound: ${bd(w)} · a kill: ${d.blot ? 'shown ' + d.blot.hid + ' s, his own pixels changed ' + d.blot.insideDiff : 'NO BLOT'} · a cut in the air: ${m.blot ? 'A BLOT' : 'none'} · a blocked cut: ${blockBlots === null ? 'not measured' : blockBlots ? 'A BLOT' : 'none'}${E}`);
    const dried = (x) => x.cover[0] && x.cover[1] && x.cover[0].px > 0 && x.cover[1].slots === x.born && x.cover[1].px === 0;   // showing, then every one landed and dried
    wall('W17 the flecks', m.born === 0 && w.born === 12 && w.fwd === 9 && w.fwdCrimson === 4 && w.back === 3 && w.backInk === 3 && d.fwd === 14 && d.fwdCrimson === 10 && w.maxAngle !== null && w.maxAngle <= 0.75
      && w.landed === 12 && w.stained === 12 && d.stained === d.born && w.lift <= 0.01 && d.lift <= 0.01 && dried(w) && dried(d) && !errors.length,
      `a wound: ${w.fwd} along the stroke (${w.fwdCrimson} crimson, ${w.fwd - w.fwdCrimson} ink, within ${w.maxAngle} rad of its travel) and ${w.back} back (${w.backInk} ink); ${w.stained}/${w.landed} landed as stains, `
      + `the farthest ${w.lift} m off the terrain's own triangles; ${w.cover[0] ? w.cover[0].px + ' px of ' + w.cover[0].slots : '—'} at ${w.cover[0] ? w.cover[0].at : '—'} s, ${w.cover[1] ? w.cover[1].px + ' px of ' + w.cover[1].slots : '—'} at ${w.cover[1] ? w.cover[1].at : '—'} s (dried) · a kill: ${d.fwd} (${d.fwdCrimson} crimson), `
      + `${d.stained}/${d.born} stains, ${d.cover[0] ? d.cover[0].px + ' px of ' + d.cover[0].slots : '—'} at 2 s, ${d.cover[1] ? d.cover[1].px + ' px of ' + d.cover[1].slots : '—'} at 2.95 s · a cut in the air: ${m.born} drops${E}`);
    const shapeOk = (x) => x.castShape.length >= 3 && x.castShape.every((q) => Math.abs(q.LW / q.want - 1) <= 0.12);
    wall('W18 the chiburi', m.chiburi === null && m.cast === 0 && typeof w.chiburi === 'number' && w.cast === 4 && w.castTip !== null && w.castTip <= 0.15 && w.castAt >= 1.0 && w.castAt <= 1.6
      && w.line && w.line.n === 4 && w.line.off <= 0.15 && w.line.spread >= 0.25 && shapeOk(w) && !errors.length,
      `after a wound, standing: Sword_Regular_A_Rec at ${w.chiburi} s, ${w.cast} crimson drops off the REAL tip (${w.castTip} m from it) at ${w.castAt} s after the cut, landing ${w.line ? `in a line: ${w.line.n} stains, ${w.line.off} m off it at most, ${w.line.spread} m along it` : 'NOT in a line'}; `
      + `each stain's length ÷ width against 1/sin α: ${w.castShape.map((q) => q.LW + '/' + q.want).join(', ')} · after a cut in the air: ${m.chiburi === null ? 'no flick' : 'A FLICK'}${E}`);
    const a = (x) => x.arc ? x.arc.all.share : null;
    wall('W19 the crimson', m.arc && w.arc && d.arc && m.arc.all.n >= 50 && a(m) <= 0.02 && a(w) >= 0.05 && w.arc.inner.share >= 2 * w.arc.outer.share && a(d) >= 0.3 && a(d) >= 1.5 * a(w) && !errors.length,
      `the stroke's own pixels in crimson: a cut in the air ${a(m)} (none) · a wound ${a(w)}, its inner half ${w.arc ? w.arc.inner.share : '—'} against its outer ${w.arc ? w.arc.outer.share : '—'} · a kill ${a(d)} (flooded)${E}`);
    await page.close();
  }

  // W20 no square corners · W21 brush strokes, not a smudge (round 2, his notes of 8-9 Nov). The splash card drawn ALONE from an orthographic
  // camera square on it, so each pixel is a point q of the card (in his heights from the wound), one stroke at a time; one droplet, one
  // flying drop and one stain alone, each pixel mapped back to its own tile's uv by the inverse of its shader's geometry. In both looks: B
  // (the default, pixel cells) and A (?inkpix=0, painted).
  if (want('W20')) {
    for (const look of ['', 'inkpix=0']) {
      const { page, errors } = await open(look);
      const r = await page.evaluate(async () => {
        const G = window.__GAME, T = G.THREE, R = G.renderer, V = G.vfx, wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
        const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
        G.bandits.blockChance = 0; G.pc.invuln = 99;
        const c = G.land.spots.camps[0], x0 = c.x + 10, z0 = c.y; G.player.setPosition(x0, G.land.groundY(x0, z0) + 0.3, z0); await wait(400);
        // `only`, from `cam`, into a W×H RGBA8 target: the shaders' own colours (a ShaderMaterial writes them untransformed)
        const grab = (only, cam, W, H) => {
          const rt = new T.WebGLRenderTarget(W, H), hidden = [];
          G.scene.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.visible && !only.includes(o)) { o.visible = false; hidden.push(o); } });
          const cc = R.getClearColor(new T.Color()), ca = R.getClearAlpha();
          R.setRenderTarget(rt); R.setClearColor(0x000000, 0); R.clear(); R.render(G.scene, cam); R.setClearColor(cc, ca); R.setRenderTarget(null);
          const b = new Uint8Array(W * H * 4); R.readRenderTargetPixels(rt, 0, 0, W, H, b); rt.dispose(); for (const o of hidden) o.visible = true; return b; };
        const card = V.blot, U = card.material.uniforms, F = U.flicks.value, D = U.drops.value;
        // an orthographic camera square on the card, seeing its rect [qx0, qx1] × [qy0, qy1] (q: the shader's own, in his heights)
        const cardCam = (qx0, qx1, qy0, qy1) => {
          card.updateMatrixWorld(true); const k = card.scale.x / V.BLOT.span;
          const rt = new T.Vector3(1, 0, 0).applyQuaternion(card.quaternion), up = new T.Vector3(0, 1, 0).applyQuaternion(card.quaternion), nr = new T.Vector3(0, 0, 1).applyQuaternion(card.quaternion);
          const cam = new T.OrthographicCamera(-(qx1 - qx0) / 2 * k, (qx1 - qx0) / 2 * k, (qy1 - qy0) / 2 * k, -(qy1 - qy0) / 2 * k, 0.01, 10);
          cam.position.copy(card.position).addScaledVector(rt, (qx0 + qx1) / 2 * k).addScaledVector(up, (qy0 + qy1) / 2 * k).addScaledVector(nr, 2);
          cam.quaternion.copy(card.quaternion); cam.updateMatrixWorld(true); cam.updateProjectionMatrix(); return cam; };
        const lin = (o, px) => [px[o], px[o + 1], px[o + 2]];
        // the palette's ink tones as the shader writes them (linear, 8 bit): ink, the mid tone, crimson, maple
        const tone = (r, g, b) => (r < 12 && g < 12 && b < 12) ? 'ink' : (r > 3 * Math.max(g, b, 1) ? (r < 100 ? 'crimson' : 'maple') : 'mid');
        const dark = (o, px) => px[o + 3] > 0 && ['ink', 'crimson'].includes(tone(...lin(o, px)));
        const travel = new T.Vector3(-0.8, 0.5, 0.3).normalize(), p0 = G.ronin.root.position, at = new T.Vector3(p0.x - 1.1, p0.y + 1.2, p0.z);
        const cr = new T.Vector3(1, 0, 0).applyQuaternion(G.camera.quaternion), cu = new T.Vector3(0, 1, 0).applyQuaternion(G.camera.quaternion), th = Math.atan2(travel.dot(cu), travel.dot(cr));
        const out = {};
        for (const level of [1, 2]) {
          V.contact(at, 1.8, level, null, G.camera, travel);                    // the game's own call, as a cut lands
          const keepF = F.map((f) => f.clone()), keepD = D.map((d) => d.clone());
          // W21 on the whole splash: its outline against a disc's, its tones, its reach along the cut's travel against across it
          const RW = 1024, all = grab([card], cardCam(-1.6, 1.6, -1.6, 1.6), RW, RW);
          let area = 0, edge = 0, sa = 0, sc = 0; const tones = {};
          for (let y = 0; y < RW; y++) for (let x = 0; x < RW; x++) { const o = (y * RW + x) * 4; if (!all[o + 3]) continue; area++;
            const t = tone(...lin(o, all)); tones[t] = (tones[t] || 0) + 1;
            if (x === 0 || y === 0 || x === RW - 1 || y === RW - 1 || !all[o - 4 + 3] || !all[o + 4 + 3] || !all[o - RW * 4 + 3] || !all[o + RW * 4 + 3]) edge++;
            const qx = (x + 0.5) / RW * 3.2 - 1.6, qy = (y + 0.5) / RW * 3.2 - 1.6, al = qx * Math.cos(th) + qy * Math.sin(th), ac = -qx * Math.sin(th) + qy * Math.cos(th); sa += al * al; sc += ac * ac; }
          const toneN = Object.values(tones).filter((n) => n >= 0.03 * area).length;
          const whole = { area, iso: +(edge * edge / (4 * Math.PI * Math.max(area, 1))).toFixed(2), tones: toneN, toneShares: Object.fromEntries(Object.entries(tones).map(([k, n]) => [k, +(n / area).toFixed(3)])), along: +Math.sqrt(sa / Math.max(sc, 1e-9)).toFixed(2) };
          // W20 · the press: each stroke alone, its start read across its own axis; the width a little past its first covered
          // cross-section against its widest near the start (a round dab ≈ 0.5, a straight cut ≈ 1), for all it draws (with its bleed) and for its dark ink alone
          const Q = 0.62, RES = 768, step = 2 * Q / RES, presses = [];
          for (let i = 0; i < 16; i++) {
            F.forEach((f, j) => f.copy(keepF[j]).setZ(j === i ? keepF[j].z : 0)); D.forEach((d) => d.setZ(0));
            const px = grab([card], cardCam(-Q, Q, -Q, Q), RES, RES), f = keepF[i], w = Math.abs(f.w), dx = Math.cos(f.x), dy = Math.sin(f.x);
            const idx = (qx, qy) => { const x = Math.floor((qx + Q) / step), y = Math.floor((qy + Q) / step); return x < 0 || y < 0 || x >= RES || y >= RES ? -1 : (y * RES + x) * 4; };
            const width = (a, test) => { let lo = Infinity, hi = -Infinity; for (let s = -1.1 * w; s <= 1.1 * w; s += step / 2) { const o = idx(dx * a - dy * s, dy * a + dx * s); if (o >= 0 && test(o)) { lo = Math.min(lo, s); hi = Math.max(hi, s); } } return hi >= lo ? hi - lo : 0; };
            const ratio = (test) => { let a0 = null; for (let a = -0.7 * w; a <= 0.7 * w; a += step / 2) if (width(a, test) > 0) { a0 = a; break; }
              if (a0 === null) return null; let mx = 0; for (let a = a0; a <= a0 + 1.4 * w; a += step) mx = Math.max(mx, width(a, test)); return mx > 0 ? +(width(a0 + 0.075 * w, test) / mx).toFixed(3) : null; };
            presses.push({ i, all: ratio((o) => px[o + 3] > 0), dark: ratio((o) => dark(o, px)) });
          }
          // W20 · each droplet alone: no pixel it draws lies in the outer 3 % of its own tile (puff_a's cut side)
          const droplets = [];
          for (let j = 0; j < 12; j++) {
            const p = keepD[j]; if (p.z <= 0) continue;
            F.forEach((f) => f.setZ(0)); D.forEach((d, k) => d.copy(keepD[k]).setZ(k === j ? keepD[k].z : 0));
            const h = 1.4 * p.z, RD = 256, px = grab([card], cardCam(p.x - h, p.x + h, p.y - h, p.y + h), RD, RD); let n = 0, rim = 0;
            for (let y = 0; y < RD; y++) for (let x = 0; x < RD; x++) { if (!px[(y * RD + x) * 4 + 3]) continue; n++;
              const u = (-h + (x + 0.5) / RD * 2 * h) / (2.2 * p.z) + 0.5, v = (-h + (y + 0.5) / RD * 2 * h) / (2.2 * p.z) + 0.5; if (Math.min(u, 1 - u, v, 1 - v) < 0.03) rim++; }
            droplets.push({ n, rim });
          }
          F.forEach((f, j) => f.copy(keepF[j])); D.forEach((d, j) => d.copy(keepD[j]));
          out[level] = { whole, presses, droplets };
        }
        card.visible = false;
        // W20 · one flying drop alone (a kill's): every pixel back to its quad's uv (vfx.js's billboard: along its flight × stretch, across)
        V.wound(at, travel, 2); await frame(); await frame(); await frame();
        const DG = V.dropMesh.geometry, A = DG.attributes, keepN = DG.instanceCount, dropsSeen = [];
        for (let k = 0; k < Math.min(4, keepN); k++) {
          const pos = new T.Vector3().fromArray(A.iPos.array, k * 3), vel = new T.Vector3().fromArray(A.iVel.array, k * 3), size = A.iSize.array[k];
          const stretch = 1 + Math.min(1.4, Math.max(0, vel.length() * 0.06)), hs = 0.75 * size * stretch, RDp = 192;
          const cam = new T.OrthographicCamera(-hs, hs, hs, -hs, 0.01, 10); cam.quaternion.copy(G.camera.quaternion);
          cam.position.copy(pos).add(new T.Vector3(0, 0, 2).applyQuaternion(G.camera.quaternion)); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
          const vv = vel.clone().applyQuaternion(G.camera.quaternion.clone().invert()), L = Math.hypot(vv.x, vv.y), d = L > 1e-4 ? [vv.x / L, vv.y / L] : [1, 0];
          // only instance k: its attributes moved to slot 0 for one draw
          const save = ['iPos', 'iVel', 'iSize', 'iTone'].map((n) => [n, A[n].array.slice(0, A[n].itemSize)]);
          for (const n of ['iPos', 'iVel', 'iSize', 'iTone']) { const s = A[n].itemSize; A[n].array.copyWithin(0, k * s, k * s + s); A[n].needsUpdate = true; }
          DG.instanceCount = 1; const px = grab([V.dropMesh], cam, RDp, RDp); DG.instanceCount = keepN;
          for (const [n, a] of save) { A[n].array.set(a, 0); A[n].needsUpdate = true; }
          let n = 0, rim = 0;
          for (let y = 0; y < RDp; y++) for (let x = 0; x < RDp; x++) { if (!px[(y * RDp + x) * 4 + 3]) continue; n++;
            const ox = ((x + 0.5) / RDp * 2 - 1) * hs, oy = ((y + 0.5) / RDp * 2 - 1) * hs;
            const u = (ox * d[0] + oy * d[1]) / (size * stretch) + 0.5, v = (-ox * d[1] + oy * d[0]) / size + 0.5; if (Math.min(u, 1 - u, v, 1 - v) < 0.03) rim++; }
          dropsSeen.push({ n, rim });
        }
        // W20 · each stain alone, seen down its projector's own axis (DecalGeometry's uv: 0.5 + x/L along, 0.5 + y/W across)
        const from = V.clock.t; await wait(1500);
        const SG = V.stainMesh.geometry, SV = SG.attributes.position.count / 96, stains = [];
        for (const s of V.stainLog.filter((q) => q.landed >= from && V.clock.t < q.dryAt).slice(0, 8)) {
          const hs = 0.7 * Math.max(s.L, s.W), RS = 192, cam = new T.OrthographicCamera(-hs, hs, hs, -hs, 0.01, 10);
          cam.position.copy(s.at).addScaledVector(s.normal, 2); cam.up.copy(s.dir); cam.lookAt(s.at); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
          const ax = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), ay = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1), sy = new T.Vector3().crossVectors(s.normal, s.dir);
          SG.setDrawRange(s.slot * SV, SV); const px = grab([V.stainMesh], cam, RS, RS); SG.setDrawRange(0, Infinity);
          let n = 0, rim = 0;
          for (let y = 0; y < RS; y++) for (let x = 0; x < RS; x++) { if (!px[(y * RS + x) * 4 + 3]) continue; n++;
            const ox = ((x + 0.5) / RS * 2 - 1) * hs, oy = ((y + 0.5) / RS * 2 - 1) * hs, P = ax.clone().multiplyScalar(ox).addScaledVector(ay, oy);
            const u = P.dot(s.dir) / s.L + 0.5, v = P.dot(sy) / s.W + 0.5; if (Math.min(u, 1 - u, v, 1 - v) < 0.03) rim++; }
          stains.push({ n, rim });
        }
        return { out, dropsSeen, stains, inkPix: V.inkPix.value };
      });
      const L = look ? 'A (painted)' : 'B (pixel cells)', E = errors.length ? ' · page errors: ' + errors.slice(0, 2).join(' | ') : '';
      const ps = [...r.out[1].presses, ...r.out[2].presses], worst = (k) => Math.max(...ps.map((p) => p[k] === null ? 9 : p[k]));
      const dl = [...r.out[1].droplets, ...r.out[2].droplets], rimN = (a) => a.reduce((m, q) => m + q.rim, 0), drawn = (a) => a.length > 0 && a.every((q) => q.n > 0);
      wall(`W20 no square corners, ${L}`, ps.length === 32 && worst('all') <= 0.75 && worst('dark') <= 0.75 && drawn(dl) && rimN(dl) === 0 && drawn(r.dropsSeen) && rimN(r.dropsSeen) === 0
        && r.stains.length >= 3 && drawn(r.stains) && rimN(r.stains) === 0 && !errors.length,
        `the 32 strokes of a wound and a kill each start in a round press: just past its start its width is at most ${worst('all')} of its widest with its bleed, ${worst('dark')} for its ink alone (a straight cut reads ~1) · `
        + `${dl.length} droplets, ${r.dropsSeen.length} flying drops and ${r.stains.length} stains drawn alone: ${rimN(dl)}, ${rimN(r.dropsSeen)} and ${rimN(r.stains)} pixels on their tiles' outer 3 % (cell ${r.inkPix} px)${E}`);
      const sm = (x) => `outline ${x.iso}× a disc's, ${x.tones} tones (${Object.entries(x.toneShares).map(([k, v]) => k + ' ' + v).join(', ')}), ${x.along}× longer along the cut than across`;
      const strokes = (x) => x.iso >= 4 && x.tones >= 2 && x.along >= 1.5;
      wall(`W21 brush strokes, not a smudge, ${L}`, strokes(r.out[1].whole) && strokes(r.out[2].whole) && !errors.length, `a wound: ${sm(r.out[1].whole)} · a kill: ${sm(r.out[2].whole)}${E}`);
      await page.close();
    }
  }

  // W22 pixel art after the oil pass: in the game's own final picture (the composer's output, read off the canvas in the very frame it is
  // drawn), the splash's pixels come in whole cells of inkPix where its tones meet: each cell beside a cell of another tone is one value,
  // bar the canvas weave the grade lays over everything (Shadowglass's "pixel stabilization"; the oil pass would round them into a smudge).
  // ?cine hides the HUD.                                                                                                plant nopixel
  if (want('W22')) {
    const { page, errors } = await open('cine', { width: 1600, height: 900 });
    const m = await page.evaluate(async () => {
      const G = window.__GAME, T = G.THREE, R = G.renderer, V = G.vfx, wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      G.bandits.blockChance = 0; G.bandits.feintChance = 0; G.pc.invuln = 99;
      const c = G.land.spots.camps[0], camp = G.bandits.list.filter((b) => b.nav === G.navs[0]);
      const x0 = c.x + 10, z0 = c.y; G.player.setPosition(x0, G.land.groundY(x0, z0) + 0.3, z0); await wait(400);
      const put = (b, x, z) => { const { point } = b.nav.query.findClosestPoint({ x, y: G.land.groundY(x, z), z }); b.agent.teleport(point); b.state = 'hold'; b.agent.resetMoveTarget(); };
      camp.forEach((b) => put(b, c.x - 9, c.y + 9)); const b = camp[0], p0 = G.ronin.root.position; put(b, p0.x - 2.2, p0.z); b.hp = 99;
      await wait(500); G.facing = Math.atan2(-1, 0); G.pc.strike = null; G.strike(0);
      // the frame the splash first shows: this callback runs after the game's own in the same frame, before the canvas is presented
      return await new Promise((done) => { const t0 = performance.now(); const tick = () => {
        if (!V.blot.visible) { if (performance.now() - t0 < 8000) requestAnimationFrame(tick); else done({ shown: false }); return; }
        const gl = R.getContext(), s = R.getDrawingBufferSize(new T.Vector2()), W = s.x, H = s.y, C = V.inkPix.value;
        R.setRenderTarget(null); const fin = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, fin);
        // the scene as the composer's first pass draws it: the ink's flagged pixels (alpha 0.5) and their tones by colour
        const rt = new T.WebGLRenderTarget(W, H, { type: T.HalfFloatType }), cc = R.getClearColor(new T.Color()), ca = R.getClearAlpha();
        R.setRenderTarget(rt); R.setClearColor(0x000000, 1); R.clear(); R.render(G.scene, G.camera); R.setClearColor(cc, ca); R.setRenderTarget(null);
        const h = new Uint16Array(W * H * 4); R.readRenderTargetPixels(rt, 0, 0, W, H, h); rt.dispose();
        const f = (i) => T.DataUtils.fromHalfFloat(h[i]), tones = new Uint16Array(W * H), ids = new Map(); let inkN = 0;
        for (let i = 0; i < W * H; i++) { if (Math.abs(f(i * 4 + 3) - 0.5) > 0.05) continue; inkN++;
          const key = [f(i * 4), f(i * 4 + 1), f(i * 4 + 2)].map((v) => Math.round(v * 200)).join(','); if (!ids.has(key)) ids.set(key, ids.size + 1); tones[i] = ids.get(key); }
        // a cell is the shader's own: gl_FragCoord / inkPix, rows from the bottom as both readings are
        const cellTone = (cx, cy) => { let t = -1; for (let y = cy * C; y < cy * C + C; y++) for (let x = cx * C; x < cx * C + C; x++) { const v = tones[y * W + x]; if (!v || (t >= 0 && v !== t)) return 0; t = v; } return t; };
        const L = (x, y) => { const o = (y * W + x) * 4; return 0.2126 * fin[o] + 0.7152 * fin[o + 1] + 0.0722 * fin[o + 2]; };
        let boundary = 0, whole = 0;
        if (C >= 2) for (let cy = 1; cy < Math.floor(H / C) - 1; cy++) for (let cx = 1; cx < Math.floor(W / C) - 1; cx++) {
          const t = cellTone(cx, cy); if (!t) continue;
          if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b2]) => { const v = cellTone(cx + a, cy + b2); return v && v !== t; })) continue;
          boundary++; let lo = 255, hi = 0, sum = 0; for (let y = cy * C; y < cy * C + C; y++) for (let x = cx * C; x < cx * C + C; x++) { const v = L(x, y); lo = Math.min(lo, v); hi = Math.max(hi, v); sum += v; }
          if (hi - lo <= 4 + 0.08 * sum / (C * C)) whole++;
        }
        done({ shown: true, W, H, C, inkN, toneIds: ids.size, boundary, whole, held: V.blotState.t });
      }; requestAnimationFrame(tick); });
    });
    const share = m.shown && m.boundary ? m.whole / m.boundary : 0, ok = m.shown && m.boundary >= 100 && share >= 0.85 && !errors.length;
    wall('W22 pixel art after the oil pass', ok, (m.shown ? `${m.whole}/${m.boundary} of the splash's cells that meet another tone are one value in the final picture (${(share * 100).toFixed(0)} %), cell ${m.C} px at ${m.W}×${m.H}, ${m.inkN} ink pixels in ${m.toneIds} tones, read in the splash's first frame` : 'the splash never showed')
      + (errors.length ? ' · page errors: ' + errors.slice(0, 2).join(' | ') : ''));
    await page.close();
  }

  // W13: the camera keeps clear of the smoke
  if (want('W13')) {
    const { page, errors } = await open('test');
    const r = await page.evaluate(async () => {
      const G = window.__GAME, wait = (ms) => new Promise((ok) => setTimeout(ok, ms)); G.pc.invuln = 99;
      const c = G.env.camps[0].center; G.player.setPosition(c.x + 1, G.land.groundY(c.x + 1, c.z) + 0.3, c.z); await wait(500);
      G.cam.hold = false; G.cam.yaw = Math.atan2(-1, 0); G.cam.pitch = 0.2; G.cam.dist = 2.0; await wait(700);   // the camera's place: over the fire
      const p = G.camera.position; return { d: Math.hypot(p.x - c.x, p.z - c.z) };
    });
    wall('W13 clear view', r.d >= 2.5 && !errors.length, `with the ronin 1 m from a fire and the camera aimed through it: the lens ${r.d.toFixed(2)} m from the smoke's axis (≥ 2.5)`);
    await page.close();
  }

  // W5: memory at a phone's size
  if (want('W5')) {
  const ph = await open('', { width: 390, height: 844 });
  await ph.page.waitForTimeout(1500);
  const mem = await ph.page.evaluate(() => window.__STACK_MEMORY);
  wall('W5 phone', mem && mem.totalMB < 192, mem ? `${mem.totalMB.toFixed(0)} MB (${Object.entries(mem).filter(([k]) => k !== 'totalMB').map(([k, v]) => k + ' ' + Math.round(v)).join(', ')})` : 'no report');
  await ph.page.close();
  }
}

await browser.close(); server.close();
const red = results.filter((x) => !x.ok).length;
console.log(red ? `\n✖ ${red} wall(s) red (${engine}${plant ? ', plant ' + plant : ''})` : `\n✔ every wall holds (${engine})`);
process.exit(red ? 1 : 0);
