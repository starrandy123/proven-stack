// 閃 THROUGH A WHOLE LINE (the script's line 9: "a dash that cuts through a whole line of them"): three bandits of a camp standing in the
// blade's line, the ronin's dash through all three, and they fall a beat after the blade passes (wall W6 holds it with two). A held camera
// from the side, both ends of the cut in frame, its sight lines clear of every banner pole and the fire's smoke. Staging, said plainly:
// the three are placed in the line on their own navmesh and hold there (as W6 places its two); the rest is the game.
const G = window.__GAME, T = G.THREE, c = G.land.spots.camps[1];
const p0 = { x: c.x + 11, z: c.y - 7 }; G.player.setPosition(p0.x, G.land.groundY(p0.x, p0.z) + 0.3, p0.z);
const f = Math.atan2(-1, 0.25); G.facing = f; G.pc.invuln = 99;
const camp = G.bandits.list.filter((b) => b.nav === G.navs[1]);
const put = (b, x, z) => { const { point } = b.nav.query.findClosestPoint({ x, y: G.land.groundY(x, z), z }); b.agent.teleport(point); b.state = 'hold'; b.agent.resetMoveTarget(); };
const log = []; window.__filmLog = log;
{ const H = G.bandits.hit.bind(G.bandits); G.bandits.hit = (b, d, p, o) => { const r = H(b, d, p, o); log.push(`${(window.__filmT || 0).toFixed(2)} bandit ${G.bandits.list.indexOf(b)}: ${r}`); return r; }; }
let placed = false, cut = false, framed = false;
window.__film = (t) => {
  const p = G.ronin.root.position;
  if (!placed) {                                                         // three in the line, 2.6, 5 and 7.4 m ahead, a little off it either way
    placed = true; G.facing = f;
    camp.slice(0, 3).forEach((b, i) => { const d = 2.6 + i * 2.4, s = [0.35, -0.3, 0.25][i]; put(b, p.x + Math.sin(f) * d + Math.cos(f) * s, p.z + Math.cos(f) * d - Math.sin(f) * s); b.facing = f + Math.PI; });
    camp.slice(3).forEach((b) => put(b, c.x - 12, c.y + 12));
  }
  if (!framed) {                                                         // the side and distance whose sight lines clear every pole and puff
    framed = true; G.facing = f;
    G.cam.hold = true; G.cam.target.set(p.x + Math.sin(f) * 4.6, p.y + 1.2, p.z + Math.cos(f) * 4.6); G.cam.pitch = 0.1;
    const poles = []; for (const cp of G.env.camps) for (const fl of cp.group.userData.flags) { const w = new T.Vector3(); fl.getWorldPosition(w); poles.push(w); }
    const puffs = []; for (const sm of G.vfx.smokes) for (const q of sm.particles || []) if (q.position) puffs.push(q.position);
    let best = null;
    for (const yaw of [f - Math.PI / 2, f + Math.PI / 2, f - Math.PI / 2 + 0.35, f + Math.PI / 2 - 0.35]) for (const dist of [8, 9.5, 7]) {
      const cx = G.cam.target.x + Math.sin(yaw) * dist, cz = G.cam.target.z + Math.cos(yaw) * dist; let clear = 1e9;
      const sights = [G.cam.target, p, new T.Vector3(p.x + Math.sin(f) * 9.2, 0, p.z + Math.cos(f) * 9.2)];
      for (const w of [...poles, ...puffs]) for (const q of sights) { const ax = q.x - cx, az = q.z - cz, L2 = ax * ax + az * az, u = Math.max(0, Math.min(1, ((w.x - cx) * ax + (w.z - cz) * az) / L2)); clear = Math.min(clear, Math.hypot(cx + ax * u - w.x, cz + az * u - w.z)); }
      if (!best || clear > best.clear + 0.5) best = { yaw, dist, clear };
    }
    G.cam.yaw = best.yaw; G.cam.dist = best.dist; log.push(`camera clear of poles and smoke by ${best.clear.toFixed(2)} m`);
  }
  if (!cut && t >= 0.7) { cut = true; G.facing = f; G.pc.ki = 100; G.dashSpecial(); log.push(`${t.toFixed(2)} 閃`); }
};
