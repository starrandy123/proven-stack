// The new fight: the ronin runs in, the bandits take their slots and circle, a three-strike chain that snaps to its target, a dodge
// to the side, a second chain, a dash attack from a sprint, then 閃 from a held side camera. His health is topped up (the subject is
// the fight, not his death), but the bandits' blows still land on him: both sides move.
const G = window.__GAME, T = G.THREE, c = G.land.spots.camps[0];
const x = c.x + 15, z = c.y + 3; G.player.setPosition(x, G.land.groundY(x, z) + 0.3, z);
G.facing = Math.atan2(-15, -3); G.cam.yaw = Math.atan2(15, 3) - 0.5; G.cam.pitch = 0.3; G.cam.dist = 7.4;
const k = (code, down) => window.__keys(code, down);
const done = {}; const once = (key, at, t, f) => { if (t >= at && !done[key]) { done[key] = 1; f(); } };
window.__film = (t) => {
  G.pc.hp = Math.max(G.pc.hp, 60);
  once('run', 0.0, t, () => { k('KeyW', true); k('ShiftLeft', true); });
  once('stop', 1.25, t, () => { k('ShiftLeft', false); k('KeyW', false); });
  once('a1', 2.4, t, () => { if (!G.pc.strike) G.strike(0); }); once('a2', 2.55, t, () => { G.pc.queued = true; }); once('a3', 2.95, t, () => { G.pc.queued = true; });
  once('dodgeL', 4.2, t, () => { k('KeyA', true); k('KeyK', true); }); once('dodgeLu', 4.3, t, () => { k('KeyK', false); k('KeyA', false); });
  once('b1', 5.0, t, () => { if (!G.pc.strike) G.strike(0); }); once('b2', 5.15, t, () => { G.pc.queued = true; }); once('b3', 5.55, t, () => { G.pc.queued = true; });
  once('sprint', 6.8, t, () => { k('KeyS', true); k('ShiftLeft', true); }); once('turn', 7.5, t, () => { k('KeyS', false); k('KeyW', true); });
  once('dashA', 7.9, t, () => { k('KeyF', true); }); once('dashAu', 8.0, t, () => { k('KeyF', false); k('KeyW', false); k('ShiftLeft', false); });
  once('cut', 9.4, t, () => {                                               // 閃 from the side: a held camera, both ends in frame
    G.pc.ki = 100; const f = G.facing, p = G.ronin.root.position;
    G.cam.hold = true; G.cam.target.set(p.x + Math.sin(f) * 4.5, p.y + 1.3, p.z + Math.cos(f) * 4.5); G.cam.yaw = f + Math.PI / 2; G.cam.pitch = 0.1; G.cam.dist = 8.5;
  });
  once('cut2', 9.7, t, () => G.dashSpecial());
  if (!G.cam.hold) G.cam.yaw += 0.0025;
};
