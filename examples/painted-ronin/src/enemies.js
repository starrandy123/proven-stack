// The bandits: Detour crowd agents (Recast & Detour) animated by Quaternius's and Mesh2Motion's CC0 clips, Jolt ragdolls when they fall.
// How a crowd fights one player, from shipped games (research F, `research/F_combat.md`):
//  · Kingdoms of Amalur's attack grid (Game AI Pro, ch. 28): slots on a ring around the player, and an ATTACK BUDGET — a cut costs 4,
//    a combo 6, the budget is 10 — so two cut at once, or one combos while one cuts; the rest hold their slots and circle.
//  · Ghost of Tsushima (GDC 2021): impacts at least 300 ms apart, so a player can read and answer each one.
//  · For Honor: a light attack's wind-up 500 ms, a heavy 800 ms, a feint called off at 500 ms.
//  · Overgrowth: the reaction is chosen by where the blow came from, blended by its force.
// Every impact time below is MEASURED off the clip itself (assets/clipdata.json: the peaks of the sword tip's speed).
import * as THREE from 'three';
import { Person } from './characters.js';
import { Ragdoll } from './ragdoll.js';

const TINTS = ['#ffffff', '#e8d2b0', '#c9b8a6', '#d6c3a0'].map((c) => new THREE.Color(c));
const RING = 4.2, REACH = 1.2, BUDGET = 10, COST = { cut: 4, combo: 6, heavy: 4 }, SPACING = 0.3;
const ATTACKS = {                                  // clip, cost, the wind-up to the FIRST impact (s); impacts are the clip's own
  cutA: { clip: 'Sword_Regular_A', kind: 'cut', windup: 0.5 },
  cutB: { clip: 'Sword_Regular_B', kind: 'cut', windup: 0.5 },
  combo: { clip: 'Sword_Regular_Combo', kind: 'combo', windup: 0.5 },
  slam: { clip: 'two-handed-overhead-slam', kind: 'heavy', windup: 0.8 },
};
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _qi = new THREE.Quaternion();

export class Bandits {
  constructor(scene, kit, navs, P, rest, land, { perCamp = 4, frozen = false, clipdata = {} } = {}) {
    this.scene = scene; this.P = P; this.rest = rest; this.land = land; this.list = []; this.ragdolls = []; this.navs = navs;
    this.clipdata = clipdata; this.spent = 0; this.lastImpact = -9; this.time = 0;
    let k = 0;
    for (const nav of navs) {
      for (let i = 0; i < perCamp; i++) {
        const b = new Person(kit, 'bandit', { tint: TINTS[(k++) % TINTS.length] }); b.armed = true;
        const a = (i / perCamp) * Math.PI * 2 + Math.random() * 0.5, r = 4 + Math.random() * 4;
        const want = new THREE.Vector3(nav.center.x + Math.cos(a) * r, 0, nav.center.y + Math.sin(a) * r); want.y = land.groundY(want.x, want.z);
        const { point } = nav.query.findClosestPoint(want);
        const agent = nav.crowd.addAgent(point, { radius: 0.42, height: 1.8, maxAcceleration: 18, maxSpeed: frozen ? 0 : 5.2, collisionQueryRange: 2.5, pathOptimizationRange: 12, separationWeight: 2.6 });
        Object.assign(b, { agent, nav, home: new THREE.Vector3(point.x, point.y, point.z), state: 'idle', hp: 2, cool: 1 + Math.random(), facing: Math.random() * 6.28,
          repath: 0, slot: -1, orbit: Math.random() < 0.5 ? -1 : 1, posture: 0, flinch: { a: 0, v: 0, axis: new THREE.Vector3(1, 0, 0) }, frozen });
        b.root.position.copy(b.home); scene.add(b.root); this.list.push(b);
      }
    }
  }
  alive() { return this.list.filter((b) => !b.dead); }
  impacts(clip) { return (this.clipdata[clip] && this.clipdata[clip].hits) || [0.25]; }

