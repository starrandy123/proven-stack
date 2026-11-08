// The bandits: each one a Detour crowd agent on its camp's navmesh (Recast & Detour), animated by the same clips as the ronin,
// and a Jolt ragdoll when it falls. Behaviour is a small state machine: idle at camp → chase → attack (a wind-up the player can
// read, then the blow) → recover; a hit staggers; far from camp they walk home.
import * as THREE from 'three';
import { Person } from './characters.js';
import { Ragdoll } from './ragdoll.js';

const TINTS = ['#ffffff', '#e8d2b0', '#c9b8a6', '#d6c3a0'].map((c) => new THREE.Color(c));

export class Bandits {
  constructor(scene, kit, navs, P, rest, land, { perCamp = 4 } = {}) {
    this.scene = scene; this.P = P; this.rest = rest; this.land = land; this.list = []; this.ragdolls = [];
    this.navs = navs; let k = 0;
    for (const nav of navs) {
      for (let i = 0; i < perCamp; i++) {
        const b = new Person(kit, 'bandit', { tint: TINTS[(k++) % TINTS.length] }); b.armed = true;
        const a = (i / perCamp) * Math.PI * 2 + Math.random() * 0.5, r = 4 + Math.random() * 4;
        const want = new THREE.Vector3(nav.center.x + Math.cos(a) * r, 0, nav.center.y + Math.sin(a) * r);
        want.y = land.groundY(want.x, want.z);
        const { point } = nav.query.findClosestPoint(want);
        const agent = nav.crowd.addAgent(point, { radius: 0.42, height: 1.8, maxAcceleration: 14, maxSpeed: 4.3, collisionQueryRange: 2.5, pathOptimizationRange: 12, separationWeight: 2.2 });
        b.agent = agent; b.nav = nav; b.home = new THREE.Vector3(point.x, point.y, point.z);
        b.state = 'idle'; b.hp = 3; b.cool = 0; b.facing = Math.random() * Math.PI * 2; b.repath = 0;
        b.root.position.copy(b.home); scene.add(b.root);
        this.list.push(b);
      }
    }
  }
  alive() { return this.list.filter((b) => !b.dead); }

  // a sword blow from the player: dir is where it pushes, power 1 (a strike) or 2 (the heavy finish)
  hit(b, dir, power, sfx) {
    if (b.dead) return;
    b.hp -= power;
    if (b.hp <= 0) return this.kill(b, dir, power);
    b.state = 'stagger'; b.agent.resetMoveTarget();
    b.root.position.addScaledVector(dir, 0.25 * power);
    b.play(power > 1 ? 'Hit_Knockback' : 'Hit_Chest', { loop: false, fade: 0.06, onEnd: () => { if (!b.dead) b.state = 'chase'; } });
  }
  kill(b, dir, power) {
    b.nav.crowd.removeAgent(b.agent); b.agent = null;
    b.root.updateMatrixWorld(true);
    const imp = dir.clone().multiplyScalar(55 * power); imp.y = 22 + 10 * power;      // a cut's shove: ~4-6 m/s on a 17 kg torso, not a cannon
    const rag = new Ragdoll(this.P, b, this.rest, { velocity: dir.clone().multiplyScalar(1.6 * power), impulse: imp, at: 'torso', group: 10 + this.ragdolls.length });
    this.ragdolls.push(rag); b.ragdoll = rag; b.sword.visible = true;
    this.onKill && this.onKill(b);
  }

  update(dt, player, playerPos, playerAlive) {
    for (const nav of this.navs) nav.crowd.update(1 / 60, Math.min(dt, 0.1));        // the example's fixed stepping, interpolated
    for (const r of this.ragdolls) r.apply(dt);
    for (const b of this.list) {
      if (b.dead) continue;
      const p = b.agent.interpolatedPosition; b.root.position.set(p.x, p.y, p.z);
      const toP = new THREE.Vector3().subVectors(playerPos, b.root.position); toP.y = 0;
      const d = toP.length(), home = b.root.position.distanceTo(b.home);
      b.cool -= dt; b.repath -= dt;
      if (b.state === 'idle' && playerAlive && d < 24) { for (const o of this.list) if (o.nav === b.nav && o.state === 'idle') o.state = 'chase'; this.onAlert && this.onAlert(b); }
      if (!playerAlive && b.state !== 'idle') b.state = 'return';
      if (b.state === 'chase') {
        if (home > 55 || d > 40) b.state = 'return';
        else if (d < 1.9 && b.cool <= 0) {
          b.state = 'attack'; b.agent.resetMoveTarget(); b.cool = 1.1 + Math.random() * 0.9;
          const clip = Math.random() < 0.5 ? 'Sword_Regular_A' : 'Sword_Regular_B';
          const act = b.play(clip, { loop: false, fade: 0.1, speed: 0.85, onEnd: () => { if (!b.dead && b.state === 'attack') b.state = 'chase'; } });
          b.blow = { at: act.getClip().duration * 0.5 / 0.85, t: 0, done: false };
        } else if (b.repath <= 0) {
          b.repath = 0.25;
          const ring = toP.clone().normalize().multiplyScalar(-1.4);                     // stop just short of the player
          const { point } = b.nav.query.findClosestPoint({ x: playerPos.x + ring.x, y: playerPos.y, z: playerPos.z + ring.z });
          b.agent.requestMoveTarget(point);
        }
      }
      if (b.state === 'return' && b.repath <= 0) { b.repath = 1; b.agent.requestMoveTarget(b.home); if (home < 1.5) b.state = 'idle'; }
      if (b.state === 'attack' && b.blow && !b.blow.done) {
        b.blow.t += dt;
        if (b.blow.t >= b.blow.at) { b.blow.done = true; if (d < 2.4 && this.onBlow) this.onBlow(b, toP.clone().normalize()); }
      }
      // face where it walks, or the player when it fights
      const v = b.agent.velocity(), sp = Math.hypot(v.x, v.z);
      const target = (b.state === 'attack' || b.state === 'stagger' || (b.state === 'chase' && d < 4)) ? Math.atan2(toP.x, toP.z) : sp > 0.3 ? Math.atan2(v.x, v.z) : b.facing;
      let dd = target - b.facing; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); b.facing += dd * Math.min(1, dt * 9);
      b.root.rotation.y = b.facing;
      if (b.state !== 'attack' && b.state !== 'stagger') b.move(sp);
      b.update(dt);
    }
    for (const b of this.list) if (b.dead) b.update(0);
  }
}
