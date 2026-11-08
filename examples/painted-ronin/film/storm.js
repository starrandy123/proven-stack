// 嵐: three bandits close in, the storm cuts all around him, ink rings hang in the air.
const G = window.__GAME, c = G.land.spots.camps[1];
const x = c.x + 6, z = c.y; G.player.setPosition(x, G.land.groundY(x, z) + 0.3, z);
G.cam.yaw = 0.9; G.cam.pitch = 0.26; G.cam.dist = 6.0;
let done = {};
window.__film = (t) => {
  const once = (k, at, f) => { if (t >= at && !done[k]) { done[k] = 1; f(); } };
  once('s', 2.4, () => { G.pc.ki = 100; G.stormSpecial(); });
  G.cam.yaw += 0.002; G.pc.invuln = 1; G.pc.hp = 100;
};