  // ── the blow from the player ── power 1 (a cut), 2 (the finisher, a dash), 3 (a special); dir: where it pushes
  // returns 'blocked' when the bandit's guard took it
  // from: where the blow comes from (the attacker). A guard faces the man who strikes, not the way his cut pushes: judged from the push,
  // a sideways cut never read as "in front", so no light cut was ever blocked (found 8 Nov, rehearsing the showcase's clash: research J §2)
  hit(b, dir, power, { breaksGuard = false, hold = false, from = null } = {}) {     // hold: a special's blow keeps them where they stand
    if (b.dead) return 'dead';
    const toPlayer = from && this.plant !== 'guardpush' ? new THREE.Vector3().subVectors(from, b.root.position).setY(0).normalize() : dir.clone().negate();
    const fwd = new THREE.Vector3(Math.sin(b.facing), 0, Math.cos(b.facing));
    const front = fwd.dot(toPlayer) > Math.cos(THREE.MathUtils.degToRad(60));
    if (front && !breaksGuard && power < 2 && (b.state === 'engage' || b.state === 'idle') && Math.random() < (this.blockChance ?? 0.28)) {
      this.setState(b, 'block'); b.play('weapon-block', { loop: false, fade: 0.06, speed: 1.6, onEnd: () => { if (b.state === 'block') this.setState(b, 'engage'); } });
      return 'blocked';
    }
    b.hp -= power; b.posture += power;
    this.flinchKick(b, dir, 0.32 + 0.12 * Math.min(power, 3));
    if (b.hp <= 0) return this.kill(b, dir, power, front);
    if (b.posture >= 3) {                                               // posture broken: dazed and open (Sekiro's posture, simply)
      b.posture = 0; this.setState(b, 'dizzy'); if (!hold) this.knock(b, dir, 0.6);
      b.play('dizzy', { loop: false, fade: 0.08, speed: 1.2, onEnd: () => { if (b.state === 'dizzy') this.setState(b, 'engage'); } });
      return 'dizzy';
    }
    this.setState(b, 'stagger'); if (!hold) this.knock(b, dir, power > 1 ? 1.1 : 0.35);
    const clip = !front ? 'Hit_Head' : power > 1 ? 'Hit_Knockback' : 'Hit_Chest';
    b.play(clip, { loop: false, fade: 0.05, speed: 1.15, onEnd: () => {
      if (b.dead || b.state !== 'stagger') return;
      // standsGround: a film's staging only (he never steps back out of a stagger)
      if (!hold && !b.standsGround && Math.random() < 0.35) { this.setState(b, 'dodge'); b.dodgeDir = dir.clone(); b.play('dodge-back', { loop: false, fade: 0.08, speed: 1.4, onEnd: () => { if (b.state === 'dodge') this.setState(b, 'engage'); } }); }
      else this.setState(b, 'engage');
    } });
    return 'hit';
  }

  kill(b, dir, power, front) {
    this.release(b);
    const fall = () => {
      if (b.ragdoll) return;
      b.nav.crowd.removeAgent(b.agent); b.agent = null; b.root.updateMatrixWorld(true);
      const imp = dir.clone().multiplyScalar(55 * Math.min(power, 3)); imp.y = 18 + 10 * power;
      const rag = new Ragdoll(this.P, b, this.rest, { velocity: dir.clone().multiplyScalar(1.2 * power), impulse: imp, at: 'torso', group: 10 + this.ragdolls.length });
      this.ragdolls.push(rag); b.ragdoll = rag;
    };
    b.dead = true; b.state = 'dead';
    if (power <= 1 && front) {                                        // a cut from the front: the body starts its own death, then gravity has it
      b.play(['death-a', 'death-b', 'death-c', 'death-d'][Math.floor(Math.random() * 4)], { loop: false, fade: 0.05, speed: 1.25 });
      b.deathFallAt = this.time + 0.32; b.deathFall = fall;
    } else fall();                                                     // a heavy blow or a special: thrown at once
    this.onKill && this.onKill(b);
    return 'dead';
  }

  knock(b, dir, dist) { b.knock = { dir: dir.clone().setY(0).normalize(), left: dist, speed: dist / 0.18 }; }
  flinchKick(b, dir, angle) { b.flinch.axis.set(0, 1, 0).cross(dir).normalize(); b.flinch.v += angle * 18; }
  // the budget is RESERVED when a bandit sets off to strike, and given back when it stops (struck, called off, or done):
  // checked and spent at the same moment, so two can never approach on the same unspent budget
  setState(b, s) { if ((b.state === 'attack' || b.state === 'approach') && s !== 'attack' && s !== 'approach') this.release(b); b.state = s; }
  release(b) { if (b.cost) { this.spent -= b.cost; b.cost = 0; } }

