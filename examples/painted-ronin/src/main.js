// Painted Ronin — an original samurai open world, made with proven-stack: three.js renders, Jolt Physics carries every body (the
// land, the ronin, the fallen), FastNoiseLite shapes the valley, Recast & Detour walks the bandits, three.quarks fills the air,
// postprocessing turns it all into oil paint, ZzFX makes the sound. Art: Quaternius (CC0) and Matt Newell (CC-BY), see rights.json.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer, RenderPass } from 'postprocessing';
import { createPhysics, addHeightField, createCharacter } from './physics.js';
import { makeLand, terrainMesh, N, SPACING } from './world.js';
import { createInput } from './input.js';
import { createGrass } from './grass.js';
import { PainterlyPass } from './painterly.js';
import { loadCharacterKit, Person } from './characters.js';
import { restPose, anatomicalBends } from './ragdoll.js';
import { buildEnvironment, obstacleMeshes } from './env.js';
import { createNavigation, terrainPatch } from './navigation.js';
import { Bandits } from './enemies.js';
import { createVfx } from './vfx.js';
import { startAudio, updateAudio, play as sfx } from './audio.js';
import { createBirds, createClouds, swayLeaves } from './life.js';
import { loadPaint, paint, paintFogAll, paintSurface, measureHorizon, paintMemoryMB, PALETTE, RAMP, WIND } from './paint.js';
import { paintSky } from './sky_painted.js';
import { createPaintedClouds } from './clouds_painted.js';
import { createLock, RANGE as LOCK_RANGE } from './lock.js';

const Q = new URLSearchParams(location.search);
const PLANT = Q.get('plant');                                               // test seams: a defect a wall must catch (tests/walls.mjs --plant …)
const PHONE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
const root = document.getElementById('game');
const hud = { ki: document.getElementById('ki-fill'), hp: document.getElementById('hp-fill'), kills: document.getElementById('kills'), msg: document.getElementById('msg'), help: document.getElementById('help') };
const say = (text, ms = 2200) => { hud.msg.textContent = text; hud.msg.classList.add('on'); clearTimeout(say.t); say.t = setTimeout(() => hud.msg.classList.remove('on'), ms); };
const loading = (t) => { const el = document.getElementById('loading-step'); if (el) el.textContent = t; };
if (Q.has('cine')) document.body.classList.add('cine');

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, PHONE ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;                               // the painterly pass grades (ACES) at the end
root.prepend(renderer.domElement);

