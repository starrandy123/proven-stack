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

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.2, 1600);
const sky = new Sky(); sky.scale.setScalar(4000); scene.add(sky);
const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 11), THREE.MathUtils.degToRad(215));
const U = sky.material.uniforms; U.turbidity.value = 3.5; U.rayleigh.value = 1.4; U.mieCoefficient.value = 0.006; U.mieDirectionalG.value = 0.85; U.sunPosition.value.copy(sunDir);
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
const env = await buildEnvironment(scene, land, P);
const vfx = createVfx(scene, { phone: PHONE });
for (const c of env.camps) c.fire = vfx.fire(c.center.clone().add(new THREE.Vector3(0, 0.1, 0)));

loading('mapping the paths (Recast)');
const regions = land.spots.camps.map((c, i) => ({ name: 'camp' + i, center: c, size: 60, maxAgents: 6,
  meshes: [terrainPatch(land, c, 60, N, SPACING), ...obstacleMeshes(env.obstacles, land, c, 60)] }));
const navs = await createNavigation(regions);
const bandits = new Bandits(scene, kit, navs, P, rest, land, { perCamp: Q.has('test') ? 1 : 4, frozen: PLANT === 'nav' });
const TOTAL = bandits.list.length;

const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
composer.addPass(new RenderPass(scene, camera));
const painterly = new PainterlyPass(camera, { targetHeight: 560, radiusNear: 2, radiusFar: 6 });
composer.addPass(painterly);
if (Q.has('raw')) painterly.enabled = false;

