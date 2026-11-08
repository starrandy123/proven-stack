// The leap, side-on: a bandit 7 m off holds by his camp; the lock takes him and the ronin leaps — low, upright, a lunge's stride, the
// sword overhead — and lands on the cut (kendo's tobikomi-men). A held camera square to the line of the leap.
const G = window.__GAME, T = G.THREE, c = G.land.spots.camps[0];
const camp = G.bandits.list.filter((b) => b.nav === G.navs[0]);
const put = (b, x, z) => { const { point } = b.nav.query.findClosestPoint({ x, y: G.land.groundY(x, z), z }); b.agent.teleport(point); b.state = 'hold'; b.agent.resetMoveTarget(); };
const x0 = c.x + 12, z0 = c.y - 6; G.player.setPosition(x0, G.land.groundY(x0, z0) + 0.3, z0);
camp.forEach((b) => put(b, c.x - 10, c.y + 10)); put(camp[0], x0 - 7.5, z0);
G.facing = Math.atan2(-1, 0); G.pc.invuln = 99;
G.cam.hold = true; G.cam.target.set(x0 - 3.8, G.land.groundY(x0 - 3.8, z0) + 1.0, z0); G.cam.yaw = 0; G.cam.pitch = 0.05; G.cam.dist = 7.5;
let done = false;
window.__film = (t) => { G.facing = done ? G.facing : Math.atan2(-1, 0); if (!done && t >= 0.5) { done = true; G.strike(0); } G.pc.hp = 100; };