loading('mixing the paint (MyPaint\'s brushes)');
await loadPaint();                                                            // the one brush atlas every painted thing samples (paint.js)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.2, 1600);
const sky = new Sky(); sky.scale.setScalar(4000); scene.add(sky);
const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 11), THREE.MathUtils.degToRad(215));
const U = sky.material.uniforms; U.turbidity.value = 3.5; U.rayleigh.value = 1.4; U.mieCoefficient.value = 0.006; U.mieDirectionalG.value = 0.85; U.sunPosition.value.copy(sunDir);
const skyPaint = paintSky(sky, { plant: PLANT });                         // four tones, oil strokes, the bokashi band (sky_painted.js)
{ const s = renderer.getDrawingBufferSize(new THREE.Vector2()); skyPaint.setResolution(s.x, s.y); }
scene.fog = new THREE.Fog(new THREE.Color('#c9c3b4'), 90, 640);
scene.add(new THREE.HemisphereLight('#bcd2f0', '#6b5a40', 1.35));
const sun = new THREE.DirectionalLight('#ffdcae', 2.3);
sun.castShadow = true; sun.shadow.mapSize.setScalar(PHONE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 260 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6; scene.add(sun, sun.target);

loading('shaping the valley');
const land = makeLand();
scene.add(terrainMesh(land));
const grass = createGrass(scene, land, N, SPACING, { phone: PHONE, sunDir, fog: scene.fog });

loading('waking the physics (Jolt)');
const P = await createPhysics();
addHeightField(P, land.heights, N, SPACING);
const player = createCharacter(P);
const SPAWN = new THREE.Vector3(land.spots.spawn.x, 0, land.spots.spawn.y); SPAWN.y = land.groundY(SPAWN.x, SPAWN.z) + 0.2;
player.setPosition(SPAWN.x, SPAWN.y, SPAWN.z);

loading('dressing the ronin');
const kit = await loadCharacterKit();
const ronin = new Person(kit, 'ronin'); ronin.armed = true;
const rest = restPose(ronin);                                             // the bind pose, before any clip: every ragdoll limit counts from it
scene.add(ronin.root);

loading('raising the shrine');
const before = new Set(scene.children);
const env = await buildEnvironment(scene, land, P, { plant: PLANT });
// the CC0 props keep their own colours and take the oil strokes laid on them in the world (a moving character never does: strokes
// fixed in the world would swim over a body that walks through them — Meier's shower door)
for (const o of scene.children) if (!before.has(o)) o.traverse((m) => { if (m.isMesh && !m.isSkinnedMesh) for (const mm of [].concat(m.material)) if (mm.isMeshStandardMaterial && !mm.userData.paint) paintSurface(mm, { region: 'field_a', scale: 0.6, strength: 0.3, band: 0 }); });
const vfx = createVfx(scene, { phone: PHONE, plant: PLANT });
const birds = createBirds(scene, land, { flocks: PHONE ? 2 : 3, perFlock: PHONE ? 10 : 14, plant: PLANT });
// the clouds: Sea of Thieves' painted mass (clouds_painted.js); the old billboard puffs only as the planted defect the walls must catch
const clouds = PLANT === 'sprites' ? createClouds(scene, { count: PHONE ? 10 : 16, phone: PHONE }) : createPaintedClouds(scene, { count: PHONE ? 12 : 22, phone: PHONE, sunDir, plant: PLANT, targetHeight: PLANT === 'bigclouds' ? 4000 : 280,
  // ?test: two known clouds for the paint walls, one away from the sun and one toward it, held still
  anchors: Q.has('test') ? [SPAWN.clone().add(new THREE.Vector3(-sunDir.x, 0, -sunDir.z).normalize().multiplyScalar(260)).setY(SPAWN.y + 95), SPAWN.clone().add(new THREE.Vector3(sunDir.x, 0, sunDir.z).normalize().multiplyScalar(300)).setY(SPAWN.y + 105)] : [] });
const sway = swayLeaves(scene);
for (const c of env.camps) c.fire = vfx.fire(c.center.clone().add(new THREE.Vector3(0, 0.1, 0)));

loading('mapping the paths (Recast)');
const regions = land.spots.camps.map((c, i) => ({ name: 'camp' + i, center: c, size: 60, maxAgents: 6,
  meshes: [terrainPatch(land, c, 60, N, SPACING), ...obstacleMeshes(env.obstacles, land, c, 60)] }));
const navs = await createNavigation(regions);
const clipdata = await (await fetch('assets/clipdata.json')).json();      // every clip's impacts and blade path, measured (tools/measure_clips.mjs)
vfx.clipdata = clipdata;
const bandits = new Bandits(scene, kit, navs, P, rest, land, { perCamp: Q.has('test') ? 1 : 4, frozen: PLANT === 'nav', clipdata });
if (PLANT === 'budget') bandits.budgetOff = true;
if (PLANT === 'ramp256') { const d = new Uint8Array(256).map((_, i) => i); const t = new THREE.DataTexture(d, 256, 1, THREE.RedFormat); t.needsUpdate = true; scene.getObjectByName('painted-rocks').material.gradientMap = t; }   // a smooth light: the bands gone
// the painted fog on everything that takes fog, ending in the sky's own horizon colour, measured off the sky (and the clouds exposed to it)
paintFogAll(scene);
measureHorizon(renderer, sky, sunDir);
if (clouds.exposeTo) clouds.exposeTo(paint.sky12);
const TOTAL = bandits.list.length;

const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
composer.addPass(new RenderPass(scene, camera));
const painterly = new PainterlyPass(camera, { targetHeight: 560, radiusNear: 2, radiusFar: 6 });
composer.addPass(painterly);
if (Q.has('raw')) painterly.enabled = false;

// ── the ronin's fight ──
const pc = { hp: 100, alive: true, queued: false, strike: null, roll: 0, invuln: 0, deadT: 0, kills: 0, ki: 0, special: null };
// the combo, swift: cut, cut, a two-handed finisher; a strike while sprinting is a dash attack. Each strike's impact is MEASURED from
// its clip; the next strike starts 166 ms after an impact that hit, 200 ms after one that missed (For Honor's cancel windows); a press
// during a strike is buffered. Every strike goes to THE LOCK (lock.js: Arkham's Freeflow, God of War's targeting), and the ronin covers
// the distance so the blade arrives at reach (motion warping, Unreal Engine's Motion Warping; God of War's attack magnetism) — in the
// AIR, never sliding on the ground (the owner, 8 Nov: "sloppily sliding to them instead of jumping and attacking"):
//  · a gap of a metre or two: FUMIKOMI, kendo's lunging step — the cut's own clip, the body carried in a low arc that lands on the cut;
//  · a longer gap, up to the lock's 12 m: TOBIKOMI, kendo's leaping strike (飛込み, "dive, jump, plunge"; Kendo-Guide: you throw your
//    body at the opponent; tobikomi-men covers a longer distance at a higher speed than debana-men, Research Journal of Budo 52(2)). It
//    goes FORWARD, NOT UP, the back straight (kendo.readthedocs.io, footwork: "kendo is trying to move forward instead of upward. Imagine
//    an plane … flying in a low height"; "The back should be straight"): the legs held in a lunge's long stride (Mesh2Motion's
//    spear-thrust, its lead foot the same as the overhead cut's stance), the overhead cut's arms, a low arc chosen by its height and its
//    time (Kyle Pittman, GDC 2016, "Math for Game Programmers: Building a Better Jump"), landing ON the cut. The first version tucked
//    both legs under a high arc — the owner, 8 Nov: "It looks like a frog rather than a leap to the enemy! … This is not a Samurai
//    moves!" (plant frog).
const COMBO = [{ clip: 'Sword_Regular_A', power: 1, speed: 1.15 }, { clip: 'Sword_Regular_B', power: 1, speed: 1.15 }, { clip: 'two-handed-overhead-slam', power: 2, speed: 1.3 }];
const DASH_STRIKE = { clip: 'Sword_Dash', power: 2, speed: 1.35 };
const LEAP_STRIKE = { clip: 'two-handed-overhead-slam', power: 2, speed: 1, leap: true };
const LEAP_GAP = 2.6, STEP_GAP = 0.5, TAKEOFF = 0.08;                 // metres to cover: above LEAP_GAP a leap, above STEP_GAP a lunge
const lock = createLock();
const REACH = 1.5;
let freeze = 0, trauma = 0, slow = 0;                                  // slow: seconds of slow motion left (the world at 0.3x)
const pos = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3(), tmp = new THREE.Vector3();
const vel = new THREE.Vector2();                                       // the ronin's own velocity: it accelerates, never jumps to speed
let facing = 0, acc = 0, last = performance.now(), booted = false, time = 0;
// a strike's CONTACT, measured off its clip (tools/measure_clips.mjs): when the moving blade crosses in front of the body, where its tip
// is then (x to the side, z ahead, in the ronin's own frame) and which way it swings. The target is placed THERE, so the blade meets it.
const contactOf = (clip) => (clipdata[clip] && clipdata[clip].contact) || { t: 0.25, frame: 15, reach: 1.1, off: 0, tip: [0, 1.1, 1.1], swing: [0, 0, 1] };
const toWorld = (lx, ly, lz, out = new THREE.Vector3()) => out.set(pos.x + Math.cos(facing) * lx + Math.sin(facing) * lz, pos.y + ly, pos.z - Math.sin(facing) * lx + Math.cos(facing) * lz);
function bestTarget(maxD = 6, cone = 70) {
  let best = null, score = 1e9;
  for (const b of bandits.alive()) {
    const to = new THREE.Vector3().subVectors(b.root.position, pos).setY(0), d = to.length();
    if (d > maxD) continue;
    const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(to.x, to.z) - facing), Math.cos(Math.atan2(to.x, to.z) - facing))) * 57.3;
    if (ang > cone && d > 1.2) continue;
    const sc = d + ang * 0.05; if (sc < score) { score = sc; best = b; }
  }
  return best;
}
// the bandit a strike goes to: the lock (refreshed now, from the ronin's facing), or with the plant nolock the old 70° cone within 6 m
function strikeTarget(dash) {
  if (PLANT === 'nolock') return bestTarget(dash ? 9 : 6);
  return lock.update(pos, new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing)), false, bandits.alive());
}
const reachOf = (C) => Math.hypot(C.off, C.reach) * (PLANT === 'reach' ? 1.7 : 0.92);
function strike(i, def) {
  let s = def || COMBO[i]; pc.queued = false;
  const target = strikeTarget(s === DASH_STRIKE);
  let C = contactOf(s.clip), reach = reachOf(C), air = null;
  const to = target ? new THREE.Vector3().subVectors(target.root.position, pos).setY(0) : null;
  if (to && PLANT !== 'slide') {
    if (to.length() - reach > LEAP_GAP) {                                 // tobikomi: a leap that lands on the overhead cut
      s = LEAP_STRIKE; C = contactOf(s.clip); reach = reachOf(C);
      const g = Math.max(0, to.length() - reach), frog = PLANT === 'frog';
      const T = frog ? THREE.MathUtils.clamp(0.4 + 0.04 * g, 0.48, 0.8) : THREE.MathUtils.clamp(0.24 + 0.05 * g, 0.3, 0.55);
      const h = frog ? THREE.MathUtils.clamp(0.3 + 0.1 * g, 0.6, 1.3) : THREE.MathUtils.clamp(0.16 + 0.03 * g, 0.2, 0.36);
      s = { ...LEAP_STRIKE, speed: C.t / (TAKEOFF + T) };
      air = { kind: 'leap', from: pos.clone(), tau: TAKEOFF, T, h, landed: false };
    } else if (to.length() - reach > STEP_GAP) {                          // fumikomi: the cut's own clip, a low arc landing on the cut
      const g = to.length() - reach;
      air = { kind: 'lunge', from: pos.clone(), tau: 0, T: C.t / s.speed, h: Math.min(0.12, 0.06 + 0.03 * g), landed: false };   // low: forward, not up
    }
  }
  const impact = C.t / s.speed;
  const a = air && air.kind === 'leap'
    ? (PLANT === 'frog' ? ronin.playSplit(s.clip, 'NinjaJump_Start', { upperSpeed: s.speed, lowerSpeed: 1.5, fade: 0.06 })
      : ronin.playSplit(s.clip, 'spear-thrust', { upperSpeed: s.speed, lowerSpeed: 0.3, lowerAt: 0.42, fade: 0.06 }))
    : ronin.play(s.clip, { loop: false, fade: 0.06, speed: s.speed, onEnd: () => { if (pc.strike && pc.strike.def === s) pc.strike = null; } });
  let lunge = 0;
  if (to) {                                                             // turn so the blade's contact point lies on the target, then close to it
    facing = Math.atan2(to.x, to.z) - Math.atan2(C.off, C.reach);
    lunge = Math.min(PLANT === 'slide' ? 12 : 5, Math.max(0, to.length() - reach) / Math.max(0.08, impact));
  } else if (s === DASH_STRIKE) lunge = 9;
  pc.strike = { i, def: s, t: 0, dur: a.getClip().duration / s.speed, impact, contact: C, reach, hit: false, landed: false, lunge, target, air, lift: 0, groundSlide: 0 };
  pc.strike.arc = vfx.slashArc(ronin, s.clip, s.speed, impact, s.power > 1);
  sfx(s.power > 1 ? 'heavy' : 'swing');
}
bandits.onBlow = (b, dir, kind) => {
  if (!pc.alive || pc.invuln > 0) return;                                // a dodge's first 233 ms: the blow passes through (For Honor)
  const toB = new THREE.Vector3().subVectors(b.root.position, pos).setY(0).normalize();
  const facingV = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
  if (pc.strike && facingV.dot(toB) > 0.6 && pc.strike.t < pc.strike.impact + 0.05) {   // blades meet: a parry
    sfx('clash'); vfx.hit(pos.clone().add(new THREE.Vector3(0, 1.3, 0)).addScaledVector(toB, 0.7), toB, false); trauma += 0.25; freeze = 0.06; slow = Math.max(slow, 0.45); pc.ki = Math.min(100, pc.ki + 25);
    bandits.flinchKick(b, toB, 0.5); return;
  }
  pc.hp -= kind === 'heavy' ? 18 : kind === 'combo' ? 8 : 10; trauma = Math.min(1, trauma + (kind === 'heavy' ? 0.7 : 0.45)); freeze = 0.06; sfx('hurt');
  vfx.hit(pos.clone().add(new THREE.Vector3(0, 1.3, 0)), dir.clone().negate(), true);
  pc.knock = { dir: dir.clone(), left: kind === 'heavy' ? 0.9 : 0.3 };
  document.body.classList.add('hurt'); setTimeout(() => document.body.classList.remove('hurt'), 180);
  if (pc.hp <= 0) { pc.alive = false; pc.strike = null; pc.deadT = 0; ronin.play('Death01', { loop: false, fade: 0.1 }); sfx('fall'); say('倒 — the ronin falls', 3500); }
  else if (!pc.strike && pc.roll <= 0) ronin.play('Hit_Chest', { loop: false, fade: 0.06, speed: 1.3 });
};
bandits.onAlert = () => { sfx('alert'); say('Bandits!', 1400); };
bandits.onKill = (b) => {
  pc.kills++; pc.ki = Math.min(100, pc.ki + 20); sfx('fall', 0.7);
  if (pc.kills === TOTAL) { say('The valley is quiet.', 5000); slow = 1.2; }
  else if (bandits.list.filter((o) => o.nav === b.nav).every((o) => o.dead)) { say('陣 — the camp is cleared', 2600); slow = Math.max(slow, 1.0); }
};

