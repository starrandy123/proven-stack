// THE INK CUT, SIDE BY SIDE WITH THE PIXEL ACT (the reel's samurai slot, 9 Nov: his words, "Let's show the pixel effect side by side with
// it so the users see the effects being added"). The other half is pixelfx's ink cut: its fighter stands left facing right, one cut rises
// across the straw target, a blot bursts behind it, the stroke shows ink outside and crimson inside, the drops stain the floor right of it,
// and the blade is flicked clean. So here, the ronin on the LEFT facing right and the combo as a player plays it: the first cut wounds
// (its splash flung up, along its rise), the second kills, flinging its splash and its drops to the RIGHT, the way the pixel act's go;
// the crimson flood on its stroke, the drops landing right of the bandit, then the chiburi. The reel sets the KILL's splash on the pixel
// blot's frame (window.__filmSplash). Rehearsed first with one cut that killed: the combo's first cut flings up and back toward the
// ronin, so its drops landed around him, not right of the bandit; the game opens every combo with that cut, so the kill is its second.
// Filmed at 960×1080 (an 8:9 half of the reel's band) with ?rate=0.5: the game's own clock at half speed.
// Staging, said plainly: the bandit stands 2.2 m in front, facing the ronin, holding (no blow, no block), with health 2 so the second cut kills;
// the rest of the camp is sent off out of the lock's reach; the camera is held on the side that puts the ronin on the left (read off the
// projection, not assumed), at the place on that side whose sight lines clear the banner poles and the smoke; it pushes in slowly from
// the first frame (5.2 → 4.6 m) so the half moves before the cut, and it follows the ronin's lunge, looking 1.4 m ahead of him (the first
// scratch take, held still at 3.7 m, lost the kill's splash and the falling bandit off its right edge). Everything else is the game: its lock, its lunge, its effects. Each beat
// waits for the game's own state, never a guessed time.
const G = window.__GAME, T = G.THREE, c = G.land.spots.camps[0], camp = G.bandits.list.filter((b) => b.nav === G.navs[0]);
G.bandits.blockChance = 0; G.bandits.feintChance = 0; G.pc.invuln = 99;
const x0 = c.x + 10, z0 = c.y; G.player.setPosition(x0, G.land.groundY(x0, z0) + 0.3, z0);
const put = (b, x, z) => { const { point } = b.nav.query.findClosestPoint({ x, y: G.land.groundY(x, z), z }); b.agent.teleport(point); b.state = 'hold'; b.agent.resetMoveTarget(); };
camp.forEach((b) => put(b, c.x - 9, c.y + 9));
const f = Math.atan2(-1, 0);
{ const b = camp[0]; put(b, x0 - 2.2, z0); b.hp = 2; b.facing = Math.PI / 2; b.cool = 99; b.standsGround = true; G.facing = f; }
const S = { beat: 'stand', at: 0, log: [], lead: camp[0] }; window.__filmLog = S.log;
const go = (beat, t) => { S.beat = beat; S.at = t; S.log.push(`${t.toFixed(2)} — ${beat}`); };
{ const H = G.bandits.hit.bind(G.bandits); G.bandits.hit = (b, d, p, o) => { const hp = b.hp, r = H(b, d, p, o); S.log.push(`${(window.__filmT || 0).toFixed(2)}   the bandit takes a power-${p} blow: ${r} (health ${hp} → ${b.hp})`); return r; }; }
// each splash's first frame on film; the kill's is the reel's alignment (its frame sits on the pixel blot's)
const splashes = []; let wasShown = false;
const D0 = 5.2, D1 = 4.6, PUSH = 1.4, AHEAD = 1.4;          // m: the push-in, and how far ahead of the ronin (toward the bandit) the camera looks
let framed = false, mid = null;
function frame() {
  const p = G.ronin.root.position, bp = new T.Vector3(p.x - 2.2, p.y, p.z);
  mid = new T.Vector3(p.x - AHEAD, p.y + 0.95, p.z);
  const poles = []; for (const cp of G.env.camps) for (const fl of cp.group.userData.flags) poles.push(fl.getWorldPosition(new T.Vector3()));
  const puffs = []; for (const sm of G.vfx.smokes) for (const q of sm.particles || []) if (q.position) puffs.push(q.position);
  // which side puts the ronin on the LEFT of the picture: project both men from each side's camera
  const sideOk = (yaw) => { const cam = new T.PerspectiveCamera(G.camera.fov, 960 / 1080, 0.1, 100);
    cam.position.set(mid.x + Math.sin(yaw) * D1, mid.y + 1, mid.z + Math.cos(yaw) * D1); cam.lookAt(mid); cam.updateMatrixWorld(true);
    return p.clone().project(cam).x < bp.clone().project(cam).x; };
  let best = null;
  for (const side of [1, -1]) {
    if (!sideOk(f + side * Math.PI / 2)) continue;
    for (const k of [0, 0.2, -0.2, 0.35, -0.35]) {
      const yaw = f + side * Math.PI / 2 + k, cam = new T.Vector3(mid.x + Math.sin(yaw) * D0, 0, mid.z + Math.cos(yaw) * D0);
      let clear = 9; for (const w of [...poles, ...puffs]) for (const q of [p, bp]) {
        const ax = q.x - cam.x, az = q.z - cam.z, L2 = ax * ax + az * az, u = Math.max(0, Math.min(1, ((w.x - cam.x) * ax + (w.z - cam.z) * az) / L2));
        clear = Math.min(clear, Math.hypot(cam.x + ax * u - w.x, cam.z + az * u - w.z)); }
      if (!best || clear > best.clear + 0.3) best = { yaw, clear, side };
    }
  }
  G.cam.hold = true; G.cam.target.copy(mid); G.cam.yaw = best.yaw; G.cam.pitch = 0.22; G.cam.dist = D0;
  S.log.push(`camera yaw ${best.yaw.toFixed(2)} (side ${best.side}: the ronin on the left), its sight lines ${best.clear.toFixed(1)} m clear of poles and smoke`);
}
window.__film = (t) => {
  const st = G.pc.strike, b = S.lead;
  if (framed) { const k = Math.min(1, t / PUSH), e = k * k * (3 - 2 * k); G.cam.dist = D0 + (D1 - D0) * e;     // the push-in, eased
    const p = G.ronin.root.position; G.cam.target.lerp(new T.Vector3(p.x - AHEAD, p.y + 0.95, p.z), 0.15); }   // and it follows his lunge (8:9 is narrow)
  const shown = G.vfx.blot.visible;
  if (shown && !wasShown) { splashes.push(t); const kill = b.dead; S.log.push(`${t.toFixed(3)}   a splash's first frame on film (${kill ? 'THE KILL: the reel aligns on it' : 'the wound'})`); if (kill) window.__filmSplash = t; }
  wasShown = shown;
  switch (S.beat) {
    case 'stand':                                                              // framed before the first frame is taken
      if (!framed) { framed = true; G.facing = f; frame(); }
      if (t > 0.3) { G.facing = f; G.pc.strike = null; G.strike(0); go('first cut', t); } break;
    case 'first cut':                                                          // the chain: the next press made after the cut has landed
      if (st && st.i === 0 && st.t > st.impact + 0.02) { G.pc.queued = true; go('second cut', t); } break;
    case 'second cut':                                                         // the second cut kills
      if (b.dead) go('fallen; he stands (zanshin)', t); break;
    case 'fallen; he stands (zanshin)':
      if (G.pc.chiburi) go('the chiburi', t); break;
    case 'the chiburi':
      if (!G.pc.chiburi) go('done', t); break;
  }
};
