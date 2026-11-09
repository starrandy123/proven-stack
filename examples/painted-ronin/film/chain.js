// 筆 THE CHAIN, the take for his reel (9 Nov, on take 6: "where's the clip of me doing it in slow mo to multiple enemies?"; before it: "I want
// to do it to enemies and dash to them too like the fear takedown in Arkham knight"). One continuous shot on the held clock, 16:9: the ronin
// walks toward three bandits of a camp; the brush opens and the valley holds; he draws a stroke across each of them (the crimson line laid
// as the hand lays it, his mark left on each, an ink pot each); the ink spent, the brush closes and the chain runs in slow motion — the dash
// attack to each in the order marked, the cut his mark names, his fall, a held beat — then time returns and the blade is flicked clean.
// Staging, said plainly: camp 0's bandits are placed and told to hold (as the walls stage them: W6, Cchain), so the take shows the mechanic,
// not a brawl; his walk is the game's own (the W key, the follow camera); each stroke is a real drag through the game's own mouse handlers
// (the cursor set where a player's would be, the button down, moved, up), so the marks are the game's own; the chain is the game's alone.
const G = window.__GAME, T = G.THREE, B = G.brush, K = window.__keys, cv = G.renderer.domElement;
// a desktop player's pointer is locked by their first click (input.js takes a stroke only then); the held clock's page cannot take the
// lock, so the shot says it is held, and everything after is the game's own mouse handling
Object.defineProperty(document, 'pointerLockElement', { get: () => cv, configurable: true });
const S = { beat: 'walk', at: 0, log: [], k: 0, drag: null, wait: 0, began: false }; window.__filmLog = S.log;
const go = (beat, t) => { S.beat = beat; S.at = t; S.log.push(`${t.toFixed(2)} — ${beat}`); };
const c = G.land.spots.camps[0], camp = G.bandits.list.filter((b) => b.nav === G.navs[0] && !b.dead);
for (const b of G.bandits.list) if (!b.dead) b.state = 'hold';
const place = (b, x, z) => { const { point } = b.nav.query.findClosestPoint({ x, y: G.land.groundY(x, z), z }); b.agent.teleport(point); b.state = 'hold'; b.agent.resetMoveTarget(); };
const three = camp.slice(0, 3); place(three[0], c.x + 4, c.y - 2.6); place(three[1], c.x + 3, c.y + 0.4); place(three[2], c.x + 4.4, c.y + 3);
for (const b of camp.slice(3)) place(b, c.x - 9, c.y + 9);
const x0 = c.x + 15, z0 = c.y + 0.2; G.player.setPosition(x0, G.land.groundY(x0, z0) + 0.3, z0); G.facing = -Math.PI / 2;
G.cam.yaw = Math.PI / 2; G.cam.pitch = 0.22; G.cam.dist = 5.2;
const stop = new T.Vector3(c.x + 10.2, 0, c.y + 0.2);
const keys = (w, s2, a, d) => { K('KeyW', w); K('KeyS', s2); K('KeyA', a); K('KeyD', d); };
function steer(goal, near) {
  const me = G.ronin.root.position, to = new T.Vector3(goal.x - me.x, 0, goal.z - me.z), d = to.length(), u = to.clone().normalize();
  const f = new T.Vector3(-Math.sin(G.cam.yaw), 0, -Math.cos(G.cam.yaw)), r = new T.Vector3(-f.z, 0, f.x), fw = u.dot(f), rt = u.dot(r), on = d > near;
  keys(on && fw > 0.38, on && fw < -0.38, on && rt < -0.38, on && rt > 0.38);
  return on ? d : 0;
}
// a stroke across a bandit's chest, as a hand draws it: the cursor where it starts, the button down, six moves along the stroke, up
function strokeStart(b) {
  const ch = b.root.position.clone(); ch.y += 1.25; const q = ch.project(G.camera), x = (q.x + 1) / 2 * innerWidth, y = (1 - q.y) / 2 * innerHeight;
  G.input.setCursor(x - 75, y + 38); cv.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
  S.drag = { n: 0 }; S.log.push(`    a stroke across bandit ${S.k + 1} at ${Math.round(x)}, ${Math.round(y)}`);
}
window.__film = (t) => {
  switch (S.beat) {
    case 'walk': if (!steer(stop, 0.3)) { keys(false, false, false, false); go('he stops; the three ahead', t); } break;
    case 'he stops; the three ahead':
      if (t - S.at > 0.45) { const m = three.reduce((a, b) => a.add(b.root.position), new T.Vector3()).divideScalar(3), p = G.ronin.root.position;
        G.facing = Math.atan2(m.x - p.x, m.z - p.z); B.S.ink = Math.max(B.S.ink, 3); B.open(G.me); go('the brush opens', t); } break;
    case 'the brush opens': if (t - S.at > 0.35) go('three strokes, three marks', t); break;
    case 'three strokes, three marks':
      if (S.wait > 0) { S.wait--; break; }
      if (!S.drag) { if (S.k < 3) strokeStart(three[S.k]); break; }
      if (S.drag.n < 6) { window.dispatchEvent(new MouseEvent('mousemove', { movementX: 25, movementY: -12.7 })); S.drag.n++; break; }
      window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })); S.drag = null; S.k++; S.wait = 4;
      S.log.push(`    marks now ${B.marks.count}, ink ${B.S.ink.toFixed(2)}`);
      if (S.k >= 3) go('the ink spent: the chain', t); break;
    case 'the ink spent: the chain': {
      const ch = G.chainOf(); if (ch) S.began = true;
      if (ch && ch.log.length !== S.seen) { S.seen = ch.log.length; const e = ch.log[ch.log.length - 1]; S.log.push(`${t.toFixed(2)}   ${e.kind} ${e.k !== undefined ? e.k + 1 : ''}${e.dead !== undefined ? (e.dead ? ' (falls)' : ' (STANDS)') : ''}`); }
      if (S.began && !ch) go('time returns', t);
      if (!S.began && t - S.at > 2) { S.log.push('    NO CHAIN (marks ' + B.marks.count + ', brush ' + (B.active ? 'open' : 'closed') + ')'); go('time returns', t); }
      break; }
    case 'time returns': if (t - S.at > 2.2) go('done', t); break;
  }
};
