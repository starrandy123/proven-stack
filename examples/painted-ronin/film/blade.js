// 筆 THE BRUSH, the take for his reel (9 Nov: "make it look cool and cinematic and allow the players to walk around the scene then slash
// and make it in the game aesthetic"). One continuous shot on the held clock, 16:9: the ronin walks up to a straw mat on its stand; the brush
// opens (the valley holds, it becomes an ink painting, the camera comes in over his right shoulder); the line turns to a kesa diagonal as a
// player's drag would turn it; the cut; a beat of stillness with the top resting on its own face and the straw in the air; time returns
// and the top slides off its face and falls (Jolt); he walks on to the green stalks, opens the brush again and cuts three times inside one
// held moment, alternating sides as a tameshigiri sequence does (Toyama-ryu: "from migi (right) to hidari (left)", "within one second").
// Staging, said plainly: his walk is the game's own (the W key, the follow camera); the line's angle and the brush's tip are set by the
// shot as the locked mouse would set them (blade.js reads the same two values from a drag); everything else is the game: its brush, its
// clock, its cuts, its physics, its camera. Each beat waits for the game's own state, never a guessed time.
const G = window.__GAME, T = G.THREE, B = G.brush, K = window.__keys;
const S = { beat: 'walk', at: 0, log: [] }; window.__filmLog = S.log;
const go = (beat, t) => { S.beat = beat; S.at = t; S.log.push(`${t.toFixed(2)} — ${beat}`); };
const center = (x) => new T.Box3().setFromObject(x.mesh).getCenter(new T.Vector3());
const whole = (i) => B.pieces.find((q) => q.stand === B.stands[i] && q.whole);
const mat = whole(1), matC = center(mat);
// start 4.2 m back from the middle mat, on the line from the spawn; the follow camera behind him, a little to his right
const back = new T.Vector3(G.camera.position.x - matC.x, 0, G.camera.position.z - matC.z).normalize(), p0 = matC.clone().addScaledVector(back, 4.2);
G.player.setPosition(p0.x, G.land.groundY(p0.x, p0.z) + 0.05, p0.z); G.facing = Math.atan2(-back.x, -back.z);
G.cam.yaw = Math.atan2(back.x, back.z); G.cam.pitch = 0.24; G.cam.dist = 5.2;
const tipAt = (p) => { const q = p.clone().project(G.camera); G.input.setCursor((q.x + 1) / 2 * innerWidth, (1 - q.y) / 2 * innerHeight); };
const cut = (theta) => { B.S.theta = theta; const ok = B.release(G.me); S.log.push(`    release at ${theta.toFixed(2)} rad: ${ok ? 'the swing' : 'REFUSED'}`); };
let stalkPos = null, way = null, n0 = 0;
// a player's walk: W/A/S/D pressed toward the goal as the camera sees it, re-aimed every frame; the follow camera swings round behind him
const keys = (w, s2, a, d) => { K('KeyW', w); K('KeyS', s2); K('KeyA', a); K('KeyD', d); };
function steer(goal, stop) {
  const me = G.ronin.root.position, to = new T.Vector3(goal.x - me.x, 0, goal.z - me.z), d = to.length(), u = to.clone().normalize();
  const f = new T.Vector3(-Math.sin(G.cam.yaw), 0, -Math.cos(G.cam.yaw)), r = new T.Vector3(-f.z, 0, f.x), fw = u.dot(f), rt = u.dot(r), go = d > stop;
  keys(go && fw > 0.38, go && fw < -0.38, go && rt < -0.38, go && rt > 0.38);
  const yaw = Math.atan2(-u.x, -u.z), dy = Math.atan2(Math.sin(yaw - G.cam.yaw), Math.cos(yaw - G.cam.yaw)); if (go) G.cam.yaw += dy * 0.08;
  return go ? d : 0;
}
window.__film = (t) => {
  const me = G.ronin.root.position;
  switch (S.beat) {
    case 'walk':                                                              // the game's own walk toward the mat, stopping at reach
      if (!steer(matC, 1.12)) go('settle', t); break;
    case 'settle': if (t - S.at > 0.45) { tipAt(new T.Vector3(matC.x, matC.y + 0.08, matC.z)); B.open(G.me); B.S.theta = -0.2; go('the brush opens', t); } break;
    case 'the brush opens': if (t - S.at > 0.55) go('the line turns', t); break;
    case 'the line turns': {                                                  // a player's drag: the line swung from 0.2 to the kesa diagonal
      // a rising cut, gyaku-kesa: its face tips AWAY from him, so the top slides off in the camera's sight (a '/' cut's top slid behind him)
      const k = Math.min(1, (t - S.at) / 0.9), e = k * k * (3 - 2 * k); B.S.theta = -0.2 + (-0.66 + 0.2) * e;
      if (k >= 1 && t - S.at > 1.05) { n0 = B.events.length; cut(-0.66); go('the cut', t); } break; }
    case 'the cut': if (B.events.slice(n0).some((e) => e.kind === 'contact')) { S.log.push('    the contact: ' + B.events.slice(n0).filter((e) => e.kind === 'slice').length + ' slice(s)'); go('stillness', t); } break;
    case 'stillness': if (t - S.at > 0.95) { B.close(); go('time returns: the top slides off its face', t); } break;
    case 'time returns: the top slides off its face':
      { const top = B.pieces.find((q) => q.dynamic && q.stand === B.stands[1]); if (top && Math.round(t * 30) % 6 === 0) { const c = center(top); S.log.push(`${t.toFixed(2)}   the top at ${(c.x - matC.x).toFixed(2)}, ${(c.y - matC.y).toFixed(2)}, ${(c.z - matC.z).toFixed(2)} from the mat's middle`); } }
      if (t - S.at > 1.7) { const s = whole(3) || B.pieces.find((q) => q.stand === B.stands[3]); stalkPos = center(s); way = stalkPos.clone().addScaledVector(back, 1.7); go('walk to the stalks', t); } break;
    case 'walk to the stalks':                                               // out along the front of the stands (never through one), then in
      if (way) { if (!steer(way, 0.45)) { way = null; S.log.push(`${t.toFixed(2)}   past the stands, turning in to the stalks`); } }
      else if (!steer(stalkPos, 1.0)) go('settle 2', t);
      break;
    case 'settle 2': if (t - S.at > 0.4) { tipAt(new T.Vector3(stalkPos.x, me.y + 1.25, stalkPos.z)); B.S.ink = Math.max(B.S.ink, 3); B.open(G.me); B.S.theta = 0.6; go('three cuts in one held moment', t); } break;
    case 'three cuts in one held moment': {                                   // right to left, left to right, level: inside one second
      const k = t - S.at;
      if (k > 0.5 && !S.c1) { S.c1 = true; tipAt(new T.Vector3(stalkPos.x, me.y + 1.45, stalkPos.z)); cut(0.6); }
      if (k > 0.85 && !S.c2) { S.c2 = true; tipAt(new T.Vector3(stalkPos.x, me.y + 1.1, stalkPos.z)); cut(-0.55); }
      if (k > 1.2 && !S.c3) { S.c3 = true; tipAt(new T.Vector3(stalkPos.x, me.y + 0.75, stalkPos.z)); cut(0.08); }
      if (k > 2.1) { B.close(); go('the return', t); } break; }
    case 'the return': if (t - S.at > 2.0) go('done', t); break;
  }
};
