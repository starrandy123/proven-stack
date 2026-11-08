// A camp: the bandits come, the three-strike combo, then 閃 — the dash cuts a line and they fall a beat later.
const G = window.__GAME, T = G.THREE, c = G.land.spots.camps[0];
const x = c.x + 13, z = c.y + 2; G.player.setPosition(x, G.land.groundY(x, z) + 0.3, z);
G.facing = Math.atan2(-13, -2); G.cam.yaw = Math.atan2(13, 2) - 0.6; G.cam.pitch = 0.14; G.cam.dist = 4.8;
const nearest = () => { let b0 = null, d0 = 1e9; for (const b of G.bandits.alive()) { const d = b.root.position.distanceTo(G.ronin.root.position); if (d < d0) { d0 = d; b0 = b; } } return [b0, d0]; };
const face = () => { const [b] = nearest(); if (b) { const v = b.root.position.clone().sub(G.ronin.root.position); G.facing = Math.atan2(v.x, v.z); } };
let done = {};
window.__film = (t) => {
  const once = (k, at, f) => { if (t >= at && !done[k]) { done[k] = 1; f(); } };
  once('a', 1.6, () => { face(); G.strike(0); }); once('b', 2.15, () => { face(); G.pc.queued = true; });
  once('c', 2.7, () => { face(); G.pc.queued = true; });
  once('d', 4.4, () => { face(); if (!G.pc.strike) G.strike(0); }); once('e', 4.95, () => { face(); G.pc.queued = true; });
  once('k', 6.0, () => {                                                    // the cut, from the side: a held camera, both ends in frame
    G.pc.ki = 100; face();
    const f = G.facing, p = G.ronin.root.position;
    G.cam.hold = true; G.cam.target.set(p.x + Math.sin(f) * 4.5, p.y + 1.3, p.z + Math.cos(f) * 4.5);
    G.cam.yaw = f + Math.PI / 2; G.cam.pitch = 0.1; G.cam.dist = 8.5;
  });
  once('k2', 6.35, () => G.dashSpecial());
  if (!G.cam.hold) G.cam.yaw += 0.0015; G.pc.invuln = 1; G.pc.hp = 100;                     // filming: the ronin is not the subject's victim
};