// ── the specials: 閃 a dash that cuts a line (they fall a beat after the blade passes), 嵐 a storm of cuts all around ──
function dashSpecial() {
  pc.ki -= 50; pc.invuln = 0.9; sfx('heavy');
  const dir = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
  ronin.play('Sword_Dash', { loop: false, fade: 0.05, speed: 1.35 });
  // airborne, never a slide: a flat fast leap through the line (0.5 m up over its 0.34 s: launch 4h/T, gravity 8h/T², Pittman's jump)
  pc.special = { kind: 'dash', t: 0, dur: 0.34, from: pos.clone(), dir, victims: new Set(), fell: false, jump: PLANT === 'slide' ? null : { v: 4 * 0.5 / 0.34, g: 8 * 0.5 / (0.34 * 0.34) } };
}
function stormSpecial() {
  pc.ki -= 100; pc.invuln = 1.6; sfx('heavy');
  const a = ronin.play('Sword_Heavy_Combo', { loop: false, fade: 0.06, speed: 1.25 });
  pc.special = { kind: 'storm', t: 0, dur: a.getClip().duration / 1.25, beats: [0.22, 0.48, 0.74], done: 0 };
}
function specialUpdate(dt) {
  const sp = pc.special; if (!sp) return { vx: 0, vz: 0 };
  sp.t += dt;
  if (sp.kind === 'dash') {
    if (sp.t < sp.dur) {
      for (const b of bandits.alive()) {                                     // who stands on the blade's line
        const d = b.root.position.clone().sub(pos); d.y = 0; if (d.length() < 1.9) sp.victims.add(b);
      }
      return { vx: sp.dir.x * 27, vz: sp.dir.z * 27 };
    }
    if (!sp.fell) {
      sp.fell = true; sp.to = pos.clone();
      sp.stroke = vfx.stroke(sp.from.clone().add(new THREE.Vector3(0, 1.05, 0)), sp.to.clone().add(new THREE.Vector3(0, 1.25, 0)), { width: PLANT === 'wideslash' ? 1.3 : 0.34, color: 'crimson', life: 1.7 });
      sp.fallAt = sp.t + 0.32;                                               // a beat of silence, then they fall
    }
    if (sp.t >= sp.fallAt && sp.victims) {
      for (const b of sp.victims) { if (b.dead) continue; const d = b.root.position.clone().sub(sp.from).setY(0).normalize(); bandits.hit(b, sp.dir.clone().multiplyScalar(0.6).add(d.multiplyScalar(0.4)).normalize(), PLANT === 'specials' ? 0 : 4, { breaksGuard: true }); vfx.hit(b.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), sp.dir, true); }
      if (sp.victims.size) { sfx('cut'); slow = Math.max(slow, 0.9); trauma = Math.min(1, trauma + 0.5); vfx.pressStroke(sp.stroke, [...sp.victims].some((b) => b.dead) ? 2 : 1); }
      sp.victims = null; setTimeout(() => { if (pc.special === sp) pc.special = null; }, 250);
    }
    return { vx: 0, vz: 0 };
  }
  if (sp.kind === 'storm') {
    while (sp.done < sp.beats.length && sp.t / sp.dur >= sp.beats[sp.done]) {
      const last = sp.done === sp.beats.length - 1; sp.done++;
      const a0 = facing + sp.done * 2.1;
      const ring = [];
      for (let k = 0; k < 3; k++) {                                           // an ink ring, three strokes around him
        const a = a0 + k * 2.09, r = 2.6;
        ring[k] = vfx.stroke(pos.clone().add(new THREE.Vector3(Math.sin(a) * r, 1.0 + k * 0.15, Math.cos(a) * r)), pos.clone().add(new THREE.Vector3(Math.sin(a + 1.9) * r, 1.1, Math.cos(a + 1.9) * r)), { width: PLANT === 'wideslash' ? 0.85 : 0.26, color: last ? 'crimson' : 'ink', life: 0.9 });
      }
      let n = 0;
      for (const b of bandits.alive()) {
        const d = b.root.position.clone().sub(pos); d.y = 0; if (d.length() > 3.6) continue;
        n++; bandits.hit(b, d.normalize(), PLANT === 'specials' ? 0 : 2, { breaksGuard: true, hold: !last }); vfx.hit(b.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), d, true);
        for (const rk of ring) vfx.pressStroke(rk, b.dead ? 2 : 1);           // the ring swells where it wounds, more where it kills
      }
      sfx(n ? 'cut' : 'swing'); trauma = Math.min(1, trauma + (last ? 0.55 : 0.25)); freeze = n ? 0.06 : 0; if (last) slow = Math.max(slow, 0.5);
    }
    if (sp.t >= sp.dur) pc.special = null;
    return { vx: Math.sin(facing) * 1.2, vz: Math.cos(facing) * 1.2 };
  }
  return { vx: 0, vz: 0 };
}