// ── the ronin's fight ──
const pc = { hp: 100, alive: true, queued: false, strike: null, roll: 0, invuln: 0, deadT: 0, kills: 0, ki: 0, special: null };
const COMBO = [{ clip: 'Sword_Regular_A', power: 1, at: [0.3, 0.55], speed: 1.15 }, { clip: 'Sword_Regular_B', power: 1, at: [0.3, 0.55], speed: 1.15 }, { clip: 'Sword_Regular_C', power: 2, at: [0.35, 0.6], speed: 1.05 }];
let freeze = 0, trauma = 0, slow = 0;                                  // slow: seconds of slow motion left (the world at 0.3x)
const pos = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3(), tmp = new THREE.Vector3();
let facing = 0, acc = 0, last = performance.now(), booted = false, time = 0;
function strike(i) {
  const s = COMBO[i]; pc.queued = false;
  const a = ronin.play(s.clip, { loop: false, fade: 0.08, speed: s.speed, onEnd: () => { if (pc.strike && pc.strike.i === i) { pc.strike = null; if (pc.queued && i < 2) strike(i + 1); } } });
  pc.strike = { i, t: 0, dur: a.getClip().duration / s.speed, hit: false };
  sfx(s.power > 1 ? 'heavy' : 'swing');
}
bandits.onBlow = (b, dir) => {
  if (!pc.alive || pc.invuln > 0) return;
  const toB = new THREE.Vector3().subVectors(b.root.position, pos); toB.y = 0; toB.normalize();
  const facingV = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
  if (pc.strike && facingV.dot(toB) > 0.6 && pc.strike.t / pc.strike.dur < 0.5) {               // blades meet: a parry
    sfx('clash'); vfx.hit(pos.clone().add(new THREE.Vector3(0, 1.3, 0)).addScaledVector(toB, 0.7), toB, false); trauma += 0.25; freeze = 0.06; slow = Math.max(slow, 0.45); pc.ki = Math.min(100, pc.ki + 25); return;
  }
  pc.hp -= 14; trauma = Math.min(1, trauma + 0.55); freeze = 0.06; sfx('hurt');
  vfx.hit(pos.clone().add(new THREE.Vector3(0, 1.3, 0)), dir.clone().negate(), true);
  document.body.classList.add('hurt'); setTimeout(() => document.body.classList.remove('hurt'), 180);
  if (pc.hp <= 0) { pc.alive = false; pc.strike = null; pc.deadT = 0; ronin.play('Death01', { loop: false, fade: 0.1 }); sfx('fall'); say('倒 — the ronin falls', 3500); }
  else if (!pc.strike && pc.roll <= 0) ronin.play('Hit_Chest', { loop: false, fade: 0.08, speed: 1.3 });
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
  pc.special = { kind: 'dash', t: 0, dur: 0.34, from: pos.clone(), dir, victims: new Set(), fell: false };
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
      vfx.stroke(sp.from.clone().add(new THREE.Vector3(0, 1.05, 0)), sp.to.clone().add(new THREE.Vector3(0, 1.25, 0)), { width: 0.55, color: '#8e1510', life: 1.7 });
      sp.fallAt = sp.t + 0.32;                                               // a beat of silence, then they fall
    }
    if (sp.t >= sp.fallAt && sp.victims) {
      for (const b of sp.victims) { if (b.dead) continue; const d = b.root.position.clone().sub(sp.from).setY(0).normalize(); bandits.hit(b, sp.dir.clone().multiplyScalar(0.6).add(d.multiplyScalar(0.4)).normalize(), PLANT === 'specials' ? 0 : 3); vfx.hit(b.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), sp.dir, true); }
      if (sp.victims.size) { sfx('cut'); slow = Math.max(slow, 0.9); trauma = Math.min(1, trauma + 0.5); }
      sp.victims = null; setTimeout(() => { if (pc.special === sp) pc.special = null; }, 250);
    }
    return { vx: 0, vz: 0 };
  }
  if (sp.kind === 'storm') {
    while (sp.done < sp.beats.length && sp.t / sp.dur >= sp.beats[sp.done]) {
      const last = sp.done === sp.beats.length - 1; sp.done++;
      const a0 = facing + sp.done * 2.1;
      for (let k = 0; k < 3; k++) {                                           // an ink ring, three strokes around him
        const a = a0 + k * 2.09, r = 2.6;
        vfx.stroke(pos.clone().add(new THREE.Vector3(Math.sin(a) * r, 1.0 + k * 0.15, Math.cos(a) * r)), pos.clone().add(new THREE.Vector3(Math.sin(a + 1.9) * r, 1.1, Math.cos(a + 1.9) * r)), { width: 0.4, color: last ? '#8e1510' : '#14090a', life: 0.9 });
      }
      let n = 0;
      for (const b of bandits.alive()) {
        const d = b.root.position.clone().sub(pos); d.y = 0; if (d.length() > 3.6) continue;
        n++; bandits.hit(b, d.normalize(), PLANT === 'specials' ? 0 : (last ? 2 : 1)); vfx.hit(b.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), d, true);
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
  time += dt;
  cam.yaw -= inp.dx * 0.0032; cam.pitch = THREE.MathUtils.clamp(cam.pitch + inp.dy * 0.0026, -0.25, 1.1);
  fwd.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)); right.set(-fwd.z, 0, fwd.x);
  move.set(0, 0, 0);
  if (pc.alive) {
    move.addScaledVector(fwd, inp.my).addScaledVector(right, inp.mx);
    if (inp.strike && !pc.special) { if (!pc.strike && pc.roll <= 0) strike(0); else if (pc.strike && pc.strike.i < 2 && pc.strike.t / pc.strike.dur > 0.35) pc.queued = true; }
    if (inp.dash && pc.ki >= 50 && !pc.strike && !pc.special && pc.roll <= 0) dashSpecial();
    if (inp.storm && pc.ki >= 100 && !pc.strike && !pc.special && pc.roll <= 0) stormSpecial();
    if (inp.roll && pc.roll <= 0 && !pc.strike && !pc.special) { pc.roll = 0.62; pc.invuln = 0.45; ronin.play('Roll', { loop: false, fade: 0.06, speed: 1.25 }); sfx('roll'); if (move.lengthSq() > 0.01) facing = Math.atan2(move.x, move.z); }
  }
  let speed = inp.run ? 7.5 : 3.6;
  if (pc.strike) { speed = 0.9; pc.strike.t += dt; }
  if (move.lengthSq() > 1e-4 && pc.roll <= 0 && !pc.strike) { const tgt = Math.atan2(move.x, move.z); let d = tgt - facing; d = Math.atan2(Math.sin(d), Math.cos(d)); facing += d * Math.min(1, dt * 12); }
  if (pc.strike && move.lengthSq() > 1e-4 && pc.strike.t < 0.12) facing = Math.atan2(move.x, move.z);    // aim the first instant of a strike
  let vx = move.x * speed, vz = move.z * speed;
  if (pc.roll > 0) { pc.roll -= dt; vx = Math.sin(facing) * 7.5; vz = Math.cos(facing) * 7.5; }
  if (pc.strike) { const lunge = pc.strike.t / pc.strike.dur < 0.4 ? 2.2 : 0; vx += Math.sin(facing) * lunge; vz += Math.cos(facing) * lunge; }
  pc.invuln -= dt;
  if (pc.special) { const sv = specialUpdate(dt); vx = sv.vx; vz = sv.vz; }
  if (!pc.alive) { vx = vz = 0; pc.deadT += realDt; if (pc.deadT > 4) respawn(); }
  acc += dt; let jump = inp.jump && pc.alive && !pc.strike;
  while (acc >= STEP) { player.step(STEP, vx, vz, jump); jump = false; P.jolt.Step(STEP, 1); acc -= STEP; }
  player.position(pos);
  ronin.root.position.copy(pos); ronin.root.rotation.y = facing;
  { const v = player.character.GetLinearVelocity(); if (pc.alive && pc.roll <= 0 && !pc.special) ronin.move(Math.hypot(v.GetX(), v.GetZ())); }
  ronin.update(dt);

  // the blow lands in its window: every bandit in front, within reach
  if (pc.strike && !pc.strike.hit) {
    const s = COMBO[pc.strike.i], f = pc.strike.t / pc.strike.dur;
    if (f >= s.at[0] && f <= s.at[1] && PLANT !== 'blade') {
      const facingV = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
      for (const b of bandits.alive()) {
        const to = new THREE.Vector3().subVectors(b.root.position, pos); to.y = 0; const d = to.length(); to.normalize();
        if (d < 2.7 && facingV.dot(to) > 0.25) {
          pc.strike.hit = true; bandits.hit(b, to, s.power); sfx('cut'); pc.ki = Math.min(100, pc.ki + 12);
          vfx.hit(b.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), to, true);
          freeze = s.power > 1 || b.dead ? 0.11 : 0.07; trauma = Math.min(1, trauma + (s.power > 1 ? 0.45 : 0.28));
        }
      }
    }
  }
  bandits.update(dt, ronin, pos, pc.alive);
  vfx.trailUpdate(ronin.sword, !!pc.strike && pc.strike.t / pc.strike.dur > 0.15 && pc.strike.t / pc.strike.dur < 0.7);
  vfx.update(dt, pos); vfx.strokeUpdate(realDt, camera);
  for (const c of env.camps) { c.fire.light.intensity = 5 + Math.sin(time * 11) * 0.8 + Math.sin(time * 23) * 0.5; for (const f of c.group.userData.flags) f.rotation.y = Math.sin(time * 1.7 + f.userData.wave) * 0.25; }

  // the camera: behind and above, never under the ground, shaken by trauma² (KidsCanCode's screen shake)
  if (!cam.hold) cam.target.lerp(tmp.copy(pos).add(new THREE.Vector3(0, 1.5, 0)), 1 - Math.exp(-realDt * 10));   // cam.hold: a locked-off shot (filming)
  const off = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)).multiplyScalar(cam.dist);
  camera.position.copy(cam.target).add(off);
  camera.position.y = Math.max(camera.position.y, land.groundY(camera.position.x, camera.position.z) + 0.6);
  camera.lookAt(cam.target);
  trauma = Math.max(0, trauma - realDt * 1.6);
  const sh = trauma * trauma;
  if (sh > 0) { const k = now * 0.05; camera.position.add(new THREE.Vector3(Math.sin(k * 1.3) * 0.32 * sh, Math.sin(k * 1.7 + 2) * 0.24 * sh, 0)); camera.rotateZ(Math.sin(k * 1.1) * 0.05 * sh); }

  sun.position.copy(pos).addScaledVector(sunDir, 120); sun.target.position.copy(pos);
  grass.update(realDt, camera, pos);
  updateAudio(realDt, { speed: Math.hypot(vx, vz), danger: bandits.list.some((b) => !b.dead && b.state !== 'idle') ? 1 : 0 });
  hud.hp.style.width = Math.max(0, pc.hp) + '%'; hud.ki.style.width = pc.ki + '%'; document.body.classList.toggle('ki-50', pc.ki >= 50); document.body.classList.toggle('ki-100', pc.ki >= 100); document.body.classList.toggle('slowmo', slow > 0); hud.kills.textContent = `斬 ${pc.kills} / ${TOTAL}`;
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
  const out = { jolt: P.Jolt.HEAP8.buffer.byteLength / 1048576, recast: 16, textures: tex / 1048576, targets: rts / 1048576, heap };
  out.totalMB = out.jolt + out.recast + out.textures + out.targets + out.heap;
  return out;
}

addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
window.__GAME = { THREE, scene, camera, renderer, player, land, P, cam, grass, painterly, ronin, kit, bandits, navs, env, pc, rest, vfx, strike, anatomicalBends, dashSpecial, stormSpecial,
  get facing() { return facing; }, set facing(v) { facing = v; } };
requestAnimationFrame(frame);
