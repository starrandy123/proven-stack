// A CAMP HUNTS HIM DOWN (the script's line 9: "Bandit camps that hunt you down"): the ronin stands in the field, a camp's bandits see him
// and come for him through Recast & Detour's crowd (wall W3), the camera low behind his shoulder so they run at the lens; when the first
// is a dash away he meets him with the dash attack. Staging: the camp is told he is there (engage) a moment in, as its alert would.
const G = window.__GAME, c = G.land.spots.camps[1];
const p0 = { x: c.x + 20, z: c.y + 4 }; G.player.setPosition(p0.x, G.land.groundY(p0.x, p0.z) + 0.3, p0.z);
const f = Math.atan2(c.x - p0.x, c.y - p0.z); G.facing = f; G.pc.invuln = 99;
G.cam.yaw = f + Math.PI - 0.45; G.cam.pitch = 0.07; G.cam.dist = 3.6;
const camp = G.bandits.list.filter((b) => b.nav === G.navs[1]);
const log = []; window.__filmLog = log;
{ const H = G.bandits.hit.bind(G.bandits); G.bandits.hit = (b, d, p, o) => { const r = H(b, d, p, o); log.push(`${(window.__filmT || 0).toFixed(2)} bandit ${G.bandits.list.indexOf(b)}: ${r}`); return r; }; }
let told = false, struck = 0;
window.__film = (t) => {
  G.pc.hp = Math.max(G.pc.hp, 60); G.facing = struck ? G.facing : f;
  if (!told && t >= 0.3) { told = true; for (const b of camp) if (!b.dead) G.bandits.setState(b, 'engage'); log.push(`${t.toFixed(2)} the camp comes`); }
  let near = 1e9; for (const b of camp) if (!b.dead) near = Math.min(near, b.root.position.distanceTo(G.ronin.root.position));
  if (!struck && told && near < 5.5) { struck = 1; G.strike(0); log.push(`${t.toFixed(2)} the dash (nearest ${near.toFixed(1)} m)`); }
  if (struck === 1 && G.pc.strike && G.pc.strike.t > G.pc.strike.impact + 0.02) { struck = 2; G.pc.queued = true; }
};