const input = createInput(root);
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, startAudio, { once: true });
const cam = { yaw: Math.PI * 0.85, pitch: 0.28, dist: 6.0, target: new THREE.Vector3() };
const STEP = 1 / 60;

function frame(now) {
  const realDt = Math.min(0.1, (now - last) / 1000); last = now;
  const inp = input.read();
  freeze = Math.max(0, freeze - realDt); slow = Math.max(0, slow - realDt);
  const dt = freeze > 0 ? 0 : realDt * (slow > 0 ? 0.3 : 1);              // hit-stop holds the world; slow motion runs it at 0.3x; the camera stays real-time
  // Sky.js's clock counts SECONDS (three.js's own example: performance.now() * 0.001); fed milliseconds (until 8 Nov) its cloud sheet
  // drifted and churned 1,000× too fast — the owner: "The clouds are moving way! Too fast!" (plant skyms)
  time += dt; paint.time.value += dt; skyPaint.update(PLANT === 'skyms' ? time * 1000 : time);
  cam.yaw -= inp.dx * 0.0032; cam.pitch = THREE.MathUtils.clamp(cam.pitch + inp.dy * 0.0026, -0.25, 1.1);
  fwd.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)); right.set(-fwd.z, 0, fwd.x);
  move.set(0, 0, 0);
  if (pc.alive) {
    move.addScaledVector(fwd, inp.my).addScaledVector(right, inp.mx);
    { const pushed = move.lengthSq() > 0.09, dir = pushed ? move.clone().setY(0).normalize() : new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
      if (!pc.strike || !pc.strike.air) lock.update(pos, dir, pushed, bandits.alive()); }
    if (inp.strike && !pc.special) {
      if (!pc.strike && pc.roll <= 0) { if (inp.run && vel.length() > 6) strike(-1, DASH_STRIKE); else strike(0); }
      else if (pc.strike && pc.strike.i >= 0 && pc.strike.i < 2) pc.queued = true;           // buffered: it fires at the cancel window
    }
    if (inp.dash && pc.ki >= 50 && !pc.strike && !pc.special && pc.roll <= 0) dashSpecial();
    if (inp.storm && pc.ki >= 100 && !pc.strike && !pc.special && pc.roll <= 0) stormSpecial();
    const canDodge = !pc.special && (!pc.strike || pc.strike.t > pc.strike.impact + 0.05);      // a dodge cancels a strike after its impact
    if (inp.roll && pc.roll <= 0 && canDodge) {
      pc.strike = null; pc.roll = 0.42; pc.invuln = 0.233; sfx('roll');
      const mv = move.lengthSq() > 0.01 ? move.clone().normalize() : new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
      const fx = Math.sin(facing), fz = Math.cos(facing), along = mv.x * fx + mv.z * fz, side = mv.x * fz - mv.z * fx;
      pc.rollDir = mv;
      const clip = along > 0.5 ? 'Roll' : along < -0.5 ? 'dodge-back' : side > 0 ? 'dodge-left' : 'dodge-right';
      ronin.play(clip, { loop: false, fade: 0.05, speed: clip === 'Roll' ? 1.6 : 1.5 });
    }
  }
  let speed = inp.run ? 8.0 : 5.2;                                       // Overgrowth's numbers: 8 m/s on the run
  if (pc.strike) { speed = 0; pc.strike.t += dt; }
  if (move.lengthSq() > 1e-4 && pc.roll <= 0 && !pc.strike) { const tgt = Math.atan2(move.x, move.z); let d = tgt - facing; d = Math.atan2(Math.sin(d), Math.cos(d)); facing += d * Math.min(1, dt * 16); }
  // accelerate toward the wanted velocity at 35 m/s² (Overgrowth), so a start and a turn have weight but never lag
  { const want = new THREE.Vector2(move.x * speed, move.z * speed), dv = want.sub(vel), max = 35 * dt; if (dv.length() > max) dv.setLength(max); vel.add(dv); }
  let vx = vel.x, vz = vel.y;
  if (pc.roll > 0) { pc.roll -= dt; const k = pc.roll > 0.14 ? 11 : 5; vx = pc.rollDir.x * k; vz = pc.rollDir.z * k; vel.set(vx * 0.5, vz * 0.5); }
  let flight = null;                                                      // where the body is carried this frame (a leap or a lunge), if it is
  if (pc.strike && pc.strike.air) {
    const st = pc.strike, A = st.air;
    if (!A.landed) {
      // the landing point follows the target (the warp target, updated every frame): on the line from where he jumped, at reach
      if (st.target && !st.target.dead) { const tp = st.target.root.position, d = new THREE.Vector3().subVectors(tp, A.from).setY(0), L = d.length(); A.land = A.from.clone().addScaledVector(d.normalize(), Math.max(0, L - st.reach)); }
      else if (!A.land) A.land = A.from.clone();
      const u = THREE.MathUtils.clamp((st.t - A.tau) / A.T, 0, 1);
      const y0 = A.from.y, y1 = land.groundY(A.land.x, A.land.z);
      flight = new THREE.Vector3().lerpVectors(A.from, A.land, u); flight.y = y0 + (y1 - y0) * u + 4 * A.h * u * (1 - u);
      st.lift = Math.max(st.lift, flight.y - land.groundY(flight.x, flight.z));
      if (st.t >= A.tau + A.T) {                                            // down: the feet land with the cut
        A.landed = true; flight.y = y1 + 0.02;
        if (A.kind === 'leap') { const s = st.def; ronin.play(s.clip, { loop: false, fade: 0.08, speed: s.speed, at: st.t * s.speed, onEnd: () => { if (pc.strike === st) pc.strike = null; } }); }
      }
      if (st.target && !st.target.dead) { const t2 = new THREE.Vector3().subVectors(st.target.root.position, flight); facing = Math.atan2(t2.x, t2.z) - Math.atan2(st.contact.off, st.contact.reach); }
    }
    if (pc.queued && st.i >= 0 && st.i < 2 && A.landed && st.t >= st.impact + (st.landed ? 0.166 : 0.2)) strike(st.i + 1);
    vel.set(0, 0); vx = vz = 0;
  } else if (pc.strike) {                                                 // the warp: cover the gap to reach by the impact, then plant
    const st = pc.strike, fw = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
    if (st.t < st.impact && st.target && !st.target.dead) {                 // close exactly to the contact distance, along the line to the target
      const to = new THREE.Vector3().subVectors(st.target.root.position, pos).setY(0), gap = to.length() - st.reach;
      const sp = gap > 0 ? Math.min(st.lunge, gap / Math.max(dt, 1e-3)) : 0; to.normalize(); vx = to.x * sp; vz = to.z * sp;
    } else if (st.t < st.impact) { vx = fw.x * st.lunge; vz = fw.z * st.lunge; } else { vx = vz = 0; }
    vel.set(0, 0);
    if (st.target && !st.target.dead && st.t < st.impact) { const to = new THREE.Vector3().subVectors(st.target.root.position, pos); facing = Math.atan2(to.x, to.z) - Math.atan2(st.contact.off, st.contact.reach); }
    // the chain: a buffered press starts the next strike at impact +166 ms (a hit) or +200 ms (a miss)
    if (pc.queued && st.i >= 0 && st.i < 2 && st.t >= st.impact + (st.landed ? 0.166 : 0.2)) strike(st.i + 1);
  }
  if (pc.knock && pc.knock.left > 0) { const step = Math.min(pc.knock.left, 4 * dt); pc.knock.left -= step; vx += pc.knock.dir.x * step / Math.max(dt, 1e-3); vz += pc.knock.dir.z * step / Math.max(dt, 1e-3); }
  pc.invuln -= dt;
  if (pc.special) { const sv = specialUpdate(dt); vx = sv.vx; vz = sv.vz; }
  if (!pc.alive) { vx = vz = 0; pc.deadT += realDt; if (pc.deadT > 4) respawn(); }
  acc += dt; let jump = inp.jump && pc.alive && !pc.strike;
  let launch = pc.special && pc.special.kind === 'dash' && pc.special.jump && !pc.special.jumped ? pc.special.jump.v : 0;
  const gScale = pc.special && pc.special.kind === 'dash' && pc.special.jump && pc.special.t < pc.special.dur + 0.2 ? pc.special.jump.g / 9.81 : 1;
  if (flight) player.setPosition(flight.x, flight.y, flight.z);            // carried through the air: the arc is the body's path
  const groundBefore = pos.clone();
  while (acc >= STEP) { if (!flight) { player.step(STEP, vx, vz, jump, launch, gScale); if (launch) pc.special.jumped = true; launch = 0; jump = false; } P.jolt.Step(STEP, 1); acc -= STEP; }
  player.position(pos);
  if (pc.strike && !flight && pc.strike.t < pc.strike.impact) {           // the walls read how far a strike slid along the ground
    const lift = pos.y - land.groundY(pos.x, pos.z); if (lift < 0.15) pc.strike.groundSlide += Math.hypot(pos.x - groundBefore.x, pos.z - groundBefore.z);
  }
  if (pc.special && pc.special.kind === 'dash') pc.special.lift = Math.max(pc.special.lift || 0, pos.y - land.groundY(pos.x, pos.z));
  ronin.root.position.copy(pos); ronin.root.rotation.y = facing;
  { const v = player.character.GetLinearVelocity(); if (pc.alive && pc.roll <= 0 && !pc.special && !pc.strike) ronin.move(Math.hypot(v.GetX(), v.GetZ())); }
  ronin.update(dt);

  // the blow lands in its window: every bandit in front, within reach
  if (pc.strike && !pc.strike.hit) {
    const st = pc.strike, s = st.def, C = st.contact, d = clipdata[s.clip];
    if (st.t >= st.impact - 0.05 && st.t <= st.impact + 0.07 && PLANT !== 'blade') {
      // the blade at contact, base to tip, in the world; a bandit is cut when that segment passes within his body's radius
      const bl = d && d.base[C.frame] ? d.base[C.frame] : [0, 1.1, 0.3];
      const B = toWorld(bl[0], bl[1], bl[2]), Tp = toWorld(C.tip[0], C.tip[1], C.tip[2]);
      const swing = toWorld(C.swing[0], 0, C.swing[2]).sub(pos).setY(0).normalize();
      for (const b of bandits.alive()) {
        const bp = b.root.position, seg = new THREE.Vector3().subVectors(Tp, B).setY(0), rel = new THREE.Vector3().subVectors(bp, B).setY(0);
        const k = THREE.MathUtils.clamp(rel.dot(seg) / Math.max(seg.lengthSq(), 1e-4), 0, 1), closest = B.clone().lerp(Tp, k);
        if (Math.hypot(closest.x - bp.x, closest.z - bp.z) > 0.55) continue;
        st.hit = true;
        const out = new THREE.Vector3().subVectors(bp, pos).setY(0).normalize();
        const dir = swing.clone().multiplyScalar(0.65).addScaledVector(out, 0.35).normalize();      // thrown along the cut, and away
        const r = bandits.hit(b, dir, s.power, { breaksGuard: s.power > 1 });
        const at = new THREE.Vector3(closest.x, THREE.MathUtils.clamp(closest.y, bp.y + 0.6, bp.y + 1.7), closest.z);
        if (r === 'blocked') { sfx('clash'); vfx.hit(at, out.clone().negate(), false); freeze = 0.05; trauma = Math.min(1, trauma + 0.2); pc.queued = false; continue; }
        st.landed = true; sfx('cut'); pc.ki = Math.min(100, pc.ki + 12);
        vfx.pressArc(st.arc, b.dead ? 2 : 1);                                // the brush presses into a wound, hardest on a death
        vfx.hit(at, dir, true);
        freeze = s.power > 1 || b.dead ? 0.11 : 0.07; trauma = Math.min(1, trauma + (s.power > 1 ? 0.45 : 0.28));
      }
    }
  }
  bandits.update(dt, ronin, pos, pc.alive);
  vfx.trailUpdate(ronin.sword, !!pc.strike && pc.strike.t / pc.strike.dur > 0.15 && pc.strike.t / pc.strike.dur < 0.7);
  vfx.update(dt, pos); vfx.strokeUpdate(realDt, camera); vfx.lockMark(PLANT === 'nolock' || !pc.alive ? null : lock.target, realDt);
  birds.update(realDt, pos, bandits.list.some((b) => !b.dead && b.state !== 'idle' && b.state !== 'return') ? 1 : 0); clouds.update(realDt); sway.update(realDt);
  for (const c of env.camps) { c.fire.light.intensity = 5 + Math.sin(time * 11) * 0.8 + Math.sin(time * 23) * 0.5; for (const f of c.group.userData.flags) f.rotation.y = f.userData.base + Math.sin(time * 1.7 + f.userData.wave) * 0.25; }

  // the camera: behind and above, never under the ground, shaken by trauma² (KidsCanCode's screen shake)
  if (!cam.hold) cam.target.lerp(tmp.copy(pos).add(new THREE.Vector3(0, 1.5, 0)), 1 - Math.exp(-realDt * 10));   // cam.hold: a locked-off shot (filming)
  const off = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)).multiplyScalar(cam.dist);
  camera.position.copy(cam.target).add(off);
  camera.position.y = Math.max(camera.position.y, land.groundY(camera.position.x, camera.position.z) + 0.6);
  // the camera keeps clear of a camp's smoke column and its banner poles (Cinemachine's collider pushes a camera out of what it would
  // pass into): inside the smoke the whole picture went white for a second of the fight (8 Nov, the reveal)
  if (!cam.hold && PLANT !== 'camclip') for (const c of env.camps) {
    for (const k of c.clear || (c.clear = [{ x: c.center.x, z: c.center.z, r: 2.6, top: c.center.y + 16 }, ...c.group.userData.flags.map((f) => { const w = f.getWorldPosition(new THREE.Vector3()); return { x: w.x - WIND.x * 0.36, z: w.z - WIND.z * 0.36, r: 1.3, top: w.y + 1.2 }; })])) {
      const dx = camera.position.x - k.x, dz = camera.position.z - k.z, d = Math.hypot(dx, dz);
      if (d < k.r && camera.position.y < k.top) { const s2 = k.r / Math.max(d, 1e-3); camera.position.x = k.x + dx * s2; camera.position.z = k.z + dz * s2; }
    }
  }
  camera.lookAt(cam.target);
  trauma = Math.max(0, trauma - realDt * 1.6);
  const sh = trauma * trauma;
  if (sh > 0) { const k = now * 0.05; camera.position.add(new THREE.Vector3(Math.sin(k * 1.3) * 0.32 * sh, Math.sin(k * 1.7 + 2) * 0.24 * sh, 0)); camera.rotateZ(Math.sin(k * 1.1) * 0.05 * sh); }

  sun.position.copy(pos).addScaledVector(sunDir, 120); sun.target.position.copy(pos);
  grass.update(realDt, camera, pos);
  updateAudio(realDt, { speed: Math.hypot(vx, vz), danger: bandits.list.some((b) => !b.dead && b.state !== 'idle') ? 1 : 0 });
  hud.hp.style.width = Math.max(0, pc.hp) + '%'; hud.ki.style.width = pc.ki + '%'; document.body.classList.toggle('ki-50', pc.ki >= 50); document.body.classList.toggle('ki-100', pc.ki >= 100); document.body.classList.toggle('slowmo', slow > 0); hud.kills.textContent = `斬 ${pc.kills} / ${TOTAL}`;
  if (clouds.render) { camera.updateMatrixWorld(); clouds.render(renderer, camera); }        // the clouds' mass into its buffer, before the frame
  composer.render(realDt);
  if (!booted) { booted = true; if (window.__MOSA_BOOT) window.__MOSA_BOOT.ok = true; else window.__MOSA_BOOT = { ok: true };   // NotesMosaic: ready on the first painted frame
    document.body.classList.add('booted'); setTimeout(() => hud.help.classList.add('gone'), 9000); }
  window.__STACK_MEMORY = memory();
  requestAnimationFrame(frame);
}