  // the spring flinch: spine and neck turned about the blow's axis, after the clip has posed them (an additive, Overgrowth-style)
  applyFlinch(b, dt) {
    const f = b.flinch; f.v += (-90 * f.a - 9 * f.v) * dt; f.a += f.v * dt;
    if (Math.abs(f.a) < 1e-3 && Math.abs(f.v) < 1e-3) return;
    for (const [name, k] of [['spine_02', 0.5], ['spine_03', 0.35], ['neck_01', 0.25]]) {
      const bone = b.bones[name]; if (!bone) continue;
      bone.parent.getWorldQuaternion(_qi).invert(); _v.copy(f.axis).applyQuaternion(_qi);
      bone.quaternion.premultiply(_q.setFromAxisAngle(_v, f.a * k));
    }
  }

  startAttack(b, name) {
    const A = ATTACKS[name], hits = this.impacts(A.clip);
    const speed = Math.min(1, Math.max(0.45, hits[0] / A.windup));
    // impacts at least 300 ms apart across the whole crowd (Ghost of Tsushima): wait if this one would land too close to the last
    const firstAt = this.time + hits[0] / speed;
    if (!this.budgetOff && firstAt < this.lastImpact + SPACING) return false;
    if (!b.cost) { b.cost = COST[A.kind]; this.spent += b.cost; }
    this.setState(b, 'attack');
    b.attack = { name, hits: hits.map((h) => this.time + h / speed), next: 0, feint: A.kind !== 'combo' && Math.random() < (this.feintChance ?? 0.15) };
    this.lastImpact = b.attack.hits[b.attack.hits.length - 1];
    b.agent.resetMoveTarget();
    b.play(A.clip, { loop: false, fade: 0.08, speed, onEnd: () => { if (b.state === 'attack') { this.setState(b, 'recover'); b.recoverUntil = this.time + 0.35 + Math.random() * 0.4; } } });
    return true;
  }

