// THE INK CUT'S BEATS, PAINTED (the reel's line 8: "so every cut that lands bursts into ink, the drops stain the ground, and he flicks
// the blood off his blade"). One bandit of camp 0 and the combo as the game plays it: the first cut wounds (the blot, the bare-paper
// stroke, the drops), the second kills (the blot, the crimson flood, more drops); then the ronin stands, and after his zanshin the
// chiburi flicks four crimson drops off the blade in a line. Filmed with ?rate=0.5: the game's own clock at half speed, never the video's.
// Staging, said plainly: the bandit stands 2.2 m in front, facing the ronin, holding (no blow of his own, no block), with health 2 so the
// second cut kills, and he never steps back out of a stagger (standsGround, as the showcase fight2.js). Rehearsed with a third cut, the
// heavy: two cuts staggered him to his engage distance (1.31 → 2.30 m) during its slow wind-up and it missed, so it was left out; the rest of the camp is sent off out of the lock's reach; the camera is held, side-on, at the place whose sight lines
// clear every banner pole and smoke puff. Everything else is the game: its lock, its lunge, its chain, its effects. Each beat waits for
// the game's own state, never a guessed time.
const G = window.__GAME, T = G.THREE, c = G.land.spots.camps[0], camp = G.bandits.list.filter((b) => b.nav === G.navs[0]);
G.bandits.blockChance = 0; G.bandits.feintChance = 0; G.pc.invuln = 99;
const x0 = c.x + 10, z0 = c.y; G.player.setPosition(x0, G.land.groundY(x0, z0) + 0.3, z0);
const put = (b, x, z) => { const { point } = b.nav.query.findClosestPoint({ x, y: G.land.groundY(x, z), z }); b.agent.teleport(point); b.state = 'hold'; b.agent.resetMoveTarget(); };
camp.forEach((b) => put(b, c.x - 9, c.y + 9));
const f = Math.atan2(-1, 0);
// the bandit is in place before the first frame (filmed from frame 2 he popped in), 2.2 m in front of the ronin, facing him
{ const b = camp[0]; put(b, x0 - 2.2, z0); b.hp = 2; b.facing = Math.PI / 2; b.cool = 99; b.standsGround = true; G.facing = f; }
const S = { beat: 'stand', at: 0, log: [], lead: camp[0] }; window.__filmLog = S.log;
const go = (beat, t) => { S.beat = beat; S.at = t; S.log.push(`${t.toFixed(2)} — ${beat}`); };
{ const H = G.bandits.hit.bind(G.bandits); G.bandits.hit = (b, d, p, o) => { const hp = b.hp, r = H(b, d, p, o); S.log.push(`${(window.__filmT || 0).toFixed(2)}   the bandit takes a power-${p} blow: ${r} (health ${hp} → ${b.hp})`); return r; }; }
// the camera: of a fan of places side-on to the line of the fight, the one whose sight lines to both men clear the poles and the smoke most
let framed = false;
function frame() {
  const p = G.ronin.root.position, mid = new T.Vector3(p.x - 1.1, p.y + 0.95, p.z);
  const poles = []; for (const cp of G.env.camps) for (const fl of cp.group.userData.flags) poles.push(fl.getWorldPosition(new T.Vector3()));
  const puffs = []; for (const sm of G.vfx.smokes) for (const q of sm.particles || []) if (q.position) puffs.push(q.position);
  let best = null;
  for (const side of [1, -1]) for (const k of [0, 0.25, -0.25, 0.45, -0.45]) {
    const yaw = f + side * Math.PI / 2 + k, cam = new T.Vector3(mid.x + Math.sin(yaw) * 3.9, 0, mid.z + Math.cos(yaw) * 3.9);
    let clear = 9; for (const w of [...poles, ...puffs]) for (const q of [p, new T.Vector3(p.x - 2.2, 0, p.z)]) {
      const ax = q.x - cam.x, az = q.z - cam.z, L2 = ax * ax + az * az, u = Math.max(0, Math.min(1, ((w.x - cam.x) * ax + (w.z - cam.z) * az) / L2));
      clear = Math.min(clear, Math.hypot(cam.x + ax * u - w.x, cam.z + az * u - w.z)); }
    if (!best || clear > best.clear + 0.3) best = { yaw, clear };
  }
  G.cam.hold = true; G.cam.target.copy(mid); G.cam.yaw = best.yaw; G.cam.pitch = 0.3; G.cam.dist = 3.9;
  S.log.push(`camera yaw ${best.yaw.toFixed(2)}, its sight lines ${best.clear.toFixed(1)} m clear of poles and smoke`);
}
window.__film = (t) => {
  const st = G.pc.strike, b = S.lead;
  switch (S.beat) {
    case 'stand':                                                              // framed before the first frame is taken
      if (!framed) { framed = true; G.facing = f; frame(); }
      if (t > 0.6) { G.facing = f; G.pc.strike = null; G.strike(0); go('first cut', t); } break;
    case 'first cut':                                                          // the chain: each next press made after the cut has landed
      if (st && st.i === 0 && st.t > st.impact + 0.02) { G.pc.queued = true; go('second cut', t); } break;
    case 'second cut':                                                         // the second cut kills
      if (b.dead) go('fallen; he stands (zanshin)', t); break;
    case 'fallen; he stands (zanshin)':
      if (G.pc.chiburi) go('the chiburi', t); break;
    case 'the chiburi':
      if (!G.pc.chiburi) go('done', t); break;
  }
};