function respawn() {
  pc.hp = 100; pc.alive = true; pc.deadT = 0; pc.strike = null; ronin.play('Idle_Loop', { loop: true });
  player.setPosition(SPAWN.x, SPAWN.y, SPAWN.z); say('The ronin rises again', 2200);
}

// what this page asks a phone to hold, by its own count: Jolt's fixed memory, Recast's, the textures and the render targets
function memory() {
  let tex = 0; const seen = new Set();
  scene.traverse((o) => { const m = o.material; if (!m) return; for (const mm of Array.isArray(m) ? m : [m]) for (const k of ['map', 'alphaMap']) { const t = mm[k]; if (t && t.image && !seen.has(t)) { seen.add(t); tex += (t.image.width || 0) * (t.image.height || 0) * 4 * 1.33; } } });
  const w = renderer.domElement.width, h = renderer.domElement.height, rts = w * h * 8 * 3 + (w * h * painterly.scale * painterly.scale) * 8 * 3 + sun.shadow.mapSize.x * sun.shadow.mapSize.y * 4;
  const heap = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 60;
  const out = { jolt: P.Jolt.HEAP8.buffer.byteLength / 1048576, recast: 16, textures: (tex / 1048576) + paintMemoryMB(), targets: (rts / 1048576) + (clouds.memoryMB ? clouds.memoryMB() : 0), heap };
  out.totalMB = out.jolt + out.recast + out.textures + out.targets + out.heap;
  return out;
}

addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  const s = renderer.getDrawingBufferSize(new THREE.Vector2()); skyPaint.setResolution(s.x, s.y); if (clouds.setSize) clouds.setSize(s.x, s.y); });
window.__GAME = { THREE, scene, camera, renderer, player, land, P, cam, grass, painterly, ronin, kit, bandits, navs, env, pc, rest, vfx, strike, anatomicalBends, dashSpecial, stormSpecial, clipdata, COMBO, DASH_STRIKE, LEAP_STRIKE, lock, LOCK_RANGE, birds, clouds, sky, skyPaint, paint, PALETTE, RAMP, WIND, sunDir,
  get facing() { return facing; }, set facing(v) { facing = v; } };
requestAnimationFrame(frame);
