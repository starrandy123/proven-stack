// THE FIGHT, choreographed from research J §2 (the owner, 8 Nov: "I need the showcase to also show many slashes on one enemy to show the
// various types of damage we can do then when we kill him, leap to the next guy and free flow fighting" · "We don't want the guy to roll,
// just dash to the opponent with the leg bend dude" · "Just dash attack"). The beats, in the order the shipped games show them:
//  1. the DASH ATTACK to the bandit the lock holds (Sword_Dash, the whole body, research J §1);
//  2. many blows on that ONE bandit: a cut he BLOCKS (the clash), a cut that wounds (the stroke swells), the heavy that breaks his worn
//     guard (he reels, dazed: Sekiro's posture, Ghost of Tsushima's heavy), quick cuts into the open man (For Honor's defenceless window),
//     the heavy that KILLS (the stroke pressed crimson and left to linger: Sekiro's red deathblow mark);
//  3. the lock passes to the next bandit by itself (Arkham Knight) and the ronin dashes to him;
//  4. free flow through the rest of the camp: each press reaches the nearest standing bandit he faces (Arkham City).
// Staging, said plainly: the first bandit's health is raised from 2 to 8 so every kind of blow the game has can land on him before he
// falls, his guard is made certain for the one cut he blocks (blockChance 1 for that cut, 0 after), and he never steps back out of a
// stagger (standsGround), so each blow meets him; the camp holds by its fire until
// he falls; the ronin's health is topped up (the subject is the fight, not his death). Everything else is the game: its lock, its dash,
// its reactions, the bandits' own blows. No roll, no jump. Each beat waits for the game's own state, never for a guessed time.
const G = window.__GAME, c = G.land.spots.camps[0];
const x = c.x + 13, z = c.y + 2; G.player.setPosition(x, G.land.groundY(x, z) + 0.3, z);
G.facing = Math.atan2(c.x - x, c.y - z); G.cam.yaw = G.facing + Math.PI - 1.35; G.cam.pitch = 0.2; G.cam.dist = 4.6;   // close, from his side: the camp's fire and smoke to the edge of the frame
const k = (code, down) => window.__keys(code, down);
const camp = G.bandits.list.filter((b) => b.nav === G.navs[0]); for (const b of camp) { b.state = 'hold'; b.agent.resetMoveTarget(); }
const alive = () => camp.filter((b) => !b.dead);
const nearest = () => { let best = null, d0 = 1e9; for (const b of alive()) { const d = b.root.position.distanceTo(G.ronin.root.position); if (d < d0) { d0 = d; best = b; } } return { b: best, d: d0 }; };
const st = () => G.pc.strike;
const landed = (gap = 0) => !st() || st().t > st().impact + gap;              // the current strike has struck (or there is none)
const S = { beat: 'run', at: 0, lead: null, log: [] };
const now = () => (window.__filmT || 0).toFixed(2);
const go = (beat, t) => { S.beat = beat; S.at = t; S.log.push(`${t.toFixed(2)} — ${beat}`); };
window.__filmLog = S.log;                                                      // tools/film.mjs --rehearse prints it
{ const H = G.bandits.hit.bind(G.bandits), who = (b) => (b === S.lead ? 'the first bandit' : 'bandit ' + G.bandits.list.indexOf(b));
  G.bandits.hit = (b, dir, power, o) => { const hp = b.hp, r = H(b, dir, power, o); S.log.push(`${now()}   ${who(b)} takes a power-${power} blow: ${r} (health ${hp} → ${b.hp})`); return r; }; }
