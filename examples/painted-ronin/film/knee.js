// The receipt: one bandit cut down, filmed from the side at his legs. Run with ?test (one bandit a camp) and ?test&plant=knee.
const G = window.__GAME, T = G.THREE, b = G.bandits.list[0], p = b.root.position.clone();
const x = p.x + 30, z = p.z + 30; G.player.setPosition(x, G.land.groundY(x, z) + 0.3, z);   // the ronin far away: the bandit stays idle
b.facing = 0; b.root.rotation.y = 0;
G.cam.hold = true; G.cam.target.set(p.x, p.y + 0.7, p.z); G.cam.yaw = -Math.PI / 2; G.cam.pitch = 0.1; G.cam.dist = 3.2;
let done = false;
window.__film = (t) => {
  if (t >= 0.6 && !done) { done = true; G.bandits.kill(b, new T.Vector3(0, 0, 1), 0.05); }   // a collapse: no shove, the legs buckle under the weight
  const q = new T.Vector3(); b.bones.pelvis.getWorldPosition(q);            // follow the body down
  G.cam.target.lerp(new T.Vector3(q.x, Math.max(q.y, p.y + 0.35) + 0.2, q.z), 0.12);
};
