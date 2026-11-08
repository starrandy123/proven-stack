// The new fight: the ronin runs in, leaps to the bandit he has locked, a three-strike chain on him (then the next), a dodge
// to the side, then 閃 from a held side camera through the camp's last two. His health is topped up (the subject is
// the fight, not his death), but the bandits' blows still land on him: both sides move.
const G = window.__GAME, T = G.THREE, c = G.land.spots.camps[0];
const x = c.x + 15, z = c.y + 3; G.player.setPosition(x, G.land.groundY(x, z) + 0.3, z);
G.facing = Math.atan2(-15, -3); G.cam.yaw = Math.atan2(15, 3) - 0.5; G.cam.pitch = 0.24; G.cam.dist = 6.2;
const k = (code, down) => window.__keys(code, down);
const camp = G.bandits.list.filter((b) => b.nav === G.navs[0]); for (const b of camp) { b.state = 'hold'; b.agent.resetMoveTarget(); }   // the camp holds by its fire
const nearestD = () => { let d0 = 1e9; for (const b of G.bandits.alive()) d0 = Math.min(d0, b.root.position.distanceTo(G.ronin.root.position)); return d0; };
const done = {}; const once = (key, at, t, f) => { if (t >= at && !done[key]) { done[key] = 1; f(); } };
window.__film = (t) => {
  G.pc.hp = Math.max(G.pc.hp, 60);
  once('run', 0.0, t, () => { k('KeyW', true); k('ShiftLeft', true); });
  // the first chain opens while the camp still stands round its fire: the lock takes the nearest bandit 6-8 m off and the ronin LEAPS
  // to him (tobikomi); the others are let go as he lands
  if (!done.a1 && (t >= 1.6 || nearestD() < 8)) { done.a1 = t || 1e-3; k('ShiftLeft', false); k('KeyW', false); if (!G.pc.strike) G.strike(0); }
  if (done.a1) {
    once('free', done.a1 + 0.7, t, () => { for (const b of camp) if (!b.dead && b.state === 'hold') G.bandits.setState(b, 'engage'); });
    once('a2', done.a1 + 0.25, t, () => { G.pc.queued = true; }); once('a3', done.a1 + 1.1, t, () => { G.pc.queued = true; });
  }
  once('dodgeL', 4.2, t, () => { k('KeyA', true); k('KeyK', true); }); once('dodgeLu', 4.3, t, () => { k('KeyK', false); k('KeyA', false); });
  // the camp's last two in the blade's line for 閃 (placed on their own navmesh, as wall W6 places them), the ronin facing along it
  once('line', 8.8, t, () => {
    const left = camp.filter((b) => !b.dead).slice(0, 2), p = G.ronin.root.position, f = G.facing;
    left.forEach((b, i) => { const d = 3 + i * 3, x = p.x + Math.sin(f) * d + (i ? 0.4 : 0), z = p.z + Math.cos(f) * d; const { point } = b.nav.query.findClosestPoint({ x, y: G.land.groundY(x, z), z }); b.agent.teleport(point); b.state = 'hold'; b.agent.resetMoveTarget(); });
  });
  once('cut', 9.4, t, () => {                                               // 閃 from the side: a held camera, both ends in frame
    G.pc.ki = 100; const f = G.facing, p = G.ronin.root.position;
    G.cam.hold = true; G.cam.target.set(p.x + Math.sin(f) * 4.5, p.y + 1.3, p.z + Math.cos(f) * 4.5); G.cam.pitch = 0.1;
    // the side, and the distance, whose line of sight passes farthest from every banner pole (no pole in front of the lens)
    const poles = []; for (const cp of G.env.camps) for (const fl of cp.group.userData.flags) { const w = new T.Vector3(); fl.getWorldPosition(w); poles.push(w); }
    let best = null;
    for (const yaw of [f - Math.PI / 2, f + Math.PI / 2]) for (const dist of [8.5, 7, 10]) {
      const cx = G.cam.target.x + Math.sin(yaw) * dist, cz = G.cam.target.z + Math.cos(yaw) * dist; let clear = 1e9;
      const sights = [G.cam.target, p, new T.Vector3(p.x + Math.sin(f) * 9, 0, p.z + Math.cos(f) * 9)];   // the cut's middle, start and end
      for (const w of poles) for (const q of sights) { const ax = q.x - cx, az = q.z - cz, L2 = ax * ax + az * az, u = Math.max(0, Math.min(1, ((w.x - cx) * ax + (w.z - cz) * az) / L2)); clear = Math.min(clear, Math.hypot(cx + ax * u - w.x, cz + az * u - w.z)); }
      if (!best || clear > best.clear + 0.5) best = { yaw, dist, clear };
    }
    G.cam.yaw = best.yaw; G.cam.dist = best.dist;
  });
  once('cut2', 9.7, t, () => G.dashSpecial());
  if (!G.cam.hold) G.cam.yaw += 0.0025;
};