window.__film = (t) => {
  G.pc.hp = Math.max(G.pc.hp, 60);
  const s = st();
  switch (S.beat) {
    case 'run':                                                                 // run in until the camp is a dash away
      if (t < 0.05) { k('KeyW', true); k('ShiftLeft', true); }
      if (nearest().d < 7.5 || t >= 1.4) {
        k('ShiftLeft', false); k('KeyW', false);
        S.lead = G.lock.target && camp.includes(G.lock.target) ? G.lock.target : nearest().b; S.lead.hp = 8; S.lead.standsGround = true;
        G.strike(0); go('dash', t);
      } break;
    case 'dash':                                                                // the dash's blow, then he stands his guard again
      if (landed(0.1) && t - S.at > 0.9 && (S.lead.state === 'engage' || S.lead.state === 'idle' || t - S.at > 2.6)) {
        G.bandits.blockChance = 1; S.lead.cool = Math.max(S.lead.cool, 1.2); G.pc.strike = null; G.strike(0); go('block', t);   // his guard up, no blow of his own just then
      } break;
    case 'block':                                                               // he blocks: the clash. Then a cut that wounds
      if (s && s.i === 0 && s.t > s.impact + 0.02) { G.bandits.blockChance = 0; G.pc.queued = true; go('wound', t); } break;
    case 'wound':
      if (s && s.i === 1 && s.t > s.impact + 0.02) { G.pc.queued = true; go('break', t); } break;
    case 'break':                                                               // the heavy that breaks his worn guard; he reels
      if (s && s.i === 2 && s.t > s.impact + 0.35) { G.pc.strike = null; G.strike(0); go('open', t); } break;
    case 'open':                                                                // quick cuts into the open man, then the heavy that kills
      if (S.lead.dead) { go('fallen', t); break; }
      if (s && s.i < 2 && s.t > s.impact + 0.02) G.pc.queued = true;
      if ((!s || (s.i === 2 && s.t > s.impact + 0.3)) && !S.lead.dead) G.strike(0);
      break;
    case 'fallen':                                                              // the camp moves; the lock has passed on by itself
      if (t - S.at > 0.45) { for (const b of alive()) G.bandits.setState(b, 'engage'); G.strike(0); go('flow', t); } break;
    case 'flow':                                                                // free flow: each strike to the nearest standing bandit he faces
      if (!alive().length) { go('done', t); break; }
      if (s && s.t > s.impact + 0.02) G.pc.queued = true;
      if (landed(0.28) && (!s || s.i === 2 || !G.pc.queued)) { G.pc.strike = null; G.strike(0); }
      break;
  }
  if (!G.cam.hold) steer(t);
};
// THE CAMERA KEEPS THE SMOKE OUT OF ITS SIGHT LINE (the old 閃 shot's banner-pole search, for smoke): every quarter second, of 16 places
// round the ronin at the follow distance, the one whose line to him passes farthest from every smoke puff (world-space particles, a
// puff's half-width taken off) and every banner pole, the nearer to where the camera already is the better; the camera turns toward it
// at most 0.9 rad a second. 8 Nov, the test film: in free flow at the fire the camera looked through the column and the fight vanished.
const poles = []; for (const cp of G.env.camps) for (const fl of cp.group.userData.flags) { const w = new G.THREE.Vector3(); fl.getWorldPosition(w); poles.push(w); }
let aim = null, lastPick = -1;
function steer(t) {
  const T = G.THREE, me = G.ronin.root.position, eye = new T.Vector3(me.x, me.y + 1.2, me.z);
  if (aim === null) aim = G.cam.yaw;
  if (t - lastPick >= 0.25) {
    lastPick = t;
    const puffs = []; for (const sm of G.vfx.smokes) for (const q of sm.particles || []) if (q.position) puffs.push(q.position);
    const seg = (a, b, p) => { const ab = b.clone().sub(a), u = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-6))); return a.clone().addScaledVector(ab, u).distanceTo(p); };
    let best = null;
    for (let k = 0; k < 16; k++) {
      const yaw = G.cam.yaw + (k - 8) * (Math.PI / 8), cp = Math.cos(G.cam.pitch);
      const cam = new T.Vector3(me.x + Math.sin(yaw) * cp * G.cam.dist, me.y + 1.5 + Math.sin(G.cam.pitch) * G.cam.dist, me.z + Math.cos(yaw) * cp * G.cam.dist);
      let clear = 9; for (const q of puffs) clear = Math.min(clear, seg(cam, eye, q) - 1.4);
      for (const w of poles) clear = Math.min(clear, Math.hypot(...(() => { const d = seg(new T.Vector3(cam.x, 0, cam.z), new T.Vector3(eye.x, 0, eye.z), new T.Vector3(w.x, 0, w.z)); return [d - 0.25, 0]; })()));
      const score = Math.min(clear, 3) - 0.35 * Math.abs(Math.atan2(Math.sin(yaw - G.cam.yaw), Math.cos(yaw - G.cam.yaw)));
      if (!best || score > best.score) best = { yaw, score };
    }
    aim = best.yaw;
  }
  const d = Math.atan2(Math.sin(aim - G.cam.yaw), Math.cos(aim - G.cam.yaw));
  G.cam.yaw += Math.max(-0.03, Math.min(0.03, d));
}