  update(dt, player, playerPos, playerAlive) {
    this.time += dt;
    for (const nav of this.navs) nav.crowd.update(1 / 60, Math.min(dt, 0.1));        // the example's fixed stepping, interpolated
    for (const r of this.ragdolls) r.apply(dt);
    const taken = new Set(this.list.filter((b) => !b.dead && b.slot >= 0).map((b) => b.slot));
    for (const b of this.list) {
      if (b.dead) { if (b.deathFall && this.time >= b.deathFallAt) { b.deathFall(); b.deathFall = null; } if (!b.ragdoll) b.update(dt); continue; }
      const p = b.agent.interpolatedPosition; b.root.position.set(p.x, p.y, p.z);
      const toP = new THREE.Vector3().subVectors(playerPos, b.root.position).setY(0); const d = toP.length(); const dirP = toP.clone().normalize();
      const home = b.root.position.distanceTo(b.home);
      b.cool -= dt; b.repath -= dt;
      if (b.state === 'idle' && playerAlive && d < 24) { for (const o of this.list) if (o.nav === b.nav && o.state === 'idle') o.state = 'engage'; this.onAlert && this.onAlert(b); }
      if (!playerAlive && b.state !== 'idle' && b.state !== 'return') { this.setState(b, 'return'); b.slot = -1; }
      if (b.state !== 'idle' && b.state !== 'return' && (home > 60 || d > 45)) { this.setState(b, 'return'); b.slot = -1; }
      if (b.knock && b.knock.left > 0) {                                // a knock: slide back along the blow, on the navmesh
        const step = Math.min(b.knock.left, b.knock.speed * dt); b.knock.left -= step;
        const { point } = b.nav.query.findClosestPoint(b.root.position.clone().addScaledVector(b.knock.dir, step)); b.agent.teleport(point);
      }
      if (b.state === 'dodge' && b.dodgeDir) { const { point } = b.nav.query.findClosestPoint(b.root.position.clone().addScaledVector(b.dodgeDir.clone().setY(0).normalize(), 3.2 * dt)); b.agent.teleport(point); }
      if (b.state === 'engage') {
        if (b.slot < 0) {                                                // claim the nearest free slot on the ring
          const ang = Math.atan2(b.root.position.x - playerPos.x, b.root.position.z - playerPos.z);
          let best = -1, bestD = 9; for (let s = 0; s < 8; s++) { if (taken.has(s)) continue; const sa = s / 8 * Math.PI * 2; const dd = Math.abs(Math.atan2(Math.sin(sa - ang), Math.cos(sa - ang))); if (dd < bestD) { bestD = dd; best = s; } }
          b.slot = best < 0 ? Math.floor(Math.random() * 8) : best; taken.add(b.slot); b.slotAng = b.slot / 8 * Math.PI * 2;
        }
        if (b.repath <= 0) {                                             // drift round the ring (circling), sometimes the other way
          b.repath = 0.25; b.slotAng += b.orbit * 0.12; if (Math.random() < 0.04) b.orbit *= -1;
          const tx = playerPos.x + Math.sin(b.slotAng) * RING, tz = playerPos.z + Math.cos(b.slotAng) * RING;
          const { point } = b.nav.query.findClosestPoint({ x: tx, y: this.land.groundY(tx, tz), z: tz }); b.agent.requestMoveTarget(point);
          b.agent.maxSpeed = b.frozen ? 0 : 2.4;
        }
        if (b.cool <= 0 && playerAlive) {                               // ask the budget for a blow
          const r = Math.random(), name = r < 0.5 ? (Math.random() < 0.5 ? 'cutA' : 'cutB') : r < 0.8 ? 'combo' : 'slam';
          if (this.budgetOff || this.spent + COST[ATTACKS[name].kind] <= BUDGET) { this.setState(b, 'approach'); b.planned = name; b.agent.maxSpeed = b.frozen ? 0 : 5.2; b.approachT = this.time; if (!this.budgetOff) { b.cost = COST[ATTACKS[name].kind]; this.spent += b.cost; } }
          b.cool = 0.8 + Math.random() * 1.6;
        }
      }
      if (b.state === 'approach') {
        if (b.repath <= 0) { b.repath = 0.15; const { point } = b.nav.query.findClosestPoint(playerPos.clone().addScaledVector(dirP, -(REACH - 0.1))); b.agent.requestMoveTarget(point); }
        if (d < REACH + 0.45) { if (!this.startAttack(b, b.planned)) b.cool = 0.15; }
        else if (this.time - b.approachT > 3) this.setState(b, 'engage');
      }
      if (b.state === 'attack' && b.attack) {
        const A = b.attack;
        if (A.feint && this.time > A.hits[0] - 0.12) {                    // the feint: called off just before it lands, then a step away
          this.setState(b, 'dodge'); b.dodgeDir = dirP.clone().negate(); b.attack = null;
          b.play('dodge-back', { loop: false, fade: 0.08, speed: 1.4, onEnd: () => { if (b.state === 'dodge') this.setState(b, 'engage'); } });
        } else while (A.next < A.hits.length && this.time >= A.hits[A.next]) {
          A.next++; if (d < REACH + 0.9 && this.onBlow) this.onBlow(b, dirP.clone(), ATTACKS[A.name].kind);
        }
      }
      if (b.state === 'recover' && this.time >= b.recoverUntil) this.setState(b, 'engage');
      if (b.state === 'return' && b.repath <= 0) { b.repath = 1; b.agent.maxSpeed = 4; b.agent.requestMoveTarget(b.home); if (home < 1.5) this.setState(b, 'idle'); }
      // facing: the player while fighting, the path while walking home
      const v = b.agent.velocity(), sp = Math.hypot(v.x, v.z);
      const fighting = !['idle', 'return'].includes(b.state);
      const target = fighting ? Math.atan2(dirP.x, dirP.z) : sp > 0.3 ? Math.atan2(v.x, v.z) : b.facing;
      let dd = target - b.facing; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); b.facing += dd * Math.min(1, dt * (b.state === 'attack' ? 4 : 10));
      b.root.rotation.y = b.facing;
      // feet: forward, backward or sideways against the way the body faces (the strafe and backward clips are Mesh2Motion's)
      if (['engage', 'approach', 'recover', 'idle', 'return'].includes(b.state)) {
        const fx = Math.sin(b.facing), fz = Math.cos(b.facing), along = v.x * fx + v.z * fz, side = v.x * fz - v.z * fx;
        if (sp < 0.35) b.move(0);
        else if (fighting && Math.abs(side) > Math.abs(along)) { b.play(side > 0 ? 'strafe-left' : 'strafe-right', { loop: true, fade: 0.2 }); b.current.setEffectiveTimeScale(THREE.MathUtils.clamp(sp / 2.2, 0.6, 1.5)); }
        else if (fighting && along < -0.3) { b.play('walk-backwards', { loop: true, fade: 0.2 }); b.current.setEffectiveTimeScale(THREE.MathUtils.clamp(sp / 1.6, 0.6, 1.5)); }
        else b.move(sp);
      }
      b.update(dt);
      this.applyFlinch(b, dt);
      b.posture = Math.max(0, b.posture - dt * 0.4);
    }
  }
}
