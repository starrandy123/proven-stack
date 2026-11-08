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
//   W11 the leap — that strike crosses the 7 m in the AIR and like a samurai: the body 0.2-0.5 m over the ground (forward, not up:
//                  "kendo is trying to move forward instead of upward"), ≤ 0.35 m slid along the ground before the impact, and at
//                  mid-flight a STRIDE, not a tuck (the feet ≥ 0.6 m apart along the travel, one knee ≥ 150°); from 3.5 m the combo's
//                  own cuts lunge off the ground too (the owner, 8 Nov: "sloppily sliding to them instead of jumping and attacking" ·
//                  "It looks like a frog rather than a leap to the enemy!")                                       plants slide, frog
//   W12 the press — the brush presses where the blade wounds: a cut that wounds is ≥ 1.6× as wide as a cut in the air, a cut that
//                  kills ≥ 2.6× (and ≥ 1.3× a wound) and lingers ≥ 1.2 s; 閃's ink line swells ≥ 1.8× over a body it kills (sumi-e: light
//                  pressure thin, heavy pressure bold; the owner, 8 Nov: "thicker as they injure their enemies … and show death") plant nopress
//   W13 clear view — the follow camera never sits inside a camp's smoke column: with the ronin 1 m from a fire and the camera aimed
//                  through it, the lens stays ≥ 2.5 m from the smoke's axis (Cinemachine's collider; the 8 Nov reveal went white)  plant camclip
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
  await page.goto(url + 'index.html?' + query + (plant && !query.includes('plant=') ? (query ? '&' : '') + 'plant=' + plant : ''));
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

{
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
  { const r = await special('dash'); wall('W6 dash', r.down.every(Boolean) && !r.spared.some(Boolean) && !r.errors.length, `in the line: ${r.down.filter(Boolean).length}/2 down · out of it: ${r.spared.filter((d) => !d).length}/2 standing`); }
  { const r = await special('storm'); wall('W7 storm', r.down.every(Boolean) && !r.spared.some(Boolean) && !r.errors.length, `around him: ${r.down.filter(Boolean).length}/2 down · beyond 3.6 m: ${r.spared.filter((d) => !d).length}/2 standing`); }

  // W8: turn-taking, measured on camp 0's four live bandits while the ronin stands among them (invulnerable, not striking)
  {
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
  {
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

  // W10 + W11: the lock and the leap. One bandit 7 m away at 110° from the ronin's facing (the others far off), one strike; then a bandit
  // 3.5 m ahead and the combo's first cut (a lunge). Every rendered frame reads the strike's own record: its target, how high the body
  // rose over the ground under it, how far it slid along the ground before the impact, and whether the blow landed.
  {
    const { page, errors } = await open('');
    const r = await page.evaluate(async () => {
      const G = window.__GAME, wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      G.bandits.blockChance = 0; G.bandits.feintChance = 0;
      const c = G.land.spots.camps[0], camp = G.bandits.list.filter((b) => b.nav === G.navs[0]);
      const x0 = c.x + 10, z0 = c.y; G.player.setPosition(x0, G.land.groundY(x0, z0) + 0.3, z0); await wait(300);
      const put = (b, x, z) => { const { point } = b.nav.query.findClosestPoint({ x, y: G.land.groundY(x, z), z }); b.agent.teleport(point); b.state = 'hold'; b.agent.resetMoveTarget(); };
      camp.forEach((b) => put(b, c.x - 9, c.y + 9));                       // the others out of the lock's 12 m
      const T = G.THREE, pose = { stride: 0, knee: 0, taken: false };
      const sample = () => { const R = G.ronin, P = (n) => R.bones[n].getWorldPosition(new T.Vector3()), f = new T.Vector3(Math.sin(R.root.rotation.y), 0, Math.cos(R.root.rotation.y));
        const ang = (a, b, c) => { const u = a.clone().sub(b).normalize(), v = c.clone().sub(b).normalize(); return Math.acos(Math.max(-1, Math.min(1, u.dot(v)))) * 57.3; };
        pose.stride = +Math.abs(P('foot_r').sub(P('foot_l')).dot(f)).toFixed(2); pose.knee = Math.round(Math.max(ang(P('thigh_r'), P('calf_r'), P('foot_r')), ang(P('thigh_l'), P('calf_l'), P('foot_l')))); pose.taken = true; };
      const follow = (b) => new Promise((ok) => { const hp0 = b.hp; let rec = null; pose.taken = false; const tick = () => { const st = G.pc.strike;
        if (st && st.air && st.air.kind === 'leap' && !st.air.landed && !pose.taken && (st.t - st.air.tau) / st.air.T >= 0.5) sample();   // mid-flight
        if (st) rec = { target: st.target === b, lift: +st.lift.toFixed(2), slide: +st.groundSlide.toFixed(2), clip: st.def.clip, air: st.air ? st.air.kind : 'ground', stride: pose.stride, knee: pose.knee };
        if (!st && rec) return ok({ ...rec, landed: b.hp < hp0 || b.dead }); if (rec && st && st.t > st.impact + 0.12) return ok({ ...rec, landed: b.hp < hp0 || b.dead }); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      const out = {};
      { const b = camp[0], p = G.ronin.root.position, a = 110 * Math.PI / 180; G.facing = 0; put(b, p.x + Math.sin(a) * 7, p.z + Math.cos(a) * 7); b.hp = 99; await wait(400);
        G.facing = 0; G.pc.strike = null; G.strike(0); out.far = await follow(b); await wait(1200); put(b, c.x - 9, c.y + 9); }
      { const b = camp[1], p = G.ronin.root.position; G.facing = Math.atan2(-1, 0); put(b, p.x - 3.5, p.z); b.hp = 99; await wait(400);
        G.facing = Math.atan2(-1, 0); G.pc.strike = null; G.strike(0); out.near = await follow(b); }
      return out;
    });
    const f = r.far || {}, n = r.near || {};
    wall('W10 the lock', !!(f.target && f.landed) && !errors.length, `a bandit 7 m away at 110°: the strike ${f.target ? 'went to him' : 'did NOT go to him'}, the blow ${f.landed ? 'landed' : 'missed'}`);
    wall('W11 the leap', !!(f.lift >= 0.2 && f.lift <= 0.5 && f.slide <= 0.35 && f.landed && f.stride >= 0.6 && f.knee >= 150 && n.lift >= 0.05 && n.slide <= 0.35), `from 7 m: ${f.air} (${f.clip}), up ${f.lift} m (0.2-0.5: forward, not up), slid ${f.slide} m (≤ 0.35), at mid-flight a stride of ${f.stride} m (≥ 0.6) with a knee at ${f.knee}° (≥ 150: not a tuck) · from 3.5 m: ${n.air} (${n.clip}), up ${n.lift} m (≥ 0.05), slid ${n.slide} m (≤ 0.35)`);
    await page.close();
  }

  // W12: the press. Three cuts of the same clip from 2.2 m — in the air, into a bandit who lives, into one who dies — and 閃 through a
  // bandit it kills; the crescent's widest band read off its own geometry, the ink line's drawn width off its mesh.
  {
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

  // W13: the camera keeps clear of the smoke
  {
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
